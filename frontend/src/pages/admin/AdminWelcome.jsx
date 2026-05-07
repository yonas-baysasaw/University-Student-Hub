import {
  BookOpen,
  Building2,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi } from '../../services/adminApi';
import {
  AdminCard,
  AdminPageHeader,
  EmptyState,
  SkeletonRows,
} from './adminShared';

const icons = {
  users: Users,
  activeStudents: ShieldCheck,
  instructors: Users,
  departments: Building2,
  books: BookOpen,
  messages: MessageSquare,
};

export default function AdminWelcome() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await adminApi.stats());
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
        ['users', 'Total users', stats.users],
        ['activeStudents', 'Students', stats.activeStudents],
        ['instructors', 'Instructors', stats.instructors],
        ['departments', 'Departments', stats.departments],
        ['books', 'Library items', stats.books],
        ['messages', 'Messages', stats.messages],
      ]
    : [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin dashboard"
        description="A command center for students, departments, moderation, announcements, settings, and audit visibility."
        action={
          <button
            type="button"
            disabled={loading}
            onClick={load}
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

      {loading && !stats ? (
        <AdminCard>
          <SkeletonRows rows={4} />
        </AdminCard>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tiles.map(([key, label, value]) => {
              const Icon = icons[key];
              return (
                <AdminCard key={key} className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        {label}
                      </p>
                      <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                        {value?.toLocaleString?.() ?? value}
                      </p>
                    </div>
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                  </div>
                </AdminCard>
              );
            })}
          </div>

          <AdminCard className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Recent system activity
              </h2>
            </div>
            {stats?.recentLogs?.length ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.recentLogs.map((log) => (
                  <div
                    key={log._id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {log.action}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {log.actorEmail || log.actor?.email || 'System'} ·{' '}
                        {log.entity || 'platform'}
                      </p>
                    </div>
                    <time className="text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5">
                <EmptyState
                  title="No activity yet"
                  description="Admin actions will appear here as audit logs."
                />
              </div>
            )}
          </AdminCard>
        </>
      )}
    </div>
  );
}
