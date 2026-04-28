import {
  ArrowUpDown,
  Bookmark,
  Calendar,
  ChevronRight,
  Download,
  Heart,
  LayoutGrid,
  Library as LibraryIcon,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import defaultProfile from '../assets/profile.png';
import { useAuth } from '../contexts/AuthContext';
import { fetchLibraryBooks } from '../utils/books';
import { academicTrackLabel } from '../utils/bookUploadMeta';
import {
  formatLibraryDate,
  humanizeFormat,
  topicIfDistinct,
  visibilityLabel,
  visibilityTone,
} from '../utils/formatLabels';

const GUEST_SAVED_KEY = 'library.guestSavedIds';

function readGuestSavedIds() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(GUEST_SAVED_KEY) || '[]',
    );
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
}

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

        const books = await fetchLibraryBooks();
        if (active) setResources(books);
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

  return { resources, setResources, loading, error };
};

function Library() {
  const { user } = useAuth();
  const { resources, setResources, loading, error } = useResources();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [savedOnly, setSavedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [guestSavedIds, setGuestSavedIds] = useState(
    () => new Set(readGuestSavedIds()),
  );
  const [savingId, setSavingId] = useState(null);
  const [saveToast, setSaveToast] = useState('');

  useEffect(() => {
    if (!user) {
      setGuestSavedIds(new Set(readGuestSavedIds()));
    }
  }, [user]);

  const bookKey = useCallback((item) => String(item.bookId || item.id), []);

  const isItemSaved = useCallback(
    (item) => {
      const key = bookKey(item);
      if (user) return Boolean(item.saved);
      return guestSavedIds.has(key);
    },
    [user, guestSavedIds, bookKey],
  );

  const toggleSave = async (item) => {
    const key = bookKey(item);
    if (!key || key === 'null') return;

    if (!user) {
      const nextSet = new Set(guestSavedIds);
      const wasSaved = nextSet.has(key);
      if (wasSaved) nextSet.delete(key);
      else nextSet.add(key);
      try {
        window.localStorage.setItem(
          GUEST_SAVED_KEY,
          JSON.stringify([...nextSet]),
        );
      } catch {
        /* ignore */
      }
      setGuestSavedIds(nextSet);
      setSaveToast(
        wasSaved
          ? 'Removed from saved on this device.'
          : 'Saved on this device only. Sign in to sync across devices.',
      );
      window.setTimeout(() => setSaveToast(''), 3200);
      return;
    }

    setSavingId(key);
    setSaveToast('');
    try {
      const res = await fetch(`/api/books/${key}/save`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? 'Please sign in to save books.'
            : data?.message || 'Could not update saved books.',
        );
      }
      const saved = Boolean(data.saved);
      setResources((prev) =>
        prev.map((r) => (bookKey(r) === key ? { ...r, saved } : r)),
      );
      setSaveToast(saved ? 'Saved to your account.' : 'Removed from saved.');
      window.setTimeout(() => setSaveToast(''), 2800);
    } catch (err) {
      setSaveToast(err?.message || 'Could not save.');
      window.setTimeout(() => setSaveToast(''), 4000);
    } finally {
      setSavingId(null);
    }
  };

  const categories = useMemo(() => {
    const labels = resources
      .map((item) => item.category)
      .filter((c) => c != null && String(c).trim() !== '');
    return ['All', ...Array.from(new Set(labels))];
  }, [resources]);

  const filteredResources = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return resources.filter((item) => {
      const fmt = humanizeFormat(item.type).toLowerCase();
      const topic = topicIfDistinct(item.category, item.type);
      const topicStr = topic ? topic.toLowerCase() : '';
      const categoryMatch = filter === 'All' || item.category === filter;
      const savedMatch = !savedOnly || isItemSaved(item);
      const trackLbl = academicTrackLabel(item.academicTrack).toLowerCase();
      const deptStr = String(item.department || '').toLowerCase();
      const courseStr = String(item.courseSubject || '').toLowerCase();
      const yearStr =
        item.publishYear != null && Number.isFinite(Number(item.publishYear))
          ? String(item.publishYear)
          : '';
      const queryMatch =
        !normalized ||
        item.title.toLowerCase().includes(normalized) ||
        item.type.toLowerCase().includes(normalized) ||
        fmt.includes(normalized) ||
        item.level.toLowerCase().includes(normalized) ||
        (item.description &&
          item.description.toLowerCase().includes(normalized)) ||
        topicStr.includes(normalized) ||
        trackLbl.includes(normalized) ||
        deptStr.includes(normalized) ||
        courseStr.includes(normalized) ||
        yearStr.includes(normalized);
      return categoryMatch && queryMatch && savedMatch;
    });
  }, [filter, query, resources, savedOnly, isItemSaved]);

  const sortedResources = useMemo(() => {
    const list = [...filteredResources];
    if (sortBy === 'title') {
      list.sort((a, b) =>
        (a.title || '').localeCompare(b.title || '', undefined, {
          sensitivity: 'base',
        }),
      );
    } else if (sortBy === 'likes') {
      list.sort(
        (a, b) => (Number(b.likesCount) || 0) - (Number(a.likesCount) || 0),
      );
    } else {
      list.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
    }
    return list;
  }, [filteredResources, sortBy]);

  const savedCount = useMemo(
    () => resources.filter((item) => isItemSaved(item)).length,
    [resources, isItemSaved],
  );

  return (
    <div className="library-ambient relative page-surface min-h-[calc(100vh-5.5rem)] px-4 pb-12 pt-3 text-slate-900 md:px-6 md:pb-14 md:pt-5 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[min(240px,32vh)] workspace-hero-mesh opacity-90 dark:opacity-70" />

      <section className="relative z-[2] mx-auto max-w-6xl space-y-5 md:space-y-6">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/15 to-indigo-500/15 text-cyan-600 shadow-lg shadow-cyan-900/5 ring-1 ring-cyan-500/20 dark:from-cyan-400/10 dark:to-indigo-400/10 dark:text-cyan-300 dark:ring-cyan-400/25">
              <LibraryIcon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/80 px-3 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-700 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800/90 dark:text-cyan-300 dark:ring-slate-600">
                  Collections
                </span>
                {!loading && !error ? (
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {resources.length}{' '}
                    {resources.length === 1 ? 'title' : 'titles'}
                    {savedCount > 0 ? ` · ${savedCount} saved` : ''}
                  </span>
                ) : null}
              </div>
              <h1 className="font-display text-balance text-3xl font-bold tracking-tight text-slate-900 md:text-4xl dark:text-white">
                Campus library
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Browse shared materials, bookmark what you need, and jump into{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Liqu AI Study buddy
                </span>{' '}
                with one click.
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 flex-wrap gap-2">
            {user ? (
              <Link
                to="/profile"
                className="group inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-md shadow-slate-900/5 ring-1 ring-slate-200/80 transition hover:border-cyan-300/60 hover:shadow-lg dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-100 dark:ring-slate-600 dark:hover:border-cyan-500/40"
              >
                <Upload
                  className="h-4 w-4 text-cyan-600 transition group-hover:translate-y-[-1px] dark:text-cyan-400"
                  aria-hidden
                />
                Upload
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-md dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-100"
              >
                Sign in to sync
              </Link>
            )}
            <Link
              to="/liqu-ai/study-buddy"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/25 ring-1 ring-white/10 transition hover:brightness-110 dark:from-cyan-700 dark:to-cyan-800 dark:shadow-cyan-950/40"
            >
              <Sparkles className="h-4 w-4 opacity-90" aria-hidden />
              Study buddy
              <ChevronRight className="h-4 w-4 opacity-70" aria-hidden />
            </Link>
          </div>
        </header>

        {saveToast ? (
          <div
            role="status"
            className="fade-in-up rounded-2xl border border-cyan-200/80 bg-gradient-to-r from-cyan-50 to-white px-4 py-3 text-sm font-medium text-cyan-950 shadow-md shadow-cyan-900/5 dark:border-cyan-800/50 dark:from-cyan-950/50 dark:to-slate-900/90 dark:text-cyan-100"
          >
            {saveToast}
          </div>
        ) : null}

        <div className="rounded-3xl border border-slate-200/90 bg-white/75 p-5 shadow-xl shadow-slate-900/[0.06] backdrop-blur-md dark:border-slate-700/90 dark:bg-slate-900/65 md:p-6">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-700/80 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSavedOnly(false)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                  !savedOnly
                    ? 'bg-slate-900 text-white shadow-md dark:bg-cyan-600'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                All books
              </button>
              <button
                type="button"
                onClick={() => setSavedOnly(true)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                  savedOnly
                    ? 'bg-amber-100 text-amber-950 ring-2 ring-amber-400/30 dark:bg-amber-500/20 dark:text-amber-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Bookmark
                  className={`h-3.5 w-3.5 ${savedOnly ? 'fill-current' : ''}`}
                  aria-hidden
                />
                Saved · {savedCount}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <ArrowUpDown className="h-4 w-4 opacity-70" aria-hidden />
              <label htmlFor="library-sort" className="sr-only">
                Sort list
              </label>
              <select
                id="library-sort"
                className="cursor-pointer rounded-xl border border-slate-200 bg-white/90 py-2 pl-3 pr-8 text-xs font-bold text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="recent">Newest first</option>
                <option value="title">Title A–Z</option>
                <option value="likes">Most liked</option>
              </select>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_minmax(0,220px)]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                autoComplete="off"
                className="input-field h-11 w-full border-slate-200/90 bg-white/90 pl-10 text-sm dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-100"
                placeholder="Search title, department, course, year, format…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search library"
              />
            </div>
            <select
              className="input-field h-11 border-slate-200/90 bg-white/90 text-sm font-medium dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-100"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter by category or topic"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === 'All' ? 'All topics' : category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full rounded-3xl border border-dashed border-slate-300/80 bg-white/50 p-12 dark:border-slate-600 dark:bg-slate-900/40">
              <div className="mx-auto flex max-w-lg flex-col items-center gap-5">
                <div className="flex w-full flex-col gap-3">
                  <div className="h-3 w-40 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="h-56 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                </div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Loading your library…
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="col-span-full rounded-3xl border border-rose-200/90 bg-rose-50/95 p-8 text-center text-sm font-medium text-rose-900 shadow-inner dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-100">
              {error}
            </div>
          ) : sortedResources.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-slate-200/90 bg-white/70 px-8 py-16 text-center dark:border-slate-700 dark:bg-slate-900/50">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <Search className="h-7 w-7" aria-hidden />
              </span>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {savedOnly
                  ? 'Nothing saved matches these filters. Try “All books” or clear search.'
                  : resources.length === 0
                    ? 'The shelves are empty. Upload a PDF or document from your profile to share with classmates.'
                    : 'No matches. Try another keyword or topic filter.'}
              </p>
              {user && resources.length === 0 ? (
                <Link
                  to="/profile"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-900/20 hover:bg-cyan-500 dark:bg-cyan-700 dark:hover:bg-cyan-600"
                >
                  <Upload className="h-4 w-4" aria-hidden />
                  Upload your first book
                </Link>
              ) : null}
            </div>
          ) : (
            sortedResources.map((item, index) => {
              const key = bookKey(item);
              const saved = isItemSaved(item);
              const busy = savingId === key;
              const formatLabel = humanizeFormat(item.type);
              const topic = topicIfDistinct(item.category, item.type);
              const visLabel = visibilityLabel(item.level);
              const visTone = visibilityTone(item.level);
              const dateShort = formatLibraryDate(item.createdAt);

              return (
                <article
                  key={item.id}
                  style={{ animationDelay: `${Math.min(index * 45, 400)}ms` }}
                  className="library-book-card fade-in-up panel-card group flex flex-col overflow-hidden rounded-[1.35rem] border border-slate-200/85 bg-gradient-to-b from-white to-slate-50/90 dark:border-slate-700/90 dark:from-slate-900 dark:to-slate-950/95"
                >
                  <div className="relative mb-4 overflow-hidden rounded-2xl bg-slate-200/90 ring-1 ring-slate-200/90 dark:bg-slate-800 dark:ring-slate-700">
                    <div className="aspect-[4/5] w-full overflow-hidden sm:aspect-[3/4]">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={`Cover: ${item.title}`}
                          className="library-cover-img h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full min-h-[11rem] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 px-4 text-center dark:from-slate-800 dark:to-slate-900">
                          <LibraryIcon
                            className="h-12 w-12 text-slate-400 opacity-70 dark:text-slate-600"
                            strokeWidth={1.25}
                            aria-hidden
                          />
                          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                            No cover
                          </span>
                        </div>
                      )}
                      <div
                        className="library-cover-shine pointer-events-none absolute inset-0 z-[1]"
                        aria-hidden
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-24 bg-gradient-to-t from-slate-950/65 to-transparent dark:from-black/75" />
                    </div>

                    <div className="absolute left-3 top-3 z-[3] flex max-w-[calc(100%-3.5rem)] flex-wrap gap-1.5">
                      <span className="rounded-lg bg-white/95 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-cyan-800 shadow-md shadow-black/10 ring-1 ring-cyan-500/25 backdrop-blur-sm dark:bg-slate-950/90 dark:text-cyan-200 dark:ring-cyan-400/30">
                        {formatLabel}
                      </span>
                      {item.academicTrack ? (
                        <span className="max-w-[10rem] truncate rounded-lg bg-indigo-500/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md ring-1 ring-indigo-400/40 backdrop-blur-sm dark:bg-indigo-600/95">
                          {academicTrackLabel(item.academicTrack)}
                        </span>
                      ) : null}
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide shadow-md ring-1 backdrop-blur-sm ${visTone}`}
                      >
                        {visLabel}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      aria-busy={busy}
                      aria-pressed={saved}
                      title={saved ? 'Remove from saved' : 'Save to list'}
                      className={`absolute right-3 top-3 z-[3] inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-lg backdrop-blur-md transition hover:scale-105 disabled:opacity-50 ${
                        saved
                          ? 'bg-amber-400/95 text-amber-950 ring-1 ring-amber-300/60 dark:bg-amber-500/90 dark:text-amber-950'
                          : 'bg-white/90 text-slate-600 ring-1 ring-white/60 hover:bg-white dark:bg-slate-900/90 dark:text-slate-200 dark:ring-slate-600'
                      }`}
                      onClick={() => toggleSave(item)}
                    >
                      <Bookmark
                        className={`h-[18px] w-[18px] ${saved ? 'fill-current' : ''}`}
                        aria-hidden
                      />
                      <span className="sr-only">
                        {busy ? 'Saving…' : saved ? 'Saved' : 'Save book'}
                      </span>
                    </button>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col px-1 pb-1">
                    <h2 className="font-display text-lg font-bold leading-snug tracking-tight text-slate-900 transition group-hover:text-cyan-800 dark:text-white dark:group-hover:text-cyan-300">
                      <Link
                        to={`/library/${item.bookId}`}
                        className="focus:outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-cyan-500/80"
                      >
                        {item.title}
                      </Link>
                    </h2>

                    {item.academicTrack ||
                    item.department ||
                    item.courseSubject ||
                    (item.publishYear != null &&
                      Number.isFinite(Number(item.publishYear))) ? (
                      <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/95 px-3 py-2 dark:border-slate-700/90 dark:bg-slate-800/55">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          Catalog
                        </p>
                        <ul className="mt-1.5 space-y-1 text-[12px] font-medium leading-snug text-slate-800 dark:text-slate-200">
                          {item.academicTrack ? (
                            <li>
                              <span className="text-slate-500 dark:text-slate-400">
                                Field ·{' '}
                              </span>
                              {academicTrackLabel(item.academicTrack)}
                            </li>
                          ) : null}
                          {item.department ? (
                            <li>
                              <span className="text-slate-500 dark:text-slate-400">
                                Dept ·{' '}
                              </span>
                              {item.department}
                            </li>
                          ) : null}
                          {item.courseSubject ? (
                            <li>
                              <span className="text-slate-500 dark:text-slate-400">
                                Course ·{' '}
                              </span>
                              {item.courseSubject}
                            </li>
                          ) : null}
                          {item.publishYear != null &&
                          Number.isFinite(Number(item.publishYear)) ? (
                            <li>
                              <span className="text-slate-500 dark:text-slate-400">
                                Year ·{' '}
                              </span>
                              {item.publishYear}
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    ) : null}

                    {topic ? (
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        {topic}
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-y border-slate-100 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-700/80 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5 text-rose-400" aria-hidden />
                        {item.likesCount ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Download
                          className="h-3.5 w-3.5 text-slate-400"
                          aria-hidden
                        />
                        {item.downloadsCount ?? 0}
                      </span>
                      {dateShort ? (
                        <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                          {dateShort}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex min-h-[40px] items-center gap-2">
                      {item.uploader.id ? (
                        <Link
                          to={`/users/${item.uploader.id}`}
                          className="group/up inline-flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-50/90 px-2 py-1.5 ring-1 ring-slate-100 transition hover:bg-slate-100 hover:ring-slate-200 dark:bg-slate-800/80 dark:ring-slate-700 dark:hover:bg-slate-800"
                        >
                          <img
                            src={item.uploader.avatar || defaultProfile}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-slate-700"
                          />
                          <span className="min-w-0 truncate text-xs font-semibold text-slate-700 group-hover/up:text-cyan-700 dark:text-slate-200 dark:group-hover/up:text-cyan-400">
                            {item.uploader.name}
                          </span>
                        </Link>
                      ) : (
                        <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
                          <img
                            src={item.uploader.avatar || defaultProfile}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover ring-2 ring-white dark:ring-slate-700"
                          />
                          <span className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {item.uploader.name}
                          </span>
                        </div>
                      )}
                    </div>

                    {item.description ? (
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {item.description}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm italic text-slate-400 dark:text-slate-600">
                        No description
                      </p>
                    )}

                    <div className="mt-5 grid gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        {item.bookUrl ? (
                          <a
                            href={item.bookUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-slate-800 shadow-sm transition hover:border-cyan-400/60 hover:bg-cyan-50/80 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-cyan-500/50 dark:hover:bg-slate-900"
                          >
                            Open file
                          </a>
                        ) : (
                          <span className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-center text-[11px] font-semibold text-slate-400 dark:border-slate-700 dark:text-slate-600">
                            No direct file
                          </span>
                        )}
                        {item.bookId ? (
                          <Link
                            to={`/library/${item.bookId}`}
                            className="flex items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-700 px-3 py-2.5 text-center text-xs font-bold text-white shadow-md shadow-cyan-900/25 transition hover:brightness-110 dark:from-cyan-600 dark:to-cyan-700"
                          >
                            Details
                          </Link>
                        ) : null}
                      </div>
                      {item.bookId ? (
                        <Link
                          to={`/liqu-ai/study-buddy?bookId=${item.bookId}`}
                          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 py-3 text-xs font-bold text-white shadow-lg shadow-slate-900/30 ring-1 ring-white/10 transition hover:brightness-110 dark:from-cyan-900 dark:via-slate-900 dark:to-slate-950 dark:shadow-black/40"
                        >
                          <Sparkles className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                          Study with Liqu AI
                          <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                        </Link>
                      ) : null}
                    </div>
                  </div>
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
