import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import defaultProfile from '../assets/profile.png';

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
        const loadedSharedBooks = Array.isArray(data?.sharedBooks) ? data.sharedBooks : [];
        setSharedBooks(loadedSharedBooks);
        setIsSubscribed(Boolean(data?.viewerState?.subscribed));
        setSubscribersCount(Number.isFinite(loadedProfile?.subscribersCount) ? loadedProfile.subscribersCount : 0);
        setBooksSharedCount(
          Number.isFinite(data?.stats?.sharedBooks) ? data.stats.sharedBooks : loadedSharedBooks.length
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
    if (!profile?.joinedAt) return 'Unknown';
    const date = new Date(profile.joinedAt);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString();
  }, [profile?.joinedAt]);

  const formatDate = value => {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
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
      const nextCount = Number.isFinite(data?.profile?.subscribersCount) ? data.profile.subscribersCount : subscribersCount;
      setIsSubscribed(subscribed);
      setSubscribersCount(nextCount);
      setProfile(prev => (prev ? { ...prev, subscribersCount: nextCount } : prev));
      setActionMessage(subscribed ? 'Subscribed successfully.' : 'Unsubscribed successfully.');
    } catch (err) {
      setActionMessage(err?.message || 'Could not update subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <section className="mx-auto max-w-6xl space-y-5">
        <Link to="/library" className="inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
          Back to library
        </Link>

        <div className="panel-card rounded-3xl p-6 md:p-8">
          {loading ? (
            <p className="text-sm text-slate-500">Loading profile...</p>
          ) : error ? (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          ) : !profile ? (
            <p className="text-sm text-slate-500">Profile not found.</p>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Uploader profile</p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <img src={profile.avatar || defaultProfile} alt={`${profile.name} avatar`} className="h-20 w-20 rounded-2xl border border-slate-200 object-cover" />
                <div>
                  <h1 className="font-display text-3xl text-slate-900 md:text-4xl">{profile.name || 'User'}</h1>
                  {profile.username ? <p className="text-sm text-slate-600">@{profile.username}</p> : null}
                  <p className="mt-1 text-xs text-slate-500">Joined: {joinedDate}</p>
                </div>
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
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Subscribers</p>
                  <p className="mt-1 font-display text-2xl text-slate-900">{subscribersCount}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Books shared</p>
                  <p className="mt-1 font-display text-2xl text-slate-900">{booksSharedCount}</p>
                </div>
              </div>
              {actionMessage ? <p className="mt-3 text-sm text-slate-600">{actionMessage}</p> : null}
            </>
          )}
        </div>

        <div className="panel-card rounded-2xl p-5">
          <h2 className="font-display text-xl text-slate-900">Shared books</h2>
          <p className="mt-1 text-sm text-slate-600">Public and unlisted books shared by this user.</p>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Loading shared books...</div>
            ) : error ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : sharedBooks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                No shared books yet.
              </div>
            ) : (
              sharedBooks.map(book => (
                <article key={book._id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    {book.thumbnailUrl ? (
                      <img src={book.thumbnailUrl} alt={`${book.title || 'Book'} cover`} className="h-44 w-full object-cover" />
                    ) : (
                      <div className="flex h-44 w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        No cover
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{book.title || 'Untitled'}</h3>
                    <span className="text-xs text-slate-500">{formatDate(book.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {(book.format || 'Unknown format').toString()} • {book.visibility || 'public'}
                  </p>
                  {book.description ? <p className="mt-1 text-sm text-slate-600">{book.description}</p> : null}
                  {book._id ? (
                    <Link
                      to={`/library/${book._id}`}
                      className="mt-2 inline-block rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700"
                    >
                      See detail page
                    </Link>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default PublicProfile;
