import {
  ArrowLeft,
  Bookmark,
  Calendar,
  ChevronRight,
  Download,
  Eye,
  Heart,
  Library,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import defaultProfile from '../assets/profile.png';
import {
  formatLibraryDateTime,
  humanizeFormat,
  topicIfDistinct,
  visibilityLabel,
  visibilityTone,
} from '../utils/formatLabels';

function BookDetail() {
  const { bookId } = useParams();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userReaction, setUserReaction] = useState(null);
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [downloadsCount, setDownloadsCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(0);

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

        const res = await fetch(`/api/books/${bookId}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
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

  const formatLabel = book ? humanizeFormat(book.format) : '';
  const topicFromBook =
    book &&
    topicIfDistinct(book.category ?? book.genre, book.format);

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
          </>
        )}
      </div>
    </div>
  );
}

export default BookDetail;
