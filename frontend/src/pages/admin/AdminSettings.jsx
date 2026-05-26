import { Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi } from '../../services/adminApi';
import { AdminCard, AdminPageHeader, SkeletonRows } from './adminShared';

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.settings();
      setSettings(data.settings);
    } catch (e) {
      toast.error(e?.message || 'Could not load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await adminApi.updateSettings(settings);
      setSettings(data.settings);
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const set = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="System settings"
        description="Control platform-wide operating switches used by the admin system."
      />
      <AdminCard className="p-5">
        {loading || !settings ? (
          <SkeletonRows rows={5} />
        ) : (
          <form onSubmit={save} className="max-w-2xl space-y-5">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
              <span>
                <span className="block font-semibold text-slate-900 dark:text-slate-100">
                  Maintenance mode
                </span>
                <span className="text-sm text-slate-500">
                  Signal that the platform is temporarily unavailable.
                </span>
              </span>
              <input
                type="checkbox"
                checked={!!settings.maintenanceMode}
                onChange={(e) => set('maintenanceMode', e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-cyan-600"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
              <span>
                <span className="block font-semibold text-slate-900 dark:text-slate-100">
                  Registration enabled
                </span>
                <span className="text-sm text-slate-500">
                  Allow new student accounts to register.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.registrationEnabled !== false}
                onChange={(e) => set('registrationEnabled', e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-cyan-600"
              />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
              <span>
                <span className="block font-semibold text-slate-900 dark:text-slate-100">
                  Email announcements
                </span>
                <span className="text-sm text-slate-500">
                  Permit admin email announcement sends.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.emailAnnouncementsEnabled !== false}
                onChange={(e) =>
                  set('emailAnnouncementsEnabled', e.target.checked)
                }
                className="h-5 w-5 rounded border-slate-300 text-cyan-600"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Default role
                </span>
                <select
                  className="input-field"
                  value={settings.defaultUserRole || 'user'}
                  onChange={(e) => set('defaultUserRole', e.target.value)}
                >
                  <option value="user">User</option>
                  <option value="lecturer">Lecturer</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Support email
                </span>
                <input
                  className="input-field"
                  value={settings.supportEmail || ''}
                  onChange={(e) => set('supportEmail', e.target.value)}
                  placeholder="support@university.edu"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> Save settings
            </button>
          </form>
        )}
      </AdminCard>
    </div>
  );
}
