import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '../../services/adminApi';
import {
  AdminCard,
  AdminPageHeader,
  EmptyState,
  AdminSearch,
  SkeletonRows,
} from './adminShared';

const STATUS_OPTS = [
  ['', 'All statuses'],
  ['pending', 'Pending'],
  ['reviewed', 'Reviewed'],
  ['resolved', 'Resolved'],
  ['rejected', 'Rejected'],
  ['open', 'Open (legacy)'],
  ['reviewing', 'Reviewing (legacy)'],
  ['dismissed', 'Dismissed (legacy)'],
];

const TYPE_OPTS = [
  ['', 'All types'],
  ['book', 'Book'],
  ['event', 'Event'],
  ['user', 'User'],
];

function statusBadge(status) {
  const s = String(status || '');
  const map = {
    pending: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    open: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    reviewed: 'bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
    reviewing:
      'bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
    resolved:
      'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
    rejected: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
    dismissed:
      'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  };
  const cls = map[s] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}
    >
      {s || '—'}
    </span>
  );
}

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [targetType, setTargetType] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.reports({
        page: String(page),
        limit: '25',
        ...(targetType ? { targetType } : {}),
        ...(status ? { status } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(from.trim() ? { from: from.trim() } : {}),
        ...(to.trim() ? { to: to.trim() } : {}),
      });
      setReports(Array.isArray(data.reports) ? data.reports : []);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      toast.error(e?.message || 'Could not load reports');
    } finally {
      setLoading(false);
    }
  }, [page, targetType, status, q, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const expanded = reports.find((r) => r.id === expandedId) || null;

  useEffect(() => {
    if (!expanded) {
      setNoteDraft('');
      return;
    }
    setNoteDraft(expanded.adminNote || '');
  }, [expanded]);

  const saveReportMeta = async (patch) => {
    if (!expanded) return;
    setBusyId(expanded.id);
    try {
      const { report } = await adminApi.patchReport(expanded.id, patch);
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, ...report } : r)),
      );
      toast.success('Report updated');
    } catch (e) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const deleteReportRow = async (id) => {
    if (!window.confirm('Delete this report permanently?')) return;
    setBusyId(id);
    try {
      await adminApi.deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast.success('Report removed');
    } catch (e) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const targetLink = (r) => {
    if (r.targetType === 'book') return `/library/${r.targetId}`;
    if (r.targetType === 'event') return `/events/${r.targetId}`;
    if (r.targetType === 'user') return `/users/${r.targetId}`;
    return null;
  };

  const summarizeTarget = (r) => {
    const ts = r.targetSummary;
    if (ts?.missing) return 'Content missing (deleted)';
    if (r.targetType === 'book') return ts?.title || r.targetId;
    if (r.targetType === 'event') return ts?.title || r.targetId;
    if (r.targetType === 'user')
      return ts?.name || ts?.username || r.targetId;
    return r.targetId;
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Moderation · Reports"
        description="Review community flags on books, events, and profiles. Take action or close reports when resolved."
        action={
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="btn-secondary inline-flex items-center gap-2 self-start px-4 py-2.5 text-sm disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              aria-hidden
            />
            Refresh
          </button>
        }
      />

      <AdminCard className="p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <AdminSearch
            value={q}
            onChange={setQ}
            placeholder="Search id, reason, note…"
          />
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
            Type
            <select
              value={targetType}
              onChange={(e) => {
                setPage(1);
                setTargetType(e.target.value);
              }}
              className="input-field mt-1 w-full text-sm"
            >
              {TYPE_OPTS.map(([val, label]) => (
                <option key={val || 'all'} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
            Status
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              className="input-field mt-1 w-full text-sm"
            >
              {STATUS_OPTS.map(([val, label]) => (
                <option key={val || 'all'} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
            From (ISO date)
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              className="input-field mt-1 w-full text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
            To (ISO date)
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              className="input-field mt-1 w-full text-sm"
            />
          </label>
        </div>
      </AdminCard>

      {loading && !reports.length ? (
        <AdminCard>
          <SkeletonRows rows={6} />
        </AdminCard>
      ) : !reports.length ? (
        <AdminCard>
          <EmptyState
            title="No reports match"
            description="Try loosening filters or check back later."
          />
        </AdminCard>
      ) : (
        <AdminCard className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Reporter</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const open = expandedId === r.id;
                const href = targetLink(r);
                return (
                  <Fragment key={r.id}>
                    <tr
                      key={r.id}
                      className={`border-b border-slate-100 dark:border-slate-800 ${
                        open ? 'bg-cyan-500/5 dark:bg-cyan-500/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold capitalize text-slate-800 dark:text-slate-100">
                        {r.targetType}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-700 dark:text-slate-200">
                        {summarizeTarget(r)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {r.reporter?.email || r.reporter?.username || '—'}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-slate-700 dark:text-slate-200">
                        {r.reasonLabel || r.reasonCode || r.reason || '—'}
                      </td>
                      <td className="px-4 py-3">{statusBadge(r.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId((id) => (id === r.id ? null : r.id))
                          }
                          className="text-xs font-bold text-cyan-700 hover:underline dark:text-cyan-400"
                        >
                          {open ? 'Close' : 'Manage'}
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr>
                        <td colSpan={7} className="bg-slate-50/95 px-4 py-5 dark:bg-slate-900/70">
                          <div className="mx-auto max-w-3xl space-y-4">
                            <div className="flex flex-wrap gap-2">
                              {href ? (
                                <Link
                                  to={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                >
                                  Open reported content
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                              ) : null}
                            </div>
                            {r.description ? (
                              <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                                <span className="font-bold text-slate-500 dark:text-slate-400">
                                  Reporter note:{' '}
                                </span>
                                {r.description}
                              </p>
                            ) : null}
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Admin note
                              <textarea
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                rows={3}
                                className="input-field mt-1 w-full text-sm"
                              />
                            </label>
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Status
                                <select
                                  value={r.status}
                                  onChange={(e) =>
                                    void saveReportMeta({
                                      status: e.target.value,
                                      adminNote: noteDraft,
                                    })
                                  }
                                  disabled={busyId === r.id}
                                  className="input-field ml-2 text-sm"
                                >
                                  {STATUS_OPTS.filter(([v]) => v).map(
                                    ([val, label]) => (
                                      <option key={val} value={val}>
                                        {label}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </label>
                              <button
                                type="button"
                                disabled={busyId === r.id}
                                onClick={() =>
                                  void saveReportMeta({ adminNote: noteDraft })
                                }
                                className="btn-secondary rounded-xl px-3 py-2 text-xs font-bold"
                              >
                                Save note
                              </button>
                              <button
                                type="button"
                                disabled={busyId === r.id}
                                onClick={() => void deleteReportRow(r.id)}
                                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-900 dark:text-rose-300"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete report
                              </button>
                            </div>

                            {r.targetType === 'book' ? (
                              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-600">
                                <button
                                  type="button"
                                  className="btn-secondary rounded-xl px-3 py-2 text-xs font-bold"
                                  disabled={busyId === r.id}
                                  onClick={async () => {
                                    if (
                                      !window.confirm(
                                        'Hide this book from browse (unlisted)?',
                                      )
                                    )
                                      return;
                                    setBusyId(r.id);
                                    try {
                                      await adminApi.patchBookVisibility(
                                        r.targetId,
                                        'unlisted',
                                      );
                                      toast.success('Book hidden (unlisted)');
                                    } catch (e) {
                                      toast.error(
                                        e?.message || 'Could not hide book',
                                      );
                                    } finally {
                                      setBusyId(null);
                                    }
                                  }}
                                >
                                  Hide book
                                </button>
                                <button
                                  type="button"
                                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
                                  disabled={busyId === r.id}
                                  onClick={async () => {
                                    if (
                                      !window.confirm(
                                        'Permanently delete this book?',
                                      )
                                    )
                                      return;
                                    setBusyId(r.id);
                                    try {
                                      await adminApi.deleteAdminBook(
                                        r.targetId,
                                      );
                                      toast.success('Book deleted');
                                    } catch (e) {
                                      toast.error(
                                        e?.message || 'Could not delete',
                                      );
                                    } finally {
                                      setBusyId(null);
                                    }
                                  }}
                                >
                                  Remove book
                                </button>
                              </div>
                            ) : null}

                            {r.targetType === 'event' ? (
                              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-600">
                                <button
                                  type="button"
                                  className="btn-secondary rounded-xl px-3 py-2 text-xs font-bold"
                                  disabled={busyId === r.id}
                                  onClick={async () => {
                                    if (
                                      !window.confirm(
                                        'Hide this event (unlisted)?',
                                      )
                                    )
                                      return;
                                    setBusyId(r.id);
                                    try {
                                      await adminApi.patchEventVisibility(
                                        r.targetId,
                                        'unlisted',
                                      );
                                      toast.success('Event hidden');
                                    } catch (e) {
                                      toast.error(
                                        e?.message || 'Could not hide event',
                                      );
                                    } finally {
                                      setBusyId(null);
                                    }
                                  }}
                                >
                                  Hide event
                                </button>
                                <button
                                  type="button"
                                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
                                  disabled={busyId === r.id}
                                  onClick={async () => {
                                    if (
                                      !window.confirm(
                                        'Permanently delete this event?',
                                      )
                                    )
                                      return;
                                    setBusyId(r.id);
                                    try {
                                      await adminApi.deleteAdminEvent(
                                        r.targetId,
                                      );
                                      toast.success('Event deleted');
                                    } catch (e) {
                                      toast.error(
                                        e?.message || 'Could not delete',
                                      );
                                    } finally {
                                      setBusyId(null);
                                    }
                                  }}
                                >
                                  Delete event
                                </button>
                              </div>
                            ) : null}

                            {r.targetType === 'user' ? (
                              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-600">
                                <button
                                  type="button"
                                  className="btn-secondary rounded-xl px-3 py-2 text-xs font-bold"
                                  disabled={busyId === r.id}
                                  onClick={async () => {
                                    const reason = window.prompt(
                                      'Suspension reason (optional)',
                                      'Moderation — reported profile',
                                    );
                                    if (reason === null) return;
                                    setBusyId(r.id);
                                    try {
                                      await adminApi.suspendUsers({
                                        ids: [r.targetId],
                                        reason:
                                          reason ||
                                          'Moderation — reported profile',
                                      });
                                      toast.success('User suspended');
                                    } catch (e) {
                                      toast.error(
                                        e?.message || 'Could not suspend',
                                      );
                                    } finally {
                                      setBusyId(null);
                                    }
                                  }}
                                >
                                  Suspend account
                                </button>
                                <button
                                  type="button"
                                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
                                  disabled={busyId === r.id}
                                  onClick={async () => {
                                    if (
                                      !window.confirm(
                                        'Soft-delete this user account? They will lose access.',
                                      )
                                    )
                                      return;
                                    setBusyId(r.id);
                                    try {
                                      await adminApi.deleteUser(r.targetId);
                                      toast.success('User removed');
                                    } catch (e) {
                                      toast.error(
                                        e?.message || 'Could not remove user',
                                      );
                                    } finally {
                                      setBusyId(null);
                                    }
                                  }}
                                >
                                  Ban / delete user
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Page {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() =>
                  setPage((p) => Math.min(totalPages, p + 1))
                }
                className="btn-secondary rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </AdminCard>
      )}
    </div>
  );
}
