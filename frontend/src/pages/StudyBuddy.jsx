import { ArrowLeft, BookOpen, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import LiquAiChatPanel from '../components/LiquAiChatPanel';
import ReadAlongPanel from '../components/ReadAlongPanel';
import { HUB_QUICK_PROMPTS } from '../constants/supportPrompts';
import { fetchLibraryBooks } from '../utils/books';

const SPLIT_LEFT_PCT_KEY = 'studyBuddy.splitLeftPct';
const DEFAULT_SPLIT_PCT = 52;
const SPLIT_MIN = 22;
const SPLIT_MAX = 72;
/** When reader focus-read is on, default left (Liqu AI) column width (%). Kept above 50% so chat stays wider than the reader until the user drags the splitter. */
const FOCUS_READ_AI_PCT = 56;

const starterPromptsWithBook = [
  'Summarize this chapter simply.',
  'Key definitions from this book.',
  '5 review questions from what I am reading.',
  'Exam-ready explanation for this topic.',
];

function readSplitPct() {
  if (typeof window === 'undefined') return DEFAULT_SPLIT_PCT;
  try {
    const raw = window.localStorage.getItem(SPLIT_LEFT_PCT_KEY);
    const n = raw == null ? NaN : Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_SPLIT_PCT;
    return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));
  } catch {
    return DEFAULT_SPLIT_PCT;
  }
}

function useIsLg() {
  const [lg, setLg] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setLg(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return lg;
}

function StudyBuddy() {
  const [searchParams] = useSearchParams();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [splitLeftPct, setSplitLeftPct] = useState(readSplitPct);
  const [mobileMaterialOpen, setMobileMaterialOpen] = useState(false);
  const [readerFocusRead, setReaderFocusRead] = useState(false);
  const splitBeforeFocusRef = useRef(null);
  const readerFocusReadRef = useRef(false);
  const splitDragRef = useRef({
    active: false,
    startX: 0,
    startPct: DEFAULT_SPLIT_PCT,
  });
  const splitContainerRef = useRef(null);
  const splitHandleRef = useRef(null);
  const isLg = useIsLg();

  const bookIdFromUrl = searchParams.get('bookId') ?? '';

  useEffect(() => {
    readerFocusReadRef.current = readerFocusRead;
  }, [readerFocusRead]);

  /** Load catalog once; ?session= and other params must not trigger a refetch / full-page skeleton. */
  useEffect(() => {
    let active = true;

    const loadBooks = async () => {
      try {
        setLoading(true);
        setError('');
        const loaded = await fetchLibraryBooks();
        if (!active) return;
        setBooks(loaded);
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.message || 'Unable to load books from library.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadBooks();
    return () => {
      active = false;
    };
  }, []);

  /** Sync selection from URL only when ?bookId is present — never wipe dropdown when param is absent. */
  useEffect(() => {
    if (!bookIdFromUrl || books.length === 0) return;
    const matched = books.find(
      (book) => String(book.bookId || book.id) === String(bookIdFromUrl),
    );
    setSelectedBookId(
      matched ? String(matched.bookId || matched.id) : '',
    );
  }, [bookIdFromUrl, books]);

  const selectedBook = useMemo(
    () =>
      books.find(
        (book) => String(book.bookId || book.id) === String(selectedBookId),
      ),
    [books, selectedBookId],
  );

  const starterPrompts = useMemo(
    () => (selectedBookId ? starterPromptsWithBook : HUB_QUICK_PROMPTS),
    [selectedBookId],
  );

  const persistSplit = useCallback((pct) => {
    try {
      window.localStorage.setItem(SPLIT_LEFT_PCT_KEY, String(Math.round(pct)));
    } catch {
      /* ignore */
    }
  }, []);

  const handleReaderFocusReadChange = useCallback(
    (next) => {
      setReaderFocusRead(next);
      if (!isLg) return;
      if (next) {
        splitBeforeFocusRef.current = splitLeftPct;
        setSplitLeftPct(FOCUS_READ_AI_PCT);
      } else {
        const prev = splitBeforeFocusRef.current;
        splitBeforeFocusRef.current = null;
        if (prev != null) {
          setSplitLeftPct(
            Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, prev)),
          );
          persistSplit(
            Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, prev)),
          );
        }
      }
    },
    [isLg, persistSplit, splitLeftPct],
  );

  const onSplitPointerDown = useCallback(
    (e) => {
      e.preventDefault();
      const container = splitContainerRef.current;
      const handle = splitHandleRef.current;
      if (!container || !handle) return;
      splitDragRef.current = {
        active: true,
        startX: e.clientX,
        startPct: splitLeftPct,
      };
      handle.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        if (!splitDragRef.current.active) return;
        const rect = container.getBoundingClientRect();
        const dx = ev.clientX - splitDragRef.current.startX;
        const dPct = (dx / rect.width) * 100;
        const next = Math.min(
          SPLIT_MAX,
          Math.max(SPLIT_MIN, splitDragRef.current.startPct + dPct),
        );
        setSplitLeftPct(next);
      };

      const onUp = (ev) => {
        splitDragRef.current.active = false;
        try {
          handle.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        setSplitLeftPct((cur) => {
          if (!readerFocusReadRef.current) persistSplit(cur);
          return cur;
        });
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [persistSplit, splitLeftPct],
  );

  const readAlongPanelProps = {
    books,
    selectedBookId,
    onBookIdChange: setSelectedBookId,
    selectedBook,
    layoutVariant: 'workspace',
    focusRead: readerFocusRead,
    onFocusReadChange: handleReaderFocusReadChange,
  };

  const contextPillLabel = selectedBook?.title
    ? selectedBook.title.length > 42
      ? `${selectedBook.title.slice(0, 40)}…`
      : selectedBook.title
    : 'General chat';

  return (
    <div
      className={`liqu-ai-ambient page-surface relative z-10 flex h-[calc(100dvh-5.5rem)] max-h-[calc(100dvh-5.5rem)] min-h-0 flex-col overflow-hidden text-slate-900 dark:text-slate-100 ${
        readerFocusRead && isLg
          ? 'px-2 pb-4 pt-2 md:px-3 md:pt-3'
          : 'px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 md:px-6 md:pb-8 md:pt-8 lg:px-6 lg:pb-8 lg:pt-8'
      }`}
    >
      <section
        className={`mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col overflow-hidden ${
          readerFocusRead && isLg ? 'space-y-2' : 'space-y-4'
        }`}
      >
        <header
          className={`flex shrink-0 flex-wrap items-center justify-between gap-3 ${
            readerFocusRead && isLg
              ? 'border-0 pb-0'
              : 'gap-4 border-b border-slate-200/90 pb-4 dark:border-slate-700/90'
          }`}
        >
          {readerFocusRead && isLg ? (
            <div className="flex w-full min-w-0 items-center justify-between gap-2">
              <Link
                to="/liqu-ai"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-3 w-3 shrink-0" aria-hidden />
                Liqu AI
              </Link>
              <span className="min-w-0 truncate text-center text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {contextPillLabel}
              </span>
            </div>
          ) : (
            <>
              <div className="flex w-full flex-wrap items-end justify-between gap-3 lg:contents">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-blue-400 dark:ring-slate-700">
                  <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900 md:text-2xl dark:text-slate-100">
                    Study buddy
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
                      <BookOpen
                        className="h-3 w-3 shrink-0 opacity-70"
                        aria-hidden
                      />
                      <span className="truncate">{contextPillLabel}</span>
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Gemini · Liqu AI
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto sm:justify-normal">
              <button
                type="button"
                onClick={() => setMobileMaterialOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
              >
                <BookOpen className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                Material
              </button>
              <Link
                to="/liqu-ai"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                Back to Liqu AI
              </Link>
              </div>
              </div>
            </>
          )}
        </header>

        {loading ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="relative flex flex-col items-center gap-4">
              <div className="flex w-full max-w-md flex-col gap-3 animate-pulse">
                <div className="h-3 w-36 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="h-52 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              </div>
              <span className="sr-only">Loading library books</span>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Loading library books…
              </p>
            </div>
            </div>
          </div>
        ) : error ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200">
              {error}
            </div>
          </div>
        ) : (
          <div
            ref={splitContainerRef}
            className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden lg:flex-row lg:items-stretch"
          >
            <article
              className="flex min-h-0 w-full shrink-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none lg:min-w-0 lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:shadow-sm dark:bg-transparent dark:lg:border-slate-700 dark:lg:bg-slate-950"
              style={
                isLg
                  ? { flex: `0 0 ${splitLeftPct}%`, maxWidth: '100%', minWidth: 0 }
                  : undefined
              }
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-0 dark:bg-slate-950 lg:px-3 lg:pb-4 lg:pt-2">
                <LiquAiChatPanel
                  variant="gemini"
                  bookTitle={selectedBook?.title ?? ''}
                  bookId={selectedBookId || ''}
                  starterPrompts={starterPrompts}
                  workspacePresentation="studyBuddy"
                  sessionSidebarMode="rail"
                  denseStudyChrome={readerFocusRead}
                  className="h-full min-h-0 border-0 bg-transparent shadow-none"
                />
              </div>
            </article>

            <div
              ref={splitHandleRef}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panes"
              tabIndex={0}
              onKeyDown={(e) => {
                const step = 2;
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setSplitLeftPct((p) => {
                    const n = Math.max(SPLIT_MIN, p - step);
                    if (!readerFocusReadRef.current) persistSplit(n);
                    return n;
                  });
                }
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  setSplitLeftPct((p) => {
                    const n = Math.min(SPLIT_MAX, p + step);
                    if (!readerFocusReadRef.current) persistSplit(n);
                    return n;
                  });
                }
              }}
              onPointerDown={onSplitPointerDown}
              className="group relative z-[1] mx-0 hidden w-3 shrink-0 cursor-col-resize items-stretch justify-center lg:flex"
            >
              <span className="my-3 w-px flex-1 bg-slate-200 transition group-hover:bg-blue-400/80 dark:bg-slate-600 dark:group-hover:bg-blue-500/80" />
            </div>

            <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex lg:mt-0">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex min-h-0 flex-1 flex-col p-5">
                  <ReadAlongPanel
                    {...readAlongPanelProps}
                    showPageTitle={false}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        {!isLg && mobileMaterialOpen && !loading && !error ? (
          <div
            className="fixed inset-0 z-[200] flex flex-col bg-black/35 backdrop-blur-[3px]"
            role="dialog"
            aria-modal="true"
            aria-label="Study material"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/15 bg-slate-950/55 px-4 py-3 backdrop-blur-md">
              <span className="font-display text-sm font-semibold text-white">
                Study material
              </span>
              <button
                type="button"
                onClick={() => setMobileMaterialOpen(false)}
                className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Close study material"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-950/75 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
              <ReadAlongPanel
                {...readAlongPanelProps}
                showPageTitle={false}
              />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default StudyBuddy;
