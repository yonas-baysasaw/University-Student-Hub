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
        <h3 className="font-display text-xl text-slate-900">
          Read alongside AI
        </h3>
      ) : null}

      <div
        className={
          showPageTitle
            ? 'mt-3 border-b border-slate-100 pb-4'
            : 'border-b border-slate-100 pb-4'
        }
      >
        <h4 className="font-display text-lg text-slate-900">
          Books from Library
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          Choose a book to feed into Study buddy.
        </p>
        <label htmlFor="read-along-book" className="sr-only">
          Select a book
        </label>
        <select
          id="read-along-book"
          className="input-field mt-3 w-full text-sm"
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

        {selectedBook ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-800">
              {selectedBook.title}
            </p>
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
      </div>

      <div className="min-h-0 flex-1 pt-4">
        {selectedBook?.bookUrl ? (
          <>
            <a
              href={selectedBook.bookUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs font-semibold text-cyan-700 hover:underline"
            >
              Open book in new tab
            </a>
            <iframe
              src={selectedBook.bookUrl}
              title={`${selectedBook.title} reader`}
              className="mt-3 h-[24rem] w-full min-h-[12rem] rounded-xl border border-slate-200 bg-white"
            />
          </>
        ) : (
          <div className="flex h-[24rem] min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
            This book has no attached file URL yet. Choose another book from
            Library.
          </div>
        )}
      </div>
    </div>
  );
}

export default ReadAlongPanel;
