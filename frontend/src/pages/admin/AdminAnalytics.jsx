import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi } from '../../services/adminApi';
import { AdminCard, AdminPageHeader, SkeletonRows } from './adminShared';

function BarList({ items, labelKey = '_id' }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item[labelKey] || 'Unknown'}>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>{item[labelKey] || 'Unknown'}</span>
            <span>{item.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-cyan-500"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminApi.analytics(days));
    } catch (e) {
      toast.error(e?.message || 'Could not load analytics');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Analytics"
        description="Track user growth, admin activity, department distribution, and account health."
        action={
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="input-field w-40 text-sm"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
          </select>
        }
      />
      {loading ? (
        <AdminCard>
          <SkeletonRows rows={6} />
        </AdminCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <AdminCard className="p-5">
            <h2 className="mb-4 font-display text-lg font-bold">User growth</h2>
            <BarList items={data.usersByDay || []} />
          </AdminCard>
          <AdminCard className="p-5">
            <h2 className="mb-4 font-display text-lg font-bold">
              Admin activity
            </h2>
            <BarList items={data.logsByDay || []} />
          </AdminCard>
          <AdminCard className="p-5">
            <h2 className="mb-4 font-display text-lg font-bold">
              Users by department
            </h2>
            <BarList items={data.usersByDepartment || []} />
          </AdminCard>
          <AdminCard className="p-5">
            <h2 className="mb-4 font-display text-lg font-bold">
              Users by status
            </h2>
            <BarList items={data.usersByStatus || []} />
          </AdminCard>
        </div>
      )}
    </div>
  );
}
