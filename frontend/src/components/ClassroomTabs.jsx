import { NavLink, useParams } from 'react-router-dom';

function ClassroomTabs() {
  const { chatId } = useParams();
  if (!chatId) return null;

  const basePath = `/classroom/${chatId}`;
  const tabs = [
    { label: 'Discussion Room', to: basePath, end: true },
    { label: 'Announcements', to: `${basePath}/announcements` },
    { label: 'Resources', to: `${basePath}/resources` },
  ];

  return (
    <nav className="mb-4 border-b border-slate-200 pb-3">
      <ul className="flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  isActive
                    ? 'bg-gradient-to-r from-slate-900 to-cyan-700 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-800'
                }`
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default ClassroomTabs;
