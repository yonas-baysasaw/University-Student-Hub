import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { readJsonOrThrow } from '../../utils/http';

export default function AdminWelcome() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      const data = await readJsonOrThrow(res, 'Could not load stats');
      setStats(data);
    } catch (e) {
      toast.error(e?.message || 'Could not load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tiles = stats
    ? [
        { label: 'Users', value: stats.users },
        { label: 'Books', value: stats.books },
        { label: 'Classrooms', value: stats.chats },
        { label: 'Messages', value: stats.messages },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to dashboard
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
            Welcome, admin
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Use the sidebar to moderate instructors, students, or library items.
            Suspended accounts cannot change data on the platform (read-only).
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={load}
          className="btn-secondary inline-flex items-center gap-2 self-start px-4 py-2.5 text-sm disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </button>
      </div>

      {loading && !stats ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-5 py-10 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900/40">
          Loading overview…
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-sm ring-1 ring-slate-200/80 dark:border-slate-600/80 dark:bg-slate-900/90 dark:ring-slate-600"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                {tile.label}
              </p>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                {tile.value?.toLocaleString?.() ?? tile.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
