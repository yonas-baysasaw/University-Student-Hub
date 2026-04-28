import { Loader2, Megaphone, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ClassroomHero from '../components/ClassroomHero';
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
  const [query, setQuery] = useState('');

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

  const filteredAnnouncements = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return announcements;
    return announcements.filter(
      (a) =>
        String(a.title || '')
          .toLowerCase()
          .includes(q) ||
        String(a.body || '')
          .toLowerCase()
          .includes(q),
    );
  }, [announcements, query]);

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

  const headerActions = (
    <Link
      to="/classroom"
      className="btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wide"
    >
      All classrooms
    </Link>
  );

  const eyebrowMeta = (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <Megaphone className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" aria-hidden />
      Instructor updates
    </span>
  );

  return (
    <div className="classroom-ambient relative page-surface flex justify-center px-4 pb-14 pt-6 md:px-6 md:pt-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[min(260px,34vh)] workspace-hero-mesh opacity-85 dark:opacity-55" />

      <div className="relative z-[2] w-full max-w-6xl">
        <div className="panel-card rounded-3xl p-4 sm:p-5 md:p-7">
          <ClassroomHero
            title={chatName}
            eyebrow="Announcements"
            meta={eyebrowMeta}
            actions={headerActions}
          />

          <ClassroomTabs />

          {loadError ? (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100" role="alert">
              {loadError}
            </p>
          ) : null}

          <section className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-cyan-50/40 p-5 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950/95 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  Compose announcement
                </h3>
                <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
                  {canManage
                    ? 'Posts appear newest-first and can notify classmates by email when configured.'
                    : 'Only classroom admins (creator and admins) can publish announcements.'}
                </p>
              </div>
            </div>
            <form onSubmit={submitAnnouncement} className="mt-5 space-y-3">
              <input
                type="text"
                placeholder="Headline students will see first"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field text-sm"
                disabled={!canManage || saving}
              />
              <textarea
                placeholder="Details, deadlines, links—keep it scannable."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/95 p-3 text-sm leading-relaxed text-slate-800 shadow-inner focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
                rows={4}
                disabled={!canManage || saving}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="submit"
                  disabled={!canManage || saving}
                  className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50"
                >
                  {saving ? 'Publishing…' : 'Publish announcement'}
                </button>
              </div>
            </form>
          </section>

          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search announcements…"
              className="input-field h-11 border-slate-200/90 bg-white/90 pl-9 text-sm dark:border-slate-600 dark:bg-slate-950/70"
              aria-label="Search announcements"
            />
          </div>

          <section className="mt-5 space-y-4">
            {loading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-5 py-10 dark:border-slate-700 dark:bg-slate-900/40">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-600" aria-hidden />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Loading announcements…
                </p>
              </div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300/90 bg-white/80 px-6 py-14 text-center dark:border-slate-600 dark:bg-slate-900/50">
                <Megaphone className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
                <p className="mx-auto mt-3 max-w-md text-sm font-medium text-slate-600 dark:text-slate-400">
                  {announcements.length === 0
                    ? 'Nothing posted yet—publish when there is news worth broadcasting.'
                    : 'No announcements match your search.'}
                </p>
              </div>
            ) : (
              filteredAnnouncements.map((item, idx) => (
                <article
                  key={item.id}
                  style={{ animationDelay: `${Math.min(idx * 40, 320)}ms` }}
                  className="fade-in-up rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-cyan-200/90 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-cyan-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {item.title}
                      </h4>
                      <time
                        dateTime={item.createdAt}
                        className="mt-2 inline-flex rounded-full bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-cyan-900 ring-1 ring-cyan-200/70 dark:bg-cyan-950/60 dark:text-cyan-100 dark:ring-cyan-900"
                      >
                        {new Date(item.createdAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </time>
                    </div>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => deleteOne(item.id)}
                        className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-700 transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {item.body}
                  </p>
                  <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Posted by {item.author}
                  </p>
                </article>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ClassroomAnnouncements() {
  const { chatId } = useParams();

  if (!chatId) {
    return (
      <div className="classroom-ambient relative page-surface flex justify-center px-4 py-10">
        <div className="relative z-[2] w-full max-w-6xl">
          <div className="panel-card rounded-3xl p-8">
            <p className="font-medium text-rose-600">Classroom not found.</p>
            <Link
              to="/classroom"
              className="mt-4 inline-block text-sm font-semibold text-cyan-700 underline dark:text-cyan-400"
            >
              ← Back to classrooms
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <ClassroomAnnouncementsContent key={chatId} chatId={chatId} />;
}

export default ClassroomAnnouncements;
