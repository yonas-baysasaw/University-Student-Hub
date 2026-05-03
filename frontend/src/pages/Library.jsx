import {
  ArrowUpDown,
  BookOpen,
  Bookmark,
  Calendar,
  ChevronRight,
  Download,
  Grid3x3,
  Heart,
  List,
  ListPlus,
  Library as LibraryIcon,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
const LS_LIBRARY_VIEW = 'ush.library.view';
const LS_LIBRARY_COLS = 'ush.library.gridCols';

function readLibraryViewPrefs() {
  if (typeof window === 'undefined') {
    return { view: 'grid', cols: '3' };
  }
  try {
    const v = window.localStorage.getItem(LS_LIBRARY_VIEW);
    const c = window.localStorage.getItem(LS_LIBRARY_COLS);
    const cols = c === '2' || c === '3' || c === '4' ? c : '3';
    return { view: v === 'list' ? 'list' : 'grid', cols };
  } catch {
    return { view: 'grid', cols: '3' };
  }
}

/** Maps URL search params to `/api/books` query (server-side filters). */
function buildBooksApiQuery(searchParams) {
  const o = {};
  const q = (searchParams.get('q') || '').trim();
  if (q) o.q = q;
  const dept = (searchParams.get('dept') || '').trim();
  if (dept) o.department = dept;
  const yearFrom = (searchParams.get('yearFrom') || '').trim();
  const yearTo = (searchParams.get('yearTo') || '').trim();
  const year = (searchParams.get('year') || '').trim();
  if (yearFrom || yearTo) {
    if (yearFrom) o.yearFrom = yearFrom;
    if (yearTo) o.yearTo = yearTo;
  } else if (year) {
    o.year = year;
  }
  const added = (searchParams.get('added') || '').trim();
  if (added === '7d' || added === '30d' || added === '90d' || added === 'term') {
    const end = new Date();
    const start = new Date();
    if (added === '7d') start.setDate(start.getDate() - 7);
    else if (added === '30d') start.setDate(start.getDate() - 30);
    else if (added === '90d') start.setDate(start.getDate() - 90);
    else start.setDate(start.getDate() - 120);
    o.from = start.toISOString();
    o.to = end.toISOString();
  }
  return o;
}

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

const useResources = (listFetchKey, listBookIdsSerialized) => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const sp = new URLSearchParams(listFetchKey);
    const apiQuery = buildBooksApiQuery(sp);

    const listBookIds =
      listBookIdsSerialized === '' || listBookIdsSerialized == null
        ? null
        : JSON.parse(listBookIdsSerialized);

    const loadBooks = async () => {
      try {
        setLoading(true);
        setError('');

        const books = await fetchLibraryBooks(undefined, apiQuery);
        if (!active) return;
        let next = books;
        if (Array.isArray(listBookIds)) {
          if (listBookIds.length === 0) next = [];
          else {
            const allow = new Set(listBookIds.map(String));
            next = books.filter((b) =>
              allow.has(String(b.bookId || b.id)),
            );
          }
        }
        setResources(next);
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
  }, [listFetchKey, listBookIdsSerialized]);

  return { resources, setResources, loading, error };
};

function LibraryBookListRow({
  item,
  index,
  itemKey,
  saved,
  busy,
  formatLabel,
  topic,
  visLabel,
  visTone,
  dateShort,
  user,
  toggleSave,
  setListPickerFor,
  listPickerFor,
  readingLists,
  listsLoading,
  addBookToList,
  createListAndAdd,
}) {
  return (
    <article
      style={{ animationDelay: `${Math.min(index * 45, 400)}ms` }}
      className="relative library-book-card fade-in-up panel-card flex flex-row gap-3 overflow-hidden rounded-[1.35rem] border border-slate-200/85 bg-gradient-to-br from-white via-white to-fuchsia-50/30 p-3 shadow-sm dark:border-slate-700/90 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 sm:gap-4 sm:p-4"
    >
      <div className="relative w-[5.75rem] shrink-0 sm:w-32">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-slate-200/90 ring-1 ring-cyan-500/10 dark:bg-slate-800">
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt=""
              className="library-cover-img h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-fuchsia-100/80 to-cyan-100/60 dark:from-slate-800 dark:to-slate-900">
              <LibraryIcon
                className="h-8 w-8 text-slate-400 opacity-70"
                strokeWidth={1.25}
                aria-hidden
              />
            </div>
          )}
          <div
            className="library-cover-shine pointer-events-none absolute inset-0 z-[1]"
            aria-hidden
          />
        </div>
        <div className="absolute left-0.5 top-0.5 z-[2] flex max-w-[calc(100%-0.25rem)] flex-wrap gap-0.5">
          <span className="rounded-md bg-white/95 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-800 shadow-sm ring-1 ring-cyan-500/20 dark:bg-slate-950/90 dark:text-cyan-200">
            {formatLabel}
          </span>
          <span
            className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide shadow-sm ring-1 backdrop-blur-sm ${visTone}`}
          >
            {visLabel}
          </span>
        </div>
        {user && itemKey ? (
          <button
            type="button"
            className="absolute right-0 top-1 z-[3] inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-slate-600 shadow-md ring-1 ring-white/70 dark:bg-slate-900/95 dark:text-slate-200"
            title="Add to reading list"
            onClick={() =>
              setListPickerFor((v) => (v === itemKey ? null : itemKey))
            }
          >
            <ListPlus className="h-4 w-4" aria-hidden />
            <span className="sr-only">Add to reading list</span>
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          aria-pressed={saved}
          title={saved ? 'Remove from saved' : 'Save to list'}
          className={`absolute right-0 top-10 z-[3] inline-flex h-8 w-8 items-center justify-center rounded-lg shadow-md disabled:opacity-50 ${
            saved
              ? 'bg-amber-400/95 text-amber-950 ring-1 ring-amber-300/50'
              : 'bg-white/95 text-slate-600 ring-1 ring-white/70 dark:bg-slate-900/95'
          }`}
          onClick={() => toggleSave(item)}
        >
          <Bookmark
            className={`h-4 w-4 ${saved ? 'fill-current' : ''}`}
            aria-hidden
          />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5 pr-1">
        <div>
          <h2 className="font-display text-base font-bold leading-snug text-slate-900 dark:text-white sm:text-lg">
            <Link
              to={`/library/${item.bookId}`}
              className="hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/80 dark:hover:text-cyan-300"
            >
              {item.title}
            </Link>
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>{formatLabel}</span>
            {dateShort ? (
              <>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                  ·
                </span>
                <span>{dateShort}</span>
              </>
            ) : null}
            {item.ragIndexStatus === 'ready' ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                · Liqu-ready
              </span>
            ) : null}
          </p>
        </div>

        {item.academicTrack ||
        item.department ||
        item.courseSubject ||
        (item.publishYear != null &&
          Number.isFinite(Number(item.publishYear))) ? (
          <div className="rounded-xl border border-slate-100/90 bg-slate-50/90 px-2.5 py-1.5 dark:border-slate-700/80 dark:bg-slate-800/50">
            <ul className="space-y-0.5 text-[11px] font-medium text-slate-800 dark:text-slate-200">
              {item.department ? (
                <li className="truncate">
                  <span className="text-slate-500 dark:text-slate-400">Dept · </span>
                  {item.department}
                </li>
              ) : null}
              {item.courseSubject ? (
                <li className="truncate">
                  <span className="text-slate-500 dark:text-slate-400">Course · </span>
                  {item.courseSubject}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {topic ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-fuchsia-600/90 dark:text-fuchsia-400/90">
            {topic}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 normal-case">
            <Heart className="h-3 w-3 text-rose-400" aria-hidden />
            {item.likesCount ?? 0}
          </span>
          <span className="inline-flex items-center gap-1 normal-case">
            <Download className="h-3 w-3 text-slate-400" aria-hidden />
            {item.downloadsCount ?? 0}
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <img
            src={item.uploader.avatar || defaultProfile}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-cyan-500/20"
          />
          {item.uploader.id ? (
            <Link
              to={`/users/${item.uploader.id}`}
              className="truncate text-xs font-semibold text-slate-700 hover:text-cyan-600 dark:text-slate-200 dark:hover:text-cyan-400"
            >
              {item.uploader.name}
            </Link>
          ) : (
            <span className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
              {item.uploader.name}
            </span>
          )}
        </div>

        {item.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {item.description}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {item.bookUrl ? (
            <a
              href={item.bookUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            >
              Open file
            </a>
          ) : null}
          {item.bookId ? (
            <Link
              to={`/library/${item.bookId}`}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 px-3 py-2 text-xs font-bold text-white shadow-md"
            >
              Details
            </Link>
          ) : null}
          {item.bookId ? (
            <Link
              to={`/liqu-ai/study-buddy?bookId=${item.bookId}`}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white dark:bg-gradient-to-r dark:from-cyan-800 dark:to-indigo-900"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Study
            </Link>
          ) : null}
        </div>
      </div>

      {listPickerFor === itemKey ? (
        <div
          role="dialog"
          aria-label="Choose reading list"
          className="absolute inset-x-0 bottom-0 z-30 max-h-[min(340px,55%)] overflow-hidden rounded-t-2xl border border-cyan-200/90 bg-white/98 shadow-[0_-8px_40px_rgba(15,23,42,0.2)] dark:border-slate-600 dark:bg-slate-900/98"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Add to list
            </span>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-cyan-700 dark:text-cyan-400"
              onClick={() => setListPickerFor(null)}
            >
              Close
            </button>
          </div>
          <div className="max-h-44 space-y-0.5 overflow-y-auto p-2">
            {listsLoading ? (
              <p className="px-2 py-3 text-xs text-slate-500">Loading…</p>
            ) : readingLists.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-500">
                No lists yet — create one below.
              </p>
            ) : (
              readingLists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-800 hover:bg-cyan-50 dark:text-slate-100 dark:hover:bg-slate-800"
                  onClick={() => addBookToList(l.id, itemKey)}
                >
                  {l.name}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-slate-100 p-2 dark:border-slate-700">
            <button
              type="button"
              className="w-full rounded-xl border border-dashed border-cyan-400/70 py-2.5 text-xs font-bold text-cyan-800 dark:border-cyan-600 dark:text-cyan-200"
              onClick={() => createListAndAdd(itemKey)}
            >
              New reading list…
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function LibraryBookGridCard({
  item,
  index,
  itemKey,
  saved,
  busy,
  formatLabel,
  topic,
  visLabel,
  visTone,
  dateShort,
  user,
  toggleSave,
  setListPickerFor,
  listPickerFor,
  readingLists,
  listsLoading,
  addBookToList,
  createListAndAdd,
  mobileDetailOpen,
  onToggleMobileDetail,
}) {
  const detailMobileClasses = mobileDetailOpen
    ? 'max-lg:max-h-[2000px] max-lg:translate-y-0 max-lg:opacity-100 max-lg:pointer-events-auto max-lg:mt-1'
    : 'max-lg:max-h-0 max-lg:translate-y-2 max-lg:opacity-0 max-lg:pointer-events-none max-lg:overflow-hidden';

  return (
    <article
      style={{ animationDelay: `${Math.min(index * 45, 400)}ms` }}
      className="relative library-book-card fade-in-up panel-card group flex flex-col overflow-hidden rounded-[1.35rem] border border-slate-200/85 bg-gradient-to-b from-white via-white to-cyan-50/25 dark:border-slate-700/90 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/50"
    >
      <div className="relative shrink-0 px-2 pt-2">
        <div className="relative overflow-hidden rounded-2xl bg-slate-200/90 ring-1 ring-cyan-500/15 dark:bg-slate-800 dark:ring-cyan-500/10">
          <div className="aspect-[4/5] w-full overflow-hidden sm:aspect-[3/4]">
            {item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt={`Cover: ${item.title}`}
                className="library-cover-img h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-[11rem] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-fuchsia-100/90 via-white to-cyan-100/80 px-4 text-center dark:from-slate-800 dark:via-slate-900 dark:to-slate-900">
                <LibraryIcon
                  className="h-12 w-12 text-fuchsia-400/60 dark:text-slate-600"
                  strokeWidth={1.25}
                  aria-hidden
                />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
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

          {user && itemKey ? (
            <button
              type="button"
              className="absolute right-14 top-3 z-[3] inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-slate-600 shadow-lg ring-1 ring-white/60 backdrop-blur-md transition hover:scale-105 hover:bg-white dark:bg-slate-900/90 dark:text-slate-200 dark:ring-slate-600"
              title="Add to reading list"
              onClick={() =>
                setListPickerFor((v) => (v === itemKey ? null : itemKey))
              }
            >
              <ListPlus className="h-[18px] w-[18px]" aria-hidden />
              <span className="sr-only">Add to reading list</span>
            </button>
          ) : null}

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
      </div>

      <div className="relative z-[5] px-3 pb-1 pt-2">
        <h2 className="font-display line-clamp-2 text-base font-bold leading-snug tracking-tight text-slate-900 dark:text-white">
          <Link
            to={`/library/${item.bookId}`}
            className="transition group-hover:text-cyan-700 focus:outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-cyan-500/80 dark:group-hover:text-cyan-300"
          >
            {item.title}
          </Link>
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span className="text-fuchsia-700/90 dark:text-fuchsia-300/90">{formatLabel}</span>
          {dateShort ? (
            <>
              <span aria-hidden className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span>{dateShort}</span>
            </>
          ) : null}
        </p>
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-500/15 to-cyan-500/15 px-3 py-1 text-[11px] font-bold text-cyan-800 ring-1 ring-cyan-500/25 transition hover:from-fuchsia-500/25 hover:to-cyan-500/25 lg:hidden dark:text-cyan-200 dark:ring-cyan-400/30"
          aria-expanded={mobileDetailOpen}
          onClick={onToggleMobileDetail}
        >
          {mobileDetailOpen ? 'Show less' : 'Show more'}
        </button>
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col px-3 pb-3 transition-all duration-300 ease-out ${detailMobileClasses} lg:absolute lg:inset-x-0 lg:bottom-0 lg:z-20 lg:mt-0 lg:max-h-[min(400px,82vh)] lg:overflow-y-auto lg:rounded-t-2xl lg:border lg:border-cyan-400/35 lg:bg-slate-950/[0.94] lg:px-4 lg:pb-4 lg:pt-4 lg:text-slate-100 lg:shadow-[0_-28px_70px_rgba(0,0,0,0.42)] lg:backdrop-blur-xl lg:transition lg:duration-300 lg:ease-out lg:translate-y-full lg:opacity-0 lg:pointer-events-none lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto lg:group-focus-within:translate-y-0 lg:group-focus-within:opacity-100 lg:group-focus-within:pointer-events-auto dark:lg:border-fuchsia-500/20`}
      >
        <p className="hidden text-[11px] font-semibold text-slate-500 dark:text-slate-400 lg:block lg:text-slate-300">
          {formatLabel}
          {item.publishYear != null && Number.isFinite(Number(item.publishYear))
            ? ` · ${item.publishYear}`
            : ''}
          {item.ragIndexStatus === 'ready' ? (
            <span className="text-emerald-400"> · Liqu-ready</span>
          ) : null}
        </p>

        {item.academicTrack ||
        item.department ||
        item.courseSubject ||
        (item.publishYear != null &&
          Number.isFinite(Number(item.publishYear))) ? (
          <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/95 px-3 py-2 dark:border-slate-700/90 dark:bg-slate-800/55 lg:mt-3 lg:border-white/10 lg:bg-white/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 lg:text-cyan-200/80">
              Catalog
            </p>
            <ul className="mt-1.5 space-y-1 text-[12px] font-medium leading-snug text-slate-800 dark:text-slate-200 lg:text-slate-100">
                          {item.academicTrack ? (
                            <li>
                              <span className="text-slate-500 dark:text-slate-400 lg:text-slate-400">
                                Field ·{' '}
                              </span>
                              {academicTrackLabel(item.academicTrack)}
                            </li>
                          ) : null}
                          {item.department ? (
                            <li>
                              <span className="text-slate-500 dark:text-slate-400 lg:text-slate-400">
                                Dept ·{' '}
                              </span>
                              {item.department}
                            </li>
                          ) : null}
                          {item.courseSubject ? (
                            <li>
                              <span className="text-slate-500 dark:text-slate-400 lg:text-slate-400">
                                Course ·{' '}
                              </span>
                              {item.courseSubject}
                            </li>
                          ) : null}
                          {item.publishYear != null &&
                          Number.isFinite(Number(item.publishYear)) ? (
                            <li>
                              <span className="text-slate-500 dark:text-slate-400 lg:text-slate-400">
                                Year ·{' '}
                              </span>
                              {item.publishYear}
                            </li>
                          ) : null}
            </ul>
          </div>
        ) : null}

        {topic ? (
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-fuchsia-300/90">
            {topic}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-y border-slate-200 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700/80 dark:text-slate-400 lg:border-white/10 lg:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5 text-rose-400" aria-hidden />
            {item.likesCount ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <Download className="h-3.5 w-3.5 text-slate-400" aria-hidden />
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
              className="group/up inline-flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/10 px-2 py-1.5 ring-1 ring-white/15 transition hover:bg-white/15 lg:bg-white/5"
            >
              <img
                src={item.uploader.avatar || defaultProfile}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-cyan-400/30"
              />
              <span className="min-w-0 truncate text-xs font-semibold text-slate-200 group-hover/up:text-cyan-300">
                {item.uploader.name}
              </span>
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
              <img
                src={item.uploader.avatar || defaultProfile}
                alt=""
                className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20"
              />
              <span className="truncate text-xs font-semibold text-slate-300">
                {item.uploader.name}
              </span>
            </div>
          )}
        </div>

        {item.description ? (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-300 max-lg:text-slate-600 dark:max-lg:text-slate-300">
            {item.description}
          </p>
        ) : (
          <p className="mt-3 text-sm italic text-slate-500 max-lg:text-slate-500">
            No description
          </p>
        )}

        <div className="mt-4 grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            {item.bookUrl ? (
              <a
                href={item.bookUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-center text-xs font-bold text-white transition hover:bg-white/15 max-lg:border-slate-200 max-lg:bg-white max-lg:text-slate-800 max-lg:hover:bg-cyan-50 dark:max-lg:border-slate-600 dark:max-lg:bg-slate-950 dark:max-lg:text-slate-100"
              >
                Open file
              </a>
            ) : (
              <span className="flex items-center justify-center rounded-xl border border-dashed border-white/20 px-3 py-2.5 text-center text-[11px] font-semibold text-slate-500 max-lg:border-slate-200 max-lg:text-slate-400 dark:max-lg:border-slate-700">
                No direct file
              </span>
            )}
            {item.bookId ? (
              <Link
                to={`/library/${item.bookId}`}
                className="flex items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-fuchsia-600 px-3 py-2.5 text-center text-xs font-bold text-white shadow-lg transition hover:brightness-110"
              >
                Details
              </Link>
            ) : null}
          </div>
          {item.bookId ? (
            <Link
              to={`/liqu-ai/study-buddy?bookId=${item.bookId}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-900 py-3 text-xs font-bold text-white shadow-lg ring-1 ring-white/10 transition hover:brightness-110 dark:from-cyan-950 dark:via-slate-900 dark:to-indigo-950"
            >
              <Sparkles className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              Study with Liqu AI
              <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>

      {listPickerFor === itemKey ? (
        <div
          role="dialog"
          aria-label="Choose reading list"
          className="absolute inset-x-0 bottom-0 z-30 max-h-[min(340px,55%)] overflow-hidden rounded-t-2xl border border-cyan-200/90 bg-white/98 shadow-[0_-8px_40px_rgba(15,23,42,0.2)] dark:border-slate-600 dark:bg-slate-900/98"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Add to list
            </span>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-cyan-700 dark:text-cyan-400"
              onClick={() => setListPickerFor(null)}
            >
              Close
            </button>
          </div>
          <div className="max-h-44 space-y-0.5 overflow-y-auto p-2">
            {listsLoading ? (
              <p className="px-2 py-3 text-xs text-slate-500">Loading…</p>
            ) : readingLists.length === 0 ? (
              <p className="px-2 py-3 text-xs text-slate-500">
                No lists yet — create one below.
              </p>
            ) : (
              readingLists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-800 hover:bg-cyan-50 dark:text-slate-100 dark:hover:bg-slate-800"
                  onClick={() => addBookToList(l.id, itemKey)}
                >
                  {l.name}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-slate-100 p-2 dark:border-slate-700">
            <button
              type="button"
              className="w-full rounded-xl border border-dashed border-cyan-400/70 py-2.5 text-xs font-bold text-cyan-800 dark:border-cyan-600 dark:text-cyan-200"
              onClick={() => createListAndAdd(itemKey)}
            >
              New reading list…
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Library() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const listFetchKey = searchParams.toString();
  const listId = (searchParams.get('list') || '').trim();

  const [listBookIdsSerialized, setListBookIdsSerialized] = useState('');

  useEffect(() => {
    if (!listId) {
      setListBookIdsSerialized('');
      return;
    }
    if (!user) {
      setListBookIdsSerialized(JSON.stringify([]));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reading-lists/${listId}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error('list');
        const ids = data?.list?.bookIds;
        const arr = Array.isArray(ids) ? ids : [];
        if (!cancelled) setListBookIdsSerialized(JSON.stringify(arr));
      } catch {
        if (!cancelled) setListBookIdsSerialized(JSON.stringify([]));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listId, user]);

  const { resources, setResources, loading, error } = useResources(
    listFetchKey,
    listBookIdsSerialized,
  );

  const patchParams = useCallback(
    (updates) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([k, v]) => {
        if (
          v === null ||
          v === undefined ||
          v === '' ||
          (k === 'topic' && v === 'All') ||
          (k === 'sort' && v === 'recent') ||
          (k === 'saved' && (v === '0' || v === false))
        ) {
          next.delete(k);
        } else {
          next.set(k, String(v));
        }
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const sortBy = searchParams.get('sort') || 'recent';
  const savedOnly = searchParams.get('saved') === '1';
  const filter = searchParams.get('topic') || 'All';

  const qFromUrl = searchParams.get('q') || '';
  const [queryInput, setQueryInput] = useState(qFromUrl);
  const queryDebounceRef = useRef();

  useEffect(() => {
    setQueryInput(qFromUrl);
  }, [qFromUrl]);

  const onQueryInputChange = (val) => {
    setQueryInput(val);
    if (queryDebounceRef.current) window.clearTimeout(queryDebounceRef.current);
    queryDebounceRef.current = window.setTimeout(() => {
      patchParams({ q: val.trim() || null });
    }, 320);
  };

  const [guestSavedIds, setGuestSavedIds] = useState(
    () => new Set(readGuestSavedIds()),
  );
  const [savingId, setSavingId] = useState(null);
  const [saveToast, setSaveToast] = useState('');
  const [listPickerFor, setListPickerFor] = useState(null);
  const [readingLists, setReadingLists] = useState([]);
  const [listsLoading, setListsLoading] = useState(false);
  const prefs = readLibraryViewPrefs();
  const [libraryView, setLibraryView] = useState(prefs.view);
  const [gridCols, setGridCols] = useState(prefs.cols);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileDetailKey, setMobileDetailKey] = useState(null);
  const filterPanelRef = useRef(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_LIBRARY_VIEW, libraryView);
      window.localStorage.setItem(LS_LIBRARY_COLS, gridCols);
    } catch {
      /* ignore */
    }
  }, [libraryView, gridCols]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setFiltersOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filtersOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    const t = window.setTimeout(() => {
      filterPanelRef.current?.querySelector('select')?.focus?.();
    }, 50);
    return () => window.clearTimeout(t);
  }, [filtersOpen]);

  useEffect(() => {
    if (!user || !listPickerFor) return;
    let active = true;
    (async () => {
      setListsLoading(true);
      try {
        const res = await fetch('/api/reading-lists', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!active || !res.ok) return;
        setReadingLists(Array.isArray(data.lists) ? data.lists : []);
      } finally {
        if (active) setListsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, listPickerFor]);

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
    return resources.filter((item) => {
      const categoryMatch = filter === 'All' || item.category === filter;
      const savedMatch = !savedOnly || isItemSaved(item);
      return categoryMatch && savedMatch;
    });
  }, [filter, resources, savedOnly, isItemSaved]);

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

  const distinctDepartments = useMemo(() => {
    const s = new Set();
    for (const item of resources) {
      const d = String(item.department || '').trim();
      if (d) s.add(d);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [resources]);

  const distinctYears = useMemo(() => {
    const s = new Set();
    for (const item of resources) {
      const y = item.publishYear;
      if (y != null && Number.isFinite(Number(y))) s.add(Number(y));
    }
    return [...s].sort((a, b) => b - a);
  }, [resources]);

  const addBookToList = async (readingListId, bookId) => {
    try {
      const res = await fetch(`/api/reading-lists/${readingListId}/books`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Request failed');
      }
      setSaveToast('Added to your list.');
      setListPickerFor(null);
      window.setTimeout(() => setSaveToast(''), 2400);
    } catch {
      setSaveToast('Could not add to that list.');
      window.setTimeout(() => setSaveToast(''), 3200);
    }
  };

  const createListAndAdd = async (bookId) => {
    const name = window.prompt('Name for this reading list', 'My reading list');
    if (!name || !name.trim()) return;
    try {
      const res = await fetch('/api/reading-lists', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), bookIds: [bookId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Could not create list');
      }
      setSaveToast('List created and book added.');
      setListPickerFor(null);
      window.setTimeout(() => setSaveToast(''), 2400);
    } catch (e) {
      setSaveToast(e?.message || 'Could not create list.');
      window.setTimeout(() => setSaveToast(''), 4000);
    }
  };

  const savedCount = useMemo(
    () => resources.filter((item) => isItemSaved(item)).length,
    [resources, isItemSaved],
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filter !== 'All') n += 1;
    if (searchParams.get('dept')) n += 1;
    if (searchParams.get('year')) n += 1;
    if (searchParams.get('yearFrom') || searchParams.get('yearTo')) n += 1;
    if (searchParams.get('added')) n += 1;
    return n;
  }, [filter, searchParams]);

  const clearAllFilters = useCallback(() => {
    patchParams({
      topic: 'All',
      dept: null,
      year: null,
      yearFrom: null,
      yearTo: null,
      added: null,
    });
  }, [patchParams]);

  const resultsContainerClass = useMemo(() => {
    if (libraryView === 'list') return 'flex flex-col gap-5';
    if (gridCols === '2')
      return 'grid gap-5 grid-cols-1 sm:grid-cols-2';
    if (gridCols === '4')
      return 'grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    return 'grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  }, [libraryView, gridCols]);

  return (
    <div className="library-ambient library-vibrant relative page-surface min-h-[calc(100vh-5.5rem)] px-4 pb-12 pt-3 text-slate-900 md:px-6 md:pb-14 md:pt-5 dark:text-slate-100">
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
                to={`/login?next=${encodeURIComponent('/library')}`}
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

        {listId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200/80 bg-indigo-50/90 px-4 py-3 text-sm text-indigo-950 dark:border-indigo-500/35 dark:bg-indigo-950/40 dark:text-indigo-100">
            <span className="font-semibold">
              Reading list view — sharing URL keeps these filters.
            </span>
            <button
              type="button"
              className="rounded-xl bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500"
              onClick={() => patchParams({ list: null })}
            >
              Show all library titles
            </button>
          </div>
        ) : null}

        {saveToast ? (
          <div
            role="status"
            className="fade-in-up rounded-2xl border border-cyan-200/80 bg-gradient-to-r from-cyan-50 to-white px-4 py-3 text-sm font-medium text-cyan-950 shadow-md shadow-cyan-900/5 dark:border-cyan-800/50 dark:from-cyan-950/50 dark:to-slate-900/90 dark:text-cyan-100"
          >
            {saveToast}
          </div>
        ) : null}

        <div className="library-chromatic-ring shadow-xl shadow-fuchsia-900/10 dark:shadow-cyan-950/25">
          <div className="library-chromatic-ring__inner border border-white/75 bg-white/82 p-5 shadow-inner backdrop-blur-xl dark:border-slate-600/55 dark:bg-slate-900/78 md:p-6">
            <div className="flex flex-wrap gap-2 border-b border-slate-100/90 pb-5 dark:border-slate-700/80" role="toolbar" aria-label="Library scope">
              <button
                type="button"
                title="Show all books"
                aria-label="Show all books"
                aria-pressed={!savedOnly}
                onClick={() => patchParams({ saved: null })}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-3.5 text-xs font-bold transition sm:px-4 ${
                  !savedOnly
                    ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md dark:from-cyan-600 dark:to-fuchsia-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="max-sm:sr-only">All books</span>
              </button>
              <button
                type="button"
                title={`Saved only (${savedCount})`}
                aria-label={`Saved books only, ${savedCount} saved`}
                aria-pressed={savedOnly}
                onClick={() => patchParams({ saved: '1' })}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-3.5 text-xs font-bold transition sm:px-4 ${
                  savedOnly
                    ? 'bg-amber-100 text-amber-950 ring-2 ring-amber-400/30 dark:bg-amber-500/20 dark:text-amber-100'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <Bookmark
                  className={`h-3.5 w-3.5 shrink-0 ${savedOnly ? 'fill-current' : ''}`}
                  aria-hidden
                />
                <span className="tabular-nums max-sm:sr-only">{savedCount}</span>
              </button>
            </div>

            <div className="relative mt-5">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                autoComplete="off"
                className="input-field h-11 w-full border-slate-200/90 bg-white/90 pl-10 text-sm dark:border-slate-600 dark:bg-slate-950/80 dark:text-slate-100"
                placeholder="Search title, department, course…"
                value={queryInput}
                onChange={(e) => onQueryInputChange(e.target.value)}
                aria-label="Search library"
                title="Search title, department, course"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3 border-b border-slate-100/90 pb-4 dark:border-slate-700/80">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
                <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-fuchsia-600 opacity-80 dark:text-fuchsia-400" aria-hidden />
                <label htmlFor="library-sort" className="sr-only">
                  Sort list
                </label>
                <select
                  id="library-sort"
                  title="Sort list"
                  className="h-8 max-w-[11rem] cursor-pointer rounded-lg border border-slate-200/90 bg-white/90 py-1 pl-2 pr-7 text-[11px] font-bold text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  value={sortBy}
                  onChange={(e) => {
                    const v = e.target.value;
                    patchParams({ sort: v === 'recent' ? null : v });
                  }}
                >
                  <option value="recent">Newest first</option>
                  <option value="title">Title A–Z</option>
                  <option value="likes">Most liked</option>
                </select>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
                <span className="sr-only" id="library-layout-label">
                  Layout
                </span>
                <div
                  className="inline-flex rounded-xl bg-slate-100/95 p-0.5 ring-1 ring-slate-200/90 dark:bg-slate-800/95 dark:ring-slate-600/80"
                  role="group"
                  aria-labelledby="library-layout-label"
                >
                  <button
                    type="button"
                    title="List view"
                    aria-pressed={libraryView === 'list'}
                    onClick={() => setLibraryView('list')}
                    className={`inline-flex h-8 w-9 items-center justify-center rounded-lg transition ${
                      libraryView === 'list'
                        ? 'bg-white text-fuchsia-700 shadow-sm dark:bg-slate-950 dark:text-fuchsia-300'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    <List className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    title="Grid view"
                    aria-pressed={libraryView === 'grid'}
                    onClick={() => setLibraryView('grid')}
                    className={`inline-flex h-8 w-9 items-center justify-center rounded-lg transition ${
                      libraryView === 'grid'
                        ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-950 dark:text-cyan-300'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    <Grid3x3 className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                {libraryView === 'grid' ? (
                  <div
                    className="inline-flex rounded-xl bg-gradient-to-r from-fuchsia-500/12 via-white/40 to-cyan-500/12 p-0.5 ring-1 ring-cyan-500/25 dark:from-fuchsia-500/10 dark:via-slate-800/80 dark:to-cyan-500/10 dark:ring-cyan-400/30"
                    role="group"
                    aria-label="Columns per row"
                  >
                    {['2', '3', '4'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={gridCols === c}
                        onClick={() => setGridCols(c)}
                        className={`min-w-[2rem] rounded-lg px-2 py-1 text-[11px] font-black tabular-nums transition ${
                          gridCols === c
                            ? 'bg-slate-900 text-white shadow-md dark:bg-cyan-600'
                            : 'text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-slate-700/80'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                ) : null}

                <button
                  type="button"
                  aria-expanded={filtersOpen}
                  aria-controls="library-filter-dialog"
                  title="Open filters"
                  onClick={() => setFiltersOpen(true)}
                  className="relative inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-3.5 text-[11px] font-bold text-white shadow-md ring-1 ring-white/10 transition hover:brightness-110 dark:from-fuchsia-900 dark:via-slate-900 dark:to-cyan-900"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                  <span className="max-sm:sr-only">Filters</span>
                  {activeFilterCount > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 px-1 text-[10px] font-black tabular-nums text-amber-950 shadow-sm">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            {activeFilterCount > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {filter !== 'All' ? (
                  <button
                    type="button"
                    onClick={() => patchParams({ topic: 'All' })}
                    className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-100 to-cyan-100 px-3 py-1 text-xs font-semibold text-fuchsia-950 dark:from-fuchsia-950/50 dark:to-cyan-950/50 dark:text-fuchsia-100"
                    title="Remove material type filter"
                  >
                    {filter}
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                ) : null}
                {searchParams.get('dept') ? (
                  <button
                    type="button"
                    onClick={() => patchParams({ dept: null })}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    title="Remove department filter"
                  >
                    {searchParams.get('dept')}
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                ) : null}
                {searchParams.get('year') ? (
                  <button
                    type="button"
                    onClick={() => patchParams({ year: null })}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    title="Remove year filter"
                  >
                    Year {searchParams.get('year')}
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                ) : null}
                {searchParams.get('yearFrom') || searchParams.get('yearTo') ? (
                  <button
                    type="button"
                    onClick={() => patchParams({ yearFrom: null, yearTo: null })}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    title="Clear year range"
                  >
                    {searchParams.get('yearFrom') || '…'}–
                    {searchParams.get('yearTo') || '…'}
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                ) : null}
                {searchParams.get('added') ? (
                  <button
                    type="button"
                    onClick={() => patchParams({ added: null })}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    title="Remove recency filter"
                  >
                    Recent uploads
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-cyan-400/70 px-3 py-1 text-xs font-bold text-cyan-800 dark:border-cyan-500/50 dark:text-cyan-200"
                >
                  Clear all filters
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {filtersOpen ? (
          <div className="fixed inset-0 z-[100] flex items-end justify-center lg:items-center lg:p-6">
            <button
              type="button"
              className="library-filter-backdrop absolute inset-0 cursor-default border-0 bg-slate-950/55 backdrop-blur-[2px]"
              aria-label="Close filters"
              onClick={() => setFiltersOpen(false)}
            />
            <div
              ref={filterPanelRef}
              id="library-filter-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="library-filters-title"
              className="relative z-[101] flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/40 bg-white/97 shadow-2xl dark:border-slate-600 dark:bg-slate-900/97 lg:max-h-[min(85vh,640px)] lg:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200/90 px-4 py-3 dark:border-slate-700">
                <h2
                  id="library-filters-title"
                  className="bg-gradient-to-r from-fuchsia-600 to-cyan-600 bg-clip-text text-sm font-black uppercase tracking-wide text-transparent dark:from-fuchsia-300 dark:to-cyan-300"
                >
                  Refine results
                </h2>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  onClick={() => setFiltersOpen(false)}
                  aria-label="Close filter panel"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <div className="space-y-4 overflow-y-auto p-4">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Material type
                  </label>
                  <select
                    className="input-field h-10 w-full border-slate-200/90 bg-white/90 text-sm dark:border-slate-600 dark:bg-slate-950/80"
                    value={filter}
                    onChange={(e) => patchParams({ topic: e.target.value })}
                    aria-label="Filter by material type"
                    title="Material type"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category === 'All' ? 'All material types' : category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Department
                  </label>
                  <select
                    className="input-field h-10 w-full border-slate-200/90 bg-white/90 text-sm dark:border-slate-600 dark:bg-slate-950/80"
                    value={searchParams.get('dept') || ''}
                    onChange={(e) =>
                      patchParams({ dept: e.target.value || null })
                    }
                  >
                    <option value="">All departments</option>
                    {distinctDepartments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Publish year (exact)
                  </label>
                  <select
                    className="input-field h-10 w-full border-slate-200/90 bg-white/90 text-sm dark:border-slate-600 dark:bg-slate-950/80"
                    value={searchParams.get('year') || ''}
                    title="Exact year (clears year range)"
                    onChange={(e) => {
                      const v = e.target.value;
                      patchParams({
                        year: v || null,
                        yearFrom: null,
                        yearTo: null,
                      });
                    }}
                  >
                    <option value="">Any year</option>
                    {distinctYears.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Added to library
                  </label>
                  <select
                    className="input-field h-10 w-full border-slate-200/90 bg-white/90 text-sm dark:border-slate-600 dark:bg-slate-950/80"
                    value={searchParams.get('added') || ''}
                    onChange={(e) =>
                      patchParams({ added: e.target.value || null })
                    }
                  >
                    <option value="">Any time</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="term">Last ~4 months</option>
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Year from (range)
                    </label>
                    <select
                      className="input-field h-10 w-full border-slate-200/90 bg-white/90 text-sm dark:border-slate-600 dark:bg-slate-950/80"
                      title="Minimum publish year; clears exact year filter"
                      value={searchParams.get('yearFrom') || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        patchParams({ yearFrom: v || null, year: null });
                      }}
                    >
                      <option value="">Any</option>
                      {distinctYears.map((y) => (
                        <option key={`from-${y}`} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Year to (range)
                    </label>
                    <select
                      className="input-field h-10 w-full border-slate-200/90 bg-white/90 text-sm dark:border-slate-600 dark:bg-slate-950/80"
                      title="Maximum publish year; clears exact year filter"
                      value={searchParams.get('yearTo') || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        patchParams({ yearTo: v || null, year: null });
                      }}
                    >
                      <option value="">Any</option>
                      {distinctYears.map((y) => (
                        <option key={`to-${y}`} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-200/90 p-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    clearAllFilters();
                  }}
                  className="flex-1 rounded-xl border border-slate-200/90 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="flex-1 rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 py-2.5 text-xs font-bold text-white shadow-lg hover:brightness-110"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className={resultsContainerClass}>
          {loading ? (
            <div className="w-full rounded-3xl border border-dashed border-slate-300/80 bg-white/50 p-12 dark:border-slate-600 dark:bg-slate-900/40">
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
            <div className="w-full rounded-3xl border border-rose-200/90 bg-rose-50/95 p-8 text-center text-sm font-medium text-rose-900 shadow-inner dark:border-rose-500/30 dark:bg-rose-950/50 dark:text-rose-100">
              {error}
            </div>
          ) : sortedResources.length === 0 ? (
            <div className="w-full flex flex-col items-center justify-center rounded-3xl border border-slate-200/90 bg-white/70 px-8 py-16 text-center dark:border-slate-700 dark:bg-slate-900/50">
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

              if (libraryView === 'list') {
                return (
                  <LibraryBookListRow
                    key={item.id}
                    item={item}
                    index={index}
                    itemKey={key}
                    saved={saved}
                    busy={busy}
                    formatLabel={formatLabel}
                    topic={topic}
                    visLabel={visLabel}
                    visTone={visTone}
                    dateShort={dateShort}
                    user={user}
                    toggleSave={toggleSave}
                    setListPickerFor={setListPickerFor}
                    listPickerFor={listPickerFor}
                    readingLists={readingLists}
                    listsLoading={listsLoading}
                    addBookToList={addBookToList}
                    createListAndAdd={createListAndAdd}
                  />
                );
              }

              return (
                <LibraryBookGridCard
                  key={item.id}
                  item={item}
                  index={index}
                  itemKey={key}
                  saved={saved}
                  busy={busy}
                  formatLabel={formatLabel}
                  topic={topic}
                  visLabel={visLabel}
                  visTone={visTone}
                  dateShort={dateShort}
                  user={user}
                  toggleSave={toggleSave}
                  setListPickerFor={setListPickerFor}
                  listPickerFor={listPickerFor}
                  readingLists={readingLists}
                  listsLoading={listsLoading}
                  addBookToList={addBookToList}
                  createListAndAdd={createListAndAdd}
                  mobileDetailOpen={mobileDetailKey === key}
                  onToggleMobileDetail={() =>
                    setMobileDetailKey((k) => (k === key ? null : key))
                  }
                />
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

export default Library;
