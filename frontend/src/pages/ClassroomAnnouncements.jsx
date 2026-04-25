import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ClassroomTabs from '../components/ClassroomTabs';
import { useAuth } from '../contexts/AuthContext';
import { fetchClassroomMeta, isInstructor } from '../utils/classroom';

function ClassroomAnnouncementsContent({ chatId, user }) {
  const [chatName, setChatName] = useState('Class Announcements');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [announcements, setAnnouncements] = useState(() => {
    const key = `ush_announcements_${chatId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (error) {
      console.error('Failed to load announcements', error);
    }
    return [];
  });
  const instructor = useMemo(() => isInstructor(user), [user]);

  useEffect(() => {
    if (!chatId) return;
    localStorage.setItem(
      `ush_announcements_${chatId}`,
      JSON.stringify(announcements),
    );
  }, [announcements, chatId]);

  useEffect(() => {
    if (!chatId) return;
    const controller = new AbortController();
    const loadMeta = async () => {
      try {
        const chat = await fetchClassroomMeta(chatId, controller.signal);
        setChatName(chat?.name ?? 'Class Announcements');
      } catch (error) {
        if (error.name !== 'AbortError') setChatName('Class Announcements');
      }
    };
    loadMeta();
    return () => controller.abort();
  }, [chatId]);

  const submitAnnouncement = (event) => {
    event.preventDefault();
    if (!instructor) return;
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) return;

    const author = user?.displayName ?? user?.username ?? 'Instructor';
    setAnnouncements((prev) => [
      {
        id: `${Date.now()}`,
        title: trimmedTitle,
        body: trimmedBody,
        author,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setTitle('');
    setBody('');
  };

  return (
    <div className="page-surface flex justify-center px-4 py-8">
      <div className="panel-card w-full max-w-6xl rounded-3xl p-4 sm:p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-slate-900 sm:text-3xl">
              {chatName}
            </h2>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              Class announcements
            </p>
          </div>
          <Link
            to="/classroom"
            className="btn-secondary px-4 py-2 text-xs uppercase tracking-wide"
          >
            View classrooms
          </Link>
        </div>

        <ClassroomTabs />

        <div>
          <div>
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="font-display text-xl text-slate-900">
                Post announcement
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {instructor
                  ? 'Only instructors can publish announcements to this classroom.'
                  : 'Announcements are posted by the instructor only.'}
              </p>
              <form onSubmit={submitAnnouncement} className="mt-4 space-y-2">
                <input
                  type="text"
                  placeholder="Announcement title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field text-sm"
                  disabled={!instructor}
                />
                <textarea
                  placeholder="Announcement details"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  rows={4}
                  disabled={!instructor}
                />
                <button
                  type="submit"
                  disabled={!instructor}
                  className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
                >
                  Publish
                </button>
              </form>
            </section>

            <section className="mt-4 space-y-3">
              {announcements.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                  No announcements yet.
                </p>
              ) : (
                announcements.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-display text-xl text-slate-900">
                        {item.title}
                      </h4>
                      <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{item.body}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Posted by {item.author}
                    </p>
                  </article>
                ))
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClassroomAnnouncements() {
  const { chatId } = useParams();
  const { user } = useAuth();

  if (!chatId) {
    return (
      <div className="page-surface flex justify-center px-4 py-8">
        <div className="panel-card w-full max-w-6xl rounded-3xl p-8">
          <p className="text-rose-600">Classroom not found.</p>
          <Link
            to="/classroom"
            className="mt-3 inline-block text-sm font-semibold text-cyan-700 underline"
          >
            &larr; Back to classrooms
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ClassroomAnnouncementsContent key={chatId} chatId={chatId} user={user} />
  );
}

export default ClassroomAnnouncements;
