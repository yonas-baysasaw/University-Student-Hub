import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import defaultProfile from '../assets/profile.png';

const toCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const useResources = () => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadBooks = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch('/api/books', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch /api/books');

        const data = await res.json();
        const books = Array.isArray(data)
          ? data
          : Array.isArray(data.data)
            ? data.data
            : [];

        if (active) {
          setResources(
            books.map((book, index) => ({
              id: book._id ?? book.id ?? `book-${index}`,
              bookId: book._id ?? book.id ?? null,
              title: book.title ?? 'Untitled',
              category: book.format ?? book.category ?? book.genre ?? 'General',
              type: book.format ?? book.type ?? 'Book',
              level: book.visibility ?? book.level ?? 'public',
              description: book.description ?? '',
              bookUrl: book.bookUrl ?? '',
              thumbnailUrl: book.thumbnailUrl ?? '',
              likesCount: toCount(book.likesCount),
              downloadsCount: toCount(
                book.downloadsCount ??
                  book.downloadCount ??
                  book.downloads ??
                  book.views,
              ),
              uploader: {
                id:
                  book?.uploader?.id ||
                  book?.uploader?._id ||
                  book?.userId?._id ||
                  null,
                name:
                  book?.uploader?.name ||
                  book?.userId?.name ||
                  book?.uploader?.username ||
                  book?.userId?.username ||
                  'Unknown user',
                username:
                  book?.uploader?.username || book?.userId?.username || '',
                avatar: book?.uploader?.avatar || book?.userId?.avatar || '',
              },
              createdAt: book.createdAt ?? '',
            })),
          );
        }
      } catch (err) {
        if (active) {
          setResources([]);
          setError(err?.message || 'Could not load books');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadBooks();
    return () => {
      active = false;
    };
  }, []);

  return { resources, loading, error };
};

function Library() {
  const { resources, loading, error } = useResources();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [favorites, setFavorites] = useState([]);

  const categories = useMemo(
    () => [
      'All',
      ...Array.from(new Set(resources.map((item) => item.category))),
    ],
    [resources],
  );

  const filteredResources = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return resources.filter((item) => {
      const categoryMatch = filter === 'All' || item.category === filter;
      const queryMatch =
        !normalized ||
        item.title.toLowerCase().includes(normalized) ||
        item.type.toLowerCase().includes(normalized) ||
        item.level.toLowerCase().includes(normalized);
      return categoryMatch && queryMatch;
    });
  }, [filter, query, resources]);

  const toggleFavorite = (id) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const formatDate = (value) => {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleString();
  };

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <section className="mx-auto max-w-6xl space-y-5">
        <div className="panel-card rounded-3xl p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Library
          </p>
          <h1 className="mt-2 font-display text-3xl text-slate-900 md:text-4xl">
            Find learning resources faster
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
            Search and filter resources instantly, and mark important materials
            as favorites for quick access.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              type="text"
              className="input-field text-sm"
              placeholder="Search title, type, or level..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="input-field text-sm md:w-56"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="panel-card col-span-full rounded-2xl p-6 text-center text-sm text-slate-500">
              Loading resources...
            </div>
          ) : error ? (
            <div className="panel-card col-span-full rounded-2xl p-6 text-center text-sm text-rose-600">
              {error}
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="panel-card col-span-full rounded-2xl p-6 text-center text-sm text-slate-500">
              No resources found. Try another search term or category.
            </div>
          ) : (
            filteredResources.map((item) => {
              const isFavorite = favorites.includes(item.id);
              return (
                <article
                  key={item.id}
                  className="panel-card fade-in-up rounded-2xl p-5"
                >
                  <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={`${item.title} cover`}
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-44 w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        No cover
                      </div>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-xl text-slate-900">
                      {item.title}
                    </h2>
                    <button
                      type="button"
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                        isFavorite
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                      onClick={() => toggleFavorite(item.id)}
                    >
                      {isFavorite ? 'Saved' : 'Save'}
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Category:{' '}
                    <span className="font-semibold text-slate-700">
                      {item.category}
                    </span>
                  </p>
                  <p className="text-sm text-slate-600">
                    Format:{' '}
                    <span className="font-semibold text-slate-700">
                      {item.type}
                    </span>
                  </p>
                  <p className="text-sm text-slate-600">
                    Visibility:{' '}
                    <span className="font-semibold text-slate-700">
                      {item.level}
                    </span>
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {item.uploader.id ? (
                      <Link
                        to={`/users/${item.uploader.id}`}
                        className="inline-flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-slate-100"
                      >
                        <img
                          src={item.uploader.avatar || defaultProfile}
                          alt={`${item.uploader.name} avatar`}
                          className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                        />
                        <p className="text-sm text-slate-600">
                          Uploaded by:{' '}
                          <span className="font-semibold text-cyan-700 hover:underline">
                            {item.uploader.name}
                          </span>
                        </p>
                      </Link>
                    ) : (
                      <>
                        <img
                          src={item.uploader.avatar || defaultProfile}
                          alt={`${item.uploader.name} avatar`}
                          className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                        />
                        <p className="text-sm text-slate-600">
                          Uploaded by:{' '}
                          <span className="font-semibold text-slate-700">
                            {item.uploader.name}
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    Likes:{' '}
                    <span className="font-semibold text-slate-700">
                      {item.likesCount}
                    </span>
                  </p>
                  <p className="text-sm text-slate-600">
                    Downloads:{' '}
                    <span className="font-semibold text-slate-700">
                      {item.downloadsCount}
                    </span>
                  </p>
                  <p className="text-sm text-slate-600">
                    Uploaded:{' '}
                    <span className="font-semibold text-slate-700">
                      {formatDate(item.createdAt)}
                    </span>
                  </p>
                  {item.description ? (
                    <p className="mt-2 text-sm text-slate-600">
                      {item.description}
                    </p>
                  ) : null}
                  {item.bookUrl ? (
                    <a
                      href={item.bookUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-block rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700"
                    >
                      See detail page
                    </a>
                  ) : item.bookId ? (
                    <Link
                      to={`/library/${item.bookId}`}
                      className="mt-3 inline-block rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700"
                    >
                      See detail page
                    </Link>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

export default Library;
