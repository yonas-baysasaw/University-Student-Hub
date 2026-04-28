import { Megaphone, MessageSquare, FolderOpen } from 'lucide-react';
import { NavLink, useParams } from 'react-router-dom';

const ICONS = {
  discussion: MessageSquare,
  announcements: Megaphone,
  resources: FolderOpen,
};

function ClassroomTabs() {
  const { chatId } = useParams();
  if (!chatId) return null;

  const basePath = `/classroom/${chatId}`;
  const tabs = [
    { label: 'Discussion', icon: ICONS.discussion, to: basePath, end: true },
    {
      label: 'Announcements',
      icon: ICONS.announcements,
      to: `${basePath}/announcements`,
    },
    {
      label: 'Resources',
      icon: ICONS.resources,
      to: `${basePath}/resources`,
    },
  ];

  return (
    <nav className="mb-5 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-2 dark:border-slate-700 dark:bg-slate-900/40">
      <ul className="flex gap-1.5 overflow-x-auto pb-0.5 pt-0.5 md:gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <li key={tab.to} className="min-w-0 flex-1 sm:flex-none">
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide transition md:px-4 ${
                    isActive
                      ? 'bg-gradient-to-r from-slate-900 to-cyan-800 text-white shadow-md shadow-slate-900/25 ring-1 ring-white/10 dark:from-slate-800 dark:to-cyan-900'
                      : 'border border-transparent bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50/80 hover:text-cyan-900 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:border-cyan-800 dark:hover:bg-slate-800 dark:hover:text-cyan-100'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span>{tab.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default ClassroomTabs;
