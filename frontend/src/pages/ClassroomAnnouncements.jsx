import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  GraduationCap,
  LayoutList,
  LayoutTemplate,
  Link2,
  Loader2,
  Megaphone,
  Menu,
  Pencil,
  RotateCcw,
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

/** Matches backend enum in ClassroomAnnouncement. */
const KIND_OPTIONS = [
  {
    id: 'statement',
    label: 'Statement',
    hint: 'General course news',
    icon: Megaphone,
    chipClass:
      'border-slate-200 bg-slate-50 text-slate-800 ring-slate-300/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
  },
  {
    id: 'assignment',
    label: 'Assignment',
    hint: 'Tasks, submissions, deadlines',
    icon: ClipboardList,
    chipClass:
      'border-violet-200 bg-violet-50 text-violet-900 ring-violet-300/50 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100',
  },
  {
    id: 'exam',
    label: 'Exam',
    hint: 'Tests, midterms, finals',
    icon: GraduationCap,
    chipClass:
      'border-amber-200 bg-amber-50 text-amber-950 ring-amber-300/50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
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

/** Local calendar day key YYYY-MM-DD for grouping (matches user's timezone). */
function localDateKeyFromIso(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLongDayHeading(dateKey) {
  const [y, mo, day] = dateKey.split('-').map(Number);
  const d = new Date(y, mo - 1, day);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * datetime-local value from ISO string (local fields).
 * Empty string if no expiry.
 */
function isoToDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return toDatetimeLocalValue(d);
}

/** Format local `Date` for `input[type=datetime-local]` (minute precision). */
function toDatetimeLocalValue(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Expiry shortcut chips: end of local calendar day (23:59) for intuitive “through that day”. */
function endOfLocalDayContaining(base) {
  const d = new Date(base);
  d.setHours(23, 59, 0, 0);
  return d;
}

function expiryShortcutEndOfDayDaysFromToday(daysAfterToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysAfterToday);
  return toDatetimeLocalValue(endOfLocalDayContaining(d));
}

function countUrlsInText(text) {
  const re = new RegExp(URL_RE.source, 'gi');
  const m = String(text).match(re);
  return m ? m.length : 0;
}

/** One-tap composer starters — kind, urgency, scaffold, optional end-of-day expiry. */
const COMPOSER_TEMPLATES = [
  {
    id: 'statement',
    label: 'Course statement',
    hint: 'Neutral urgency — general news',
    kind: 'statement',
    importance: 0,
    title: 'Course update: ',
    body: 'Hi everyone,\n\n\n\nThanks,\n',
    expiryDaysFromToday: null,
  },
  {
    id: 'assignment',
    label: 'Assignment handoff',
    hint: 'Highlight + scaffold + 1-week relevance',
    kind: 'assignment',
    importance: 1,
    title: 'Assignment: ',
    body: 'What to do:\n\n\nSubmission:\n\nDue date:\n',
    expiryDaysFromToday: 7,
  },
  {
    id: 'exam',
    label: 'Exam window',
    hint: 'Urgent + scaffold + 2-week relevance',
    kind: 'exam',
    importance: 2,
    title: 'Exam: ',
    body: 'Coverage:\n\nWhen / format:\n\nMaterials allowed:\n\nQuestions?\n',
    expiryDaysFromToday: 14,
  },
];

/** POST/PATCH: omit field when null return undefined for JSON omission; invalid returns invalid marker. */
function datetimeLocalToIsoOrNull(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return { iso: null };
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return { invalid: true };
  return { iso: d.toISOString() };
}

function formatExpiryCaption(expiresAtIso, now = new Date()) {
  if (!expiresAtIso) return null;
  const end = new Date(expiresAtIso);
  const t = end.getTime();
  if (Number.isNaN(t)) return null;
  const diffMs = t - now.getTime();
  const abs = end.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  if (diffMs < 0) return { tone: 'expired', text: 'Expired', abs };
  const days = Math.ceil(diffMs / 86400000);
  if (days <= 0)
    return { tone: 'soon', text: 'Expires today', abs };
  if (days === 1) return { tone: 'soon', text: 'Expires tomorrow', abs };
  if (days <= 7)
    return { tone: 'soon', text: `Expires in ${days} days`, abs };
  return { tone: 'ok', text: `Relevant until ${abs}`, abs };
}

function normalizeAnnouncementFromApi(a) {
  const importance =
    typeof a.importance === 'number' &&
    a.importance >= 0 &&
    a.importance <= 2
      ? a.importance
      : 0;
  const kind =
    a.kind === 'exam' || a.kind === 'assignment' || a.kind === 'statement'
      ? a.kind
      : 'statement';
  const expiresAt =
    typeof a.expiresAt === 'string' && a.expiresAt ? a.expiresAt : null;
  const serverExpired = typeof a.isExpired === 'boolean' ? a.isExpired : null;
  const computedExpired =
    expiresAt && !Number.isNaN(new Date(expiresAt).getTime())
      ? new Date(expiresAt).getTime() < Date.now()
      : false;
  const isExpired =
    serverExpired !== null ? serverExpired : computedExpired;
  return {
    ...a,
    importance,
    kind,
    expiresAt,
    isExpired,
  };
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
  const [composeKind, setComposeKind] = useState('statement');
  const [composeExpiresAt, setComposeExpiresAt] = useState('');
  const [composerOpen, setComposerOpen] = useState(true);
  const [composerPreview, setComposerPreview] = useState(false);
  const [composerTemplatesOpen, setComposerTemplatesOpen] = useState(false);
  const composerInitiallyCollapsed = useRef(false);

  const [announcements, setAnnouncements] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [importanceFilter, setImportanceFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [activeOnly, setActiveOnly] = useState(false);
  const [viewMode, setViewMode] = useState('timeline');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [calendarSelectedDay, setCalendarSelectedDay] = useState(null);
  const [collapsedDayKeys, setCollapsedDayKeys] = useState({});

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
        (Array.isArray(data.announcements) ? data.announcements : []).map(
          normalizeAnnouncementFromApi,
        ),
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
    let rows = announcements.map(normalizeAnnouncementFromApi);
    if (kindFilter !== 'all') {
      rows = rows.filter((a) => a.kind === kindFilter);
    }
    if (importanceFilter === 'urgent') rows = rows.filter((a) => a.importance >= 2);
    else if (importanceFilter === 'highlight')
      rows = rows.filter((a) => a.importance === 1);
    if (activeOnly) {
      rows = rows.filter(
        (a) =>
          !a.expiresAt || !a.isExpired,
      );
    }
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
    if (viewMode === 'calendar' && calendarSelectedDay) {
      rows = rows.filter(
        (a) => localDateKeyFromIso(a.createdAt) === calendarSelectedDay,
      );
    }
    rows.sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return rows;
  }, [
    announcements,
    query,
    importanceFilter,
    kindFilter,
    activeOnly,
    viewMode,
    calendarSelectedDay,
  ]);

  const announcementsByDay = useMemo(() => {
    const map = new Map();
    for (const a of filteredAnnouncements) {
      const k = localDateKeyFromIso(a.createdAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(a);
    }
    const keys = [...map.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    return { map, keys };
  }, [filteredAnnouncements]);

  /** Dot counts for calendar cells — respects filters except selected calendar day. */
  const calendarCountMap = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = announcements.map(normalizeAnnouncementFromApi);
    if (kindFilter !== 'all') {
      rows = rows.filter((a) => a.kind === kindFilter);
    }
    if (importanceFilter === 'urgent') rows = rows.filter((a) => a.importance >= 2);
    else if (importanceFilter === 'highlight')
      rows = rows.filter((a) => a.importance === 1);
    if (activeOnly) {
      rows = rows.filter(
        (a) =>
          !a.expiresAt || !a.isExpired,
      );
    }
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
    const counts = new Map();
    for (const a of rows) {
      const k = localDateKeyFromIso(a.createdAt);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [
    announcements,
    query,
    importanceFilter,
    kindFilter,
    activeOnly,
  ]);

  const dueSoonItems = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 86400000;
    return announcements
      .map(normalizeAnnouncementFromApi)
      .filter((a) => {
        if (!a.expiresAt || a.isExpired) return false;
        const t = new Date(a.expiresAt).getTime();
        if (Number.isNaN(t)) return false;
        const dt = t - now;
        return dt >= 0 && dt <= weekMs;
      })
      .sort(
        (a, b) =>
          new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
      )
      .slice(0, 8);
  }, [announcements]);

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

  const latestPublishedForComposer = useMemo(
    () => filteredAnnouncements[0] ?? null,
    [filteredAnnouncements],
  );

  const composerDraftDirty = useMemo(
    () =>
      Boolean(
        title.trim() ||
          body.trim() ||
          composeKind !== 'statement' ||
          composeImportance !== 0 ||
          composeExpiresAt.trim(),
      ),
    [title, body, composeKind, composeImportance, composeExpiresAt],
  );

  const composePreviewExpiryIso = useMemo(() => {
    const r = datetimeLocalToIsoOrNull(composeExpiresAt);
    if (!r || r.invalid || r.iso === null) return null;
    return r.iso;
  }, [composeExpiresAt]);

  const composerChecklist = useMemo(() => {
    const linksOk = countUrlsInText(body) > 0;
    const expiryMissing =
      (composeKind === 'assignment' || composeKind === 'exam') &&
      !composeExpiresAt.trim();
    const urgencySoft =
      (composeKind === 'assignment' || composeKind === 'exam') &&
      composeImportance === 0;
    return { linksOk, expiryMissing, urgencySoft };
  }, [body, composeKind, composeExpiresAt, composeImportance]);

  const resetComposerDraft = useCallback(() => {
    setTitle('');
    setBody('');
    setComposeImportance(0);
    setComposeKind('statement');
    setComposeExpiresAt('');
    setComposerPreview(false);
    setComposerTemplatesOpen(false);
  }, []);

  const publishAnnouncement = useCallback(async () => {
    if (!canManage || !chatId) return;
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) return;

    const exp = datetimeLocalToIsoOrNull(composeExpiresAt);
    if (exp.invalid) {
      toast.error('Invalid expiry date and time.');
      return;
    }

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
            kind: composeKind,
            expiresAt: exp.iso,
          }),
        },
      );
      const data = await readJsonOrThrow(res, 'Failed to publish');
      if (data.announcement) {
        setAnnouncements((prev) => [
          normalizeAnnouncementFromApi(data.announcement),
          ...prev,
        ]);
      } else {
        await load();
      }
      resetComposerDraft();
      setComposerOpen(false);
      toast.success('Announcement published');
    } catch (e) {
      setLoadError(e?.message || 'Could not publish announcement');
    } finally {
      setSaving(false);
    }
  }, [
    canManage,
    chatId,
    title,
    body,
    composeImportance,
    composeKind,
    composeExpiresAt,
    load,
    resetComposerDraft,
  ]);

  const submitAnnouncement = (event) => {
    event.preventDefault();
    void publishAnnouncement();
  };

  const applyComposerTemplate = useCallback((t) => {
    setComposeKind(t.kind);
    setComposeImportance(t.importance);
    setTitle(t.title);
    setBody(t.body);
    if (t.expiryDaysFromToday == null) {
      setComposeExpiresAt('');
    } else {
      const d = new Date();
      d.setDate(d.getDate() + t.expiryDaysFromToday);
      setComposeExpiresAt(toDatetimeLocalValue(endOfLocalDayContaining(d)));
    }
    toast.success('Template applied');
  }, []);

  const copySettingsFromLatest = useCallback(() => {
    const latest = latestPublishedForComposer;
    if (!latest) return;
    setComposeKind(latest.kind);
    setComposeImportance(latest.importance);
    setComposeExpiresAt(isoToDatetimeLocalValue(latest.expiresAt));
    toast.success('Matched latest announcement settings');
  }, [latestPublishedForComposer]);

  const handleComposerFieldKeyDown = useCallback(
    (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return;
      e.preventDefault();
      void publishAnnouncement();
    },
    [publishAnnouncement],
  );

  useEffect(() => {
    if (!composerOpen || !canManage) return undefined;
    const onDocKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (editModal) return;
      const panel = document.querySelector('[data-announcement-composer-panel]');
      if (!panel?.contains(document.activeElement)) return;
      if (composerDraftDirty) {
        if (!window.confirm('Discard your draft and collapse the composer?')) return;
        resetComposerDraft();
      }
      setComposerOpen(false);
    };
    document.addEventListener('keydown', onDocKeyDown);
    return () => document.removeEventListener('keydown', onDocKeyDown);
  }, [
    composerOpen,
    canManage,
    composerDraftDirty,
    editModal,
    resetComposerDraft,
  ]);

  const saveEdit = async () => {
    if (!editModal) return;
    const trimmedTitle = editModal.title.trim();
    const trimmedBody = editModal.body.trim();
    if (!trimmedTitle || !trimmedBody) return;
    const exp = datetimeLocalToIsoOrNull(editModal.expiresAtLocal ?? '');
    if (exp.invalid) {
      toast.error('Invalid expiry date and time.');
      return;
    }
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
            kind: editModal.kind ?? 'statement',
            expiresAt: exp.iso,
          }),
        },
      );
      const data = await readJsonOrThrow(res, 'Could not save changes');
      const ann = data.announcement;
      if (ann) {
        const normalized = normalizeAnnouncementFromApi(ann);
        setAnnouncements((prev) =>
          prev
            .map((x) =>
              x.id === normalized.id ? { ...x, ...normalized } : x,
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
    const norm = normalizeAnnouncementFromApi(item);
    const imp = norm.importance ?? 0;
    const accent = importanceAccentClasses(imp);
    const hashId = `announcement-${norm.id}`;
    const bodyHtml = linkifyAnnouncementHtml(norm.body || '');
    const iso = norm.createdAt;
    const abs = new Date(iso).toLocaleString(undefined, {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const kindOpt =
      KIND_OPTIONS.find((k) => k.id === norm.kind) ?? KIND_OPTIONS[0];
    const KindIcon = kindOpt.icon;
    const expCap = formatExpiryCaption(norm.expiresAt);
    const expiredVisual = norm.isExpired ? 'opacity-[0.82] saturate-[0.85]' : '';

    return (
      <article
        key={norm.id}
        id={hashId}
        style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
        className={`fade-in-up scroll-mt-24 rounded-2xl border border-slate-200/90 bg-white shadow-sm transition hover:border-cyan-200/90 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-cyan-900 ${accent} border-l-[5px] ${expiredVisual}`}
      >
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${kindOpt.chipClass}`}
                >
                  <KindIcon className="h-3 w-3 shrink-0" aria-hidden />
                  {kindOpt.label}
                </span>
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
                {norm.isExpired ? (
                  <span className="rounded-full bg-slate-200/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    Expired
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
                {norm.title}
              </h4>
              {expCap ? (
                <p
                  className={`mt-1 text-[11px] font-semibold ${
                    expCap.tone === 'expired'
                      ? 'text-slate-500 line-through decoration-slate-400 dark:text-slate-500'
                      : expCap.tone === 'soon'
                        ? 'text-amber-800 dark:text-amber-200'
                        : 'text-slate-600 dark:text-slate-400'
                  }`}
                  title={expCap.abs}
                >
                  {expCap.text}
                </p>
              ) : null}
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
                        id: norm.id,
                        title: norm.title,
                        body: norm.body,
                        importance: imp,
                        kind: norm.kind,
                        expiresAtLocal: isoToDatetimeLocalValue(norm.expiresAt),
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700 hover:border-cyan-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteOne(norm.id)}
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
            Posted by {norm.author}
          </p>
        </div>
      </article>
    );
  };

  const calYear = calendarMonth.y;
  const calMonth = calendarMonth.m;
  const monthTitleLabel = new Date(calYear, calMonth, 1).toLocaleDateString(
    undefined,
    { month: 'long', year: 'numeric' },
  );
  const daysInCalMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstWeekday = new Date(calYear, calMonth, 1).getDay();

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
                <div
                  className="border-t border-slate-100 px-5 pb-6 pt-2 dark:border-slate-700 md:px-6"
                  data-announcement-composer-panel
                >
                  <form onSubmit={submitAnnouncement} className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setComposerTemplatesOpen((open) => !open)
                        }
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-cyan-300 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />
                        Start from template
                        {composerTemplatesOpen ? (
                          <ChevronUp className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={copySettingsFromLatest}
                        disabled={
                          saving || latestPublishedForComposer == null
                        }
                        title="Copy kind, urgency, and expiry from the latest announcement in the feed"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-cyan-300 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
                        Match latest settings
                      </button>
            </div>

                    {composerTemplatesOpen ? (
                      <div className="rounded-2xl border border-slate-200/90 bg-white/80 p-4 shadow-inner dark:border-slate-600 dark:bg-slate-950/40">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Pick a scaffold — nothing publishes until you hit Publish.
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          {COMPOSER_TEMPLATES.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              disabled={saving}
                              onClick={() => applyComposerTemplate(t)}
                              title={t.hint}
                              className="flex min-w-[min(100%,14rem)] flex-1 flex-col items-start rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[11px] font-semibold text-slate-800 shadow-sm transition hover:border-cyan-300 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            >
                              <span className="font-bold uppercase tracking-wide">
                                {t.label}
                              </span>
                              <span className="mt-1 font-normal text-slate-500 dark:text-slate-400">
                                {t.hint}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

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

                    <div className="flex flex-wrap gap-2">
                      <span className="w-full text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Type
                      </span>
                      {KIND_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setComposeKind(opt.id)}
                            title={opt.hint}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ring-2 transition ${
                              composeKind === opt.id
                                ? `bg-slate-900 text-white ring-slate-900 dark:bg-cyan-900 dark:ring-cyan-700`
                                : `bg-white text-slate-600 ring-transparent hover:ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:ring-slate-600`
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Relevant until (optional)
                      </span>
                      <p className="mt-0.5 max-w-xl text-[11px] text-slate-500 dark:text-slate-400">
                        Uses your local timezone. Leave empty if this announcement stays valid indefinitely.
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="datetime-local"
                          value={composeExpiresAt}
                          onChange={(e) => setComposeExpiresAt(e.target.value)}
                          className="input-field max-w-xs text-sm"
                          disabled={saving}
                        />
                        <button
                          type="button"
                          disabled={saving || !composeExpiresAt}
                          onClick={() => setComposeExpiresAt('')}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 transition hover:border-cyan-300 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          Clear expiry
                        </button>
                      </div>
                      {/* Expiry shortcuts: end of local calendar day (23:59), same rule as template defaults */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          End of day:
                        </span>
                        {[
                          { label: 'Today', days: 0 },
                          { label: '+3d', days: 3 },
                          { label: '+7d', days: 7 },
                        ].map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              setComposeExpiresAt(
                                expiryShortcutEndOfDayDaysFromToday(
                                  chip.days,
                                ),
                              )
                            }
                            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-cyan-300 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

              <input
                type="text"
                      placeholder="Headline students see first"
                value={title}
                      maxLength={TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                      onKeyDown={handleComposerFieldKeyDown}
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
                      onKeyDown={handleComposerFieldKeyDown}
                      className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-white/95 p-3 text-sm leading-relaxed text-slate-800 shadow-inner focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:border-slate-600 dark:bg-slate-950/60 dark:text-slate-100"
                      disabled={saving}
                    />
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {body.length}/{BODY_MAX} characters
                    </p>

                    <div
                      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/50"
                      aria-live="polite"
                    >
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                        title={
                          composerChecklist.linksOk
                            ? 'At least one link detected'
                            : 'Add a URL if students should open a link'
                        }
                      >
                        {composerChecklist.linksOk ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        ) : (
                          <AlertCircle className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                        )}
                        Links
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                        title={
                          composerChecklist.expiryMissing
                            ? 'Assignments and exams usually need a relevance window'
                            : 'Expiry set or not required for this type'
                        }
                      >
                        {composerChecklist.expiryMissing ? (
                          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        )}
                        Expiry
                      </span>
                      {composeKind === 'assignment' ||
                      composeKind === 'exam' ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                          title={
                            composerChecklist.urgencySoft
                              ? 'Consider Highlight or Urgent for deadlines'
                              : 'Urgency matches type'
                          }
                        >
                          {composerChecklist.urgencySoft ? (
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-300/90" aria-hidden />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                          )}
                          Urgency
                        </span>
                      ) : null}
                    </div>

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
                      (() => {
                        const imp = composeImportance;
                        const accent = importanceAccentClasses(imp);
                        const kindOpt =
                          KIND_OPTIONS.find((k) => k.id === composeKind) ??
                          KIND_OPTIONS[0];
                        const KindIcon = kindOpt.icon;
                        const previewIso = new Date().toISOString();
                        const absPosted = new Date(previewIso).toLocaleString(
                          undefined,
                          {
                            dateStyle: 'full',
                            timeStyle: 'short',
                          },
                        );
                        const expCap = formatExpiryCaption(
                          composePreviewExpiryIso,
                        );
                        const previewExpired =
                          Boolean(composePreviewExpiryIso) &&
                          new Date(composePreviewExpiryIso).getTime() <
                            Date.now();
                        const bodyHtml = linkifyAnnouncementHtml(
                          body.trim() || '(No body yet)',
                        );
                        const expiredVisual = previewExpired
                          ? 'opacity-[0.82] saturate-[0.85]'
                          : '';
                        return (
                          <article
                            className={`rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70 ${accent} border-l-[5px] ${expiredVisual}`}
                            aria-label="Announcement preview"
                          >
                            <div className="p-5">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${kindOpt.chipClass}`}
                                    >
                                      <KindIcon
                                        className="h-3 w-3 shrink-0"
                                        aria-hidden
                                      />
                                      {kindOpt.label}
                                    </span>
                                    {imp >= 2 ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-800 ring-1 ring-rose-400/40 dark:text-rose-200 dark:ring-rose-900">
                                        <Zap className="h-3 w-3" aria-hidden />
                                        Urgent
                                      </span>
                                    ) : imp >= 1 ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-900 ring-1 ring-cyan-400/40 dark:text-cyan-100 dark:ring-cyan-900">
                                        <Sparkles
                                          className="h-3 w-3"
                                          aria-hidden
                                        />
                                        Highlight
                                      </span>
                                    ) : null}
                                    {previewExpired ? (
                                      <span className="rounded-full bg-slate-200/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                        Expired
                                      </span>
                                    ) : null}
                                    <time
                                      dateTime={previewIso}
                                      title={absPosted}
                                      className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                                    >
                                      {relativeTimePhrase(previewIso)}
                                    </time>
                                  </div>
                                  <h4 className="mt-2 font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                                    {title.trim() || 'Untitled headline'}
                                  </h4>
                                  {expCap ? (
                                    <p
                                      className={`mt-1 text-[11px] font-semibold ${
                                        expCap.tone === 'expired'
                                          ? 'text-slate-500 line-through decoration-slate-400 dark:text-slate-500'
                                          : expCap.tone === 'soon'
                                            ? 'text-amber-800 dark:text-amber-200'
                                            : 'text-slate-600 dark:text-slate-400'
                                      }`}
                                      title={expCap.abs}
                                    >
                                      {expCap.text}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              <div
                                className="announce-body mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
                                dangerouslySetInnerHTML={{ __html: bodyHtml }}
                              />
                              <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-cyan-800 dark:text-cyan-200">
                                Preview — not published
                              </p>
                            </div>
                          </article>
                        );
                      })()
                    ) : null}

                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <span className="order-last w-full text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 sm:order-first sm:w-auto sm:text-left">
                        ⌘/Ctrl + Enter to publish
                      </span>
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

          <div className="flex flex-col gap-4">
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

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'All types' },
                  { id: 'statement', label: 'Statements' },
                  { id: 'assignment', label: 'Assignments' },
                  { id: 'exam', label: 'Exams' },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setKindFilter(chip.id)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ring-1 transition ${
                      kindFilter === chip.id
                        ? 'bg-cyan-950 text-white ring-cyan-900 dark:bg-cyan-600 dark:ring-cyan-500'
                        : 'bg-white text-slate-600 ring-slate-200 hover:ring-cyan-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                Active only (hide expired)
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-xl border border-slate-200/95 bg-white p-1 shadow-sm dark:border-slate-600 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('timeline');
                    setCalendarSelectedDay(null);
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
                    viewMode === 'timeline'
                      ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <LayoutList className="h-4 w-4" aria-hidden />
                  Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
                    viewMode === 'calendar'
                      ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  Calendar
                </button>
              </div>
              {viewMode === 'calendar' && calendarSelectedDay ? (
                <button
                  type="button"
                  onClick={() => setCalendarSelectedDay(null)}
                  className="text-[11px] font-bold uppercase tracking-wide text-cyan-700 underline underline-offset-2 dark:text-cyan-400"
                >
                  Clear day filter
                </button>
              ) : null}
            </div>

            {viewMode === 'calendar' ? (
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-4 shadow-inner dark:border-slate-700 dark:bg-slate-900/60">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-label="Previous month"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    onClick={() =>
                      setCalendarMonth(({ y, m }) => {
                        const nm = m - 1;
                        if (nm < 0) return { y: y - 1, m: 11 };
                        return { y, m: nm };
                      })
                    }
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </button>
                  <span className="font-display text-sm font-bold text-slate-800 dark:text-slate-100">
                    {monthTitleLabel}
                  </span>
                  <button
                    type="button"
                    aria-label="Next month"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    onClick={() =>
                      setCalendarMonth(({ y, m }) => {
                        const nm = m + 1;
                        if (nm > 11) return { y: y + 1, m: 0 };
                        return { y, m: nm };
                      })
                    }
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {Array.from({ length: firstWeekday }, (_, i) => (
                    <div
                      key={`pad-${calYear}-${calMonth}-${i}`}
                      className="aspect-square"
                      aria-hidden
                    />
                  ))}
                  {Array.from({ length: daysInCalMonth }, (_, i) => {
                    const dayNum = i + 1;
                    const pad = (n) => String(n).padStart(2, '0');
                    const dateKey = `${calYear}-${pad(calMonth + 1)}-${pad(dayNum)}`;
                    const count = calendarCountMap.get(dateKey) ?? 0;
                    const selected = calendarSelectedDay === dateKey;
                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() =>
                          setCalendarSelectedDay((prev) =>
                            prev === dateKey ? null : dateKey,
                          )
                        }
                        className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border text-sm font-semibold transition ${
                          selected
                            ? 'border-cyan-500 bg-cyan-500/15 text-cyan-950 dark:border-cyan-400 dark:bg-cyan-950/40 dark:text-cyan-50'
                            : count > 0
                              ? 'border-slate-200 bg-white text-slate-900 hover:border-cyan-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:border-cyan-600'
                              : 'border-transparent text-slate-400 hover:bg-slate-50 dark:text-slate-500 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        {dayNum}
                        {count > 0 ? (
                          <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-cyan-500 dark:bg-cyan-400" aria-hidden />
                        ) : null}
                        {count > 1 ? (
                          <span className="absolute right-1 top-1 min-w-[14px] rounded-full bg-slate-900 px-0.5 text-[9px] font-bold leading-none text-white dark:bg-slate-100 dark:text-slate-900">
                            {count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {dueSoonItems.length > 0 ? (
              <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 to-white px-4 py-3 dark:border-amber-900/50 dark:from-amber-950/35 dark:to-slate-900/40">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-950 dark:text-amber-100">
                  Due soon (next 7 days)
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dueSoonItems.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        const id = `announcement-${a.id}`;
                        document.getElementById(id)?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        });
                      }}
                      className="max-w-[min(100%,14rem)] truncate rounded-full border border-amber-300/80 bg-white px-3 py-1.5 text-left text-[11px] font-semibold text-amber-950 shadow-sm transition hover:border-cyan-400 hover:text-cyan-900 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-50 dark:hover:border-cyan-500"
                    >
                      {a.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
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
                    : 'Nothing matches your filters—try another keyword, type, or date.'}
                </p>
              </div>
            ) : viewMode === 'timeline' ? (
              announcementsByDay.keys.map((dayKey) => {
                const items = announcementsByDay.map.get(dayKey) ?? [];
                const collapsed = Boolean(collapsedDayKeys[dayKey]);
                return (
                  <div key={dayKey}>
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedDayKeys((prev) => {
                          const next = { ...prev };
                          if (next[dayKey]) delete next[dayKey];
                          else next[dayKey] = true;
                          return next;
                        })
                      }
                      className="mb-4 flex w-full items-center gap-3 rounded-xl px-1 text-left transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-600" aria-hidden />
                      <span className="shrink-0 font-display text-sm font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
                        {formatLongDayHeading(dayKey)}
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-200/90 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {items.length}
                      </span>
                      {collapsed ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      ) : (
                        <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      )}
                      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-600" aria-hidden />
                    </button>
                    {!collapsed ? (
                      <div className="space-y-4">
                        {items.map((item, i) => renderAnnouncementCard(item, i))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="space-y-4">
                {filteredAnnouncements.map((item, i) =>
                  renderAnnouncementCard(item, i),
                )}
              </div>
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
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="w-full text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Type
              </span>
              {KIND_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setEditModal((m) =>
                        m ? { ...m, kind: opt.id } : m,
                      )
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ring-2 transition ${
                      editModal.kind === opt.id
                        ? 'bg-slate-900 text-white ring-slate-900 dark:bg-cyan-900'
                        : 'bg-slate-100 text-slate-600 ring-transparent dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {opt.label}
                  </button>
                );
              })}
                    </div>
            <div className="mt-4">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Relevant until (optional)
              </span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  value={editModal.expiresAtLocal ?? ''}
                  onChange={(e) =>
                    setEditModal((m) =>
                      m ? { ...m, expiresAtLocal: e.target.value } : m,
                    )
                  }
                  className="input-field max-w-xs text-sm"
                />
                      <button
                        type="button"
                  onClick={() =>
                    setEditModal((m) =>
                      m ? { ...m, expiresAtLocal: '' } : m,
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  Clear expiry
                      </button>
                  </div>
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
