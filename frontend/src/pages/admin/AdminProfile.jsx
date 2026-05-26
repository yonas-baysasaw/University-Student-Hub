import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AdminCard, AdminPageHeader } from './adminShared';

export default function AdminProfile() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Admin profile"
        description="Review your current admin session, role, and security controls."
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
