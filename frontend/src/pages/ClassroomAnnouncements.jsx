import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ClassroomTabs from '../components/ClassroomTabs';
import { fetchClassroomMeta } from '../utils/classroom';
import { readJsonOrThrow } from '../utils/http';

function ClassroomAnnouncementsContent({ chatId }) {
  const [chatName, setChatName] = useState('Class Announcements');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/announcements`,
        {
          credentials: 'include',
        },
      );
      const data = await readJsonOrThrow(res, 'Failed to load announcements');
      setAnnouncements(
        Array.isArray(data.announcements) ? data.announcements : [],
      );
      setCanManage(Boolean(data.canManage));
    } catch (e) {
      setLoadError(e?.message || 'Failed to load announcements');
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    load();
  }, [load]);

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

  const submitAnnouncement = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) return;

    setSaving(true);
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/announcements`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmedTitle, body: trimmedBody }),
        },
      );
      const data = await readJsonOrThrow(res, 'Failed to publish');
      if (data.announcement) {
        setAnnouncements((prev) => [data.announcement, ...prev]);
      } else {
        await load();
      }
      setTitle('');
      setBody('');
    } catch (e) {
      setLoadError(e?.message || 'Could not publish announcement');
    } finally {
      setSaving(false);
    }
  };

  const deleteOne = async (id) => {
    if (!canManage) return;
    if (!window.confirm('Delete this announcement?')) return;
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/announcements/${encodeURIComponent(id)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      await readJsonOrThrow(res, 'Failed to delete');
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setLoadError(e?.message || 'Delete failed');
    }
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

        {loadError ? (
          <p className="mb-3 text-sm text-rose-600" role="alert">
            {loadError}
          </p>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="font-display text-xl text-slate-900">
            Post announcement
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {canManage
              ? 'You can publish announcements to this classroom.'
              : 'Only classroom admins (creator and admins) can publish announcements.'}
          </p>
          <form onSubmit={submitAnnouncement} className="mt-4 space-y-2">
            <input
              type="text"
              placeholder="Announcement title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field text-sm"
              disabled={!canManage || saving}
            />
            <textarea
              placeholder="Announcement details"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
              rows={4}
              disabled={!canManage || saving}
            />
            <button
              type="submit"
              disabled={!canManage || saving}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
            >
              {saving ? 'Publishing…' : 'Publish'}
            </button>
          </form>
        </section>

        <section className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading announcements…</p>
          ) : announcements.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              No announcements yet.
            </p>
          ) : (
            announcements.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-display text-xl text-slate-900">
                      {item.title}
                    </h4>
                    <span className="mt-1 inline-block rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => deleteOne(item.id)}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Delete
                    </button>
                  ) : null}
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
  );
}

function ClassroomAnnouncements() {
  const { chatId } = useParams();

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

  return <ClassroomAnnouncementsContent key={chatId} chatId={chatId} />;
}

export default ClassroomAnnouncements;
