import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Library,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import defaultProfile from '../assets/profile.png';
import {
  formatLibraryDate,
  humanizeFormat,
  visibilityLabel,
  visibilityTone,
} from '../utils/formatLabels';
import { academicTrackLabel } from '../utils/bookUploadMeta';

function PublicProfile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [sharedBooks, setSharedBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [booksSharedCount, setBooksSharedCount] = useState(0);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(`/api/profile/public/${userId}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.message || 'Failed to load profile');
        }

        if (!active) return;
        const loadedProfile = data?.profile || null;
        setProfile(loadedProfile);
        const loadedSharedBooks = Array.isArray(data?.sharedBooks)
          ? data.sharedBooks
          : [];
        setSharedBooks(loadedSharedBooks);
        setIsSubscribed(Boolean(data?.viewerState?.subscribed));
        setSubscribersCount(
          Number.isFinite(loadedProfile?.subscribersCount)
            ? loadedProfile.subscribersCount
            : 0,
        );
        setBooksSharedCount(
          Number.isFinite(data?.stats?.sharedBooks)
            ? data.stats.sharedBooks
            : loadedSharedBooks.length,
        );
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Could not load this profile');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (!userId) {
      setError('Missing user id');
      setLoading(false);
      return;
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [userId]);

  const joinedDate = useMemo(() => {
    if (!profile?.joinedAt) return null;
    const date = new Date(profile.joinedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [profile?.joinedAt]);

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
  };

  const handleSubscribe = async () => {
    if (!profile?.id || actionLoading) return;

    setActionLoading(true);
    setActionMessage('');

    try {
      const res = await fetch(`/api/profile/public/${profile.id}/subscribe`, {
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
      setProfile((prev) =>
        prev ? { ...prev, subscribersCount: nextCount } : prev,
      );
      setActionMessage(
        subscribed ? 'You’re following this creator.' : 'Subscription removed.',
      );
      window.setTimeout(() => setActionMessage(''), 3200);
    } catch (err) {
      setActionMessage(err?.message || 'Could not update subscription.');
      window.setTimeout(() => setActionMessage(''), 4000);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="library-ambient relative page-surface min-h-[calc(100vh-5.5rem)] px-4 pb-14 pt-6 text-slate-900 md:px-6 md:pb-16 md:pt-8 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[min(260px,36vh)] workspace-hero-mesh opacity-90 dark:opacity-65" />

      <section className="relative z-[1] mx-auto max-w-6xl space-y-8 md:space-y-10">
        <Link
          to="/library"
          className="group inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-cyan-400/45 hover:bg-white hover:text-cyan-900 dark:border-slate-600 dark:bg-slate-900/85 dark:text-slate-200 dark:hover:border-cyan-500/40 dark:hover:bg-slate-900"
        >
          <ArrowLeft
            className="h-4 w-4 transition group-hover:-translate-x-0.5"
            aria-hidden
          />
          Campus library
        </Link>

        {loading ? (
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50 to-cyan-50/30 p-8 shadow-xl shadow-slate-900/[0.07] dark:border-slate-600 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/90 dark:shadow-black/40 md:p-10">
              <div className="flex flex-wrap gap-6">
                <div className="h-28 w-28 animate-pulse rounded-[1.35rem] bg-slate-200 dark:bg-slate-700" />
                <div className="flex-1 space-y-4">
                  <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="h-10 max-w-md animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
                  <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200/90 bg-gradient-to-br from-rose-50 to-white p-10 text-center shadow-inner dark:border-rose-900/40 dark:from-rose-950/50 dark:to-slate-900">
            <p className="font-display text-lg font-semibold text-rose-900 dark:text-rose-100">
              {error}
            </p>
            <Link
              to="/library"
              className="btn-primary mt-6 inline-flex px-6 py-2.5 text-sm"
            >
              Browse library
            </Link>
          </div>
        ) : !profile ? (
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-10 text-center dark:border-slate-700 dark:bg-slate-900/70">
            <p className="font-medium text-slate-600 dark:text-slate-400">
              We couldn’t find this profile.
            </p>
            <Link
              to="/library"
              className="btn-primary mt-5 inline-flex px-6 py-2.5 text-sm"
            >
              Back to library
            </Link>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/95 to-cyan-50/35 shadow-[0_28px_70px_-28px_rgba(15,23,42,0.2)] dark:border-slate-600/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/85 dark:shadow-[0_32px_80px_-28px_rgba(0,0,0,0.55)]">
              <div className="workspace-hero-mesh pointer-events-none absolute inset-0 opacity-65 dark:opacity-45" />
              <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/12" />
              <div className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-indigo-400/12 blur-3xl dark:bg-indigo-500/10" />

              <div className="relative flex flex-col gap-8 p-6 md:flex-row md:items-start md:justify-between md:p-10">
                <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-start">
                  <div className="relative shrink-0">
                    <img
                      src={profile.avatar || defaultProfile}
                      alt=""
                      className="profile-avatar-ring h-28 w-28 rounded-[1.35rem] border border-white object-cover shadow-xl dark:border-slate-700 md:h-32 md:w-32"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200">
                        Creator profile
                      </span>
                      <span className="rounded-full bg-slate-900/5 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/90 dark:bg-white/5 dark:text-slate-300 dark:ring-slate-600">
                        Public view
                      </span>
                    </div>
                    <div>
                      <h1 className="font-display text-balance text-3xl font-bold tracking-tight text-slate-900 md:text-4xl xl:text-[2.5rem] dark:text-white">
                        {profile.name || 'Member'}
                      </h1>
                      {profile.username ? (
                        <p className="mt-1 font-medium text-cyan-700 dark:text-cyan-400">
                          @{profile.username}
                        </p>
                      ) : null}
                      {joinedDate ? (
                        <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <Calendar
                            className="h-4 w-4 shrink-0 text-slate-400"
                            aria-hidden
                          />
                          <span>
                            Member since{' '}
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {joinedDate}
                            </span>
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:min-w-[220px]">
                  <button
                    type="button"
                    onClick={handleSubscribe}
                    disabled={actionLoading}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isSubscribed
                        ? 'border-2 border-emerald-400/50 bg-emerald-50 text-emerald-900 shadow-emerald-900/10 hover:bg-emerald-100 dark:border-emerald-500/35 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-950/80'
                        : 'btn-primary shadow-cyan-900/20'
                    }`}
                  >
                    <UserPlus className="h-5 w-5" aria-hidden />
                    {actionLoading
                      ? 'Please wait…'
                      : isSubscribed
                        ? 'Following'
                        : 'Follow creator'}
                  </button>
                  <p className="text-center text-[11px] leading-snug text-slate-500 dark:text-slate-400 sm:text-left">
                    Get updates when they share new materials to the library.
                  </p>
                </div>
              </div>

              <div className="relative grid gap-px border-t border-slate-200/80 bg-slate-200/80 dark:border-slate-700 dark:bg-slate-700 sm:grid-cols-2">
                <div className="flex items-center gap-4 bg-white/95 px-6 py-5 dark:bg-slate-900/95">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-700 ring-1 ring-violet-500/20 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/25">
                    <Users className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Followers
                    </p>
                    <p className="font-display text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                      {subscribersCount}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-white/95 px-6 py-5 dark:bg-slate-900/95">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/12 text-cyan-800 ring-1 ring-cyan-500/20 dark:bg-cyan-500/12 dark:text-cyan-200 dark:ring-cyan-400/25">
                    <BookOpen className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Books shared
                    </p>
                    <p className="font-display text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                      {booksSharedCount}
                    </p>
                  </div>
                </div>
              </div>

              {actionMessage ? (
                <div className="border-t border-slate-200/80 bg-emerald-50/90 px-6 py-3 text-center text-sm font-medium text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-950/40 dark:text-emerald-100">
                  {actionMessage}
                </div>
              ) : null}
            </div>

            {/* Shared books */}
            <div className="panel-card rounded-3xl p-6 shadow-xl shadow-slate-900/[0.06] md:p-8 dark:shadow-black/35">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-6 dark:border-slate-700/80">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/15 to-indigo-500/10 text-cyan-700 ring-1 ring-cyan-500/20 dark:from-cyan-400/12 dark:to-indigo-400/8 dark:text-cyan-300 dark:ring-cyan-400/25">
                    <Library className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                      Shared library
                    </h2>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      Public and unlisted titles from this creator — open any card
                      for full detail, reactions, and Study Buddy.
                    </p>
                  </div>
                </div>
                <Link
                  to="/liqu-ai/study-buddy"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50/80 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-cyan-500/40"
                >
                  <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  Liqu AI
                </Link>
              </div>

              <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {sharedBooks.length === 0 ? (
                  <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-cyan-50/30 px-8 py-16 text-center dark:border-slate-600 dark:from-slate-900/50 dark:to-slate-900/30">
                    <BookOpen className="mx-auto h-14 w-14 text-cyan-500/75" />
                    <p className="mt-4 font-display text-xl font-semibold text-slate-900 dark:text-white">
                      Nothing on the shelf yet
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
                      When this member publishes books to the library, they’ll show
                      up here for everyone who visits their profile.
                    </p>
                  </div>
                ) : (
                  sharedBooks.map((book) => (
                    <article
                      key={book._id}
                      className="library-book-card group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white dark:border-slate-600/85 dark:bg-slate-900/40"
                    >
                      <Link
                        to={`/library/${book._id}`}
                        className="relative block aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-800"
                      >
                        {book.thumbnailUrl ? (
                          <img
                            src={book.thumbnailUrl}
                            alt=""
                            className="library-cover-img h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-2 p-6">
                            <BookOpen className="h-12 w-12 text-slate-400" />
                            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                              No cover
                            </span>
                          </div>
                        )}
                        <div className="library-cover-shine pointer-events-none absolute inset-0" />
                      </Link>
                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="line-clamp-2 font-display text-base font-semibold text-slate-900 dark:text-white">
                            <Link
                              to={`/library/${book._id}`}
                              className="transition hover:text-cyan-700 dark:hover:text-cyan-400"
                            >
                              {book.title || 'Untitled'}
                            </Link>
                          </h3>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${visibilityTone(book.visibility)}`}
                          >
                            {visibilityLabel(book.visibility)}
                          </span>
                        </div>
                        {book.academicTrack ||
                        book.department ||
                        book.courseSubject ||
                        Number.isFinite(book.publishYear) ? (
                          <p className="mt-2 line-clamp-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                            {[
                              book.academicTrack
                                ? academicTrackLabel(book.academicTrack)
                                : null,
                              book.department,
                              book.courseSubject,
                              Number.isFinite(book.publishYear)
                                ? book.publishYear
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                          {humanizeFormat(book.format)} ·{' '}
                          {formatLibraryDate(book.createdAt) ||
                            formatDate(book.createdAt)}
                        </p>
                        {book.description ? (
                          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                            {book.description}
                          </p>
                        ) : (
                          <div className="flex-1" />
                        )}
                        <Link
                          to={`/library/${book._id}`}
                          className="btn-secondary mt-4 inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm font-bold"
                        >
                          View details
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default PublicProfile;
