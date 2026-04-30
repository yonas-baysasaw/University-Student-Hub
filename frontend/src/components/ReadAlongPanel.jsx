import { BookOpen, ChevronDown, ExternalLink, LibraryBig, Maximize2, PanelTop } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

/** Library book selector + inline reader (iframe) for Study buddy. */
function ReadAlongPanel({
  books,
  selectedBookId,
  onBookIdChange,
  selectedBook,
  showPageTitle = true,
  layoutVariant = 'default',
  focusRead: focusReadProp,
  onFocusReadChange,
}) {
  const isWorkspace = layoutVariant === 'workspace';
  const [focusReadInternal, setFocusReadInternal] = useState(false);
  const focusControlled = typeof focusReadProp === 'boolean';
  const focusRead = focusControlled ? focusReadProp : focusReadInternal;

  const setFocusRead = useCallback(
    (next) => {
      if (focusControlled) onFocusReadChange?.(next);
      else setFocusReadInternal(next);
    },
    [focusControlled, onFocusReadChange],
  );

  const toggleFocus = useCallback(() => {
    setFocusRead(!focusRead);
  }, [focusRead, setFocusRead]);

  const FocusReadIconButton = ({ className = '' }) =>
    focusRead ? (
      <button
        type="button"
        onClick={toggleFocus}
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100 ${className}`}
        title="Show book details"
      >
        <span className="sr-only">Show book details</span>
        <PanelTop className="h-3 w-3" strokeWidth={2} aria-hidden />
      </button>
    ) : (
      <button
        type="button"
        onClick={toggleFocus}
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100 ${className}`}
        title="Focus read"
      >
        <span className="sr-only">Focus read</span>
        <Maximize2 className="h-3 w-3" strokeWidth={2} aria-hidden />
      </button>
    );

  const pickerBlock = (
    <div
      className={
        showPageTitle && !focusRead
          ? 'border-b border-slate-100 pb-6 dark:border-slate-700'
          : 'border-b border-slate-100 pb-4 dark:border-slate-700'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        {!focusRead ? (
          <div className="min-w-0 flex-1">
            <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Books from Library
            </h4>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Choose a book to feed into Study buddy.
            </p>
          </div>
        ) : (
          <div className="min-w-[1px] flex-1" aria-hidden />
        )}
        {isWorkspace ? (
          <div className="shrink-0 self-start">
            <FocusReadIconButton />
          </div>
        ) : null}
      </div>
      <label htmlFor="read-along-book" className="sr-only">
        Select a book
      </label>
      <div className={focusRead ? 'relative' : 'relative mt-4'}>
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

      {!focusRead && selectedBook ? (
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
  );

  const focusReadTopChrome =
    focusRead && isWorkspace ? (
      <div className="mb-1 flex h-7 min-h-7 shrink-0 items-center gap-1 border-b border-slate-100 pb-1 dark:border-slate-700">
        <BookOpen className="h-2.5 w-2.5 shrink-0 text-slate-400" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium leading-none text-slate-600 dark:text-slate-300">
          {selectedBook?.title || 'Pick a book'}
        </span>
        <label htmlFor="read-along-book-micro" className="sr-only">
          Select a book
        </label>
        <select
          id="read-along-book-micro"
          className="max-w-[42%] shrink-0 cursor-pointer truncate rounded border border-transparent bg-transparent py-0 pl-0.5 text-[10px] font-medium text-slate-600 outline-none hover:border-slate-200 dark:text-slate-400 dark:hover:border-slate-600"
          value={selectedBookId}
          onChange={(event) => onBookIdChange(event.target.value)}
        >
          <option value="">No book</option>
          {books.map((book) => {
            const value = String(book.bookId || book.id);
            return (
              <option key={value} value={value}>
                {book.title}
              </option>
            );
          })}
        </select>
        <FocusReadIconButton className="-mr-0.5" />
      </div>
    ) : null;

  return (
    <div
      className={
        isWorkspace
          ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
          : 'flex min-h-0 flex-1 flex-col overflow-y-auto'
      }
    >
      {showPageTitle ? (
        <div className="mb-6 flex flex-wrap items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <LibraryBig className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Read alongside AI
              </h3>
              {isWorkspace ? <FocusReadIconButton /> : null}
            </div>
            {!focusRead ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Select a book and read while you chat.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {focusRead && isWorkspace ? focusReadTopChrome : null}
      {!focusRead || !isWorkspace ? pickerBlock : null}

      <div
        className={`flex min-h-0 flex-1 flex-col ${focusRead || !showPageTitle ? 'pt-2' : 'pt-6'} ${isWorkspace ? 'overflow-hidden' : ''}`}
      >
        {selectedBook?.bookUrl ? (
          <>
            {!focusRead || !isWorkspace ? (
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <a
                  href={selectedBook.bookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-700 transition hover:underline dark:text-cyan-400"
                >
                  Open book in new tab
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
                {isWorkspace ? (
                  <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                    Copy text in the viewer, then paste into the chat.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div
              className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-100/80 shadow-inner ring-1 ring-slate-200/50 dark:border-slate-600 dark:bg-slate-900/60 dark:ring-slate-600/50 ${
                !focusRead || !isWorkspace ? 'mt-3' : 'mt-0'
              }`}
            >
              {!(focusRead && isWorkspace) ? (
                <div className="flex h-9 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-gradient-to-r from-slate-100 to-slate-50 px-3 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900/90">
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
              ) : null}
              <iframe
                src={selectedBook.bookUrl}
                title={`${selectedBook.title} reader`}
                className={
                  isWorkspace
                    ? 'min-h-[12rem] w-full flex-1 border-0 bg-white dark:bg-slate-950 lg:min-h-0'
                    : 'h-[calc(24rem-2.25rem)] w-full min-h-[10rem] border-0 bg-white dark:bg-slate-950'
                }
              />
            </div>
          </>
        ) : (
          <div
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300/90 bg-gradient-to-b from-slate-50/80 to-white/50 px-4 text-center text-sm text-slate-500 dark:border-slate-600 dark:from-slate-900/40 dark:to-slate-900/20 dark:text-slate-400 ${
              isWorkspace ? 'min-h-[12rem] flex-1 py-12' : 'h-[24rem] min-h-[12rem]'
            }`}
          >
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
