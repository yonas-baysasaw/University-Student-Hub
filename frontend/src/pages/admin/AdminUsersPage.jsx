import { CheckCircle2, Edit3, Trash2, UserX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { adminApi } from '../../services/adminApi';
import {
  AdminCard,
  AdminPageHeader,
  AdminSearch,
  EmptyState,
  SkeletonRows,
} from './adminShared';

const roleOptions = ['user', 'lecturer', 'admin'];

export default function AdminUsersPage({
  accountType = 'student',
  title = 'Students',
  description = 'Manage student access, profile metadata, roles, and account status.',
}) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);

  const params = useMemo(
    () => ({
      accountType,
      page,
      limit: 20,
      ...(query ? { q: query } : {}),
      ...(status ? { status } : {}),
    }),
    [accountType, page, query, status],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.users(params);
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? page);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      toast.error(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [page, params]);

  useEffect(() => {
    load();
  }, [load]);

  const updateUser = async (id, body, message) => {
    setBusyId(id);
    try {
      await adminApi.updateUser(id, body);
      toast.success(message);
      await load();
    } catch (e) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const suspendUser = async (user) => {
    if (!window.confirm(`Suspend ${user.email}?`)) return;
    setBusyId(user.id);
    try {
      await adminApi.suspendUsers({ ids: [user.id], reason: 'Admin action' });
      toast.success('Account suspended');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Suspend failed');
    } finally {
      setBusyId(null);
    }
  };

  const activateUser = async (user) => {
    setBusyId(user.id);
    try {
      await adminApi.activateUsers({ ids: [user.id] });
      toast.success('Account activated');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Activation failed');
    } finally {
      setBusyId(null);
    }
  };

  const deleteUser = async (user) => {
    if (
      !window.confirm(
        `Soft delete ${user.email}? This hides the account and locks writes.`,
      )
    )
      return;
    setBusyId(user.id);
    try {
      await adminApi.deleteUser(user.id);
      toast.success('Account soft deleted');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader title={title} description={description} />

      <AdminCard className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <AdminSearch
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Search name, username, or email"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="input-field text-sm"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </AdminCard>

      <AdminCard className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={7} />
        ) : users.length ? (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <th className="w-[22%] px-4 py-3">User</th>
                  <th className="w-[14%] px-4 py-3">Department</th>
                  <th className="w-[12%] px-4 py-3">Role</th>
                  <th className="w-[10%] px-4 py-3">Status</th>
                  <th className="w-[12%] px-4 py-3">Controls</th>
                  <th className="w-[30%] px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {u.displayName ||
                          u.name ||
                          u.username ||
                          'Unnamed user'}
                      </p>
                      <p className="max-w-[260px] truncate text-xs text-slate-500">
                        {u.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {u.department || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={busyId === u.id}
                        onChange={(e) =>
                          updateUser(
                            u.id,
                            { role: e.target.value },
                            'Role updated',
                          )
                        }
                        className="input-field max-w-[130px] py-1.5 text-xs"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          u.status === 'suspended'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={u.platformReadOnly}
                          disabled={busyId === u.id}
                          onChange={() =>
                            updateUser(
                              u.id,
                              { platformReadOnly: !u.platformReadOnly },
                              u.platformReadOnly
                                ? 'Write access restored'
                                : 'Read-only enabled',
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        Read-only
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          title="Edit user"
                          onClick={() => setEditing(u)}
                          className="btn-secondary grid h-9 w-9 place-items-center p-0"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        {u.status === 'suspended' ? (
                          <button
                            type="button"
                            title="Activate user"
                            disabled={busyId === u.id}
                            onClick={() => activateUser(u)}
                            className="btn-secondary grid h-9 w-9 place-items-center p-0"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Suspend user"
                            disabled={busyId === u.id}
                            onClick={() => suspendUser(u)}
                            className="btn-secondary grid h-9 w-9 place-items-center p-0"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Soft delete user"
                          disabled={busyId === u.id}
                          onClick={() => deleteUser(u)}
                          className="btn-secondary grid h-9 w-9 place-items-center p-0 text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No users found"
              description="Try changing the search or filters."
            />
          </div>
        )}
      </AdminCard>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {total} account(s) · page {page}/{totalPages}
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

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              updateUser(
                editing.id,
                {
                  displayName: form.get('displayName'),
                  department: form.get('department'),
                  schoolYear: form.get('schoolYear')
                    ? Number(form.get('schoolYear'))
                    : null,
                  accountType,
                },
                'Profile details updated',
              ).then(() => setEditing(null));
            }}
          >
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Edit user
            </h2>
            <div className="mt-4 grid gap-3">
              <input
                name="displayName"
                defaultValue={editing.displayName || editing.name}
                className="input-field"
                placeholder="Display name"
              />
              <input
                name="department"
                defaultValue={editing.department}
                className="input-field"
                placeholder="Department"
              />
              <input
                name="schoolYear"
                type="number"
                min="1"
                max="7"
                defaultValue={editing.schoolYear || ''}
                className="input-field"
                placeholder="School year"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary px-4 py-2 text-sm">
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
