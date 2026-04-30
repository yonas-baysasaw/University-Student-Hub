import {
  ChevronDown,
  ChevronUp,
  Link2,
  Loader2,
  Megaphone,
  Menu,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import ClassroomHero from '../components/ClassroomHero';
import ClassroomParticipantsDrawer from '../components/ClassroomParticipantsDrawer';
import ClassroomTabs from '../components/ClassroomTabs';
import { useAuth } from '../contexts/AuthContext';
import {
  canManageClassroom,
  fetchClassroomMeta,
  isClassroomCreator,
} from '../utils/classroom';
import { readJsonOrThrow } from '../utils/http';

const TITLE_MAX = 500;
const BODY_MAX = 20000;

const IMPORTANCE_OPTIONS = [
  {
    value: 0,
    label: 'Normal',
    hint: 'Day-to-day updates',
    ring: 'ring-slate-200 dark:ring-slate-600',
    accent: 'border-l-slate-300 dark:border-l-slate-600',
  },
  {
    value: 1,
    label: 'Highlight',
    hint: 'Deadlines & notable shifts',
    ring: 'ring-cyan-300 dark:ring-cyan-800',
    accent: 'border-l-cyan-500 dark:border-l-cyan-400',
  },
  {
    value: 2,
    label: 'Urgent',
    hint: 'Time-sensitive or mandatory',
    ring: 'ring-rose-300 dark:ring-rose-800',
    accent: 'border-l-rose-500 dark:border-l-rose-400',
  },
];

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const URL_RE =
  /\b(https?:\/\/[^\s]+[^\s.,;:!?)\\\]}]|mailto:[^\s<]+[^\s.,;:!?)\\\]}])/gi;

function linkifyAnnouncementHtml(rawBody) {
  const escaped = escapeHtml(rawBody);
  const withBreaks = escaped.replace(/\r\n/g, '\n').replace(/\n/g, '<br />');
  return withBreaks.replace(URL_RE, (match) => {
    const href = escapeHtml(match);
    return `<a href="${href}" class="announce-link font-medium text-cyan-700 underline decoration-cyan-400/70 underline-offset-2 hover:text-cyan-900 dark:text-cyan-400 dark:hover:text-cyan-200" target="_blank" rel="noopener noreferrer">${href}</a>`;
  });
}

function localDayStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function localWeekMondayStart(d) {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = day.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  day.setDate(day.getDate() + delta);
  return day.getTime();
}

function timelineBucket(iso, now = new Date()) {
  const t = new Date(iso).getTime();
  const todayStart = localDayStart(now);
  const itemDayStart = localDayStart(new Date(iso));
  if (itemDayStart === todayStart) return 'today';
  const weekStart = localWeekMondayStart(now);
  if (t >= weekStart) return 'week';
  return 'earlier';
}

function relativeTimePhrase(iso) {
  const now = new Date();
  const d = new Date(iso);
  const todayStart = localDayStart(now);
  const itemDayStart = localDayStart(d);
  const diffDays = Math.round((todayStart - itemDayStart) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 14) return `${diffDays} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    dateStyle: 'medium',
  });
}

function importanceAccentClasses(importance) {
  const o = IMPORTANCE_OPTIONS.find((x) => x.value === importance);
  return o?.accent ?? IMPORTANCE_OPTIONS[0].accent;
}

async function copyAnnouncementLink(hashId) {
  const url = `${window.location.origin}${window.location.pathname}#${hashId}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  }
}

function ClassroomAnnouncementsContent({ chatId }) {
  const { user } = useAuth();
  const location = useLocation();
  const [chatName, setChatName] = useState('Class Announcements');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [composeImportance, setComposeImportance] = useState(0);
  const [composerOpen, setComposerOpen] = useState(true);
  const [composerPreview, setComposerPreview] = useState(false);
  const composerInitiallyCollapsed = useRef(false);

  const [announcements, setAnnouncements] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [importanceFilter, setImportanceFilter] = useState('all');

  const [editModal, setEditModal] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const [showMembersDrawer, setShowMembersDrawer] = useState(false);
  const [members, setMembers] = useState([]);
  const [creator, setCreator] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [membersError, setMembersError] = useState('');
  const [invitationCode, setInvitationCode] = useState('');

  const viewerIsCreator = isClassroomCreator(user, { creator });
  const viewerCanManageClassroom = canManageClassroom(user, {
    creator,
    admins,
  });

  const refreshClassroomMetaAfterMutation = useCallback(async () => {
    if (!chatId) return;
    try {
      const chat = await fetchClassroomMeta(chatId);
      setChatName(chat?.name ?? 'Class Announcements');
      setMembers(chat?.members ?? []);
      setCreator(chat?.creator ?? null);
      setAdmins(chat?.admins ?? []);
      setInvitationCode(
        typeof chat?.invitationCode === 'string' ? chat.invitationCode : '',
      );
      setMembersError('');
    } catch (_) {
      /* ignore */
    }
  }, [chatId]);

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
    if (!loading && announcements.length > 0 && !composerInitiallyCollapsed.current) {
      composerInitiallyCollapsed.current = true;
      setComposerOpen(false);
    }
    if (!loading && announcements.length === 0) {
      composerInitiallyCollapsed.current = false;
      setComposerOpen(true);
    }
  }, [loading, announcements.length]);

  useEffect(() => {
    if (!chatId) return;
    const controller = new AbortController();
    const loadMeta = async () => {
      try {
        const chatMeta = await fetchClassroomMeta(chatId, controller.signal);
        setChatName(chatMeta?.name ?? 'Class Announcements');
        setMembers(chatMeta?.members ?? []);
        setCreator(chatMeta?.creator ?? null);
        setAdmins(chatMeta?.admins ?? []);
        setInvitationCode(
          typeof chatMeta?.invitationCode === 'string'
            ? chatMeta.invitationCode
            : '',
        );
        setMembersError('');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setChatName('Class Announcements');
          setMembersError(error?.message ?? 'Could not load roster');
        }
      }
    };
    loadMeta();
    return () => controller.abort();
  }, [chatId]);

  const filteredAnnouncements = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = announcements.map((a) => ({
      ...a,
      importance:
        typeof a.importance === 'number' &&
        a.importance >= 0 &&
        a.importance <= 2
          ? a.importance
          : 0,
    }));
    if (importanceFilter === 'urgent') rows = rows.filter((a) => a.importance >= 2);
    else if (importanceFilter === 'highlight')
      rows = rows.filter((a) => a.importance === 1);
    if (q.length) {
      rows = rows.filter(
        (a) =>
          String(a.title || '')
            .toLowerCase()
            .includes(q) ||
          String(a.body || '')
            .toLowerCase()
            .includes(q),
      );
    }
    rows.sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return rows;
  }, [announcements, query, importanceFilter]);

  const timelineGroups = useMemo(() => {
    const g = { today: [], week: [], earlier: [] };
    for (const a of filteredAnnouncements) {
      g[timelineBucket(a.createdAt)].push(a);
    }
    return g;
  }, [filteredAnnouncements]);

  useEffect(() => {
    const hash = (location.hash || window.location.hash || '').replace(
      /^#/,
      '',
    );
    if (!hash.startsWith('announcement-')) return;
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [location.hash, filteredAnnouncements.length, chatId]);

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
          body: JSON.stringify({
            title: trimmedTitle,
            body: trimmedBody,
            importance: composeImportance,
          }),
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
      setComposeImportance(0);
      setComposerPreview(false);
      setComposerOpen(false);
      toast.success('Announcement published');
    } catch (e) {
      setLoadError(e?.message || 'Could not publish announcement');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editModal) return;
    const trimmedTitle = editModal.title.trim();
    const trimmedBody = editModal.body.trim();
    if (!trimmedTitle || !trimmedBody) return;
    setEditSaving(true);
    setLoadError('');
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/announcements/${encodeURIComponent(editModal.id)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trimmedTitle,
            body: trimmedBody,
            importance: editModal.importance,
          }),
        },
      );
      const data = await readJsonOrThrow(res, 'Could not save changes');
      const ann = data.announcement;
      if (ann) {
        setAnnouncements((prev) =>
          prev
            .map((x) =>
              x.id === ann.id
                ? {
                    ...x,
                    ...ann,
                    importance:
                      typeof ann.importance === 'number' ? ann.importance : 0,
                  }
                : x,
            )
            .sort((a, b) => {
              const ia = a.importance ?? 0;
              const ib = b.importance ?? 0;
              if (ib !== ia) return ib - ia;
              return new Date(b.createdAt) - new Date(a.createdAt);
            }),
        );
      }
      setEditModal(null);
      toast.success('Announcement updated');
    } catch (e) {
      setLoadError(e?.message || 'Update failed');
    } finally {
      setEditSaving(false);
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
      toast.success('Removed');
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

  const tabsTrailingParticipants = (
    <button
      type="button"
      onClick={() => setShowMembersDrawer(true)}
      className="inline-flex h-11 min-h-[44px] w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/95 bg-white text-slate-700 shadow-sm ring-1 ring-slate-900/[0.04] transition hover:border-cyan-400 hover:bg-gradient-to-br hover:from-cyan-50 hover:to-white hover:text-cyan-900 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-white/[0.06] dark:hover:border-cyan-500/70 dark:hover:from-slate-800 dark:hover:to-cyan-950/40 dark:hover:text-cyan-50"
      aria-label="Participants & classroom actions"
      title="Participants"
    >
      <Menu className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
    </button>
  );

  const renderAnnouncementCard = (item, idx) => {
    const imp = item.importance ?? 0;
    const accent = importanceAccentClasses(imp);
    const hashId = `announcement-${item.id}`;
    const bodyHtml = linkifyAnnouncementHtml(item.body || '');
    const iso = item.createdAt;
    const abs = new Date(iso).toLocaleString(undefined, {
      dateStyle: 'full',
      timeStyle: 'short',
    });

    return (
      <article
        key={item.id}
        id={hashId}
        style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
        className={`fade-in-up scroll-mt-24 rounded-2xl border border-slate-200/90 bg-white shadow-sm transition hover:border-cyan-200/90 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-cyan-900 ${accent} border-l-[5px]`}
      >
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {imp >= 2 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-800 ring-1 ring-rose-400/40 dark:text-rose-200 dark:ring-rose-900">
                    <Zap className="h-3 w-3" aria-hidden />
                    Urgent
                  </span>
                ) : imp >= 1 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-900 ring-1 ring-cyan-400/40 dark:text-cyan-100 dark:ring-cyan-900">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    Highlight
                  </span>
                ) : null}
                <time
                  dateTime={iso}
                  title={abs}
                  className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  {relativeTimePhrase(iso)}
                </time>
              </div>
              <h4 className="mt-2 font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {item.title}
              </h4>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copyAnnouncementLink(hashId)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-cyan-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-cyan-600"
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden />
                Copy link
              </button>
              {canManage ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setEditModal({
                        id: item.id,
                        title: item.title,
                        body: item.body,
                        importance: imp,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700 hover:border-cyan-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteOne(item.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <div
            className="announce-body mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
          <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Posted by {item.author}
          </p>
        </div>
      </article>
    );
  };

  const sectionLabels = {
    today: 'Today',
    week: 'Earlier this week',
    earlier: 'Earlier',
  };

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

          <ClassroomTabs trailing={tabsTrailingParticipants} />

          {loadError ? (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100" role="alert">
              {loadError}
            </p>
          ) : null}

          {canManage ? (
            <section className="mb-6 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-cyan-50/40 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950/95">
              <button
                type="button"
                onClick={() => setComposerOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left transition hover:bg-white/60 dark:hover:bg-slate-800/60 md:px-6"
              >
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    New announcement
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                    {composerOpen
                      ? 'Compose below—students see posts sorted by urgency.'
                      : 'Collapsed—open when you have news to ship.'}
                  </p>
                </div>
                {composerOpen ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
                )}
              </button>

              {composerOpen ? (
                <div className="border-t border-slate-100 px-5 pb-6 pt-2 dark:border-slate-700 md:px-6">
                  <form onSubmit={submitAnnouncement} className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="w-full text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Importance
                      </span>
                      {IMPORTANCE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setComposeImportance(opt.value)}
                          title={opt.hint}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ring-2 transition ${
                            composeImportance === opt.value
                              ? `bg-slate-900 text-white ring-slate-900 dark:bg-cyan-900 dark:ring-cyan-700 ${opt.ring}`
                              : `bg-white text-slate-600 ring-transparent hover:ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:ring-slate-600`
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      placeholder="Headline students see first"
                      value={title}
                      maxLength={TITLE_MAX}
                      onChange={(e) => setTitle(e.target.value)}
                      className="input-field text-sm"
                      disabled={saving}
                    />
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {title.length}/{TITLE_MAX} characters
                    </p>

                    <textarea
                      placeholder="Details, deadlines, links (URLs become clickable automatically)."
                      value={body}
                      maxLength={BODY_MAX}
                      onChange={(e) => setBody(e.target.value)}
                      className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-white/95 p-3 text-sm leading-relaxed text-slate-800 shadow-inner focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
                      disabled={saving}
                    />
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {body.length}/{BODY_MAX} characters
                    </p>

                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={composerPreview}
                        onChange={(e) => setComposerPreview(e.target.checked)}
                        disabled={saving}
                      />
                      Preview before publishing
                    </label>

                    {composerPreview ? (
                      <div className="rounded-2xl border border-dashed border-cyan-300/80 bg-cyan-50/40 p-4 dark:border-cyan-900 dark:bg-cyan-950/25">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-900 dark:text-cyan-200">
                          Preview
                        </p>
                        <p className="mt-2 font-display text-lg font-bold text-slate-900 dark:text-white">
                          {title.trim() || 'Untitled headline'}
                        </p>
                        <div
                          className="announce-body mt-2 text-sm text-slate-700 dark:text-slate-300"
                          dangerouslySetInnerHTML={{
                            __html: linkifyAnnouncementHtml(
                              body.trim() || '(No body yet)',
                            ),
                          }}
                        />
                      </div>
                    ) : null}

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="submit"
                        disabled={
                          saving ||
                          !title.trim() ||
                          !body.trim()
                        }
                        className="btn-primary px-8 py-2.5 text-sm disabled:opacity-50"
                      >
                        {saving ? 'Publishing…' : 'Publish announcement'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="mb-6 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-5 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400 md:px-6">
              Only classroom admins publish announcements—everything below is
              read-only for students.
            </section>
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1">
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
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All' },
                { id: 'urgent', label: 'Urgent' },
                { id: 'highlight', label: 'Highlight' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setImportanceFilter(chip.id)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ring-1 transition ${
                    importanceFilter === chip.id
                      ? 'bg-slate-900 text-white ring-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-100'
                      : 'bg-white text-slate-600 ring-slate-200 hover:ring-cyan-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <section className="mt-6 space-y-10">
            {loading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-5 py-12 dark:border-slate-700 dark:bg-slate-900/40">
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
                    ? 'The timeline is quiet—when instructors post, urgent items rise to the top automatically.'
                    : 'Nothing matches your filters—try another keyword or chip.'}
                </p>
              </div>
            ) : (
              (['today', 'week', 'earlier']).map((bucket) => {
                const items = timelineGroups[bucket];
                if (!items?.length) return null;
                return (
                  <div key={bucket}>
                    <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-600" aria-hidden />
                      {sectionLabels[bucket]}
                      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-600" aria-hidden />
                    </h3>
                    <div className="space-y-4">
                      {items.map((item, i) => renderAnnouncementCard(item, i))}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </div>

      {editModal ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-announcement-title"
            className="fade-in-up max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
          >
            <h3
              id="edit-announcement-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-white"
            >
              Edit announcement
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {IMPORTANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setEditModal((m) =>
                      m ? { ...m, importance: opt.value } : m,
                    )
                  }
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ring-2 transition ${
                    editModal.importance === opt.value
                      ? 'bg-slate-900 text-white ring-slate-900 dark:bg-cyan-900'
                      : 'bg-slate-100 text-slate-600 ring-transparent dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <label htmlFor="edit-ann-title" className="sr-only">
              Title
            </label>
            <input
              id="edit-ann-title"
              type="text"
              value={editModal.title}
              maxLength={TITLE_MAX}
              onChange={(e) =>
                setEditModal((m) => (m ? { ...m, title: e.target.value } : m))
              }
              className="input-field mt-4 text-sm"
            />
            <label htmlFor="edit-ann-body" className="sr-only">
              Body
            </label>
            <textarea
              id="edit-ann-body"
              value={editModal.body}
              maxLength={BODY_MAX}
              onChange={(e) =>
                setEditModal((m) => (m ? { ...m, body: e.target.value } : m))
              }
              rows={6}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-600 dark:bg-slate-950/60"
            />
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-secondary px-5 py-2 text-sm"
                onClick={() => setEditModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  editSaving ||
                  !editModal.title.trim() ||
                  !editModal.body.trim()
                }
                className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
                onClick={() => void saveEdit()}
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ClassroomParticipantsDrawer
        open={showMembersDrawer}
        onClose={() => setShowMembersDrawer(false)}
        chatId={chatId}
        chatName={chatName}
        members={members}
        creator={creator}
        admins={admins}
        membersError={membersError}
        invitationCode={invitationCode}
        user={user}
        viewerCanManageRoster={viewerIsCreator}
        viewerCanManageClassroom={viewerCanManageClassroom}
        viewerIsClassroomCreator={viewerIsCreator}
        onRefreshMeta={refreshClassroomMetaAfterMutation}
        showEditClassroomButton={false}
        showLeaveButton={false}
      />
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
