import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import defaultProfile from '../assets/profile.png';

const activityTypeLabel = {
  book_upload: 'Book upload',
  chat_create: 'Classroom created',
  message_send: 'Message sent',
};

function Profile() {
  const { user } = useAuth();
  const [activity, setActivity] = useState([]);
  const [sharedBooks, setSharedBooks] = useState([]);
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalChatsCreated: 0,
    totalMessages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadActivity = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch('/api/profile/activity?limit=25', {
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('Failed to load activity');
        }

        const data = await res.json();
        if (!active) return;

        setActivity(Array.isArray(data.activity) ? data.activity : []);
        setSharedBooks(Array.isArray(data.sharedBooks) ? data.sharedBooks : []);
        setStats(
          data.stats || {
            totalBooks: 0,
            totalChatsCreated: 0,
            totalMessages: 0,
          }
        );
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Could not load profile activity');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadActivity();
    return () => {
      active = false;
    };
  }, []);

  const displayName = user?.displayName ?? user?.username ?? 'Student';
  const email = user?.email ?? 'No email available';
  const avatar = user?.photo || defaultProfile;

  const formattedLastSeen = useMemo(() => {
    if (!user?.lastSeen) return 'Unknown';
    const date = new Date(user.lastSeen);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString();
  }, [user?.lastSeen]);

  const formatDate = value => {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleString();
  };

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <section className="mx-auto max-w-6xl space-y-5">
        <div className="panel-card rounded-3xl p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Profile</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <img src={avatar} alt={`${displayName} avatar`} className="h-20 w-20 rounded-2xl border border-slate-200 object-cover" />
            <div>
              <h1 className="font-display text-3xl text-slate-900 md:text-4xl">{displayName}</h1>
              <p className="text-sm text-slate-600">{email}</p>
              <p className="mt-1 text-xs text-slate-500">Last seen: {formattedLastSeen}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="panel-card rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Books uploaded</p>
            <p className="mt-2 font-display text-3xl text-slate-900">{stats.totalBooks}</p>
          </article>
          <article className="panel-card rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Classrooms created</p>
            <p className="mt-2 font-display text-3xl text-slate-900">{stats.totalChatsCreated}</p>
          </article>
          <article className="panel-card rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Messages sent</p>
            <p className="mt-2 font-display text-3xl text-slate-900">{stats.totalMessages}</p>
          </article>
        </div>

        <div className="panel-card rounded-2xl p-5">
          <h2 className="font-display text-xl text-slate-900">Shared books</h2>
          <p className="mt-1 text-sm text-slate-600">All books you have shared publicly or unlisted.</p>

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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{book.title || 'Untitled'}</h3>
                    <span className="text-xs text-slate-500">{formatDate(book.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {(book.format || 'Unknown format').toString()} • {book.visibility || 'public'}
                  </p>
                  {book.description ? <p className="mt-1 text-sm text-slate-600">{book.description}</p> : null}
                  {book.bookUrl ? (
                    <a
                      href={book.bookUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700"
                    >
                      Open book
                    </a>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>

        <div className="panel-card rounded-2xl p-5">
          <h2 className="font-display text-xl text-slate-900">Recent activity</h2>
          <p className="mt-1 text-sm text-slate-600">Your latest actions across library and classrooms.</p>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Loading activity...</div>
            ) : error ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : activity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                No activity yet.
              </div>
            ) : (
              activity.map(item => (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                      {activityTypeLabel[item.type] || item.type}
                    </span>
                    <span className="text-xs text-slate-500">{formatDate(item.at)}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Profile;
