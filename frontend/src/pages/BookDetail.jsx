import {
  ArrowLeft,
  Bookmark,
  Calendar,
  ChevronRight,
  Download,
  Eye,
  GraduationCap,
  Heart,
  Library,
  MessageSquare,
  Pencil,
  Share2,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import defaultProfile from '../assets/profile.png';
import { useAuth } from '../contexts/AuthContext';
import {
  formatLibraryDateTime,
  humanizeFormat,
  topicIfDistinct,
  visibilityLabel,
  visibilityTone,
} from '../utils/formatLabels';
import EditBookMetaModal from '../components/EditBookMetaModal';
import { academicTrackLabel } from '../utils/bookUploadMeta';
import { safeInternalPath } from '../utils/safeRedirect';

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

function BookDetail() {
  const { bookId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [userReaction, setUserReaction] = useState(null);
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [downloadsCount, setDownloadsCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(0);

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [reviewRating, setReviewRating] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDeletingId, setReviewDeletingId] = useState(null);
  const [reviewNotice, setReviewNotice] = useState('');
  const reviewDraftLoaded = useRef(false);

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [deletingBook, setDeletingBook] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [replyToId, setReplyToId] = useState(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentDeletingId, setCommentDeletingId] = useState(null);
  const [commentNotice, setCommentNotice] = useState('');

  const applyBookState = useCallback((loadedBook) => {
    setBook(loadedBook);
    setLikesCount(
      Number.isFinite(loadedBook?.likesCount) ? loadedBook.likesCount : 0,
    );
    setDislikesCount(
      Number.isFinite(loadedBook?.dislikesCount) ? loadedBook.dislikesCount : 0,
    );
    setDownloadsCount(
      Number.isFinite(loadedBook?.views) ? loadedBook.views : 0,
    );
    if (loadedBook?.viewerState?.liked) {
      setUserReaction('like');
    } else if (loadedBook?.viewerState?.disliked) {
      setUserReaction('dislike');
    } else {
      setUserReaction(null);
    }
    setIsSaved(Boolean(loadedBook?.viewerState?.saved));
    setIsSubscribed(Boolean(loadedBook?.uploader?.viewerSubscribed));
    setSubscribersCount(
      Number.isFinite(loadedBook?.uploader?.subscribersCount)
        ? loadedBook.uploader.subscribersCount
        : 0,
    );
  }, []);

  useEffect(() => {
    let active = true;

    const loadBook = async () => {
      try {
        setLoading(true);
        setError('');
        setAuthRequired(false);

        const res = await fetch(`/api/books/${bookId}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (res.status === 401 && data?.code === 'AUTH_REQUIRED') {
            if (!active) return;
            setAuthRequired(true);
            setLoading(false);
            return;
          }
          throw new Error(data?.message || 'Failed to load book details');
        }

        if (!active) return;
        const loadedBook = data?.data || null;
        applyBookState(loadedBook);
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Could not load this book');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (!bookId) {
      setError('Missing book id');
      setLoading(false);
      return;
    }

    loadBook();
    return () => {
      active = false;
    };
  }, [bookId, applyBookState]);

  const fetchReviews = useCallback(async () => {
    if (!bookId) return;
    try {
      setReviewsLoading(true);
      setReviewsError('');
      const res = await fetch(`/api/books/${bookId}/reviews`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Could not load reviews');
      }
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch (err) {
      setReviewsError(err?.message || 'Could not load reviews');
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [bookId]);

  const fetchComments = useCallback(async () => {
    if (!bookId) return;
    try {
      setCommentsLoading(true);
      setCommentsError('');
      const res = await fetch(`/api/books/${bookId}/comments`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Could not load discussion');
      }
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (err) {
      setCommentsError(err?.message || 'Could not load discussion');
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    reviewDraftLoaded.current = false;
    setReviewBody('');
    setReviewRating(null);
    setReviewNotice('');
    setCommentBody('');
    setReplyToId(null);
    setCommentNotice('');
  }, [bookId]);

  useEffect(() => {
    if (!bookId || loading || error || authRequired || !book) return;
    fetchComments();
  }, [bookId, loading, error, authRequired, book, fetchComments]);

  useEffect(() => {
    if (reviewsLoading || reviewDraftLoaded.current) return;
    const mine = reviews.find((r) => r.viewerOwns);
    if (mine) {
      setReviewBody(mine.body);
      setReviewRating(mine.rating ?? null);
    }
    reviewDraftLoaded.current = true;
  }, [reviewsLoading, reviews]);

  const handleDownload = async () => {
    if (!book?.bookUrl) return;

    try {
      const res = await fetch(`/api/books/${book._id}/download`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDownloadsCount(
          Number.isFinite(data?.views) ? data.views : downloadsCount + 1,
        );
      }
    } catch {
      // Ignore tracking failures and continue with file download.
    }

    const link = document.createElement('a');
    link.href = book.bookUrl;
    link.download = '';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setActionMessage('Download started.');
  };

  const handleReaction = async (type) => {
    if (!book?._id || actionLoading) return;
    setActionLoading(true);
    setActionMessage('');

    const nextReaction = type === userReaction ? 'none' : type;

    try {
      const res = await fetch(`/api/books/${book._id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reaction: nextReaction }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Please sign in to react to this book.');
        }
        throw new Error(data?.message || 'Could not update reaction');
      }

      applyBookState(data?.data || book);
      setActionMessage(
        nextReaction === 'none'
          ? 'Reaction removed.'
          : `Marked as ${nextReaction}.`,
      );
    } catch (err) {
      setActionMessage(err?.message || 'Could not update reaction.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: book?.title || 'Book detail',
          text: 'Check out this book',
          url: shareUrl,
        });
        setActionMessage('Shared successfully.');
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setActionMessage('Link copied to clipboard.');
        return;
      }

      setActionMessage('Sharing is not supported on this device.');
    } catch {
      setActionMessage('Share cancelled.');
    }
  };

  const handleSave = async () => {
    if (!book?._id || actionLoading) return;
    setActionLoading(true);
    setActionMessage('');

    try {
      const res = await fetch(`/api/books/${book._id}/save`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Please sign in to save this book.');
        }
        throw new Error(data?.message || 'Could not update saved state');
      }

      applyBookState(data?.data || book);
      setActionMessage(
        data?.saved ? 'Book saved.' : 'Removed from saved books.',
      );
    } catch (err) {
      setActionMessage(err?.message || 'Could not update saved books.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubscribe = async () => {
    const uploaderId = book?.uploader?.id;
    if (!uploaderId || actionLoading) return;

    setActionLoading(true);
    setActionMessage('');

    try {
      const res = await fetch(`/api/profile/public/${uploaderId}/subscribe`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Please sign in to subscribe.');
        }
        throw new Error(data?.message || 'Could not update subscription');
      }

      const subscribed = Boolean(data?.subscribed);
      const nextCount = Number.isFinite(data?.profile?.subscribersCount)
        ? data.profile.subscribersCount
        : subscribersCount;
      setIsSubscribed(subscribed);
      setSubscribersCount(nextCount);
      setBook((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          uploader: {
            ...prev.uploader,
            viewerSubscribed: subscribed,
            subscribersCount: nextCount,
          },
        };
      });
      setActionMessage(
        subscribed ? 'Subscribed to uploader.' : 'Unsubscribed from uploader.',
      );
    } catch (err) {
      setActionMessage(err?.message || 'Could not update subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewNotice('');
    if (!book?._id) return;
    if (!user) {
      setReviewNotice('Sign in to post a review.');
      return;
    }
    const text = reviewBody.trim();
    if (!text) {
      setReviewNotice('Write something before submitting.');
      return;
    }
    setReviewSubmitting(true);
    try {
      const res = await fetch(`/api/books/${book._id}/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: text,
          rating: reviewRating,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Could not save your review.');
      }
      setReviewNotice('Thanks — your review was saved.');
      await fetchReviews();
    } catch (err) {
      setReviewNotice(err?.message || 'Could not save review.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (rid) => {
    if (!book?._id || !rid) return;
    setReviewDeletingId(rid);
    setReviewNotice('');
    try {
      const res = await fetch(`/api/books/${book._id}/reviews/${rid}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Could not delete review.');
      }
      setReviewNotice('Review removed.');
      setReviewBody('');
      setReviewRating(null);
      reviewDraftLoaded.current = false;
      await fetchReviews();
    } catch (err) {
      setReviewNotice(err?.message || 'Could not delete.');
    } finally {
      setReviewDeletingId(null);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    setCommentNotice('');
    if (!book?._id) return;
    if (!user) {
      setCommentNotice('Sign in to join the discussion.');
      return;
    }
    const text = commentBody.trim();
    if (!text) {
      setCommentNotice('Write something before posting.');
      return;
    }
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/books/${book._id}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: text,
          parentCommentId: replyToId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Could not post comment.');
      }
      setCommentBody('');
      setReplyToId(null);
      setCommentNotice('Posted.');
      await fetchComments();
    } catch (err) {
      setCommentNotice(err?.message || 'Could not post comment.');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteBook = async () => {
    const id = book?._id;
    if (!id || deletingBook) return;
    if (
      !window.confirm(
        'Permanently delete this book from the library? Reviews and discussion will be removed. This cannot be undone.',
      )
    ) {
      return;
    }
    setDeletingBook(true);
    setActionMessage('');
    try {
      const res = await fetch(`/api/books/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Could not delete this book.');
      }
      navigate('/library');
    } catch (err) {
      setActionMessage(err?.message || 'Could not delete this book.');
    } finally {
      setDeletingBook(false);
    }
  };

  const handleDeleteComment = async (cid) => {
    if (!book?._id || !cid) return;
    setCommentDeletingId(cid);
    setCommentNotice('');
    try {
      const res = await fetch(`/api/books/${book._id}/comments/${cid}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Could not delete comment.');
      }
      await fetchComments();
    } catch (err) {
      setCommentNotice(err?.message || 'Could not delete.');
    } finally {
      setCommentDeletingId(null);
    }
  };

  const formatLabel = book ? humanizeFormat(book.format) : '';
  const topicFromBook =
    book &&
    topicIfDistinct(book.category ?? book.genre, book.format);

  const ownerId = book?.uploader?.id || book?.userId?._id || book?.userId;
  const isOwner =
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

  return (
    <div className="library-ambient relative page-surface min-h-[calc(100vh-5.5rem)] px-4 pb-12 pt-3 text-slate-900 md:px-6 md:pb-16 md:pt-5 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[min(240px,32vh)] workspace-hero-mesh opacity-90 dark:opacity-70" />

      <div className="relative z-[2] mx-auto max-w-6xl space-y-6 md:space-y-8">
        <Link
          to="/library"
          className="group inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-cyan-400/40 hover:bg-white hover:text-cyan-900 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-cyan-500/40 dark:hover:bg-slate-900"
        >
          <ArrowLeft
            className="h-4 w-4 transition group-hover:-translate-x-0.5"
            aria-hidden
          />
          Library
        </Link>

        {loading ? (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_1fr]">
            <div className="space-y-4">
              <div className="aspect-[3/4] animate-pulse rounded-3xl bg-slate-200/90 dark:bg-slate-800" />
            </div>
            <div className="space-y-4 pt-2">
              <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-10 max-w-xl animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[1, 2, 3, 4].map((k) => (
                  <div
                    key={k}
                    className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
                  />
                ))}
              </div>
              <div className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/90" />
            </div>
          </div>
        ) : authRequired ? (
          <div className="rounded-3xl border border-cyan-200/90 bg-gradient-to-br from-cyan-50 to-white p-8 text-center shadow-lg dark:border-cyan-500/30 dark:from-cyan-950/50 dark:to-slate-900/90">
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Sign in to view this resource
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {user
                ? 'Your session may have expired. Sign in again to continue.'
                : 'This title is only visible to signed-in users who have access.'}
            </p>
            <Link
              to={`/login?next=${encodeURIComponent(safeInternalPath(pathname) || pathname)}`}
              className="mt-6 inline-flex rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 dark:bg-cyan-600"
            >
              Sign in
            </Link>
            <div className="mt-4">
              <Link
                to="/"
                className="text-sm font-medium text-cyan-700 hover:underline dark:text-cyan-400"
              >
                Back to home
              </Link>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200/90 bg-rose-50 p-8 text-center shadow-inner dark:border-rose-500/25 dark:bg-rose-950/40">
            <p className="font-semibold text-rose-900 dark:text-rose-100">
              {error}
            </p>
            <Link
              to="/library"
              className="mt-6 inline-flex rounded-xl bg-rose-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-600"
            >
              Back to library
            </Link>
          </div>
        ) : !book ? (
          <p className="text-sm font-medium text-slate-500">Book not found.</p>
        ) : (
          <>
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400"
            >
              <Library className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" aria-hidden />
              <Link to="/library" className="hover:text-cyan-700 dark:hover:text-cyan-300">
                Library
              </Link>
              <ChevronRight className="h-3.5 w-3.5 opacity-50" aria-hidden />
              <span className="max-w-[min(100%,56vw)] truncate text-slate-700 dark:text-slate-300">
                {book.title || 'Untitled'}
              </span>
            </nav>

            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,320px)_1fr] xl:grid-cols-[minmax(0,360px)_1fr] xl:gap-14">
              <aside className="lg:sticky lg:top-24">
                <div className="overflow-hidden rounded-3xl bg-gradient-to-b from-slate-100 to-slate-200/90 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-300/60 dark:from-slate-800 dark:to-slate-900 dark:shadow-black/40 dark:ring-slate-600">
                  <div className="aspect-[3/4] w-full overflow-hidden">
                    {book.thumbnailUrl ? (
                      <img
                        src={book.thumbnailUrl}
                        alt={`Cover of ${book.title || 'book'}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-100 to-slate-200 px-6 text-center dark:from-slate-800 dark:to-slate-900">
                        <Library
                          className="h-14 w-14 text-slate-400 opacity-70 dark:text-slate-600"
                          strokeWidth={1.25}
                          aria-hidden
                        />
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                          No cover
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-200/80 bg-white/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/90">
                    <span className="rounded-lg bg-cyan-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-cyan-900 ring-1 ring-cyan-500/25 dark:bg-cyan-400/15 dark:text-cyan-100 dark:ring-cyan-400/30">
                      {formatLabel}
                    </span>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 backdrop-blur-sm ${visibilityTone(book.visibility)}`}
                    >
                      {visibilityLabel(book.visibility)}
                    </span>
                    {book.academicTrack ? (
                      <span
                        className="max-w-[11rem] truncate rounded-lg bg-indigo-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-indigo-900 ring-1 ring-indigo-500/25 dark:bg-indigo-400/15 dark:text-indigo-100 dark:ring-indigo-400/35"
                        title={academicTrackLabel(book.academicTrack)}
                      >
                        {academicTrackLabel(book.academicTrack)}
                      </span>
                    ) : null}
                    {book.department ? (
                      <span
                        className="max-w-[11rem] truncate rounded-lg bg-violet-500/12 px-2.5 py-1 text-[11px] font-bold text-violet-900 ring-1 ring-violet-500/25 dark:bg-violet-400/12 dark:text-violet-100 dark:ring-violet-400/35"
                        title={book.department}
                      >
                        {book.department}
                      </span>
                    ) : null}
                  </div>
                </div>
              </aside>

              <article className="min-w-0 space-y-8">
                <header className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-400">
                        Resource detail
                      </p>
                      <h1 className="font-display text-balance text-3xl font-bold tracking-tight text-slate-900 md:text-4xl xl:text-[2.65rem] dark:text-white">
                        {book.title || 'Untitled'}
                      </h1>
                      {topicFromBook ? (
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                          Topic · {topicFromBook}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={actionLoading}
                      title={isSaved ? 'Remove from saved' : 'Save to library'}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold shadow-md ring-1 transition hover:brightness-105 disabled:opacity-60 ${
                        isSaved
                          ? 'bg-amber-400 text-amber-950 ring-amber-300/50 dark:bg-amber-500/90 dark:text-amber-950'
                          : 'border border-slate-200 bg-white text-slate-800 ring-slate-200/80 hover:border-cyan-300/60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700'
                      }`}
                    >
                      <Bookmark
                        className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`}
                        aria-hidden
                      />
                      {isSaved ? 'Saved' : 'Save'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200/90 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <Heart className="h-4 w-4 text-rose-400" aria-hidden />
                        Likes
                      </div>
                      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                        {likesCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/90 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <ThumbsDown className="h-4 w-4 text-slate-400" aria-hidden />
                        Dislikes
                      </div>
                      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                        {dislikesCount}
                      </p>
                    </div>
                    <div
                      className="rounded-2xl border border-slate-200/90 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70"
                      title="Counted when readers open or download from this page"
                    >
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <Eye className="h-4 w-4 text-cyan-500" aria-hidden />
                        Opens
                      </div>
                      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                        {downloadsCount}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/90 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
                        Added
                      </div>
                      <p className="mt-1 text-sm font-bold leading-snug text-slate-900 dark:text-white">
                        {formatLibraryDateTime(book.createdAt)}
                      </p>
                    </div>
                  </div>
                </header>

                <section
                  aria-labelledby="catalog-heading"
                  className="rounded-3xl border border-cyan-200/60 bg-gradient-to-br from-cyan-50/80 via-white to-slate-50/90 p-6 shadow-lg shadow-slate-900/[0.04] ring-1 ring-cyan-100/80 dark:border-cyan-900/35 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:ring-slate-700/80"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-700 ring-1 ring-cyan-500/25 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-400/35">
                      <GraduationCap className="h-6 w-6" aria-hidden />
                    </span>
                    <div>
                      <h2
                        id="catalog-heading"
                        className="font-display text-lg font-bold text-slate-900 dark:text-white"
                      >
                        Catalog information
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                        Academic metadata supplied when this title was uploaded.
                      </p>
                    </div>
                    {isOwner ? (
                      <div className="ml-auto flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditMetaOpen(true)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200/80 bg-white/90 px-3 py-2 text-xs font-bold text-cyan-900 shadow-sm transition hover:border-cyan-400 dark:border-cyan-800 dark:bg-slate-800 dark:text-cyan-100"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Edit details
                        </button>
                        <button
                          type="button"
                          disabled={deletingBook}
                          onClick={handleDeleteBook}
                          className="inline-flex items-center gap-2 rounded-2xl border border-rose-200/90 bg-white/90 px-3 py-2 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/50 dark:bg-slate-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
                          title="Delete this book permanently"
                          aria-label="Delete book"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          {deletingBook ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {isOwner && book.visibility === 'unlisted' ? (
                    <p className="mt-3 rounded-xl border border-indigo-200/80 bg-indigo-50/80 px-3 py-2 text-xs font-medium text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-100">
                      Anyone with this link can open this title. It stays out of
                      the main library browse.
                    </p>
                  ) : null}
                  <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        Academic field
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {book.academicTrack
                          ? academicTrackLabel(book.academicTrack)
                          : '—'}
                      </dd>
                    </div>
                    <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        Department / discipline
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {book.department?.trim() ? book.department : '—'}
                      </dd>
                    </div>
                    <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        Course / subject
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {book.courseSubject?.trim() ? book.courseSubject : '—'}
                      </dd>
                    </div>
                    <div className="rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                      <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        Publish year
                      </dt>
                      <dd className="mt-1 font-display text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                        {Number.isFinite(book.publishYear)
                          ? book.publishYear
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-3xl border border-slate-200/85 bg-gradient-to-br from-white to-slate-50/90 p-6 shadow-lg shadow-slate-900/[0.05] ring-1 ring-slate-100/90 dark:border-slate-700 dark:from-slate-900 dark:to-slate-950 dark:ring-slate-800">
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    About this resource
                  </h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {book.description?.trim()
                      ? book.description
                      : 'No description was provided for this upload.'}
                  </p>
                </section>

                <section className="rounded-3xl border border-slate-200/85 bg-white/75 p-5 shadow-md backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/75 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {book?.uploader?.id ? (
                      <Link
                        to={`/users/${book.uploader.id}`}
                        className="group/up flex min-w-0 flex-1 items-center gap-4 rounded-2xl bg-slate-50/95 p-3 ring-1 ring-slate-100 transition hover:bg-slate-100 hover:ring-slate-200 dark:bg-slate-800/90 dark:ring-slate-700 dark:hover:bg-slate-800"
                      >
                        <img
                          src={book?.uploader?.avatar || defaultProfile}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-md ring-2 ring-white dark:ring-slate-700"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                            <UserRound className="h-3.5 w-3.5" aria-hidden />
                            Contributor
                          </div>
                          <p className="mt-0.5 truncate text-lg font-bold text-cyan-800 group-hover/up:underline dark:text-cyan-300">
                            {book?.uploader?.name ||
                              book?.uploader?.username ||
                              'Unknown user'}
                          </p>
                          {book?.uploader?.username ? (
                            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                              @{book.uploader.username}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {subscribersCount}{' '}
                            {subscribersCount === 1 ? 'subscriber' : 'subscribers'}
                          </p>
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/90">
                        <img
                          src={book?.uploader?.avatar || defaultProfile}
                          alt=""
                          className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white dark:ring-slate-700"
                        />
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                            Contributor
                          </p>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {book?.uploader?.name ||
                              book?.uploader?.username ||
                              'Unknown user'}
                          </p>
                        </div>
                      </div>
                    )}
                    {book?.uploader?.id ? (
                      <button
                        type="button"
                        onClick={handleSubscribe}
                        disabled={actionLoading}
                        className={`shrink-0 rounded-2xl px-5 py-3 text-sm font-bold shadow-md transition disabled:opacity-60 ${
                          isSubscribed
                            ? 'bg-emerald-500/15 text-emerald-900 ring-2 ring-emerald-400/35 dark:bg-emerald-500/15 dark:text-emerald-100'
                            : 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white hover:brightness-110 dark:from-cyan-700 dark:to-cyan-800'
                        }`}
                      >
                        {isSubscribed ? 'Subscribed' : 'Subscribe'}
                      </button>
                    ) : null}
                  </div>
                </section>

                <section
                  aria-labelledby="reviews-heading"
                  className="overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/95 shadow-xl shadow-slate-900/[0.06] ring-1 ring-slate-200/80 dark:border-slate-700 dark:from-slate-900 dark:to-slate-950 dark:ring-slate-700/80"
                >
                  <div className="border-b border-slate-200/90 bg-gradient-to-r from-cyan-50/90 via-white to-indigo-50/50 px-6 py-5 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/95">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-700 ring-1 ring-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-400/30">
                          <MessageSquare
                            className="h-6 w-6"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        </span>
                        <div>
                          <h2
                            id="reviews-heading"
                            className="font-display text-xl font-bold text-slate-900 dark:text-white"
                          >
                            Reader reviews
                          </h2>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            Share how this resource worked for your courses. One
                            review per account — update anytime.
                          </p>
                        </div>
                      </div>
                      {reviewsLoading ? (
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Loading…
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {reviews.length}{' '}
                          {reviews.length === 1 ? 'review' : 'reviews'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-6">
                    {user ? (
                      <form
                        onSubmit={handleReviewSubmit}
                        className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-slate-600 dark:bg-slate-800/50"
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Your review
                        </p>
                        <div
                          className="mt-3 flex flex-wrap items-center gap-1"
                          role="group"
                          aria-label="Star rating"
                        >
                          <span className="mr-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                            Rating
                          </span>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() =>
                                setReviewRating((prev) =>
                                  prev === n ? null : n,
                                )
                              }
                              className="rounded-lg p-1 transition hover:bg-amber-50 dark:hover:bg-amber-950/40"
                              aria-label={`${n} star${n === 1 ? '' : 's'}`}
                              aria-pressed={reviewRating === n}
                            >
                              <Star
                                className={`h-8 w-8 sm:h-7 sm:w-7 ${
                                  reviewRating != null && n <= reviewRating
                                    ? 'fill-amber-400 text-amber-500'
                                    : 'text-slate-300 dark:text-slate-600'
                                }`}
                                strokeWidth={1.5}
                              />
                            </button>
                          ))}
                          {reviewRating ? (
                            <span className="ml-2 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                              {reviewRating}/5
                            </span>
                          ) : (
                            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                              Optional
                            </span>
                          )}
                        </div>
                        <label htmlFor="book-review-body" className="sr-only">
                          Review text
                        </label>
                        <textarea
                          id="book-review-body"
                          rows={4}
                          maxLength={4000}
                          value={reviewBody}
                          onChange={(e) => setReviewBody(e.target.value)}
                          placeholder="What stood out? Was it aligned with lectures or exams? Would you recommend it?"
                          className="input-field mt-4 min-h-[120px] resize-y py-3 text-sm leading-relaxed dark:bg-slate-900/60"
                        />
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {reviewBody.length}/4000
                          </span>
                          <button
                            type="submit"
                            disabled={reviewSubmitting}
                            className="btn-primary px-6 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {reviewSubmitting
                              ? 'Saving…'
                              : reviews.some((r) => r.viewerOwns)
                                ? 'Update review'
                                : 'Post review'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/90 px-5 py-8 text-center dark:border-slate-600 dark:bg-slate-800/40">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Sign in to leave a review and help classmates choose
                          readings.
                        </p>
                        <Link
                          to="/login"
                          className="btn-primary mt-4 inline-flex px-6 py-2.5 text-sm"
                        >
                          Sign in
                        </Link>
                      </div>
                    )}

                    {reviewNotice ? (
                      <div
                        role="status"
                        className="mt-4 rounded-xl border border-cyan-200/90 bg-cyan-50/90 px-4 py-3 text-sm font-medium text-cyan-950 dark:border-cyan-900/50 dark:bg-cyan-950/40 dark:text-cyan-100"
                      >
                        {reviewNotice}
                      </div>
                    ) : null}

                    {reviewsError ? (
                      <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200">
                        {reviewsError}
                      </div>
                    ) : null}

                    <div className="mt-8 space-y-4">
                      {reviewsLoading && reviews.length === 0 ? (
                        <p className="py-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                          Loading reviews…
                        </p>
                      ) : null}

                      {!reviewsLoading && reviews.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/30">
                          <MessageSquare
                            className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600"
                            aria-hidden
                          />
                          <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                            No reviews yet — be the first to share your take.
                          </p>
                        </div>
                      ) : null}

                      {reviews.map((rev) => (
                        <article
                          key={rev.id}
                          className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm transition hover:border-cyan-200/80 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/45 dark:hover:border-cyan-900/60"
                        >
                          <div className="flex gap-4">
                            <img
                              src={rev.author.avatar || defaultProfile}
                              alt=""
                              className="h-11 w-11 shrink-0 rounded-xl object-cover ring-2 ring-slate-100 dark:ring-slate-700"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-slate-900 dark:text-white">
                                    {rev.author.name}
                                  </p>
                                  {rev.author.username ? (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      @{rev.author.username}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                  <time
                                    className="text-xs font-medium text-slate-400 dark:text-slate-500"
                                    dateTime={
                                      rev.updatedAt || rev.createdAt || ''
                                    }
                                  >
                                    {formatReviewTimestamp(
                                      rev.updatedAt || rev.createdAt,
                                    )}
                                  </time>
                                  {rev.viewerOwns ? (
                                    <button
                                      type="button"
                                      disabled={reviewDeletingId === rev.id}
                                      onClick={() =>
                                        handleDeleteReview(rev.id)
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200/90 bg-rose-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-800 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/70"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                              {rev.rating != null &&
                              Number.isFinite(Number(rev.rating)) ? (
                                <div
                                  className="mt-2 flex items-center gap-0.5"
                                  aria-label={`${rev.rating} out of 5 stars`}
                                >
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <Star
                                      key={n}
                                      className={`h-4 w-4 ${
                                        n <= Number(rev.rating)
                                          ? 'fill-amber-400 text-amber-500'
                                          : 'text-slate-200 dark:text-slate-700'
                                      }`}
                                      aria-hidden
                                    />
                                  ))}
                                </div>
                              ) : null}
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                                {rev.body}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>

                <section
                  aria-labelledby="discussion-heading"
                  className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 shadow-lg dark:border-slate-700 dark:bg-slate-900/75"
                >
                  <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-700">
                    <h2
                      id="discussion-heading"
                      className="font-display text-lg font-bold text-slate-900 dark:text-white"
                    >
                      Discussion
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                      Quick questions and clarifications — separate from starred
                      reviews above.
                    </p>
                  </div>
                  <div className="p-6">
                    {user ? (
                      <form
                        onSubmit={handleCommentSubmit}
                        className="mb-6 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-800/40"
                      >
                        {replyToId ? (
                          <p className="mb-2 text-xs font-semibold text-cyan-800 dark:text-cyan-200">
                            Replying to thread ·{' '}
                            <button
                              type="button"
                              className="underline"
                              onClick={() => setReplyToId(null)}
                            >
                              Cancel
                            </button>
                          </p>
                        ) : null}
                        <textarea
                          maxLength={2000}
                          rows={3}
                          value={commentBody}
                          onChange={(e) => setCommentBody(e.target.value)}
                          placeholder="Ask a question or share a quick note…"
                          className="input-field w-full resize-y text-sm dark:bg-slate-900/60"
                        />
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-slate-500">
                            {commentBody.length}/2000
                          </span>
                          <button
                            type="submit"
                            disabled={commentSubmitting}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-60 dark:bg-cyan-700"
                          >
                            {commentSubmitting ? 'Posting…' : 'Post'}
                          </button>
                        </div>
                        {commentNotice ? (
                          <p className="mt-2 text-xs font-medium text-cyan-800 dark:text-cyan-200">
                            {commentNotice}
                          </p>
                        ) : null}
                      </form>
                    ) : (
                      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                        <Link
                          to={`/login?next=${encodeURIComponent(pathname)}`}
                          className="font-semibold text-cyan-700 underline dark:text-cyan-400"
                        >
                          Sign in
                        </Link>{' '}
                        to take part in the discussion.
                      </p>
                    )}
                    {commentsError ? (
                      <p className="text-sm text-rose-600">{commentsError}</p>
                    ) : null}
                    {commentsLoading && topComments.length === 0 ? (
                      <p className="text-sm text-slate-500">Loading discussion…</p>
                    ) : null}
                    {!commentsLoading && topComments.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        No comments yet.
                      </p>
                    ) : null}
                    <ul className="space-y-4">
                      {topComments.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40"
                        >
                          <div className="flex gap-3">
                            <img
                              src={c.author?.avatar || defaultProfile}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-full object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-bold text-slate-900 dark:text-white">
                                  {c.author?.name || 'Reader'}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {user ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyToId(c.id);
                                        setCommentNotice('');
                                      }}
                                      className="text-[11px] font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-400"
                                    >
                                      Reply
                                    </button>
                                  ) : null}
                                  {(c.viewerOwns || isOwner) && (
                                    <button
                                      type="button"
                                      disabled={commentDeletingId === c.id}
                                      onClick={() => handleDeleteComment(c.id)}
                                      className="text-[11px] font-bold uppercase tracking-wide text-rose-600"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {formatReviewTimestamp(c.createdAt)}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                                {c.body}
                              </p>
                              {(repliesByParent[c.id] || []).length > 0 ? (
                                <ul className="mt-3 space-y-2 border-l-2 border-cyan-200/60 pl-4 dark:border-cyan-800">
                                  {(repliesByParent[c.id] || []).map((r) => (
                                    <li key={r.id}>
                                      <div className="flex gap-2">
                                        <img
                                          src={r.author?.avatar || defaultProfile}
                                          alt=""
                                          className="h-7 w-7 rounded-full object-cover"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center justify-between gap-1">
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                              {r.author?.name}
                                            </span>
                                            {(r.viewerOwns || isOwner) && (
                                              <button
                                                type="button"
                                                disabled={
                                                  commentDeletingId === r.id
                                                }
                                                onClick={() =>
                                                  handleDeleteComment(r.id)
                                                }
                                                className="text-[10px] font-bold uppercase text-rose-600"
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
                  </div>
                </section>

                <section className="space-y-4">
                  <Link
                    to={`/liqu-ai/study-buddy?bookId=${book._id}`}
                    className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-5 text-base font-bold text-white shadow-2xl shadow-slate-950/35 ring-1 ring-white/10 transition hover:brightness-110 dark:from-cyan-950 dark:via-slate-950 dark:to-indigo-950"
                  >
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-indigo-500/15 opacity-100 transition group-hover:opacity-100" />
                    <Sparkles className="relative h-6 w-6 shrink-0 text-cyan-300" aria-hidden />
                    <span className="relative">Study with Liqu AI</span>
                    <ChevronRight className="relative h-5 w-5 shrink-0 opacity-80 transition group-hover:translate-x-0.5" aria-hidden />
                  </Link>

                  <div className="flex flex-wrap gap-3">
                    {book.bookUrl ? (
                      <button
                        type="button"
                        onClick={handleDownload}
                        disabled={actionLoading}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-md transition hover:border-cyan-400/50 hover:bg-cyan-50/90 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900 sm:flex-none sm:min-w-[160px]"
                      >
                        <Download className="h-4 w-4 text-cyan-600 dark:text-cyan-400" aria-hidden />
                        Download file
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => handleReaction('like')}
                      disabled={actionLoading}
                      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold shadow-md transition disabled:opacity-60 sm:flex-none sm:min-w-[120px] ${
                        userReaction === 'like'
                          ? 'bg-emerald-500/15 text-emerald-900 ring-2 ring-emerald-400/35 dark:bg-emerald-500/15 dark:text-emerald-100'
                          : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <ThumbsUp className="h-4 w-4" aria-hidden />
                      Like
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReaction('dislike')}
                      disabled={actionLoading}
                      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold shadow-md transition disabled:opacity-60 sm:flex-none sm:min-w-[120px] ${
                        userReaction === 'dislike'
                          ? 'bg-rose-500/15 text-rose-900 ring-2 ring-rose-400/35 dark:bg-rose-500/15 dark:text-rose-100'
                          : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <ThumbsDown className="h-4 w-4" aria-hidden />
                      Dislike
                    </button>

                    <button
                      type="button"
                      onClick={handleShare}
                      disabled={actionLoading}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-md transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:flex-none sm:min-w-[120px]"
                    >
                      <Share2 className="h-4 w-4" aria-hidden />
                      Share
                    </button>
                  </div>

                  {actionMessage ? (
                    <div
                      role="status"
                      className="rounded-2xl border border-slate-200/90 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200"
                    >
                      {actionMessage}
                    </div>
                  ) : null}
                </section>
              </article>
            </div>

            <EditBookMetaModal
              open={editMetaOpen}
              book={book}
              onClose={() => setEditMetaOpen(false)}
              onSaved={(updated) => {
                if (updated) applyBookState(updated);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default BookDetail;
