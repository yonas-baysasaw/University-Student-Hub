import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ClassroomScheduleEditor from '../components/ClassroomScheduleEditor';
import { useAuth } from '../contexts/AuthContext';
import { canManageClassroom } from '../utils/classroom';
import { readJsonOrThrow } from '../utils/http';

function ClassRoom() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [classroomName, setClassroomName] = useState('');
  const [classroomCode, setClassroomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const fetchChats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/chats', { credentials: 'include' });
      const result = await readJsonOrThrow(
        response,
        'Unable to load classrooms',
      );
      setData(result);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const handleCreateClass = async () => {
    const trimmedName = classroomName.trim();
    if (!trimmedName) {
      setCreateError('Classroom name is required.');
      return;
    }

    setCreateError('');
    setIsCreating(true);
    try {
      const payload = {
        name: trimmedName,
        ...(classroomCode.trim() ? { code: classroomCode.trim() } : {}),
      };

      const response = await fetch('/api/chats', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await readJsonOrThrow(response, 'Unable to create classroom');

      setShowCreateModal(false);
      setClassroomName('');
      setClassroomCode('');
      await fetchChats();
    } catch (submitError) {
      setCreateError(submitError.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinClass = async () => {
    const trimmedCode = joinCode.trim();
    if (!trimmedCode) {
      setJoinError('Invitation code is required.');
      return;
    }

    setJoinError('');
    setIsJoining(true);
    try {
      const response = await fetch('/api/chats/join', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationCode: trimmedCode }),
      });
      await readJsonOrThrow(response, 'Unable to join classroom');

      setShowJoinModal(false);
      setJoinCode('');
      await fetchChats();
    } catch (submitError) {
      setJoinError(submitError.message);
    } finally {
      setIsJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="page-surface flex items-center justify-center px-4 py-8">
        <div className="panel-card w-full max-w-6xl rounded-3xl p-6">
          <p className="text-sm text-slate-600">Loading classrooms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-surface flex items-center justify-center px-4 py-8">
        <div className="panel-card w-full max-w-6xl rounded-3xl p-6">
          <p className="text-sm text-rose-600">Error: {error}</p>
          <button
            type="button"
            onClick={fetchChats}
            className="btn-primary mt-4 px-5 py-2 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const classrooms = data?.chats ?? [];

  return (
    <div className="page-surface px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="panel-card rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-slate-900 sm:text-3xl">
              Course Classrooms
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="btn-primary px-5 py-2 text-sm"
              >
                Create class
              </button>
              <button
                type="button"
                onClick={() => setShowJoinModal(true)}
                className="btn-secondary px-5 py-2 text-sm"
              >
                Join class
              </button>
            </div>
          </div>

          {classrooms.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No classrooms yet. Create one for your course or join with an
              invitation code.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {classrooms.map((classroom) => (
                <article
                  key={classroom._id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25"
                >
                  <h3 className="font-display text-xl text-slate-900 dark:text-slate-50">
                    {classroom.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Code:{' '}
                    <span className="break-all font-mono">
                      {classroom.invitationCode}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Members: {classroom.members?.length ?? 0}
                  </p>
                  <Link
                    to={`/classroom/${classroom._id}`}
                    className="btn-primary mt-4 inline-flex w-full justify-center px-4 py-2 text-sm"
                  >
                    Enter classroom
                  </Link>
                  {canManageClassroom(user, classroom) ? (
                    <ClassroomScheduleEditor
                      chatId={String(classroom._id)}
                      initialSlots={classroom.metadata?.classSchedule?.slots}
                      onSaved={fetchChats}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-cyan-100 bg-white p-6 shadow-xl">
            <h3 className="font-display text-2xl text-slate-900">
              Create classroom
            </h3>
            {createError && (
              <p className="mt-2 text-sm text-rose-600">{createError}</p>
            )}
            <input
              type="text"
              placeholder="Course / Classroom name"
              value={classroomName}
              onChange={(e) => setClassroomName(e.target.value)}
              className="input-field mt-4 text-sm"
            />
            <input
              type="text"
              placeholder="Custom code (optional)"
              value={classroomCode}
              onChange={(e) => setClassroomCode(e.target.value)}
              className="input-field mt-3 text-sm"
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleCreateClass}
                disabled={isCreating}
                className="btn-primary flex-1 px-4 py-2 text-sm disabled:opacity-60"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary flex-1 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-cyan-100 bg-white p-6 shadow-xl">
            <h3 className="font-display text-2xl text-slate-900">
              Join classroom
            </h3>
            {joinError && (
              <p className="mt-2 text-sm text-rose-600">{joinError}</p>
            )}
            <input
              type="text"
              placeholder="Invitation code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="input-field mt-4 text-sm"
            />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleJoinClass}
                disabled={isJoining}
                className="btn-primary flex-1 px-4 py-2 text-sm disabled:opacity-60"
              >
                {isJoining ? 'Joining...' : 'Join'}
              </button>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="btn-secondary flex-1 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassRoom;
