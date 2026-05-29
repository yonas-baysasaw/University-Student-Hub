import {
  ArrowLeft,
  ChevronDown,
  Clock,
  ExternalLink,
  Heart,
  ImagePlus,
  Loader2,
  MapPin,
  Pencil,
  Star,
  ThumbsDown,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import defaultProfile from '../assets/profile.png';
import BookEventReportMenu from '../components/report/BookEventReportMenu.jsx';
import { useAuth } from '../contexts/AuthContext';
import {
  ACADEMIC_TRACKS,
  academicTrackLabel,
  DEPARTMENTS_BY_TRACK,
  resolveDepartmentForSubmit,
  validateEventCatalogFields,
} from '../utils/bookUploadMeta';
import { notifyCalendarInvalidate } from '../utils/calendarEvents.js';
import { visibilityLabel, visibilityTone } from '../utils/formatLabels';
import { readJsonOrThrow } from '../utils/http';

const MAX_EVENT_MEDIA = 12;

function formatReviewTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatEventWhen(startsAt, endsAt) {
  try {
    const s = new Date(startsAt);
    if (Number.isNaN(s.getTime())) return '';
    const line = s.toLocaleString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    if (!endsAt) return line;
    const e = new Date(endsAt);
    if (Number.isNaN(e.getTime())) return line;
    return `${line} — ends ${e.toLocaleString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  } catch {
    return '';
  }
}

function toDateTimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function buildEventEditDraft(event) {
  const academicTrack = String(event?.academicTrack || '')
    .trim()
    .toLowerCase();
  const dept = String(event?.department || '').trim();
  const deptOptions = DEPARTMENTS_BY_TRACK[academicTrack] || [];
  const usesOtherDepartment = dept && !deptOptions.includes(dept);

  return {
    title: event?.title || '',
    description: event?.description || '',
    startsAt: toDateTimeLocalValue(event?.startsAt),
    endsAt: toDateTimeLocalValue(event?.endsAt),
    location: event?.location || '',
    meetingUrl: event?.meetingUrl || '',
    capacity: event?.capacity != null ? String(event.capacity) : '',
    academicTrack,
    department: usesOtherDepartment ? 'Other' : dept,
    departmentOther: usesOtherDepartment ? dept : '',
    visibility: event?.visibility || 'public',
  };
}

function CollapsibleSection({
  title,
  icon: Icon,
  open,
  onToggle,
  summary,
  children,
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white dark:border-slate-600 dark:bg-slate-900/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
        aria-expanded={open}
      >
        {Icon ? (
          <Icon
            className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400"
            aria-hidden
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
            {title}
          </span>
          {summary ? (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {summary}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [guestsOpen, setGuestsOpen] = useState(true);
  const [reviewsOpen, setReviewsOpen] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);
  const [userReaction, setUserReaction] = useState(null);
  const [guestQuery, setGuestQuery] = useState('');
  const [guestResults, setGuestResults] = useState([]);
  const [guestSearchBusy, setGuestSearchBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState(() => buildEventEditDraft(null));
  const mediaInputRef = useRef(null);
  const guestSearchInputRef = useRef(null);

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewBody, setReviewBody] = useState('');
  const [reviewRating, setReviewRating] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDeletingId, setReviewDeletingId] = useState(null);
  const reviewDraftLoaded = useRef(false);

  const applyEvent = useCallback((payload) => {
    setEvent(payload);
    const vs = payload?.viewerState;
    if (vs?.liked) setUserReaction('like');
    else if (vs?.disliked) setUserReaction('dislike');
    else setUserReaction(null);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!eventId) {
        setError('Missing event');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`/api/events/${eventId}`, {
          credentials: 'include',
        });
        const data = await readJsonOrThrow(res, 'Could not load event');
        if (!active) return;
        applyEvent(data.data);
      } catch (e) {
        if (active) {
          setError(e.message || 'Could not load event');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [eventId, applyEvent]);

  const fetchReviews = useCallback(async () => {
    if (!eventId) return;
    try {
      setReviewsLoading(true);
      const res = await fetch(`/api/events/${eventId}/reviews`, {
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Could not load reviews');
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId || loading || error || !event) return;
    fetchReviews();
  }, [eventId, loading, error, event, fetchReviews]);

  useEffect(() => {
    if (!eventId) return;
    reviewDraftLoaded.current = false;
    setReviewBody('');
    setReviewRating('');
  }, [eventId]);

  useEffect(() => {
    if (reviewsLoading || reviewDraftLoaded.current) return;
    const mine = reviews.find((r) => r.viewerOwns);
    if (mine) {
      setReviewBody(mine.body);
      setReviewRating(mine.rating != null ? String(mine.rating) : '');
    }
    reviewDraftLoaded.current = true;
  }, [reviewsLoading, reviews]);

  const ownerId = event?.organizer?.id;
  const isOrganizer = Boolean(
    user && ownerId && String(user._id || user.id) === String(ownerId),
  );
  const editDeptList = editForm.academicTrack
    ? DEPARTMENTS_BY_TRACK[editForm.academicTrack] || []
    : [];
  const ownReview = useMemo(
    () => reviews.find((r) => r.viewerOwns) || null,
    [reviews],
  );
  const averageRating = useMemo(() => {
    const rated = reviews.filter((r) => r.rating != null);
    if (!rated.length) return null;
    const total = rated.reduce((sum, r) => sum + Number(r.rating || 0), 0);
    return total / rated.length;
  }, [reviews]);

  useEffect(() => {
    if (!isOrganizer) {
      setGuestResults([]);
      return;
    }
    const q = guestQuery.trim();
    if (q.length < 2) {
      setGuestResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setGuestSearchBusy(true);
      try {
        const res = await fetch(
          `/api/profile/users/search?q=${encodeURIComponent(q)}`,
          { credentials: 'include' },
        );
        const data = await readJsonOrThrow(res, 'Could not search users');
        setGuestResults(Array.isArray(data.users) ? data.users : []);
      } catch {
        setGuestResults([]);
      } finally {
        setGuestSearchBusy(false);
      }
    }, 320);
    return () => clearTimeout(t);
  }, [guestQuery, isOrganizer]);

  const updateEditField = (field, value) => {
    setEditForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'academicTrack') {
        next.department = '';
        next.departmentOther = '';
      }
      if (field === 'department' && value !== 'Other') {
        next.departmentOther = '';
      }
      return next;
    });
  };

  const openEditModal = () => {
    if (!event || !isOrganizer) return;
    setEditForm(buildEventEditDraft(event));
    setEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!event?._id || !isOrganizer) return;

    const t = editForm.title.trim();
    if (!t) {
      toast.error('Title is required.');
      return;
    }
    if (!editForm.startsAt) {
      toast.error('Start date and time are required.');
      return;
    }

    const resolvedDept = resolveDepartmentForSubmit(editForm);
    const catErr = validateEventCatalogFields({
      academicTrack: editForm.academicTrack,
      department: resolvedDept,
    });
    if (catErr) {
      toast.error(catErr);
      return;
    }

    const body = {
      title: t,
      description: editForm.description.trim(),
      startsAt: new Date(editForm.startsAt).toISOString(),
      location: editForm.location.trim(),
      meetingUrl: editForm.meetingUrl.trim(),
      capacity: editForm.capacity.trim(),
      academicTrack: editForm.academicTrack,
      department: resolvedDept,
      visibility: editForm.visibility,
    };
    if (editForm.endsAt) body.endsAt = new Date(editForm.endsAt).toISOString();

    setEditSaving(true);
    try {
      const res = await fetch(`/api/events/${event._id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await readJsonOrThrow(res, 'Could not update event');
      applyEvent(data.data);
      setEditOpen(false);
      notifyCalendarInvalidate();
      toast.success('Event updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleReaction = async (type) => {
    if (!event?._id || !user || actionLoading) return;
    setActionLoading(true);
    const nextReaction = type === userReaction ? 'none' : type;
    try {
      const res = await fetch(`/api/events/${event._id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reaction: nextReaction }),
      });
      const data = await readJsonOrThrow(res, 'Could not update reaction');
      applyEvent(data.data);
      toast.success(nextReaction === 'none' ? 'Reaction cleared' : 'Saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReserve = async () => {
    if (!event?._id || !user) {
      toast.error('Sign in to join this event.');
      return;
    }
    if (isOrganizer) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/events/${event._id}/reserve`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Could not update reservation');
      applyEvent(data.data);
      toast.success(
        data.data?.viewerState?.reserved
          ? 'You are on the list'
          : 'You left this event',
      );
      notifyCalendarInvalidate();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const addGuest = async (targetUserId) => {
    if (!event?._id || !isOrganizer || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/events/${event._id}/attendees`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const data = await readJsonOrThrow(res, 'Could not add guest');
      applyEvent(data.data);
      setGuestQuery('');
      setGuestResults([]);
      toast.success('Guest added');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const removeAttendee = async (targetUserId) => {
    if (!event?._id || !isOrganizer) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/events/${event._id}/attendees/${encodeURIComponent(targetUserId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      const data = await readJsonOrThrow(res, 'Could not remove guest');
      applyEvent(data.data);
      toast.success('Removed from list');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const uploadEventMedia = async (fileList) => {
    if (!event?._id || !isOrganizer || !fileList?.length) return;
    const urls = event.mediaUrls || [];
    const slots = MAX_EVENT_MEDIA - urls.length;
    const files = Array.from(fileList).slice(0, Math.max(0, slots));
    if (!files.length) {
      toast.error(`At most ${MAX_EVENT_MEDIA} photos per event.`);
      return;
    }
    setMediaBusy(true);
    try {
      let nextPayload = event;
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`/api/events/${event._id}/media`, {
          method: 'POST',
          credentials: 'include',
          body: fd,
        });
        const data = await readJsonOrThrow(res, 'Upload failed');
        if (data.data) nextPayload = data.data;
      }
      if (nextPayload) applyEvent(nextPayload);
      toast.success(files.length > 1 ? 'Photos uploaded' : 'Photo uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setMediaBusy(false);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  const removeEventMedia = async (url) => {
    if (!event?._id || !isOrganizer) return;
    setMediaBusy(true);
    try {
      const res = await fetch(`/api/events/${event._id}/media`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await readJsonOrThrow(res, 'Could not remove image');
      if (data.data) applyEvent(data.data);
      toast.success('Photo removed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setMediaBusy(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Sign in to review.');
      return;
    }
    const text = reviewBody.trim();
    if (!text) {
      toast.error('Write your review first.');
      return;
    }
    setReviewSubmitting(true);
    try {
      const body = { body: text };
      if (reviewRating) body.rating = Number(reviewRating);
      const res = await fetch(`/api/events/${event._id}/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await readJsonOrThrow(res, 'Could not save review');
      toast.success('Review saved');
      await fetchReviews();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (rid) => {
    if (!event?._id || !rid) return;
    setReviewDeletingId(rid);
    try {
      const res = await fetch(
        `/api/events/${event._id}/reviews/${encodeURIComponent(rid)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      await readJsonOrThrow(res, 'Could not delete review');
      setReviewBody('');
      setReviewRating('');
      reviewDraftLoaded.current = false;
      await fetchReviews();
      toast.success('Review removed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReviewDeletingId(null);
    }
  };

  const cap = event?.capacity;
  const reserved = event?.reservedCount ?? 0;
  const attendees = Array.isArray(event?.attendees) ? event.attendees : [];
  const mediaUrls = Array.isArray(event?.mediaUrls) ? event.mediaUrls : [];
  const capLabel =
    cap != null && cap > 0
      ? `${reserved} / ${cap} guests`
      : `${reserved} guests`;
  const peopleAttendingLabel =
    reserved === 1 ? '1 person attending' : `${reserved} people attending`;

  return (
    <div className="page-surface min-h-[calc(100vh-5.5rem)] px-3 pb-8 pt-3 md:px-6 md:pb-10 md:pt-5">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          to="/events"
          className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900 dark:text-cyan-400 dark:hover:text-cyan-200"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All events
        </Link>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : error || !event ? (
          <div className="panel-card rounded-3xl p-8 text-center">
            <p className="text-slate-700 dark:text-slate-300">
              {error || 'Event not found.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/events')}
              className="btn-secondary mt-4 px-4 py-2 text-sm"
            >
              Back to events
            </button>
          </div>
        ) : (
          <>
            <article className="panel-card space-y-3 rounded-[1.35rem] border border-slate-200/85 bg-gradient-to-br from-white via-white to-cyan-50/15 p-4 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/25 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-lg bg-cyan-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-900 ring-1 ring-cyan-500/25 dark:bg-cyan-500/15 dark:text-cyan-100 dark:ring-cyan-400/30">
                      Event
                    </span>
                    {event.academicTrack ? (
                      <span className="rounded-lg bg-indigo-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-900 ring-1 ring-indigo-500/25 dark:bg-indigo-500/15 dark:text-indigo-100 dark:ring-indigo-400/30">
                        {academicTrackLabel(event.academicTrack)}
                      </span>
                    ) : null}
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${visibilityTone(event.visibility)}`}
                    >
                      {visibilityLabel(event.visibility)}
                    </span>
                  </div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                    {event.title}
                  </h1>
                </div>
                {user ? (
                  <div className="flex flex-wrap gap-2">
                    {isOrganizer ? (
                      <button
                        type="button"
                        onClick={openEditModal}
                        className="inline-flex items-center gap-1 rounded-xl border border-cyan-200 bg-cyan-50/80 px-3 py-2 text-xs font-bold text-cyan-900 transition hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                        Edit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleReaction('like')}
                      className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold ${
                        userReaction === 'like'
                          ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100'
                          : 'border-slate-200 text-slate-700 dark:border-slate-600 dark:text-slate-200'
                      }`}
                    >
                      <Heart
                        className={`h-4 w-4 ${userReaction === 'like' ? 'fill-current' : ''}`}
                        aria-hidden
                      />
                      {event.likesCount ?? 0}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleReaction('dislike')}
                      className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold ${
                        userReaction === 'dislike'
                          ? 'border-slate-600 bg-slate-800 text-white'
                          : 'border-slate-200 text-slate-700 dark:border-slate-600 dark:text-slate-200'
                      }`}
                    >
                      <ThumbsDown
                        className={`h-4 w-4 ${userReaction === 'dislike' ? 'fill-current' : ''}`}
                        aria-hidden
                      />
                      {event.dislikesCount ?? 0}
                    </button>
                    {event._id ? (
                      <BookEventReportMenu
                        targetType="event"
                        targetId={String(event._id)}
                        shareUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/events/${event._id}`}
                        hideReport={isOrganizer}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Clock
                    className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400"
                    aria-hidden
                  />
                  {formatEventWhen(event.startsAt, event.endsAt)}
                </span>
                {event.location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin
                      className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400"
                      aria-hidden
                    />
                    {event.location}
                  </span>
                ) : null}
              </div>

              {event.meetingUrl ? (
                <a
                  href={event.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50/80 px-4 py-2.5 text-sm font-bold text-cyan-900 transition hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  Join link
                </a>
              ) : null}

              {event.academicTrack ||
              event.department ||
              event.courseSubject ||
              (event.publishYear != null &&
                Number.isFinite(Number(event.publishYear))) ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50/95 px-3 py-3 dark:border-slate-600/70 dark:bg-slate-800/65">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Catalog
                  </p>
                  <ul className="mt-1.5 space-y-1 text-[12px] font-medium leading-snug text-slate-800 dark:text-slate-100">
                    {event.academicTrack ? (
                      <li>
                        <span className="text-slate-600 dark:text-slate-300">
                          Field ·{' '}
                        </span>
                        {academicTrackLabel(event.academicTrack)}
                      </li>
                    ) : null}
                    {event.department ? (
                      <li>
                        <span className="text-slate-600 dark:text-slate-300">
                          Dept ·{' '}
                        </span>
                        {event.department}
                      </li>
                    ) : null}
                    {event.courseSubject ? (
                      <li>
                        <span className="text-slate-600 dark:text-slate-300">
                          Course ·{' '}
                        </span>
                        {event.courseSubject}
                      </li>
                    ) : null}
                    {event.publishYear != null &&
                    Number.isFinite(Number(event.publishYear)) ? (
                      <li>
                        <span className="text-slate-600 dark:text-slate-300">
                          Year ·{' '}
                        </span>
                        {event.publishYear}
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              {event.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {event.description}
                </p>
              ) : null}

              {event.organizer ? (
                <Link
                  to={`/users/${event.organizer.id}`}
                  className="inline-flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/80 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800/40"
                >
                  <img
                    src={event.organizer.avatar || defaultProfile}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Host
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {event.organizer.name}
                    </p>
                  </div>
                  <UserRound
                    className="ml-auto h-4 w-4 text-slate-400"
                    aria-hidden
                  />
                </Link>
              ) : null}
            </article>

            {mediaUrls.length > 0 || isOrganizer ? (
              <div className="space-y-3">
                {mediaUrls.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200/90 dark:ring-slate-600">
                    <div className="grid grid-cols-3 gap-0.5 bg-slate-100 dark:bg-slate-800">
                      {mediaUrls.map((url) => (
                        <div
                          key={url}
                          className="relative aspect-square bg-slate-200 dark:bg-slate-900"
                        >
                          <img
                            src={url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          {isOrganizer ? (
                            <button
                              type="button"
                              disabled={mediaBusy}
                              onClick={() => removeEventMedia(url)}
                              className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/70 text-white shadow-md backdrop-blur-sm transition hover:bg-rose-600 disabled:opacity-50"
                              aria-label="Remove photo"
                            >
                              <X className="h-4 w-4" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {isOrganizer && mediaUrls.length < MAX_EVENT_MEDIA ? (
                  <div>
                    <input
                      ref={mediaInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => uploadEventMedia(e.target.files)}
                    />
                    <button
                      type="button"
                      disabled={mediaBusy}
                      onClick={() => mediaInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:border-cyan-400/60 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {mediaBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <ImagePlus
                          className="h-4 w-4 text-cyan-600 dark:text-cyan-400"
                          aria-hidden
                        />
                      )}
                      Add photos ({mediaUrls.length}/{MAX_EVENT_MEDIA})
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Book this event
              </h2>

              <div className="space-y-3">
                <CollapsibleSection
                  title={isOrganizer ? 'Guests' : 'RSVP'}
                  icon={UserPlus}
                  open={guestsOpen}
                  onToggle={() => setGuestsOpen((v) => !v)}
                  summary={
                    isOrganizer
                      ? capLabel
                      : peopleAttendingLabel +
                        (cap != null && cap > 0 ? ` · ${cap} max` : '')
                  }
                >
                  {isOrganizer ? (
                    <>
                      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                        <div className="relative min-w-0 flex-1">
                          <input
                            ref={guestSearchInputRef}
                            type="search"
                            value={guestQuery}
                            onChange={(e) => setGuestQuery(e.target.value)}
                            placeholder="Search by name or username…"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                          />
                          {guestQuery.trim().length >= 2 &&
                          guestResults.length > 0 ? (
                            <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900">
                              {guestResults.map((g) => (
                                <li key={g.id}>
                                  <button
                                    type="button"
                                    disabled={
                                      actionLoading ||
                                      attendees.some((a) => a.id === g.id)
                                    }
                                    onClick={() => addGuest(g.id)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cyan-50 dark:hover:bg-slate-800 disabled:opacity-50"
                                  >
                                    <img
                                      src={g.avatar || defaultProfile}
                                      alt=""
                                      className="h-8 w-8 rounded-full object-cover"
                                    />
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                      {g.name}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      @{g.username}
                                    </span>
                                    {attendees.some((a) => a.id === g.id) ? (
                                      <span className="ml-auto text-[11px] font-bold uppercase text-emerald-600">
                                        Added
                                      </span>
                                    ) : (
                                      <span className="ml-auto text-[11px] font-bold uppercase text-cyan-600">
                                        Add
                                      </span>
                                    )}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {guestSearchBusy ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Searching…
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setGuestsOpen(true);
                            guestSearchInputRef.current?.focus();
                          }}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-105 sm:w-auto"
                        >
                          <UserPlus className="h-4 w-4" aria-hidden />
                          Add guest
                        </button>
                      </div>
                      {attendees.length === 0 ? (
                        <p className="text-sm text-slate-500">No guests yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {attendees.map((a) => (
                            <li
                              key={a.id}
                              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40"
                            >
                              <img
                                src={a.avatar || defaultProfile}
                                alt=""
                                className="h-9 w-9 rounded-full object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <Link
                                  to={`/users/${a.id}`}
                                  className="font-semibold text-slate-900 hover:underline dark:text-white"
                                >
                                  {a.name}
                                </Link>
                                <p className="text-xs text-slate-500">
                                  @{a.username}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => removeAttendee(a.id)}
                                className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                        {peopleAttendingLabel}.
                        {cap != null && cap > 0 ? ` Capacity is ${cap}.` : ''}{' '}
                        Guest names are visible only to the host.
                      </p>
                      {user ? (
                        <button
                          type="button"
                          disabled={
                            actionLoading ||
                            (!event.viewerState?.reserved &&
                              cap != null &&
                              cap > 0 &&
                              reserved >= cap)
                          }
                          onClick={handleReserve}
                          className={`rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-md transition disabled:opacity-50 ${
                            event.viewerState?.reserved
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:brightness-105'
                          }`}
                        >
                          {event.viewerState?.reserved
                            ? 'Leave this event'
                            : "I'm attending"}
                        </button>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Sign in to RSVP.
                        </p>
                      )}
                    </>
                  )}
                </CollapsibleSection>

                <CollapsibleSection
                  title="Reviews"
                  icon={Star}
                  open={reviewsOpen}
                  onToggle={() => setReviewsOpen((v) => !v)}
                  summary={
                    reviewsLoading
                      ? 'Loading…'
                      : averageRating
                        ? `${averageRating.toFixed(1)}/5 · ${reviews.length} review${reviews.length === 1 ? '' : 's'}`
                        : `${reviews.length} review${reviews.length === 1 ? '' : 's'}`
                  }
                >
                  {user ? (
                    <form
                      onSubmit={handleReviewSubmit}
                      className="mb-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/30"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          {ownReview ? 'Update your review' : 'Add your review'}
                        </p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((n) => {
                            const selected = Number(reviewRating) >= n;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setReviewRating(String(n))}
                                className={`rounded-md p-1 transition ${
                                  selected
                                    ? 'text-amber-500'
                                    : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'
                                }`}
                                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                              >
                                <Star
                                  className={`h-4 w-4 ${selected ? 'fill-current' : ''}`}
                                  aria-hidden
                                />
                              </button>
                            );
                          })}
                          {reviewRating ? (
                            <button
                              type="button"
                              onClick={() => setReviewRating('')}
                              className="ml-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                              Clear
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <textarea
                        value={reviewBody}
                        onChange={(e) => setReviewBody(e.target.value)}
                        rows={2}
                        placeholder="Share your experience…"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="submit"
                          disabled={reviewSubmitting}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900"
                        >
                          {reviewSubmitting
                            ? 'Saving…'
                            : ownReview
                              ? 'Update review'
                              : 'Save review'}
                        </button>
                        {ownReview ? (
                          <button
                            type="button"
                            disabled={reviewDeletingId === ownReview.id}
                            onClick={() => handleDeleteReview(ownReview.id)}
                            className="rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </form>
                  ) : (
                    <p className="mb-2 text-sm text-slate-500">
                      Sign in to review.
                    </p>
                  )}
                  {reviewsLoading ? (
                    <p className="text-sm text-slate-500">Loading reviews…</p>
                  ) : reviews.length === 0 ? (
                    <p className="text-sm text-slate-500">No reviews yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {reviews.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-xl border border-slate-100 bg-white/75 p-3 dark:border-slate-700 dark:bg-slate-950/40"
                        >
                          <div className="flex items-start gap-2">
                            <img
                              src={r.author?.avatar || defaultProfile}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                  {r.author?.name}
                                </span>
                                {r.rating ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                                    <Star
                                      className="h-3 w-3 fill-current"
                                      aria-hidden
                                    />
                                    {r.rating}/5
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs text-slate-500">
                                {formatReviewTimestamp(r.createdAt)}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                                {r.body}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CollapsibleSection>
              </div>
            </section>
          </>
        )}
      </div>
      {editOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
            role="presentation"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close"
              onClick={() => {
                if (!editSaving) setEditOpen(false);
              }}
            />
            <div
              role="dialog"
              aria-labelledby="event-edit-title"
              className="relative z-[201] flex max-h-[min(92dvh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="shrink-0 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2
                      id="event-edit-title"
                      className="font-display text-lg font-bold text-slate-900 dark:text-white"
                    >
                      Edit event
                    </h2>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      Update the details attendees see.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={editSaving}
                    onClick={() => setEditOpen(false)}
                    className="shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
                  >
                    <X className="h-5 w-5" aria-hidden />
                    <span className="sr-only">Close</span>
                  </button>
                </div>
              </div>
              <form
                onSubmit={handleEditSubmit}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Title
                    </span>
                    <input
                      required
                      value={editForm.title}
                      onChange={(e) => updateEditField('title', e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                      maxLength={200}
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
                        value={editForm.startsAt}
                        onChange={(e) =>
                          updateEditField('startsAt', e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        Ends
                      </span>
                      <input
                        type="datetime-local"
                        value={editForm.endsAt}
                        onChange={(e) =>
                          updateEditField('endsAt', e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Description
                    </span>
                    <textarea
                      value={editForm.description}
                      onChange={(e) =>
                        updateEditField('description', e.target.value)
                      }
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        Location
                      </span>
                      <input
                        value={editForm.location}
                        onChange={(e) =>
                          updateEditField('location', e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        maxLength={300}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        Capacity
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={editForm.capacity}
                        onChange={(e) =>
                          updateEditField('capacity', e.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        placeholder="0 = unlimited"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Meeting link
                    </span>
                    <input
                      type="url"
                      value={editForm.meetingUrl}
                      onChange={(e) =>
                        updateEditField('meetingUrl', e.target.value)
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                      placeholder="https://..."
                    />
                  </label>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/90 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      Catalog
                    </p>
                    <div className="mt-2 space-y-2">
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Academic field
                        </span>
                        <select
                          required
                          value={editForm.academicTrack}
                          onChange={(e) =>
                            updateEditField('academicTrack', e.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        >
                          <option value="">Select...</option>
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
                          value={editForm.department}
                          disabled={!editForm.academicTrack}
                          onChange={(e) =>
                            updateEditField('department', e.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950"
                        >
                          <option value="">
                            {editForm.academicTrack
                              ? 'Select...'
                              : 'Choose a field first'}
                          </option>
                          {editDeptList.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </label>
                      {editForm.department === 'Other' ? (
                        <label className="block">
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            Name your department
                          </span>
                          <input
                            required
                            value={editForm.departmentOther}
                            onChange={(e) =>
                              updateEditField('departmentOther', e.target.value)
                            }
                            maxLength={160}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                          />
                        </label>
                      ) : null}
                      <label className="block">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Visibility
                        </span>
                        <select
                          value={editForm.visibility}
                          onChange={(e) =>
                            updateEditField('visibility', e.target.value)
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-950"
                        >
                          <option value="public">Public</option>
                          <option value="unlisted">Unlisted</option>
                          <option value="private">Private</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
                  <button
                    type="button"
                    disabled={editSaving}
                    onClick={() => setEditOpen(false)}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="rounded-2xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-50"
                  >
                    {editSaving ? 'Saving...' : 'Save changes'}
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
