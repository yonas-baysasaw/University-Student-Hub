import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import LiquAiChatPanel from '../components/LiquAiChatPanel';
import ReadAlongPanel from '../components/ReadAlongPanel';
import { fetchLibraryBooks } from '../utils/books';

const READ_ALONG_PIN_KEY = 'studyBuddy.readAlongPinned';

const starterPrompts = [
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
        const matched = fromQuery
          ? loaded.find(
              (book) => String(book.bookId || book.id) === String(fromQuery),
            )
          : null;
        const initialBook = matched || loaded[0];
        if (initialBook) {
          setSelectedBookId(String(initialBook.bookId || initialBook.id));
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

  const openReadAlong = useCallback(() => {
    if (readAlongPinned) return;
    setReadAlongOpen(true);
  }, [readAlongPinned]);

  const closeReadAlongOverlay = useCallback(() => {
    setReadAlongOpen(false);
  }, []);

  const handlePin = useCallback(() => {
    setPinned(true);
    setReadAlongOpen(false);
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
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      {readAlongOpen && !readAlongPinned ? (
        <div
          className="fixed inset-0 z-[135] flex justify-end"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/40"
            aria-label="Close read along"
            onClick={closeReadAlongOverlay}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="read-along-dialog-title"
            className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <h2
                id="read-along-dialog-title"
                className="font-display text-lg text-slate-900"
              >
                Read alongside AI
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePin}
                  className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-50"
                >
                  Pin
                </button>
                <button
                  type="button"
                  onClick={closeReadAlongOverlay}
                  className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ReadAlongPanel {...readAlongPanelProps} showPageTitle={false} />
            </div>
          </div>
        </div>
      ) : null}

      <section className="mx-auto max-w-6xl space-y-5">
        <div className="panel-card rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Liqu AI
              </p>
              <h1 className="mt-2 font-display text-3xl text-slate-900 md:text-4xl">
                Study buddy
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Open a library book and read with AI support side-by-side.
              </p>
            </div>
            <Link to="/liqu-ai" className="btn-secondary px-4 py-2 text-sm">
              Back to Liqu AI
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="panel-card rounded-2xl p-6 text-sm text-slate-500">
            Loading library books...
          </div>
        ) : error ? (
          <div className="panel-card rounded-2xl p-6 text-sm text-rose-600">
            {error}
          </div>
        ) : (
          <div
            className={
              readAlongPinned
                ? 'grid min-h-0 gap-4 lg:grid-cols-2'
                : 'grid min-h-0 grid-cols-1 gap-4'
            }
          >
            <article className="panel-card flex min-h-[28rem] flex-col rounded-2xl p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-display text-xl text-slate-900">
                  AI study chat
                </h3>
                {readAlongPinned ? (
                  <button
                    type="button"
                    onClick={handleUnpin}
                    className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Unpin read along
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openReadAlong}
                    className="shrink-0 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800 hover:bg-cyan-100"
                  >
                    Read along
                  </button>
                )}
              </div>
              <div className="min-h-0 flex-1">
                <LiquAiChatPanel
                  key={selectedBookId ?? 'no-book'}
                  bookTitle={selectedBook?.title ?? ''}
                  starterPrompts={starterPrompts}
                  onQuickPrompt={onQuickPrompt}
                />
              </div>
            </article>

            {readAlongPinned ? (
              <article className="panel-card flex min-h-[28rem] flex-col rounded-2xl p-4">
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
