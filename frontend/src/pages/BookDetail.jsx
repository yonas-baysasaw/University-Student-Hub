import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

function BookDetail() {
  const { bookId } = useParams();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadBook = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(`/api/books/${bookId}`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.message || 'Failed to load book details');
        }

        if (!active) return;
        setBook(data?.data || null);
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Could not load this book');
      } finally {
        if (active) setLoading(false);
      }
    };

    if (!bookId) {
      setError('Missing book id');
      setLoading(false);
      return;
    }

    loadBook();
    return () => {
      active = false;
    };
  }, [bookId]);

  const formatDate = value => {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleString();
  };

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <section className="mx-auto max-w-4xl space-y-4">
        <Link to="/library" className="inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
          Back to library
        </Link>

        <div className="panel-card rounded-3xl p-6 md:p-8">
          {loading ? (
            <p className="text-sm text-slate-500">Loading book details...</p>
          ) : error ? (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          ) : !book ? (
            <p className="text-sm text-slate-500">Book not found.</p>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Book detail</p>
              <h1 className="mt-2 font-display text-3xl text-slate-900 md:text-4xl">{book.title || 'Untitled'}</h1>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>
                  Format: <span className="font-semibold text-slate-800">{book.format || 'Unknown format'}</span>
                </p>
                <p>
                  Visibility: <span className="font-semibold text-slate-800">{book.visibility || 'public'}</span>
                </p>
                <p>
                  Uploaded: <span className="font-semibold text-slate-800">{formatDate(book.createdAt)}</span>
                </p>
              </div>
              <p className="mt-4 text-sm text-slate-700">{book.description || 'No description available.'}</p>

              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {book.thumbnailUrl ? (
                  <img src={book.thumbnailUrl} alt={`${book.title || 'Book'} cover`} className="h-72 w-full object-cover" />
                ) : (
                  <div className="flex h-72 w-full items-center justify-center text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    No cover available
                  </div>
                )}
              </div>

              {book.bookUrl ? (
                <a
                  href={book.bookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-block rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
                >
                  Open file
                </a>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default BookDetail;
