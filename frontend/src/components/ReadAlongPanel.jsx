import { ChevronDown, ExternalLink, LibraryBig } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Library book selector + inline reader (iframe) for Study buddy. */
function ReadAlongPanel({
  books,
  selectedBookId,
  onBookIdChange,
  selectedBook,
  showPageTitle = true,
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {showPageTitle ? (
        <div className="mb-6 flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <LibraryBig className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h3 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Read alongside AI
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Select a book and read while you chat.
            </p>
          </div>
        </div>
      ) : null}

      <div
        className={
          showPageTitle
            ? 'border-b border-slate-100 pb-6 dark:border-slate-700'
            : 'border-b border-slate-100 pb-5 dark:border-slate-700'
        }
      >
        <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Books from Library
        </h4>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Choose a book to feed into Study buddy.
        </p>
        <label htmlFor="read-along-book" className="sr-only">
          Select a book
        </label>
        <div className="relative mt-4">
          <select
            id="read-along-book"
            className="input-field w-full appearance-none rounded-xl border-slate-200/90 py-2.5 pl-3 pr-10 text-sm font-medium dark:border-slate-600 dark:bg-slate-900/50"
            value={selectedBookId}
            onChange={(event) => onBookIdChange(event.target.value)}
          >
            <option value="">No book (general chat)</option>
            {books.map((book) => {
              const value = String(book.bookId || book.id);
              return (
                <option key={value} value={value}>
                  {book.title}
                </option>
              );
            })}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
        </div>

        {selectedBook ? (
          <div className="mt-4 rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-800/40">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {selectedBook.title}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {selectedBook.description || 'No description for this book.'}
            </p>
            {selectedBook.bookId ? (
              <Link
                to={`/library/${selectedBook.bookId}`}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 transition hover:text-cyan-900 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                Open detail page
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 pt-6">
        {selectedBook?.bookUrl ? (
          <>
            <a
              href={selectedBook.bookUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 transition hover:underline dark:text-cyan-400"
            >
              Open book in new tab
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100/80 shadow-inner ring-1 ring-slate-200/50 dark:border-slate-600 dark:bg-slate-900/60 dark:ring-slate-600/50">
              <div className="flex h-9 items-center gap-2 border-b border-slate-200/80 bg-gradient-to-r from-slate-100 to-slate-50 px-3 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900/90">

                <span
                  className="h-2.5 w-2.5 rounded-full bg-rose-400/90"
                  aria-hidden
                />
                <span
                  className="h-2.5 w-2.5 rounded-full bg-amber-400/90"
                  aria-hidden
                />
                <span
                  className="h-2.5 w-2.5 rounded-full bg-emerald-400/90"
                  aria-hidden
                />
                <span className="ml-2 truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Reader — {selectedBook.title}
                </span>
              </div>
              <iframe
                src={selectedBook.bookUrl}
                title={`${selectedBook.title} reader`}
                className="h-[calc(24rem-2.25rem)] w-full min-h-[10rem] border-0 bg-white dark:bg-slate-950"
              />
            </div>
          </>
        ) : (
          <div className="flex h-[24rem] min-h-[12rem] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300/90 bg-gradient-to-b from-slate-50/80 to-white/50 px-4 text-center text-sm text-slate-500 dark:border-slate-600 dark:from-slate-900/40 dark:to-slate-900/20 dark:text-slate-400">
            <LibraryBig
              className="h-8 w-8 opacity-40"
              strokeWidth={1.25}
              aria-hidden
            />
            <p>
              This book has no attached file URL yet. Choose another book from
              Library.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReadAlongPanel;
