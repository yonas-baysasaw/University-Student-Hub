import {
  ArrowUpDown,
  CalendarPlus,
  ChevronRight,
  Clock,
  Grid3x3,
  Heart,
  List,
  Loader2,
  MapPin,
  ImagePlus,
  Plus,
  ThumbsDown,
  Trash2,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import defaultProfile from '../assets/profile.png';
import { useAuth } from '../contexts/AuthContext';
import { readJsonOrThrow } from '../utils/http';
import {
  ACADEMIC_TRACKS,
  academicTrackLabel,
  DEPARTMENTS_BY_TRACK,
  resolveDepartmentForSubmit,
  validateEventCatalogFields,
} from '../utils/bookUploadMeta';
import { visibilityLabel, visibilityTone } from '../utils/formatLabels';

const LS_EVENTS_VIEW = 'ush.events.view';
const LS_EVENTS_COLS = 'ush.events.gridCols';

function readEventsViewPrefs() {
  if (typeof window === 'undefined') {
    return { view: 'grid', cols: '3' };
  }
  try {
    const v = window.localStorage.getItem(LS_EVENTS_VIEW);
    const c = window.localStorage.getItem(LS_EVENTS_COLS);
    const cols = c === '2' || c === '3' || c === '4' ? c : '3';
    if (v === 'list' || v === 'grid') {
      return { view: v, cols };
    }
    const prefersList =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 767px)').matches
        : false;
    return { view: prefersList ? 'list' : 'grid', cols };
  } catch {
    return { view: 'grid', cols: '3' };
  }
}

function formatEventWhen(startsAt, endsAt) {
  try {
    const s = new Date(startsAt);
    if (Number.isNaN(s.getTime())) return '';
    const opts = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };
    let line = s.toLocaleString(undefined, opts);
    if (endsAt) {
      const e = new Date(endsAt);
      if (!Number.isNaN(e.getTime())) {
        line += ` — ${e.toLocaleString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })}`;
      }
    }
    return line;
  } catch {
    return '';
  }
}

function formatEventDateShort(startsAt) {
  try {
    const s = new Date(startsAt);
    if (Number.isNaN(s.getTime())) return '';
    return s.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/** One-line discovery trail (field + school/dept only). */
function eventCatalogSnippet(ev) {
  const parts = [];
  if (ev.academicTrack) parts.push(academicTrackLabel(ev.academicTrack));
  if (ev.department?.trim()) parts.push(ev.department.trim());
  return parts.join(' · ');
}

function EventListRow({ ev, index, user, mergeEvent, onDelete, deleteBusy }) {
  const ownerId = ev.organizer?.id;
  const isOrganizer =
    user && ownerId && String(user._id || user.id) === String(ownerId);
  const urls = Array.isArray(ev.mediaUrls) ? ev.mediaUrls.filter(Boolean) : [];
  const hero = urls.length > 0 ? urls[0] : null;
  const visLabel = visibilityLabel(ev.visibility);
  const visTone = visibilityTone(ev.visibility);
  const snippet = eventCatalogSnippet(ev);
  const dateShort = formatEventDateShort(ev.startsAt);

  return (
    <article
      style={{ animationDelay: `${Math.min(index * 45, 400)}ms` }}
      className="fade-in-up panel-card relative flex flex-row gap-3 overflow-hidden rounded-[1.35rem] border border-slate-200/85 bg-gradient-to-br from-white via-white to-fuchsia-50/30 p-3 shadow-sm dark:border-slate-700/90 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 sm:gap-4 sm:p-4"
    >
      <div className="relative w-[5.75rem] shrink-0 sm:w-32">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-slate-200/90 ring-1 ring-cyan-500/10 dark:bg-slate-800">
          {hero ? (
            <img
              src={hero}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-fuchsia-100/80 to-cyan-100/60 dark:from-slate-800 dark:to-slate-900">
              <CalendarPlus
                className="h-8 w-8 text-slate-400 opacity-70"
                strokeWidth={1.25}
                aria-hidden
              />
            </div>
          )}
        </div>
        <div className="absolute left-0.5 top-0.5 z-[2] flex max-w-[calc(100%-0.25rem)] flex-wrap gap-0.5">
          <span className="rounded-md bg-white/95 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-800 shadow-sm ring-1 ring-cyan-500/20 dark:bg-slate-950/90 dark:text-cyan-200">
            Event
          </span>
          <span
            className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide shadow-sm ring-1 backdrop-blur-sm ${visTone}`}
          >
            {visLabel}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5 pr-1">
        <div>
          <h2 className="font-display text-base font-bold leading-snug text-slate-900 dark:text-white sm:text-lg">
            <Link
              to={`/events/${ev._id}`}
              className="hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/80 dark:hover:text-cyan-300"
            >
              {ev.title}
            </Link>
          </h2>
          {snippet ? (
            <p
              className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400"
              title={snippet}
            >
              {snippet}
            </p>
          ) : null}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Event</span>
            {dateShort ? (
              <>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                  ·
                </span>
                <span>{dateShort}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
            <span className="line-clamp-1">{formatEventWhen(ev.startsAt, ev.endsAt)}</span>
          </span>
          {ev.location ? (
            <span className="inline-flex max-w-full items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
              <span className="truncate">{ev.location}</span>
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {user ? (
            <EventEngagementRow event={ev} onUpdated={mergeEvent} />
          ) : (
            <p className="text-[10px] text-slate-500">Sign in to react.</p>
          )}
          {isOrganizer ? (
            <button
              type="button"
              disabled={deleteBusy === ev._id}
              title="Delete event"
              aria-label="Delete event"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200/90 bg-white text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/50"
              onClick={() => onDelete(ev)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        {ev.organizer ? (
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={ev.organizer.avatar || defaultProfile}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-cyan-500/20"
            />
            {ev.organizer.id ? (
              <Link
                to={`/users/${ev.organizer.id}`}
                className="truncate text-xs font-semibold text-slate-700 hover:text-cyan-600 dark:text-slate-200 dark:hover:text-cyan-400"
              >
                {ev.organizer.name}
              </Link>
            ) : (
              <span className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
                {ev.organizer.name}
              </span>
            )}
          </div>
        ) : null}

        {ev.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {ev.description}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Link
            to={`/events/${ev._id}`}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 px-3 py-2 text-xs font-bold text-white shadow-md"
          >
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}

function EventEngagementRow({ event, onUpdated }) {
  const vs = event.viewerState ?? {};
  const userReaction = vs.liked ? 'like' : vs.disliked ? 'dislike' : null;
  const [busy, setBusy] = useState(null);

  const toggleReaction = async (kind) => {
    const nextReaction = kind === userReaction ? 'none' : kind;
    setBusy(kind);
    try {
      const res = await fetch(`/api/events/${event._id}/react`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: nextReaction }),
      });
      const data = await readJsonOrThrow(res, 'Could not update reaction');
      onUpdated?.(data.data);
      toast.success(
        nextReaction === 'none'
          ? 'Reaction cleared'
          : nextReaction === 'like'
            ? 'Liked'
            : 'Dislike saved',
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy != null && busy !== 'like'}
        onClick={() => toggleReaction('like')}
        title="Like"
        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition ${
          vs.liked
            ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200'
            : 'border-slate-200/90 text-slate-600 hover:border-cyan-300/70 dark:border-slate-600 dark:text-slate-400'
        }`}
      >
        <Heart
          className={`h-3.5 w-3.5 ${vs.liked ? 'fill-current' : ''}`}
          aria-hidden
        />
        {event.likesCount ?? 0}
      </button>
      <button
        type="button"
        disabled={busy != null && busy !== 'dislike'}
        onClick={() => toggleReaction('dislike')}
        title="Dislike"
        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition ${
          vs.disliked
            ? 'border-slate-400 bg-slate-800 text-white dark:bg-slate-700'
            : 'border-slate-200/90 text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:text-slate-400'
        }`}
      >
        <ThumbsDown
          className={`h-3.5 w-3.5 ${vs.disliked ? 'fill-current' : ''}`}
          aria-hidden
        />
        {event.dislikesCount ?? 0}
      </button>
    </div>
  );
}

function EventGridCard({ ev, index, user, mergeEvent, onDelete, deleteBusy }) {
  const ownerId = ev.organizer?.id;
  const isOrganizer =
    user && ownerId && String(user._id || user.id) === String(ownerId);
  const urls = Array.isArray(ev.mediaUrls) ? ev.mediaUrls.filter(Boolean) : [];
  const hero = urls.length > 0 ? urls[0] : null;
  const visLabel = visibilityLabel(ev.visibility);
  const visTone = visibilityTone(ev.visibility);
  const snippet = eventCatalogSnippet(ev);
  const dateShort = formatEventDateShort(ev.startsAt);

  return (
    <article
      style={{ animationDelay: `${Math.min(index * 45, 400)}ms` }}
      className="fade-in-up panel-card group relative flex flex-col overflow-hidden rounded-[1.35rem] border border-slate-200/85 bg-gradient-to-b from-white via-white to-cyan-50/25 dark:border-slate-700/90 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/50"
    >
      <div className="relative shrink-0 px-2 pt-2">
        <div className="relative overflow-hidden rounded-2xl bg-slate-200/90 ring-1 ring-cyan-500/15 dark:bg-slate-800 dark:ring-cyan-500/10">
          <div className="aspect-[4/5] w-full overflow-hidden sm:aspect-[3/4]">
            {hero ? (
              <img
                src={hero}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-[11rem] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-fuchsia-100/90 via-white to-cyan-100/80 px-4 text-center dark:from-slate-800 dark:via-slate-900 dark:to-slate-900">
                <CalendarPlus
                  className="h-12 w-12 text-fuchsia-400/60 dark:text-slate-600"
                  strokeWidth={1.25}
                  aria-hidden
                />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  No cover
                </span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-24 bg-gradient-to-t from-slate-950/65 to-transparent dark:from-black/75" />
          </div>

          <div className="absolute left-3 top-3 z-[3] flex max-w-[calc(100%-3.5rem)] flex-wrap gap-1.5">
            <span className="rounded-lg bg-white/95 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-cyan-800 shadow-md shadow-black/10 ring-1 ring-cyan-500/25 backdrop-blur-sm dark:bg-slate-950/90 dark:text-cyan-200 dark:ring-cyan-400/30">
              Event
            </span>
            {ev.academicTrack ? (
              <span className="max-w-[10rem] truncate rounded-lg bg-indigo-500/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md ring-1 ring-indigo-400/40 backdrop-blur-sm dark:bg-indigo-600/95">
                {academicTrackLabel(ev.academicTrack)}
              </span>
            ) : null}
            <span
              className={`rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide shadow-md ring-1 backdrop-blur-sm ${visTone}`}
            >
              {visLabel}
            </span>
          </div>

          {isOrganizer ? (
            <button
              type="button"
              disabled={deleteBusy === ev._id}
              onClick={() => onDelete(ev)}
              title="Delete event"
              className="absolute right-3 top-3 z-[3] inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-rose-700 shadow-lg ring-1 ring-white/60 backdrop-blur-md transition hover:scale-105 hover:bg-rose-50 disabled:opacity-50 dark:bg-slate-900/90 dark:text-rose-400 dark:ring-slate-600"
            >
              <Trash2 className="h-[18px] w-[18px]" aria-hidden />
              <span className="sr-only">Delete event</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative z-[5] flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
        <h2 className="font-display line-clamp-2 text-base font-bold leading-snug tracking-tight text-slate-900 dark:text-white">
          <Link
            to={`/events/${ev._id}`}
            className="transition group-hover:text-cyan-700 focus:outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-cyan-500/80 dark:group-hover:text-cyan-300"
          >
            {ev.title}
          </Link>
        </h2>
        {snippet ? (
          <p
            className="mt-1 truncate text-[11px] font-medium text-slate-600 dark:text-slate-300"
            title={snippet}
          >
            {snippet}
          </p>
        ) : null}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <span className="text-fuchsia-700/90 dark:text-fuchsia-200/95">
            Event
          </span>
          {dateShort ? (
            <>
              <span aria-hidden className="text-slate-400 dark:text-slate-500">
                ·
              </span>
              <span className="text-slate-700 dark:text-slate-200">
                {dateShort}
              </span>
            </>
          ) : null}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
            <span className="line-clamp-1">{formatEventWhen(ev.startsAt, ev.endsAt)}</span>
          </span>
          {ev.location ? (
            <span className="inline-flex max-w-full items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
              <span className="truncate">{ev.location}</span>
            </span>
          ) : null}
        </div>
        {ev.description ? (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {ev.description}
          </p>
        ) : null}
        {ev.organizer ? (
          <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-500">
            Hosted by{' '}
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              {ev.organizer.name}
            </span>
          </p>
        ) : null}
        {user ? (
          <div className="mt-2">
            <EventEngagementRow event={ev} onUpdated={mergeEvent} />
          </div>
        ) : (
          <p className="mt-2 text-[10px] text-slate-500">
            Sign in to like or dislike events.
          </p>
        )}
        <Link
          to={`/events/${ev._id}`}
          className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-500/15 to-cyan-500/15 px-3 py-1.5 text-[11px] font-bold text-cyan-800 ring-1 ring-cyan-500/25 transition hover:from-fuchsia-500/25 hover:to-cyan-500/25 dark:text-cyan-200 dark:ring-cyan-400/30"
        >
          View details
          <ChevronRight className="h-3.5 w-3.5 opacity-90" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export default function Events() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const patchParams = useCallback(
    (updates) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([k, v]) => {
        if (
          v === null ||
          v === undefined ||
          v === '' ||
          (k === 'sort' && v === 'recent')
        ) {
          next.delete(k);
        } else {
          next.set(k, String(v));
        }
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const sortBy = searchParams.get('sort') || 'recent';

  const [eventsView, setEventsView] = useState(
    () => readEventsViewPrefs().view,
  );
  const [gridCols, setGridCols] = useState(
    () => readEventsViewPrefs().cols,
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_EVENTS_VIEW, eventsView);
      window.localStorage.setItem(LS_EVENTS_COLS, gridCols);
    } catch {
      /* ignore */
    }
  }, [eventsView, gridCols]);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(null);
  const coverInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [capacity, setCapacity] = useState('');
  const [academicTrack, setAcademicTrack] = useState('');
  const [department, setDepartment] = useState('');
  const [departmentOther, setDepartmentOther] = useState('');
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null);
  const [visibility, setVisibility] = useState('public');

  const deptList =
    academicTrack && DEPARTMENTS_BY_TRACK[academicTrack]
      ? DEPARTMENTS_BY_TRACK[academicTrack]
      : [];

  const resetCreateForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setStartsAt('');
    setEndsAt('');
    setLocation('');
    setMeetingUrl('');
    setCapacity('');
    setAcademicTrack('');
    setDepartment('');
    setDepartmentOther('');
    setVisibility('public');
    setCoverPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (coverInputRef.current) coverInputRef.current.value = '';
  }, []);

  const openCreateModal = useCallback(() => {
    resetCreateForm();
    setCreateOpen(true);
  }, [resetCreateForm]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/events', { credentials: 'include' });
      const data = await readJsonOrThrow(res, 'Could not load events');
      const list = Array.isArray(data.events) ? data.events : [];
      setEvents(list);
    } catch (e) {
      setError(e.message || 'Could not load events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mergeEvent = useCallback((updated) => {
    if (!updated?._id) return;
    setEvents((prev) =>
      prev.map((e) =>
        String(e._id) === String(updated._id) ? { ...e, ...updated } : e,
      ),
    );
  }, []);

  const sortedEvents = useMemo(() => {
    const list = [...events];
    if (sortBy === 'title') {
      list.sort((a, b) =>
        String(a.title || '').localeCompare(String(b.title || ''), undefined, {
          sensitivity: 'base',
        }),
      );
    } else if (sortBy === 'likes') {
      list.sort(
        (a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0),
      );
    } else {
      list.sort((a, b) => {
        const tb = new Date(b.createdAt || b.updatedAt || 0).getTime();
        const ta = new Date(a.createdAt || a.updatedAt || 0).getTime();
        return tb - ta;
      });
    }
    return list;
  }, [events, sortBy]);

  const resultsContainerClass = useMemo(() => {
    if (eventsView === 'list') return 'flex flex-col gap-5';
    if (gridCols === '2')
      return 'grid gap-5 grid-cols-1 sm:grid-cols-2';
    if (gridCols === '4')
      return 'grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    return 'grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  }, [eventsView, gridCols]);

  const rollbackDeleteEvent = async (id) => {
    try {
      await fetch(`/api/events/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      /* best effort */
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      toast.error('Title is required.');
      return;
    }
    if (!startsAt) {
      toast.error('Start date and time are required.');
      return;
    }

    const cover = coverInputRef.current?.files?.[0];
    if (!cover || !cover.type.startsWith('image/')) {
      toast.error('Cover photo is required.');
      return;
    }

    const resolvedDept = resolveDepartmentForSubmit({
      department,
      departmentOther,
    });
    const catErr = validateEventCatalogFields({
      academicTrack,
      department: resolvedDept,
    });
    if (catErr) {
      toast.error(catErr);
      return;
    }

    setSaving(true);
    try {
      const body = {
        title: t,
        description: description.trim(),
        startsAt: new Date(startsAt).toISOString(),
        location: location.trim(),
        meetingUrl: meetingUrl.trim(),
        academicTrack,
        department: resolvedDept,
        visibility,
      };
      if (endsAt) body.endsAt = new Date(endsAt).toISOString();
      const cap = capacity.trim();
      if (cap) body.capacity = Number(cap);

      const res = await fetch('/api/events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await readJsonOrThrow(res, 'Could not create event');
      const created = data.data;
      if (!created?._id) {
        throw new Error('Invalid server response.');
      }

      const eventId = String(created._id);
      const fd = new FormData();
      fd.append('file', cover);
      const mediaRes = await fetch(
        `/api/events/${encodeURIComponent(eventId)}/media`,
        {
          method: 'POST',
          credentials: 'include',
          body: fd,
        },
      );
      const mediaPayload = await mediaRes.json().catch(() => ({}));

      if (!mediaRes.ok) {
        await rollbackDeleteEvent(eventId);
        toast.error(
          mediaPayload?.message ||
            'Cover upload failed. The event was not created.',
        );
        return;
      }

      const withMedia = mediaPayload.data ?? created;
      setEvents((prev) => [withMedia, ...prev]);
      toast.success('Event posted');
      setCreateOpen(false);
      resetCreateForm();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ev) => {
    if (
      !window.confirm(
        `Delete “${ev.title}”? Reviews and comments will be removed.`,
      )
    ) {
      return;
    }
    setDeleteBusy(ev._id);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(ev._id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await readJsonOrThrow(res, 'Could not delete event');
      setEvents((prev) => prev.filter((x) => String(x._id) !== String(ev._id)));
      toast.success('Event removed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteBusy(null);
    }
  };

  return (
    <div className="page-surface min-h-[calc(100vh-5.5rem)] px-4 pb-14 pt-6 md:px-6 md:pt-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
              Campus life
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Events
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
              Create gatherings, workshops, and club activities. Like or pass
              on posts and open a card to reserve a seat or join the
              conversation.
            </p>
            {!loading && !error ? (
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {events.length}{' '}
                {events.length === 1 ? 'event' : 'events'}
              </p>
            ) : null}
          </div>

          <div className="flex flex-shrink-0 flex-wrap gap-2">
            {user ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-cyan-300/70 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-cyan-500/40 dark:hover:bg-slate-800/80"
              >
                <Plus
                  className="h-4 w-4 text-cyan-600 dark:text-cyan-400"
                  aria-hidden
                />
                Add event
              </button>
            ) : (
              <Link
                to={`/login?next=${encodeURIComponent('/events')}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                Sign in to post
              </Link>
            )}
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="panel-card rounded-[1.35rem] border border-slate-200/85 p-4 shadow-sm dark:border-slate-700 md:p-5">
          <div
            className="flex flex-wrap items-end gap-3 border-b border-slate-200/90 pb-4 dark:border-slate-700/80"
            role="toolbar"
            aria-label="Event list controls"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-cyan-600 opacity-80 dark:text-cyan-400" aria-hidden />
              <label htmlFor="events-sort" className="sr-only">
                Sort list
              </label>
              <select
                id="events-sort"
                title="Sort list"
                className="h-8 max-w-[11rem] cursor-pointer rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-7 text-[11px] font-bold text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                value={sortBy}
                onChange={(e) => {
                  const v = e.target.value;
                  patchParams({ sort: v === 'recent' ? null : v });
                }}
              >
                <option value="recent">Newest first</option>
                <option value="title">Title A–Z</option>
                <option value="likes">Most liked</option>
              </select>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
              <span className="sr-only" id="events-layout-label">
                Layout
              </span>
              <div
                className="inline-flex rounded-xl bg-slate-100/95 p-0.5 ring-1 ring-slate-200/90 dark:bg-slate-800/95 dark:ring-slate-600/80"
                role="group"
                aria-labelledby="events-layout-label"
              >
                <button
                  type="button"
                  title="List view"
                  aria-pressed={eventsView === 'list'}
                  onClick={() => setEventsView('list')}
                  className={`inline-flex h-8 w-9 items-center justify-center rounded-lg transition ${
                    eventsView === 'list'
                      ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-950 dark:text-cyan-300'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <List className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  title="Grid view"
                  aria-pressed={eventsView === 'grid'}
                  onClick={() => setEventsView('grid')}
                  className={`inline-flex h-8 w-9 items-center justify-center rounded-lg transition ${
                    eventsView === 'grid'
                      ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-950 dark:text-cyan-300'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <Grid3x3 className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {eventsView === 'grid' ? (
                <div
                  className="inline-flex rounded-xl bg-slate-100/95 p-0.5 ring-1 ring-slate-200/90 dark:bg-slate-800/95 dark:ring-slate-600/80"
                  role="group"
                  aria-label="Columns per row"
                >
                  {['2', '3', '4'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={gridCols === c}
                      onClick={() => setGridCols(c)}
                      className={`min-w-[2rem] rounded-lg px-2 py-1 text-[11px] font-black tabular-nums transition ${
                        gridCols === c
                          ? 'bg-slate-800 text-white shadow-sm dark:bg-slate-600'
                          : 'text-slate-600 hover:bg-white/90 dark:text-slate-300 dark:hover:bg-slate-700/80'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className={`mt-5 ${resultsContainerClass}`}>
            {loading ? (
              <div className="flex w-full items-center justify-center gap-2 py-16 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                Loading events…
              </div>
            ) : sortedEvents.length === 0 ? (
              <div className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/50 px-8 py-16 text-center dark:border-slate-600 dark:bg-slate-800/30">
                <CalendarPlus
                  className="mx-auto h-10 w-10 text-slate-400"
                  strokeWidth={1.25}
                  aria-hidden
                />
                <p className="mt-4 font-display text-lg font-semibold text-slate-800 dark:text-slate-100">
                  No events yet
                </p>
                <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
                  Be the first to post an event for your campus.
                </p>
                {user ? (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-500"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add your first event
                  </button>
                ) : null}
              </div>
            ) : (
              sortedEvents.map((ev, index) =>
                eventsView === 'list' ? (
                  <EventListRow
                    key={ev._id}
                    ev={ev}
                    index={index}
                    user={user}
                    mergeEvent={mergeEvent}
                    onDelete={handleDelete}
                    deleteBusy={deleteBusy}
                  />
                ) : (
                  <EventGridCard
                    key={ev._id}
                    ev={ev}
                    index={index}
                    user={user}
                    mergeEvent={mergeEvent}
                    onDelete={handleDelete}
                    deleteBusy={deleteBusy}
                  />
                ),
              )
            )}
          </div>
        </div>
      </div>

      {createOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
            role="presentation"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close"
              onClick={() => {
                if (!saving) {
                  setCreateOpen(false);
                  resetCreateForm();
                }
              }}
            />
            <div
              role="dialog"
              aria-labelledby="event-create-title"
              className="relative z-[201] flex max-h-[min(92dvh,860px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="shrink-0 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2
                      id="event-create-title"
                      className="font-display text-lg font-bold text-slate-900 dark:text-white"
                    >
                      New event
                    </h2>
                    <p className="mt-0.5 max-w-[280px] text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      Cover and basics up front; link and capacity stay optional.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (!saving) {
                        setCreateOpen(false);
                        resetCreateForm();
                      }
                    }}
                    className="shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="h-5 w-5" aria-hidden />
                    <span className="sr-only">Close</span>
                  </button>
                </div>
              </div>
              <form
                onSubmit={handleCreate}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Cover <span className="text-rose-600">*</span>
                    </span>
                    <input
                      ref={coverInputRef}
                      id="event-cover-input"
                      type="file"
                      accept="image/*"
                      required
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setCoverPreviewUrl((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return file ? URL.createObjectURL(file) : null;
                        });
                      }}
                    />
                    <label
                      htmlFor="event-cover-input"
                      className="group block cursor-pointer"
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-cyan-50/40 ring-1 ring-slate-200/80 transition group-hover:border-cyan-400/60 group-hover:ring-cyan-500/20 dark:border-slate-600 dark:from-slate-800/80 dark:to-slate-900 dark:ring-slate-700">
                        {coverPreviewUrl ? (
                          <img
                            src={coverPreviewUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full min-h-[9rem] flex-col items-center justify-center gap-2 px-4 text-center">
                            <ImagePlus
                              className="h-10 w-10 text-cyan-600/70 dark:text-cyan-400/80"
                              strokeWidth={1.25}
                              aria-hidden
                            />
                            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                              Add cover photo
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              Shown on the grid and event page
                            </span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Title
                    </span>
                    <input
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                      maxLength={200}
                      placeholder="Workshop, social, info session…"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        Starts
                      </span>
                      <input
                        type="datetime-local"
                        required
                        value={startsAt}
                        onChange={(e) => setStartsAt(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        Ends (optional)
                      </span>
                      <input
                        type="datetime-local"
                        value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                      />
                    </label>
                  </div>
                  <p className="-mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                    Stored in UTC; displayed in your local time.
                  </p>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Description
                    </span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                      placeholder="What should attendees know?"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Location
                    </span>
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                      maxLength={300}
                      placeholder="Room, building, or online"
                    />
                  </label>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/90 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      Discovery
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Helps the right people find this on campus—year comes from
                      the start time.
                    </p>
                    <div className="mt-3 space-y-2">
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Academic field
                        </span>
                        <select
                          required
                          value={academicTrack}
                          onChange={(e) => {
                            setAcademicTrack(e.target.value);
                            setDepartment('');
                            setDepartmentOther('');
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        >
                          <option value="">Select…</option>
                          {ACADEMIC_TRACKS.map((tr) => (
                            <option key={tr.id} value={tr.id}>
                              {tr.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          School / faculty / department
                        </span>
                        <select
                          required
                          value={department}
                          disabled={!academicTrack}
                          onChange={(e) => {
                            setDepartment(e.target.value);
                            if (e.target.value !== 'Other')
                              setDepartmentOther('');
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950"
                        >
                          <option value="">
                            {academicTrack
                              ? 'Select…'
                              : 'Choose a field first'}
                          </option>
                          {deptList.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </label>
                      {department === 'Other' ? (
                        <label className="block">
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            Name your department
                          </span>
                          <input
                            required
                            value={departmentOther}
                            onChange={(e) =>
                              setDepartmentOther(e.target.value)
                            }
                            maxLength={160}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                            placeholder="Your school or unit"
                          />
                        </label>
                      ) : null}
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Visibility
                        </span>
                        <select
                          value={visibility}
                          onChange={(e) => setVisibility(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        >
                          <option value="public">
                            Public — listed in the app
                          </option>
                          <option value="unlisted">
                            Unlisted — link only
                          </option>
                          <option value="private">Private</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <details className="group rounded-2xl border border-slate-100 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40">
                    <summary className="cursor-pointer list-none py-2 text-xs font-bold uppercase tracking-wide text-slate-600 marker:hidden dark:text-slate-400 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center justify-between gap-2">
                        Optional extras
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
                      </span>
                    </summary>
                    <div className="space-y-3 pb-2 pt-1">
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Meeting link
                        </span>
                        <input
                          type="url"
                          value={meetingUrl}
                          onChange={(e) => setMeetingUrl(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                          placeholder="https://…"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Capacity (0 = unlimited)
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={capacity}
                          onChange={(e) => setCapacity(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        />
                      </label>
                    </div>
                  </details>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (!saving) {
                        setCreateOpen(false);
                        resetCreateForm();
                      }
                    }}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-50"
                  >
                    {saving ? 'Publishing…' : 'Publish event'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
