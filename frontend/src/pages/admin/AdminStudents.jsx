import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { readJsonOrThrow } from '../../utils/http';

export default function AdminStudents() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (pageNum) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/users?accountType=student&page=${pageNum}&limit=20`,
        { credentials: 'include' },
      );
      const data = await readJsonOrThrow(res, 'Could not load students');
      setUsers(data.users ?? []);
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

  const toggleReadOnly = async (u) => {
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          platformReadOnly: !u.platformReadOnly,
        }),
      });
      await readJsonOrThrow(res, 'Update failed');
      toast.success(
        !u.platformReadOnly
          ? 'Student set to read-only'
          : 'Read-only cleared',
      );
      await load(page);
    } catch (e) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const setRole = async (u, accountType) => {
    if (u.accountType === accountType) return;
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accountType }),
      });
      await readJsonOrThrow(res, 'Update failed');
      toast.success(
        accountType === 'instructor'
          ? 'Promoted to instructor'
          : 'Set to student',
      );
      await load(page);
    } catch (e) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Students
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Read-only disables all writes (classrooms, library, profile, exams, AI,
          uploads). Promote trusted users to instructor when needed.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 dark:border-slate-600/80 dark:bg-slate-900/90">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Role</th>
                    <th className="px-4 py-2.5">Read-only</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="max-w-[200px] truncate px-4 py-2.5 font-medium">
                        {u.email}
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-2.5">
                        {u.displayName || u.name || u.username || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={u.accountType}
                          disabled={busyId === u.id}
                          onChange={(e) => setRole(u, e.target.value)}
                          className="input-field max-w-[140px] py-1.5 text-xs"
                        >
                          <option value="student">Student</option>
                          <option value="instructor">Instructor</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={u.platformReadOnly}
                            disabled={busyId === u.id}
                            onChange={() => toggleReadOnly(u)}
                            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          />
                          <span className="text-slate-600 dark:text-slate-300">
                            {u.platformReadOnly ? 'Locked' : 'Active'}
                          </span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {total} student account(s) · page {page}/{totalPages}
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
