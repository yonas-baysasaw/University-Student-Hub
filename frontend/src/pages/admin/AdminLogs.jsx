import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi } from '../../services/adminApi';
import {
  AdminCard,
  AdminPageHeader,
  AdminSearch,
  EmptyState,
  SkeletonRows,
} from './adminShared';

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.logs({
        page,
        limit: 30,
        ...(query ? { q: query } : {}),
      });
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      toast.error(e?.message || 'Could not load logs');
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="System logs"
        description="Audit every sensitive admin action, actor, entity, timestamp, IP, and result."
      />
      <AdminCard className="p-4">
        <AdminSearch
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="Search actions, actor email, entity, or id"
        />
      </AdminCard>
      <AdminCard className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={8} />
        ) : logs.length ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map((log) => (
              <article key={log._id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {log.action}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {log.actorEmail || log.actor?.email || 'System'} ·{' '}
                      {log.entity || 'platform'}{' '}
                      {log.entityId ? `#${log.entityId}` : ''}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      log.status === 'failed'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                  <time>{new Date(log.createdAt).toLocaleString()}</time>
                  {log.ip ? <span>{log.ip}</span> : null}
                  {log.userAgent ? (
                    <span className="max-w-lg truncate">{log.userAgent}</span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No logs found"
              description="Try a different search term."
            />
          </div>
        )}
      </AdminCard>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={page <= 1}
          className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
