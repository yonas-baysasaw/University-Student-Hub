import { Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi } from '../../services/adminApi';
import {
  AdminCard,
  AdminPageHeader,
  EmptyState,
  SkeletonRows,
} from './adminShared';

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    audience: 'all',
    department: '',
    channel: 'email',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.notifications();
      setNotifications(data.notifications || []);
    } catch (e) {
      toast.error(e?.message || 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!window.confirm('Send this announcement to the selected audience?'))
      return;
    setSending(true);
    try {
      const data = await adminApi.sendAnnouncement(form);
      toast.success(
        `Announcement queued for ${data.notification.recipientCount} recipient(s)`,
      );
      setForm({
        title: '',
        message: '',
        audience: 'all',
        department: '',
        channel: 'email',
      });
      await load();
    } catch (e) {
      toast.error(e?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Notifications"
        description="Send admin announcements by email or prepare in-app notification records for university audiences."
      />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <AdminCard className="p-5">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            Send announcement
          </h2>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <input
              className="input-field"
              placeholder="Title"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
            <textarea
              className="input-field min-h-36"
              placeholder="Message"
              value={form.message}
              onChange={(e) =>
                setForm((f) => ({ ...f, message: e.target.value }))
              }
            />
            <select
              className="input-field"
              value={form.audience}
              onChange={(e) =>
                setForm((f) => ({ ...f, audience: e.target.value }))
              }
            >
              <option value="all">All users</option>
              <option value="students">Students</option>
              <option value="instructors">Instructors</option>
              <option value="department">Department</option>
            </select>
            {form.audience === 'department' ? (
              <input
                className="input-field"
                placeholder="Department name"
                value={form.department}
                onChange={(e) =>
                  setForm((f) => ({ ...f, department: e.target.value }))
                }
              />
            ) : null}
            <select
              className="input-field"
              value={form.channel}
              onChange={(e) =>
                setForm((f) => ({ ...f, channel: e.target.value }))
              }
            >
              <option value="email">Email</option>
              <option value="in_app">In app</option>
              <option value="both">Both</option>
            </select>
            <button
              type="submit"
              disabled={sending}
              className="btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> Send
            </button>
          </form>
        </AdminCard>
        <AdminCard className="overflow-hidden">
          {loading ? (
            <SkeletonRows rows={7} />
          ) : notifications.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((item) => (
                <article key={item._id} className="px-5 py-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {item.message}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.audience} · {item.channel} · {item.recipientCount}{' '}
                    recipients
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No announcements yet"
                description="Sent announcements will appear here."
              />
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
