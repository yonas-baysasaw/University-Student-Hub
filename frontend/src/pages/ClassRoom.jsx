import {
  ArrowRight,
  BookOpen,
  Copy,
  GraduationCap,
  Archive as ArchiveIcon,
  Sparkles,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import ClassroomCardMenu from '../components/ClassroomCardMenu.jsx';
import ClassroomScheduleEditor from '../components/ClassroomScheduleEditor';
import { CLASSROOM_LIST_CHANGED_EVENT } from '../constants/dashboardEvents.js';
import { useAuth } from '../contexts/AuthContext';
import {
  canManageClassroom,
  getMemberName,
  isClassroomMember,
} from '../utils/classroom';
import { readJsonOrThrow } from '../utils/http';

function notifyClassroomsChanged() {
  window.dispatchEvent(new CustomEvent(CLASSROOM_LIST_CHANGED_EVENT));
}

async function copyInvitationCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    toast.success('Invitation code copied to clipboard.');
  } catch {
    toast.error(
      'Could not copy automatically — select the code and copy manually.',
    );
  }
}

function ClassRoom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  const [scheduleForId, setScheduleForId] = useState(null);
  const [editClassroom, setEditClassroom] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [archiveBusyId, setArchiveBusyId] = useState(null);

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

  useEffect(() => {
    const raw =
      searchParams.get('invite')?.trim() ||
      searchParams.get('code')?.trim();
    if (!raw) return;
    setJoinCode(raw);
    setShowJoinModal(true);
    const next = new URLSearchParams(searchParams);
    next.delete('invite');
    next.delete('code');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (editClassroom) setEditName(editClassroom.name);
  }, [editClassroom]);

  const classrooms = data?.chats ?? [];

  const activeRooms = useMemo(
    () => classrooms.filter((c) => !c.metadata?.archived),
    [classrooms],
  );

  const archivedRooms = useMemo(
    () => classrooms.filter((c) => Boolean(c.metadata?.archived)),
    [classrooms],
  );

  const scheduleClassroom = useMemo(
    () => classrooms.find((c) => String(c._id) === scheduleForId),
    [classrooms, scheduleForId],
  );

  const totalMembers = activeRooms.reduce(
    (acc, c) => acc + (c.members?.length ?? 0),
    0,
  );

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
      toast.success('Classroom created — invite classmates with the code.');
      await fetchChats();
      notifyClassroomsChanged();
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
      const joinedChat = await readJsonOrThrow(
        response,
        'Unable to join classroom',
      );

      setShowJoinModal(false);
      setJoinCode('');
      toast.success('You joined the classroom.');
      await fetchChats();
      notifyClassroomsChanged();
      const joinedId = joinedChat?._id ?? joinedChat?.id;
      if (joinedId) {
        navigate(`/classroom/${joinedId}`, { replace: true });
      }
    } catch (submitError) {
      setJoinError(submitError.message);
    } finally {
      setIsJoining(false);
    }
  };

  const patchClassroom = async (chatId, body) => {
    const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await readJsonOrThrow(res, 'Could not update classroom');
  };

  const submitEditName = async () => {
    if (!editClassroom) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty.');
      return;
    }
    setEditSaving(true);
    try {
      await patchClassroom(editClassroom.id, { name: trimmed });
      toast.success('Classroom updated.');
      setEditClassroom(null);
      await fetchChats();
      notifyClassroomsChanged();
    } catch (e) {
      toast.error(e?.message || 'Could not update.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleArchiveToggle = async (classroom) => {
    const id = String(classroom._id);
    const next = !classroom.metadata?.archived;
    setArchiveBusyId(id);
    try {
      await patchClassroom(id, { archived: next });
      toast.success(next ? 'Classroom archived.' : 'Classroom restored.');
      await fetchChats();
      notifyClassroomsChanged();
      if (scheduleForId === id) setScheduleForId(null);
    } catch (e) {
      toast.error(e?.message || 'Could not update.');
    } finally {
      setArchiveBusyId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(deleteConfirmId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      await readJsonOrThrow(res, 'Could not delete classroom');
      toast.success('Classroom deleted.');
      setDeleteConfirmId(null);
      if (scheduleForId === deleteConfirmId) setScheduleForId(null);
      await fetchChats();
      notifyClassroomsChanged();
    } catch (e) {
      toast.error(e?.message || 'Could not delete.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const renderClassroomCard = (classroom, index) => {
    const id = String(classroom._id);
    const archived = Boolean(classroom.metadata?.archived);
    const manage = canManageClassroom(user, classroom);
    const member = isClassroomMember(user, classroom);
    const canSchedule = manage || member;

    return (
      <article
        key={id}
        style={{
          animationDelay: `${Math.min(index * 55, 420)}ms`,
        }}
        className="classroom-card-lift fade-in-up group relative overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/95 p-5 pt-4 shadow-md dark:border-slate-700/85 dark:from-slate-900 dark:to-slate-950/95"
      >
        <div className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-cyan-400/10 blur-2xl transition-opacity group-hover:opacity-100 dark:bg-cyan-500/15" />

        <div className="relative flex items-start gap-2">
          <h3 className="min-w-0 flex-1 font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {classroom.name}
          </h3>
          <ClassroomCardMenu
            classroomId={id}
            classroomName={classroom.name}
            invitationCode={classroom.invitationCode}
            archived={archived}
            canManage={manage}
            canSchedule={canSchedule}
            onSchedule={() => setScheduleForId(id)}
            onEdit={() =>
              setEditClassroom({ id, name: classroom.name })
            }
            onArchiveToggle={() => handleArchiveToggle(classroom)}
            onDelete={() => setDeleteConfirmId(id)}
          />
        </div>

        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              archived
                ? 'bg-slate-500/90 text-white dark:bg-slate-700'
                : 'bg-emerald-600/90 text-white dark:bg-emerald-800'
            }`}
          >
            {archived ? 'Archived' : 'Active'}
          </span>
          {archiveBusyId === id ? (
            <span className="text-[11px] font-medium text-slate-500">
              Updating…
            </span>
          ) : null}
        </div>

        {classroom.creator ? (
          <p className="relative mt-3 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-500 dark:text-slate-500">
              Instructor:
            </span>{' '}
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {getMemberName(classroom.creator)}
            </span>
          </p>
        ) : null}

        <div className="relative mt-4 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950/40">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Invite code
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-cyan-900 dark:text-cyan-100">
              {classroom.invitationCode}
            </code>
            <button
              type="button"
              onClick={() => copyInvitationCode(classroom.invitationCode)}
              aria-label="Copy invitation code"
              title="Copy code"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-cyan-900 transition hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-100 dark:hover:bg-cyan-900/60"
            >
              <Copy className="h-3 w-3" aria-hidden />
              Copy
            </button>
          </div>
        </div>

        <p className="relative mt-3 flex min-w-0 items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" aria-hidden />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {classroom.members?.length ?? 0}
          </span>{' '}
          {classroom.members?.length === 1 ? 'member' : 'members'}
        </p>

        <Link
          to={`/classroom/${id}`}
          className="relative mt-5 inline-flex w-full whitespace-nowrap items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/25 ring-1 ring-white/10 transition hover:brightness-110 dark:from-cyan-700 dark:to-cyan-900"
          aria-label={`Open classroom: ${classroom.name}`}
        >
          Open classroom
          <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        </Link>
      </article>
    );
  };

  if (loading) {
    return (
      <div className="classroom-ambient relative page-surface px-4 py-10 md:px-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[min(280px,36vh)] workspace-hero-mesh opacity-80 dark:opacity-50" />
        <div className="relative z-[2] mx-auto max-w-6xl">
          <div className="panel-card rounded-3xl p-8">
            <div className="flex flex-col items-center gap-4">
              <div className="h-3 w-48 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-64 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Loading your classrooms…
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="classroom-ambient relative page-surface px-4 py-10 md:px-6">
        <div className="relative z-[2] mx-auto max-w-6xl">
          <div className="panel-card rounded-3xl p-8">
            <p className="text-sm font-medium text-rose-600">{error}</p>
            <button
              type="button"
              onClick={fetchChats}
              className="btn-primary mt-4 px-5 py-2 text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="classroom-ambient relative page-surface min-h-[calc(100vh-5.5rem)] px-4 pb-14 pt-6 text-slate-900 md:px-6 md:pt-8 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[min(320px,42vh)] workspace-hero-mesh opacity-90 dark:opacity-60" />

      <div className="relative z-[2] mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/15 text-cyan-700 shadow-lg shadow-cyan-900/10 ring-1 ring-cyan-500/25 dark:from-cyan-400/15 dark:to-indigo-400/10 dark:text-cyan-300 dark:ring-cyan-400/30">
              <GraduationCap className="h-8 w-8" strokeWidth={1.6} aria-hidden />
            </span>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/90 px-3 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-700 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800/90 dark:text-cyan-300 dark:ring-slate-600">
                  Collaboration
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {activeRooms.length}{' '}
                  {activeRooms.length === 1 ? 'active space' : 'active spaces'}{' '}
                  · {totalMembers} seats
                  {archivedRooms.length > 0
                    ? ` · ${archivedRooms.length} archived`
                    : ''}
                </span>
              </div>
              <h1 className="font-display text-balance text-3xl font-bold tracking-tight md:text-4xl">
                Course classrooms
              </h1>
            </div>
          </div>

          <div className="flex flex-shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm shadow-lg shadow-cyan-900/15 max-md:px-3 max-md:py-2 max-md:text-xs"
            >
              <Sparkles className="h-4 w-4 shrink-0 opacity-90 max-md:h-3.5 max-md:w-3.5" aria-hidden />
              Create classroom
            </button>
            <button
              type="button"
              onClick={() => setShowJoinModal(true)}
              className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold max-md:px-3 max-md:py-2 max-md:text-xs"
            >
              Join with code
              <ArrowRight className="h-4 w-4 shrink-0 opacity-80 max-md:h-3.5 max-md:w-3.5" aria-hidden />
            </button>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200/90 bg-white/80 p-5 shadow-xl shadow-slate-900/[0.06] backdrop-blur-md dark:border-slate-700/90 dark:bg-slate-900/55 md:p-7">
          <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 pb-5 dark:border-slate-700/80">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-md dark:from-cyan-800 dark:to-slate-900">
              <BookOpen className="h-5 w-5 opacity-95" aria-hidden />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Your spaces
              </h2>
            </div>
          </div>

          {classrooms.length === 0 ? (
            <div className="relative mt-8 overflow-hidden rounded-2xl border border-dashed border-cyan-300/60 bg-gradient-to-br from-cyan-50/90 via-white to-indigo-50/40 px-6 py-14 text-center dark:border-cyan-800/40 dark:from-slate-900/90 dark:via-slate-900 dark:to-slate-950/95">
              <div className="pointer-events-none absolute -left-16 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-500/10" />
              <Users className="relative mx-auto h-12 w-12 text-cyan-600 opacity-90 dark:text-cyan-400" aria-hidden />
              <p className="relative mx-auto mt-4 max-w-md text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                No classrooms yet. Spin one up for your cohort or paste an invite
                code—your dashboard summary will pick up weekly slots automatically.
              </p>
              <div className="relative mt-6 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary px-5 py-2.5 text-sm"
                >
                  Create your first classroom
                </button>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(true)}
                  className="btn-secondary px-5 py-2.5 text-sm font-semibold"
                >
                  I have a code
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-7 space-y-10">
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Active
                </h3>
                {activeRooms.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
                    No active classrooms. Restore one from the archive below or
                    create a new space.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
                    {activeRooms.map((c, i) => renderClassroomCard(c, i))}
                  </div>
                )}
              </div>

              {archivedRooms.length > 0 ? (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40 md:p-5">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <ArchiveIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
                    <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                      Archived
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Hidden from dashboard summaries—restore anytime.
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
                    {archivedRooms.map((c, i) =>
                      renderClassroomCard(c, i + activeRooms.length),
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>

      {scheduleForId && scheduleClassroom ? (
        <ClassroomScheduleEditor
          key={scheduleForId}
          chatId={scheduleForId}
          initialSlots={scheduleClassroom.metadata?.classSchedule?.slots}
          onSaved={() => {
            fetchChats();
            notifyClassroomsChanged();
          }}
          canEdit={canManageClassroom(user, scheduleClassroom)}
          showTrigger={false}
          open
          onOpenChange={(open) => {
            if (!open) setScheduleForId(null);
          }}
        />
      ) : null}

      {editClassroom ? (
        <div
          className="fixed inset-0 z-[1002] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-md"
          role="presentation"
          onClick={() => setEditClassroom(null)}
          onKeyDown={(e) => e.key === 'Escape' && setEditClassroom(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-class-title"
            className="fade-in-up relative w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-7 shadow-[0_28px_80px_-24px_rgba(15,23,42,0.45)] dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="edit-class-title"
              className="font-display text-xl font-bold text-slate-900 dark:text-white"
            >
              Edit classroom name
            </h3>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input-field mt-4 text-sm"
              maxLength={120}
            />
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditClassroom(null)}
                className="btn-secondary px-5 py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={submitEditName}
                className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmId ? (
        <div
          className="fixed inset-0 z-[1002] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-md"
          role="presentation"
          onClick={() => !deleteBusy && setDeleteConfirmId(null)}
        >
          <div
            role="dialog"
            aria-labelledby="delete-class-title"
            className="relative w-full max-w-md rounded-3xl border border-rose-200/90 bg-white p-7 shadow-2xl dark:border-rose-900/40 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="delete-class-title"
              className="font-display text-xl font-bold text-rose-900 dark:text-rose-100"
            >
              Delete classroom?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              This removes discussion, announcements, resources, and messages for
              this space. This cannot be undone.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteConfirmId(null)}
                className="btn-secondary px-5 py-2.5 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={handleDeleteConfirm}
                className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-rose-700 disabled:opacity-60 dark:bg-rose-700 dark:hover:bg-rose-600"
              >
                {deleteBusy ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-950/55 px-4 py-4 backdrop-blur-md sm:items-center sm:py-8"
          role="presentation"
          onClick={() => setShowCreateModal(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowCreateModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-class-title"
            className="fade-in-up relative my-4 w-full max-h-[min(90dvh,40rem)] max-w-md overflow-y-auto rounded-3xl border border-cyan-100/90 bg-white p-5 shadow-[0_28px_80px_-24px_rgba(15,23,42,0.45)] dark:border-slate-600 dark:bg-slate-900 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/15 text-cyan-700 dark:text-cyan-300">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3
                  id="create-class-title"
                  className="font-display text-xl font-bold text-slate-900 sm:text-2xl dark:text-white"
                >
                  Create classroom
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Name it after your course—invite codes help classmates join fast.
                </p>
              </div>
            </div>
            {createError && (
              <p className="mb-3 text-sm font-medium text-rose-600">{createError}</p>
            )}
            <input
              type="text"
              placeholder="Course / classroom name"
              value={classroomName}
              onChange={(e) => setClassroomName(e.target.value)}
              className="input-field mt-2 text-sm"
            />
            <input
              type="text"
              placeholder="Custom invitation code (optional)"
              value={classroomCode}
              onChange={(e) => setClassroomCode(e.target.value)}
              className="input-field mt-3 text-sm"
            />
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary order-2 px-5 py-2.5 text-sm sm:order-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateClass}
                disabled={isCreating}
                className="btn-primary order-1 px-5 py-2.5 text-sm disabled:opacity-60 sm:order-2"
              >
                {isCreating ? 'Creating…' : 'Create classroom'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-950/55 px-4 py-4 backdrop-blur-md sm:items-center sm:py-8"
          role="presentation"
          onClick={() => setShowJoinModal(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowJoinModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-class-title"
            className="relative my-4 w-full max-h-[min(90dvh,40rem)] max-w-md overflow-y-auto rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_28px_80px_-24px_rgba(15,23,42,0.45)] dark:border-slate-600 dark:bg-slate-900 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-cyan-800">
                <Users className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3
                  id="join-class-title"
                  className="font-display text-xl font-bold text-slate-900 sm:text-2xl dark:text-white"
                >
                  Join with code
                </h3>
                <p className="mt-1 text-xs text-slate-600 sm:text-sm dark:text-slate-400">
                  Enter the invitation code from your instructor (invite links
                  open this screen with the code filled in — confirm and tap Join).
                </p>
              </div>
            </div>
            {joinError && (
              <p className="mb-3 text-sm font-medium text-rose-600">{joinError}</p>
            )}
            <input
              type="text"
              placeholder="Invitation code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="input-field text-sm"
              autoComplete="off"
            />
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="btn-secondary order-2 px-5 py-2.5 text-sm sm:order-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleJoinClass}
                disabled={isJoining}
                className="btn-primary order-1 px-5 py-2.5 text-sm disabled:opacity-60 sm:order-2"
              >
                {isJoining ? 'Joining…' : 'Join classroom'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassRoom;
