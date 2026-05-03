import {
  ArrowLeft,
  ChevronDown,
  Clock,
  ExternalLink,
  Heart,
  Loader2,
  MapPin,
  MessageSquare,
  Star,
  ThumbsDown,
  Ticket,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import defaultProfile from '../assets/profile.png';
import { useAuth } from '../contexts/AuthContext';
import { readJsonOrThrow } from '../utils/http';

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
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
        aria-expanded={open}
      >
        {Icon ? (
          <Icon className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
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
        <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-700">
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

  const [reserveOpen, setReserveOpen] = useState(true);
  const [reviewsOpen, setReviewsOpen] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(true);

  const [actionLoading, setActionLoading] = useState(false);
  const [userReaction, setUserReaction] = useState(null);

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewBody, setReviewBody] = useState('');
  const [reviewRating, setReviewRating] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDeletingId, setReviewDeletingId] = useState(null);
  const reviewDraftLoaded = useRef(false);

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [replyToId, setReplyToId] = useState(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentDeletingId, setCommentDeletingId] = useState(null);
  const [commentNotice, setCommentNotice] = useState('');

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

  const fetchComments = useCallback(async () => {
    if (!eventId) return;
    try {
      setCommentsLoading(true);
      const res = await fetch(`/api/events/${eventId}/comments`, {
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Could not load comments');
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId || loading || error || !event) return;
    fetchReviews();
    fetchComments();
  }, [eventId, loading, error, event, fetchReviews, fetchComments]);

  useEffect(() => {
    reviewDraftLoaded.current = false;
    setReviewBody('');
    setReviewRating('');
  }, [eventId]);

  useEffect(() => {
    if (reviewsLoading || reviewDraftLoaded.current) return;
    const mine = reviews.find((r) => r.viewerOwns);
    if (mine) {
      setReviewBody(mine.body);
      setReviewRating(
        mine.rating != null ? String(mine.rating) : '',
      );
    }
    reviewDraftLoaded.current = true;
  }, [reviewsLoading, reviews]);

  const ownerId = event?.organizer?.id;
  const isOrganizer =
    Boolean(user && ownerId && String(user._id || user.id) === String(ownerId));

  const topComments = useMemo(
    () => comments.filter((c) => !c.parentCommentId),
    [comments],
  );
  const repliesByParent = useMemo(() => {
    const m = {};
    for (const c of comments) {
      if (c.parentCommentId) {
        const k = String(c.parentCommentId);
        if (!m[k]) m[k] = [];
        m[k].push(c);
      }
    }
    return m;
  }, [comments]);

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
      toast.error('Sign in to reserve a seat.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/events/${event._id}/reserve`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Could not update reservation');
      applyEvent(data.data);
      toast.success(
        data.data?.viewerState?.reserved ? 'You are on the list' : 'Reservation cancelled',
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
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

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    setCommentNotice('');
    if (!user) {
      setCommentNotice('Sign in to comment.');
      return;
    }
    const text = commentBody.trim();
    if (!text) {
      setCommentNotice('Write something first.');
      return;
    }
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/events/${event._id}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: text,
          parentCommentId: replyToId,
        }),
      });
      await readJsonOrThrow(res, 'Could not post comment');
      setCommentBody('');
      setReplyToId(null);
      setCommentNotice('Posted.');
      await fetchComments();
    } catch (err) {
      setCommentNotice(err.message);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (cid) => {
    if (!event?._id || !cid) return;
    setCommentDeletingId(cid);
    setCommentNotice('');
    try {
      const res = await fetch(
        `/api/events/${event._id}/comments/${encodeURIComponent(cid)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      await readJsonOrThrow(res, 'Could not delete comment');
      await fetchComments();
    } catch (err) {
      setCommentNotice(err.message);
    } finally {
      setCommentDeletingId(null);
    }
  };

  const cap = event?.capacity;
  const reserved = event?.reservedCount ?? 0;
  const capLabel =
    cap != null && cap > 0
      ? `${reserved} / ${cap} seats`
      : `${reserved} attending`;

  return (
    <div className="page-surface min-h-[calc(100vh-5.5rem)] px-4 pb-14 pt-6 md:px-6 md:pt-8">
      <div className="mx-auto max-w-3xl space-y-6">
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
            <p className="text-slate-700 dark:text-slate-300">{error || 'Event not found.'}</p>
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
            <article className="panel-card space-y-4 rounded-[1.35rem] border border-slate-200/85 bg-gradient-to-br from-white via-white to-cyan-50/15 p-5 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/25 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  {event.title}
                </h1>
                {user ? (
                  <div className="flex flex-wrap gap-2">
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
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
                  {formatEventWhen(event.startsAt, event.endsAt)}
                </span>
                {event.location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
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
                  <UserRound className="ml-auto h-4 w-4 text-slate-400" aria-hidden />
                </Link>
              ) : null}
            </article>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Book this event
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Reserve a spot, read what people thought, or join the discussion.
                Tap a section header to expand or minimize it.
              </p>

              <div className="space-y-3">
                <CollapsibleSection
                  title="Reserve a seat"
                  icon={Ticket}
                  open={reserveOpen}
                  onToggle={() => setReserveOpen((v) => !v)}
                  summary={capLabel}
                >
                  <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                    {event.viewerState?.reserved
                      ? 'You have a spot. Cancel anytime.'
                      : cap != null && cap > 0 && reserved >= cap
                        ? 'This event is full.'
                        : 'Save your place so organizers can plan ahead.'}
                  </p>
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
                      ? 'Cancel reservation'
                      : 'Reserve my seat'}
                  </button>
                  {!user ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Sign in to reserve.
                    </p>
                  ) : null}
                </CollapsibleSection>

                <CollapsibleSection
                  title="People’s reviews"
                  icon={Star}
                  open={reviewsOpen}
                  onToggle={() => setReviewsOpen((v) => !v)}
                  summary={
                    reviewsLoading
                      ? 'Loading…'
                      : `${reviews.length} review${reviews.length === 1 ? '' : 's'}`
                  }
                >
                  {user ? (
                    <form onSubmit={handleReviewSubmit} className="mb-4 space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Rating (optional)
                        <select
                          value={reviewRating}
                          onChange={(e) => setReviewRating(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                        >
                          <option value="">No stars</option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={String(n)}>
                              {n} star{n > 1 ? 's' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <textarea
                        value={reviewBody}
                        onChange={(e) => setReviewBody(e.target.value)}
                        rows={3}
                        placeholder="Share your experience…"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                      />
                      <button
                        type="submit"
                        disabled={reviewSubmitting}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900"
                      >
                        {reviewSubmitting ? 'Saving…' : 'Save review'}
                      </button>
                    </form>
                  ) : (
                    <p className="mb-3 text-sm text-slate-500">Sign in to review.</p>
                  )}
                  {reviewsLoading ? (
                    <p className="text-sm text-slate-500">Loading reviews…</p>
                  ) : reviews.length === 0 ? (
                    <p className="text-sm text-slate-500">No reviews yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {reviews.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/40"
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
                                {r.viewerOwns ? (
                                  <button
                                    type="button"
                                    disabled={reviewDeletingId === r.id}
                                    onClick={() => handleDeleteReview(r.id)}
                                    className="text-[11px] font-bold text-rose-600"
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                              <p className="text-xs text-slate-500">
                                {formatReviewTimestamp(r.createdAt)}
                                {r.rating ? ` · ${r.rating}/5` : ''}
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

                <CollapsibleSection
                  title="Comments"
                  icon={MessageSquare}
                  open={commentsOpen}
                  onToggle={() => setCommentsOpen((v) => !v)}
                  summary={`${topComments.length} thread${topComments.length === 1 ? '' : 's'}`}
                >
                  {user ? (
                    <form onSubmit={handleCommentSubmit} className="mb-4 space-y-2">
                      {replyToId ? (
                        <p className="text-xs text-cyan-700 dark:text-cyan-400">
                          Replying —{' '}
                          <button
                            type="button"
                            className="font-bold underline"
                            onClick={() => setReplyToId(null)}
                          >
                            cancel
                          </button>
                        </p>
                      ) : null}
                      <textarea
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        rows={2}
                        placeholder="Ask a question or say hello…"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                      />
                      <button
                        type="submit"
                        disabled={commentSubmitting}
                        className="rounded-xl bg-cyan-700 px-4 py-2 text-xs font-bold text-white dark:bg-cyan-600"
                      >
                        {commentSubmitting ? 'Posting…' : 'Post comment'}
                      </button>
                      {commentNotice ? (
                        <p className="text-xs text-slate-600">{commentNotice}</p>
                      ) : null}
                    </form>
                  ) : (
                    <p className="mb-3 text-sm text-slate-500">Sign in to comment.</p>
                  )}
                  {commentsLoading ? (
                    <p className="text-sm text-slate-500">Loading…</p>
                  ) : topComments.length === 0 ? (
                    <p className="text-sm text-slate-500">No comments yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {topComments.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/30"
                        >
                          <div className="flex gap-2">
                            <img
                              src={c.author?.avatar || defaultProfile}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded-full object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                  {c.author?.name}
                                </span>
                                <div className="flex gap-2">
                                  {user ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyToId(c.id);
                                        setCommentNotice('');
                                      }}
                                      className="text-[11px] font-bold uppercase text-cyan-700 dark:text-cyan-400"
                                    >
                                      Reply
                                    </button>
                                  ) : null}
                                  {(c.viewerOwns || isOrganizer) && (
                                    <button
                                      type="button"
                                      disabled={commentDeletingId === c.id}
                                      onClick={() => handleDeleteComment(c.id)}
                                      className="text-[11px] font-bold text-rose-600"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-slate-500">
                                {formatReviewTimestamp(c.createdAt)}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                                {c.body}
                              </p>
                              {(repliesByParent[c.id] || []).length > 0 ? (
                                <ul className="mt-2 space-y-2 border-l-2 border-cyan-200/60 pl-3 dark:border-cyan-800">
                                  {(repliesByParent[c.id] || []).map((r) => (
                                    <li key={r.id}>
                                      <div className="flex gap-2">
                                        <img
                                          src={r.author?.avatar || defaultProfile}
                                          alt=""
                                          className="h-7 w-7 rounded-full object-cover"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                              {r.author?.name}
                                            </span>
                                            {(r.viewerOwns || isOrganizer) && (
                                              <button
                                                type="button"
                                                disabled={
                                                  commentDeletingId === r.id
                                                }
                                                onClick={() =>
                                                  handleDeleteComment(r.id)
                                                }
                                                className="text-[10px] font-bold text-rose-600"
                                              >
                                                Delete
                                              </button>
                                            )}
                                          </div>
                                          <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                                            {r.body}
                                          </p>
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
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
    </div>
  );
}
