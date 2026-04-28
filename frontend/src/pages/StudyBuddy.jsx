import { ArrowLeft, BookOpen, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import LiquAiChatPanel from '../components/LiquAiChatPanel';
import ReadAlongPanel from '../components/ReadAlongPanel';
import { HUB_QUICK_PROMPTS } from '../constants/supportPrompts';
import { fetchLibraryBooks } from '../utils/books';

const READ_ALONG_PIN_KEY = 'studyBuddy.readAlongPinned';

const starterPromptsWithBook = [
  'Summarize this chapter in simple terms.',
  'List the key definitions from this book.',
  'Give me 5 review questions from what I am reading.',
  'Explain this as if I am preparing for an exam.',
];

function readInitialPin() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(READ_ALONG_PIN_KEY) === '1';
  } catch {
    return false;
  }
}

function StudyBuddy() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [readAlongOpen, setReadAlongOpen] = useState(false);
  const [readAlongDrawerEntered, setReadAlongDrawerEntered] = useState(false);
  const [readAlongPinned, setReadAlongPinned] = useState(readInitialPin);

  useEffect(() => {
    let active = true;

    const loadBooks = async () => {
      try {
        setLoading(true);
        setError('');
        const loaded = await fetchLibraryBooks();
        if (!active) return;
        setBooks(loaded);

        const fromQuery = searchParams.get('bookId');
        if (fromQuery) {
          const matched = loaded.find(
            (book) => String(book.bookId || book.id) === String(fromQuery),
          );
          setSelectedBookId(
            matched ? String(matched.bookId || matched.id) : '',
          );
        } else {
          setSelectedBookId('');
        }
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
  }, [searchParams]);

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

  const onQuickPrompt = useCallback(
    (prompt) => {
      navigate('.', { state: { prefill: prompt }, replace: true });
    },
    [navigate],
  );

  const setPinned = useCallback((value) => {
    setReadAlongPinned(value);
    try {
      if (value) {
        window.localStorage.setItem(READ_ALONG_PIN_KEY, '1');
      } else {
        window.localStorage.removeItem(READ_ALONG_PIN_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useLayoutEffect(() => {
    if (!readAlongOpen || readAlongPinned) {
      setReadAlongDrawerEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setReadAlongDrawerEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [readAlongOpen, readAlongPinned]);

  const openReadAlong = useCallback(() => {
    if (readAlongPinned) return;
    setReadAlongDrawerEntered(false);
    setReadAlongOpen(true);
  }, [readAlongPinned]);

  const closeReadAlongOverlay = useCallback(() => {
    setReadAlongDrawerEntered(false);
    window.setTimeout(() => setReadAlongOpen(false), 300);
  }, []);

  const handlePin = useCallback(() => {
    setReadAlongDrawerEntered(false);
    window.setTimeout(() => {
      setReadAlongOpen(false);
      setPinned(true);
    }, 300);
  }, [setPinned]);

  const handleUnpin = useCallback(() => {
    setPinned(false);
  }, [setPinned]);

  const readAlongPanelProps = {
    books,
    selectedBookId,
    onBookIdChange: setSelectedBookId,
    selectedBook,
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-14 pt-6 text-slate-900 md:px-6 md:pt-8 dark:bg-slate-950 dark:text-slate-100">
      {readAlongOpen && !readAlongPinned ? (
        <div
          className={`fixed inset-0 z-[135] flex justify-end transition-opacity duration-300 motion-reduce:transition-none ${
            readAlongDrawerEntered
              ? 'bg-slate-900/40 dark:bg-slate-950/75'
              : 'bg-transparent'
          } backdrop-blur-[3px]`}
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close read along"
            onClick={closeReadAlongOverlay}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="read-along-dialog-title"
            className={`relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out dark:border-slate-700 dark:bg-slate-900 ${
              readAlongDrawerEntered
                ? 'translate-x-0'
                : 'translate-x-full motion-reduce:translate-x-0'
            }`}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-blue-600 dark:bg-slate-800 dark:text-blue-400">
                  <BookOpen className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                <h2
                  id="read-along-dialog-title"
                  className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100"
                >
                  Read alongside AI
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePin}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
                >
                  Pin to layout
                </button>
                <button
                  type="button"
                  onClick={closeReadAlongOverlay}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-4 dark:bg-slate-950">
              <ReadAlongPanel {...readAlongPanelProps} showPageTitle={false} />
            </div>
          </div>
        </div>
      ) : null}

      <section className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-700">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-blue-400 dark:ring-slate-700">
              <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900 md:text-2xl dark:text-slate-100">
                Study buddy
              </h1>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                Library context when a book is selected · Gemini
              </p>
            </div>
          </div>
          <Link
            to="/liqu-ai"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to Liqu AI
          </Link>
        </header>

        {loading ? (
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
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </div>
        ) : (
          <div
            className={
              readAlongPinned
                ? 'grid min-h-0 gap-6 lg:grid-cols-2 lg:gap-8'
                : 'grid min-h-0 grid-cols-1 gap-6'
            }
          >
            <article className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950 md:min-h-[30rem]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 md:px-5 dark:border-slate-700 dark:bg-slate-900">
                <div>
                  <h3 className="font-display text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    AI study chat
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    Answers use your book when indexed
                  </p>
                </div>
                {readAlongPinned ? (
                  <button
                    type="button"
                    onClick={handleUnpin}
                    className="shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Unpin read along
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openReadAlong}
                    className="shrink-0 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
                  >
                    Read along
                  </button>
                )}
              </div>
              <div className="min-h-0 flex-1 bg-slate-50 px-2 pb-3 pt-2 dark:bg-slate-950 md:px-3 md:pb-4">
                <LiquAiChatPanel
                  variant="gemini"
                  bookTitle={selectedBook?.title ?? ''}
                  bookId={selectedBookId || ''}
                  starterPrompts={starterPrompts}
                  onQuickPrompt={onQuickPrompt}
                  className="border-0 bg-transparent shadow-none"
                />
              </div>
            </article>

            {readAlongPinned ? (
              <article className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 md:min-h-[30rem] md:p-5">
                <ReadAlongPanel {...readAlongPanelProps} showPageTitle />
              </article>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

export default StudyBuddy;
