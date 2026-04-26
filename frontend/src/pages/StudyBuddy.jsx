import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import LiquAiChatPanel from '../components/LiquAiChatPanel';
import { fetchLibraryBooks } from '../utils/books';

const starterPrompts = [
  'Summarize this chapter in simple terms.',
  'List the key definitions from this book.',
  'Give me 5 review questions from what I am reading.',
  'Explain this as if I am preparing for an exam.',
];

function StudyBuddy() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');

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
          ? loaded.find((book) => String(book.bookId || book.id) === String(fromQuery))
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
    () => books.find((book) => String(book.bookId || book.id) === String(selectedBookId)),
    [books, selectedBookId],
  );

  const applyQuickPrompt = (prompt) => {
    navigate('.', { state: { prefill: prompt }, replace: true });
  };

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <section className="mx-auto max-w-6xl space-y-5">
        <div className="panel-card rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Liqu AI</p>
              <h1 className="mt-2 font-display text-3xl text-slate-900 md:text-4xl">Study buddy</h1>
              <p className="mt-2 text-sm text-slate-600">Open a library book and read with AI support side-by-side.</p>
            </div>
            <Link to="/liqu-ai" className="btn-secondary px-4 py-2 text-sm">
              Back to Liqu AI
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="panel-card rounded-2xl p-6 text-sm text-slate-500">Loading library books...</div>
        ) : error ? (
          <div className="panel-card rounded-2xl p-6 text-sm text-rose-600">{error}</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <aside className="panel-card rounded-2xl p-4">
              <h2 className="font-display text-xl text-slate-900">Books from Library</h2>
              <p className="mt-1 text-xs text-slate-500">Choose a book to feed into Study buddy.</p>
              <select
                className="input-field mt-3 text-sm"
                value={selectedBookId}
                onChange={(event) => setSelectedBookId(event.target.value)}
              >
                {books.map((book) => {
                  const value = String(book.bookId || book.id);
                  return (
                    <option key={value} value={value}>
                      {book.title}
                    </option>
                  );
                })}
              </select>

              {selectedBook ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-800">{selectedBook.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedBook.description || 'No description for this book.'}
                  </p>
                  {selectedBook.bookId ? (
                    <Link
                      to={`/library/${selectedBook.bookId}`}
                      className="mt-2 inline-block text-xs font-semibold text-cyan-700 hover:underline"
                    >
                      Open detail page
                    </Link>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">Quick prompts</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => applyQuickPrompt(prompt)}
                      className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <div className="grid min-h-0 gap-4 xl:grid-cols-2">
              <article className="panel-card flex min-h-[28rem] flex-col rounded-2xl p-3">
                <h3 className="mb-2 font-display text-xl text-slate-900">AI study chat</h3>
                <div className="min-h-0 flex-1">
                  <LiquAiChatPanel
                    remountKey={selectedBookId}
                    bookTitle={selectedBook?.title ?? ''}
                  />
                </div>
              </article>

              <article className="panel-card rounded-2xl p-4">
                <h3 className="font-display text-xl text-slate-900">Read alongside AI</h3>
                {selectedBook?.bookUrl ? (
                  <>
                    <a
                      href={selectedBook.bookUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-cyan-700 hover:underline"
                    >
                      Open book in new tab
                    </a>
                    <iframe
                      src={selectedBook.bookUrl}
                      title={`${selectedBook.title} reader`}
                      className="mt-3 h-[24rem] w-full rounded-xl border border-slate-200 bg-white"
                    />
                  </>
                ) : (
                  <div className="mt-3 flex h-[24rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
                    This book has no attached file URL yet. Choose another book from Library.
                  </div>
                )}
              </article>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default StudyBuddy;
