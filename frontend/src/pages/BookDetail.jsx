import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import defaultProfile from '../assets/profile.png';

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

  const applyBookState = loadedBook => {
    setBook(loadedBook);
    setLikesCount(Number.isFinite(loadedBook?.likesCount) ? loadedBook.likesCount : 0);
    setDislikesCount(Number.isFinite(loadedBook?.dislikesCount) ? loadedBook.dislikesCount : 0);
    setDownloadsCount(Number.isFinite(loadedBook?.views) ? loadedBook.views : 0);
    if (loadedBook?.viewerState?.liked) {
      setUserReaction('like');
    } else if (loadedBook?.viewerState?.disliked) {
      setUserReaction('dislike');
    } else {
      setUserReaction(null);
    }
    setIsSaved(Boolean(loadedBook?.viewerState?.saved));
    setIsSubscribed(Boolean(loadedBook?.uploader?.viewerSubscribed));
    setSubscribersCount(Number.isFinite(loadedBook?.uploader?.subscribersCount) ? loadedBook.uploader.subscribersCount : 0);
  };

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
  }, [bookId]);

  const formatDate = value => {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleString();
  };

  const handleDownload = async () => {
    if (!book?.bookUrl) return;

    try {
      const res = await fetch(`/api/books/${book._id}/download`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDownloadsCount(Number.isFinite(data?.views) ? data.views : downloadsCount + 1);
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

  const handleReaction = async type => {
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
      setActionMessage(nextReaction === 'none' ? 'Reaction removed.' : `Marked as ${nextReaction}.`);
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
      setActionMessage(data?.saved ? 'Book saved.' : 'Removed from saved books.');
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
      const nextCount = Number.isFinite(data?.profile?.subscribersCount) ? data.profile.subscribersCount : subscribersCount;
      setIsSubscribed(subscribed);
      setSubscribersCount(nextCount);
      setBook(prev => {
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
      setActionMessage(subscribed ? 'Subscribed to uploader.' : 'Unsubscribed from uploader.');
    } catch (err) {
      setActionMessage(err?.message || 'Could not update subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <section className="mx-auto max-w-4xl space-y-4">
        <Link to="/library" className="inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
          Back to library
        </Link>

        <div className="panel-card rounded-3xl p-6 md:p-8">
          {loading ? (
            <p className="text-sm text-slate-500">Loading book details...</p>
          ) : error ? (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          ) : !book ? (
            <p className="text-sm text-slate-500">Book not found.</p>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Book detail</p>
              <h1 className="mt-2 font-display text-3xl text-slate-900 md:text-4xl">{book.title || 'Untitled'}</h1>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>
                  Format: <span className="font-semibold text-slate-800">{book.format || 'Unknown format'}</span>
                </p>
                <p>
                  Visibility: <span className="font-semibold text-slate-800">{book.visibility || 'public'}</span>
                </p>
                <p>
                  Likes: <span className="font-semibold text-slate-800">{likesCount}</span>
                </p>
                <p>
                  Dislikes: <span className="font-semibold text-slate-800">{dislikesCount}</span>
                </p>
                <p>
                  Downloads: <span className="font-semibold text-slate-800">{downloadsCount}</span>
                </p>
                <p>
                  Uploaded: <span className="font-semibold text-slate-800">{formatDate(book.createdAt)}</span>
                </p>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {book?.uploader?.id ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link to={`/users/${book.uploader.id}`} className="inline-flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-slate-100">
                      <img
                        src={book?.uploader?.avatar || defaultProfile}
                        alt={`${book?.uploader?.name || 'Uploader'} avatar`}
                        className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                      />
                      <div className="text-sm text-slate-600">
                        <p>
                          Uploaded by:{' '}
                          <span className="font-semibold text-cyan-700 hover:underline">
                            {book?.uploader?.name || book?.uploader?.username || 'Unknown user'}
                          </span>
                        </p>
                        {book?.uploader?.username ? (
                          <p className="text-xs text-slate-500">@{book.uploader.username}</p>
                        ) : null}
                        <p className="text-xs text-slate-500">{subscribersCount} subscriber{subscribersCount === 1 ? '' : 's'}</p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={handleSubscribe}
                      disabled={actionLoading}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                        isSubscribed ? 'bg-emerald-100 text-emerald-700' : 'bg-cyan-600 text-white hover:bg-cyan-700'
                      }`}
                    >
                      {isSubscribed ? 'Subscribed' : 'Subscribe'}
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-3">
                    <img
                      src={book?.uploader?.avatar || defaultProfile}
                      alt={`${book?.uploader?.name || 'Uploader'} avatar`}
                      className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                    />
                    <div className="text-sm text-slate-600">
                      <p>
                        Uploaded by:{' '}
                        <span className="font-semibold text-slate-800">
                          {book?.uploader?.name || book?.uploader?.username || 'Unknown user'}
                        </span>
                      </p>
                      {book?.uploader?.username ? (
                        <p className="text-xs text-slate-500">@{book.uploader.username}</p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-4 text-sm text-slate-700">{book.description || 'No description available.'}</p>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {book.thumbnailUrl ? (
                  <img src={book.thumbnailUrl} alt={`${book.title || 'Book'} cover`} className="h-72 w-full object-cover" />
                ) : (
                  <div className="flex h-72 w-full items-center justify-center text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    No cover available
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {book.bookUrl ? (
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={actionLoading}
                    className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
                  >
                    Download
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleReaction('like')}
                  disabled={actionLoading}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    userReaction === 'like' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Like
                </button>
                <button
                  type="button"
                  onClick={() => handleReaction('dislike')}
                  disabled={actionLoading}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    userReaction === 'dislike' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Dislike
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={actionLoading}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Share
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={actionLoading}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isSaved ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {isSaved ? 'Saved' : 'Save'}
                </button>
              </div>
              {actionMessage ? <p className="mt-3 text-sm text-slate-600">{actionMessage}</p> : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default BookDetail;
