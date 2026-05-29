import {
  BarChart3,
  Bell,
  Building2,
  Flag,
  GraduationCap,
  LayoutDashboard,
  Library,
  ScrollText,
  Settings,
  Shield,
  UserCog,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

const nav = [
  { to: '/admin', label: 'Dashboard', end: true, icon: LayoutDashboard },
  { to: '/admin/students', label: 'Students', icon: Shield },
  { to: '/admin/instructors', label: 'Instructors', icon: GraduationCap },
  { to: '/admin/departments', label: 'Departments', icon: Building2 },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/logs', label: 'Logs', icon: ScrollText },
  { to: '/admin/reports', label: 'Reports', icon: Flag },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/profile', label: 'Admin profile', icon: UserCog },
  { to: '/admin/library', label: 'Library', icon: Library },
];

export default function AdminLayout() {
  return (
    <div className="dashboard-ambient page-surface min-h-[calc(100vh-5.5rem)] px-3 pb-8 pt-5 md:px-6 md:pb-14 md:pt-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[min(200px,28vh)] workspace-hero-mesh opacity-75 dark:opacity-55" />
      <div className="relative z-[2] mx-auto flex w-full max-w-[min(100%,1600px)] flex-col gap-6 md:flex-row md:items-start">
        <aside className="w-full shrink-0 md:sticky md:top-24 md:max-w-[240px]">
          <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-sm ring-1 ring-slate-200/80 dark:border-slate-600/80 dark:bg-slate-900/90 dark:ring-slate-600">
            <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Admin
            </p>
            <nav className="flex flex-col gap-0.5" aria-label="Admin sections">
              {nav.map(({ to, label, end, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-900 dark:bg-cyan-500/15 dark:text-cyan-100'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
