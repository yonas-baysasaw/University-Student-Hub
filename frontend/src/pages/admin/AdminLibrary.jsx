import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { readJsonOrThrow } from '../../utils/http';

function formatShortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminLibrary() {
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (pageNum) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/books?page=${pageNum}&limit=20`, {
        credentials: 'include',
      });
      const data = await readJsonOrThrow(res, 'Could not load books');
      setBooks(data.books ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? pageNum);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      toast.error(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  const removeBook = async (b) => {
    if (
      !window.confirm(
        `Delete “${b.title}”? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyId(b.id);
    try {
      const res = await fetch(`/api/admin/books/${b.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await readJsonOrThrow(res, 'Delete failed');
      toast.success('Book removed');
      await load(page);
    } catch (e) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Library moderation
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Sorted by dislikes first. Remove items that are inappropriate or
          heavily downvoted.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 dark:border-slate-600/80 dark:bg-slate-900/90">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Uploader</th>
                    <th className="px-4 py-3">Likes</th>
                    <th className="px-4 py-3">Dislikes</th>
                    <th className="px-4 py-3">Added</th>
                    <th className="px-4 py-3"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {books.map((b) => (
                    <tr key={b.id}>
                      <td className="max-w-[200px] px-4 py-3 font-medium">
                        <span className="line-clamp-2">{b.title}</span>
                        <span className="mt-0.5 block text-xs font-normal text-slate-500">
                          {b.visibility}
                        </span>
                      </td>
                      <td className="max-w-[180px] px-4 py-3 text-slate-600 dark:text-slate-300">
                        {b.uploader ? (
                          <>
                            <span className="block truncate">
                              {b.uploader.name || b.uploader.username}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {b.uploader.email}
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{b.likesCount}</td>
                      <td className="px-4 py-3 tabular-nums text-rose-700 dark:text-rose-300">
                        {b.dislikesCount}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {formatShortDate(b.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={busyId === b.id}
                          onClick={() => removeBook(b)}
                          className="rounded-lg bg-rose-600/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {total} book(s) · page {page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                onClick={() => load(page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                onClick={() => load(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
