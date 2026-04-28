import { Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import defaultProfile from '../assets/profile.png';
import { useAuth } from '../contexts/AuthContext';

function Profile() {
  const { user } = useAuth();
  const [sharedBooks, setSharedBooks] = useState([]);
  const [viewedBooks, setViewedBooks] = useState([]);
  const [likedBooks, setLikedBooks] = useState([]);
  const [subscribedChannels, setSubscribedChannels] = useState([]);
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalChatsCreated: 0,
    totalMessages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    file: null,
  });

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

        setSharedBooks(Array.isArray(data.sharedBooks) ? data.sharedBooks : []);
        setViewedBooks(Array.isArray(data.viewedBooks) ? data.viewedBooks : []);
        setLikedBooks(Array.isArray(data.likedBooks) ? data.likedBooks : []);
        setSubscribedChannels(
          Array.isArray(data.subscribedChannels) ? data.subscribedChannels : [],
        );
        setStats(
          data.stats || {
            totalBooks: 0,
            totalChatsCreated: 0,
            totalMessages: 0,
          },
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

  const formatDate = (value) => {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleString();
  };

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
    setUploadError('');
    setUploadForm({
      title: '',
      description: '',
      file: null,
    });
  };

  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    setUploadError('');
    setUploadSuccess('');

    if (!uploadForm.file) {
      setUploadError('Please choose a file first.');
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      if (uploadForm.title.trim()) {
        formData.append('title', uploadForm.title.trim());
      }
      if (uploadForm.description.trim()) {
        formData.append('description', uploadForm.description.trim());
      }
      formData.append('file', uploadForm.file);

      const res = await fetch('/api/upload/file', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || 'Failed to upload book');
      }

      const newBook = {
        ...payload,
        _id: payload?._id || payload?.id || `${Date.now()}`,
      };

      setSharedBooks((prev) => [newBook, ...prev]);
      setStats((prev) => ({
        ...prev,
        totalBooks: (prev?.totalBooks || 0) + 1,
      }));

      setUploadSuccess('Book uploaded successfully.');
      closeUploadModal();
    } catch (err) {
      setUploadError(err?.message || 'Could not upload this book');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <section className="mx-auto max-w-6xl space-y-5">
        <div className="panel-card rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
              Profile
            </p>
            <Link
              to="/settings"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-5 w-5" aria-hidden />
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <img
              src={avatar}
              alt={`${displayName} avatar`}
              className="h-20 w-20 rounded-2xl border border-slate-200 object-cover dark:border-slate-600"
            />
            <div>
              <h1 className="font-display text-3xl text-slate-900 dark:text-slate-100 md:text-4xl">
                {displayName}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {email}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Last seen: {formattedLastSeen}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <aside className="panel-card h-fit rounded-2xl p-4 lg:sticky lg:top-24">
            <h2 className="font-display text-xl text-slate-900">Side Nav</h2>
            <p className="mt-1 text-sm text-slate-600">
              Your viewed books, subscriptions, and liked books.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Books Viewed
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {viewedBooks.length}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {viewedBooks.slice(0, 6).map((book) => (
                    <Link
                      key={`viewed-${book._id}`}
                      to={`/library/${book._id}`}
                      className="block rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      {book.title || 'Untitled'}
                    </Link>
                  ))}
                  {viewedBooks.length === 0 ? (
                    <p className="px-2 text-xs text-slate-500">
                      No viewed books yet.
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Channels Subscribed
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {subscribedChannels.length}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {subscribedChannels.slice(0, 6).map((channel) => (
                    <Link
                      key={`channel-${channel.id}`}
                      to={`/users/${channel.id}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      <img
                        src={channel.avatar || defaultProfile}
                        alt={`${channel.name} avatar`}
                        className="h-6 w-6 rounded-full border border-slate-200 object-cover"
                      />
                      <span>{channel.name}</span>
                    </Link>
                  ))}
                  {subscribedChannels.length === 0 ? (
                    <p className="px-2 text-xs text-slate-500">
                      No channel subscriptions yet.
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Books Liked
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {likedBooks.length}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {likedBooks.slice(0, 6).map((book) => (
                    <Link
                      key={`liked-${book._id}`}
                      to={`/library/${book._id}`}
                      className="block rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      {book.title || 'Untitled'}
                    </Link>
                  ))}
                  {likedBooks.length === 0 ? (
                    <p className="px-2 text-xs text-slate-500">
                      No liked books yet.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <article className="panel-card rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Books uploaded
                </p>
                <p className="mt-2 font-display text-3xl text-slate-900">
                  {stats.totalBooks}
                </p>
              </article>
              <article className="panel-card rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Classrooms created
                </p>
                <p className="mt-2 font-display text-3xl text-slate-900">
                  {stats.totalChatsCreated}
                </p>
              </article>
              <article className="panel-card rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Messages sent
                </p>
                <p className="mt-2 font-display text-3xl text-slate-900">
                  {stats.totalMessages}
                </p>
              </article>
            </div>

            <div className="panel-card rounded-2xl p-5">
              <div className="flex flex-wrap items-start gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setUploadSuccess('');
                    setUploadError('');
                    setIsUploadModalOpen(true);
                  }}
                  className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
                >
                  Upload book
                </button>
                <div>
                  <h2 className="font-display text-xl text-slate-900">
                    Shared books
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    All books you have shared publicly or unlisted.
                  </p>
                </div>
              </div>
              {uploadSuccess ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {uploadSuccess}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    Loading shared books...
                  </div>
                ) : error ? (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                ) : sharedBooks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                    No shared books yet.
                  </div>
                ) : (
                  sharedBooks.map((book) => (
                    <article
                      key={book._id}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        {book.thumbnailUrl ? (
                          <img
                            src={book.thumbnailUrl}
                            alt={`${book.title || 'Book'} cover`}
                            className="h-44 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-44 w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            No cover
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {book.title || 'Untitled'}
                        </h3>
                        <span className="text-xs text-slate-500">
                          {formatDate(book.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {(book.format || 'Unknown format').toString()} |{' '}
                        {book.visibility || 'public'}
                      </p>
                      {book.description ? (
                        <p className="mt-1 text-sm text-slate-600">
                          {book.description}
                        </p>
                      ) : null}
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
          </div>
        </div>

        {isUploadModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl text-slate-900">
                    Upload a book
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Choose a file and add optional details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeUploadModal}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="book-title"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Title (optional)
                  </label>
                  <input
                    id="book-title"
                    type="text"
                    className="input-field text-sm"
                    placeholder="Computer Networks Notes"
                    value={uploadForm.title}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="book-description"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Description (optional)
                  </label>
                  <textarea
                    id="book-description"
                    className="input-field min-h-24 text-sm"
                    placeholder="Briefly describe this book."
                    value={uploadForm.description}
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="book-file"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    File
                  </label>
                  <input
                    id="book-file"
                    type="file"
                    className="input-field text-sm"
                    onChange={(e) =>
                      setUploadForm((prev) => ({
                        ...prev,
                        file: e.target.files?.[0] || null,
                      }))
                    }
                    required
                  />
                </div>

                {uploadError ? (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {uploadError}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                  <button
                    type="button"
                    onClick={closeUploadModal}
                    className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default Profile;
