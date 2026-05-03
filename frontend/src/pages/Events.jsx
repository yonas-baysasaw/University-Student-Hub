import {
  CalendarPlus,
  ChevronRight,
  Clock,
  Heart,
  Loader2,
  MapPin,
  Plus,
  ThumbsDown,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { readJsonOrThrow } from '../utils/http';
import {
  ACADEMIC_TRACKS,
  academicTrackLabel,
  COURSE_SUBJECT_SUGGESTIONS,
  DEPARTMENTS_BY_TRACK,
  resolveDepartmentForSubmit,
  validateEventCatalogFields,
} from '../utils/bookUploadMeta';
import { visibilityLabel, visibilityTone } from '../utils/formatLabels';

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

/** One-line catalog trail (library-aligned). */
function eventCatalogSnippet(ev) {
  const parts = [];
  if (ev.academicTrack) parts.push(academicTrackLabel(ev.academicTrack));
  if (ev.department?.trim()) parts.push(ev.department.trim());
  if (ev.courseSubject?.trim()) parts.push(ev.courseSubject.trim());
  if (ev.publishYear != null && Number.isFinite(Number(ev.publishYear)))
    parts.push(String(ev.publishYear));
  return parts.join(' · ');
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
  const [courseSubject, setCourseSubject] = useState('');
  const [publishYear, setPublishYear] = useState('');
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
    setCourseSubject('');
    setPublishYear('');
    setVisibility('public');
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
      publishYear,
      courseSubject,
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
        publishYear: Math.floor(Number(publishYear)),
        courseSubject: courseSubject.trim(),
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
      setEvents((prev) =>
        [withMedia, ...prev].sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        ),
      );
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
              on posts and open details to reserve a seat or join the
              conversation.
            </p>
          </div>
          {user ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-900/20 transition hover:brightness-105"
            >
              <Plus className="h-4 w-4" aria-hidden />
              New event
            </button>
          ) : null}
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            Loading events…
          </div>
        ) : events.length === 0 ? (
          <div className="panel-card rounded-3xl border border-dashed border-slate-200/90 p-10 text-center dark:border-slate-700">
            <CalendarPlus
              className="mx-auto h-10 w-10 text-slate-400"
              strokeWidth={1.25}
              aria-hidden
            />
            <p className="mt-4 font-display text-lg font-semibold text-slate-800 dark:text-slate-100">
              No events yet
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Be the first to post an event for your campus.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((ev, index) => (
              <EventGridCard
                key={ev._id}
                ev={ev}
                index={index}
                user={user}
                mergeEvent={mergeEvent}
                onDelete={handleDelete}
                deleteBusy={deleteBusy}
              />
            ))}
          </div>
        )}
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
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                <h2
                  id="event-create-title"
                  className="font-display text-lg font-bold text-slate-900 dark:text-white"
                >
                  New event
                </h2>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (!saving) {
                      setCreateOpen(false);
                      resetCreateForm();
                    }
                  }}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" aria-hidden />
                  <span className="sr-only">Close</span>
                </button>
              </div>
              <form
                onSubmit={handleCreate}
                className="flex-1 space-y-3 overflow-y-auto p-4"
              >
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Cover photo <span className="text-rose-600">*</span>
                  </span>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    required
                    className="mt-1 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-600 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                  />
                </label>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/90 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Catalog
                  </p>
                  <div className="mt-2 space-y-2">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Field / track
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
                        Department
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
                          {academicTrack ? 'Select…' : 'Choose a field first'}
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
                          Department name
                        </span>
                        <input
                          required
                          value={departmentOther}
                          onChange={(e) => setDepartmentOther(e.target.value)}
                          maxLength={160}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                          placeholder="Your department or discipline"
                        />
                      </label>
                    ) : null}
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Course / subject
                      </span>
                      <input
                        required
                        list="event-course-suggestions"
                        value={courseSubject}
                        onChange={(e) => setCourseSubject(e.target.value)}
                        maxLength={200}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        placeholder="e.g. Operating Systems"
                      />
                      <datalist id="event-course-suggestions">
                        {COURSE_SUBJECT_SUGGESTIONS.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Year
                      </span>
                      <input
                        type="number"
                        required
                        min={1950}
                        max={2035}
                        value={publishYear}
                        onChange={(e) => setPublishYear(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        placeholder={String(new Date().getFullYear())}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Visibility
                      </span>
                      <select
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                      >
                        <option value="public">Public</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="private">Private</option>
                      </select>
                    </label>
                  </div>
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
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Description
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
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
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Location
                  </span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                    maxLength={300}
                    placeholder="Room, building, or address"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Meeting link (optional)
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
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    Capacity (optional, 0 = unlimited)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-2 w-full rounded-2xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 py-3 text-sm font-bold text-white shadow-md disabled:opacity-50"
                >
                  {saving ? 'Posting…' : 'Post event'}
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
