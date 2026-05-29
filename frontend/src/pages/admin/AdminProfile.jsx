import { LogOut, ShieldCheck, ShieldOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { adminApi } from '../../services/adminApi';
import {
  AdminCard,
  AdminPageHeader,
  AdminSearch,
  EmptyState,
  SkeletonRows,
} from './adminShared';

export default function AdminProfile() {
  const { user, logout } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const params = useMemo(
    () => ({
      role: 'admin',
      page,
      limit: 20,
      ...(query ? { q: query } : {}),
    }),
    [page, query],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.users(params);
      setAdmins(data.users ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? page);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      toast.error(e?.message || 'Could not load administrators');
    } finally {
      setLoading(false);
    }
  }, [page, params]);

  useEffect(() => {
    load();
  }, [load]);

  const demoteAdmin = async (target) => {
    if (target.id === user?.id) {
      toast.error('You cannot remove your own admin access');
      return;
    }
    if (total <= 1) {
      toast.error('At least one administrator must remain');
      return;
    }
    if (
      !window.confirm(
        `Remove admin access for ${target.email}? They will become a normal user.`,
      )
    ) {
      return;
    }
    setBusyId(target.id);
    try {
      await adminApi.updateUser(target.id, { role: 'user' });
      toast.success('Admin access removed');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Could not remove admin access');
    } finally {
      setBusyId(null);
    }
  };

  const isSelf = (admin) => admin.id === user?.id;
  const isLastAdmin = total <= 1;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Admin profile"
        description="Review your session, manage assigned administrators, and control platform security."
      />

      <AdminCard className="p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {user?.displayName || user?.name || user?.username || 'Admin'}
              </p>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
                {user?.role || 'admin'} · protected administrator session
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </AdminCard>

      <div className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Administrator accounts
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            View all users with admin privileges and remove access when needed.
          </p>
        </div>

        <AdminCard className="p-4">
          <AdminSearch
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Search name, username, or email"
          />
        </AdminCard>

        <AdminCard className="overflow-hidden">
          {loading ? (
            <SkeletonRows rows={5} />
          ) : admins.length ? (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                    <th className="w-[30%] px-4 py-3">User</th>
                    <th className="w-[12%] px-4 py-3">Role</th>
                    <th className="w-[12%] px-4 py-3">Status</th>
                    <th className="w-[18%] px-4 py-3">Joined</th>
                    <th className="w-[28%] px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {admins.map((admin) => {
                    const demoteDisabled =
                      busyId === admin.id ||
                      isSelf(admin) ||
                      (isLastAdmin && admin.role === 'admin');
                    return (
                      <tr key={admin.id}>
                        <td className="px-4 py-3">
                          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                            {admin.displayName ||
                              admin.name ||
                              admin.username ||
                              'Unnamed user'}
                            {isSelf(admin) ? (
                              <span className="ml-2 text-xs font-normal text-cyan-600 dark:text-cyan-400">
                                (you)
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {admin.email}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200">
                            admin
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              admin.status === 'suspended'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                            }`}
                          >
                            {admin.status || 'active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {admin.createdAt
                            ? new Date(admin.createdAt).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            title={
                              isSelf(admin)
                                ? 'You cannot remove your own admin access'
                                : isLastAdmin
                                  ? 'At least one administrator must remain'
                                  : 'Remove admin access'
                            }
                            disabled={demoteDisabled}
                            onClick={() => demoteAdmin(admin)}
                            className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <ShieldOff className="h-4 w-4" />
                            Remove admin access
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No administrators found"
                description="Try changing your search, or promote a user from student management."
              />
            </div>
          )}
        </AdminCard>

        {!loading && admins.length ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {total} administrator(s) · page {page}/{totalPages}
            </span>
            <div className="flex gap-2">
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
        ) : null}
      </div>

      <AdminCard className="p-5">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
          Security
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Admin routes are protected by server-side administrator checks and every
          sensitive action is written to the SystemLog collection.
        </p>
      </AdminCard>
    </div>
  );
}
