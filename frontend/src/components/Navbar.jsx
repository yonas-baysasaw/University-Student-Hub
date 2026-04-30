import { ChevronDown, LogOut, Settings, Shield, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink } from 'react-router-dom';
import defaultProfile from '../assets/profile.png';
import { useAuth } from '../contexts/AuthContext';

const menuWidth = 272;

const baseNavLinks = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/classroom', label: 'Classroom', end: false },
  { to: '/notifications', label: 'Notifications', end: false },
  { to: '/library', label: 'Library', end: false },
  { to: '/liqu-ai', label: 'Liqu AI', end: false },
  { to: '/profile', label: 'Profile', end: false },
];

function Navbar({ children }) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const photoUrl = user?.photo || defaultProfile;
  const displayName = user
    ? (user.displayName ?? user.username ?? 'Profile')
    : 'Profile';
  const email = user?.email ?? '';

  const byokActive = !!user?.geminiConfigured;

  const navLinks = user?.isStaff
    ? [
        ...baseNavLinks,
        { to: '/admin', label: 'Admin', end: false, icon: Shield },
      ]
    : baseNavLinks;

  useEffect(() => {
    if (!menuOpen) return;

    const updateMenuPosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const maxLeft = window.innerWidth - menuWidth - 8;
      setMenuPosition({
        top: rect.bottom + 10,
        left: Math.max(8, Math.min(rect.right - menuWidth, maxLeft)),
      });
    };

    const handleOutsideClick = (event) => {
      const clickedButton = buttonRef.current?.contains(event.target);
      const clickedMenu = menuRef.current?.contains(event.target);
      if (!clickedButton && !clickedMenu) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    updateMenuPosition();
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [menuOpen]);

  return (
    <div className="pb-8">
      <header className="nav-shell sticky top-0 z-50">
        <div className="mx-auto flex min-h-[3.75rem] max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
          <Link
            to="/"
            className="group flex shrink-0 items-center gap-3 rounded-xl outline-none ring-cyan-500/0 transition hover:ring-cyan-500/25 focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 via-cyan-700 to-slate-900 text-[11px] font-bold tracking-wide text-white shadow-md shadow-cyan-900/15 ring-1 ring-white/10">
              USH
            </span>
            <span className="hidden flex-col sm:flex">
              <span className="font-display text-[15px] font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-50">
                Student Hub
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Workspace
              </span>
            </span>
            <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 sm:hidden">
              USH
            </span>
          </Link>

          <div className="hidden h-8 w-px shrink-0 bg-slate-200 dark:bg-slate-600 md:block" />

          <nav
            className="min-w-0 flex-1 md:flex md:justify-center"
            aria-label="Primary"
          >
            <div className="nav-segment-track flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {navLinks.map(({ to, label, end, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `relative shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-150 sm:px-3.5 sm:text-[13px] ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90 dark:bg-slate-700 dark:text-white dark:ring-slate-600/90'
                        : 'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100'
                    }`
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    {Icon ? (
                      <Icon className="h-3.5 w-3.5 opacity-80" aria-hidden />
                    ) : null}
                    {label}
                  </span>
                </NavLink>
              ))}
            </div>
          </nav>

          <div className="flex shrink-0 items-center">
            <div className="relative">
              <button
                ref={buttonRef}
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="group flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 py-1 pl-1 pr-2 shadow-sm transition hover:border-cyan-300/80 hover:shadow-md dark:border-slate-600 dark:bg-slate-800/90 dark:hover:border-cyan-600/50"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
              >
                <div className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-slate-100 dark:ring-slate-700">
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    src={photoUrl}
                  />
                  {byokActive ? (
                    <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                  ) : null}
                </div>
                <ChevronDown
                  className={`hidden h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 sm:block ${
                    menuOpen ? 'rotate-180' : ''
                  }`}
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>

      {menuOpen &&
        createPortal(
          <ul
            ref={menuRef}
            className="nav-profile-menu fixed z-[2147483647] overflow-hidden rounded-2xl p-1.5 text-slate-700 dark:text-slate-200"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              width: `${menuWidth}px`,
            }}
          >
            <li className="rounded-xl bg-slate-50/90 px-3 py-3 dark:bg-slate-800/80">
              <div className="flex items-center gap-3">
                <img
                  src={photoUrl}
                  alt=""
                  className="h-11 w-11 rounded-full border border-slate-200/80 object-cover dark:border-slate-600"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[15px] font-semibold text-slate-900 dark:text-slate-50">
                    {displayName}
                  </p>
                  {email ? (
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {email}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>

            <li className="my-1.5 h-px bg-slate-200/90 dark:bg-slate-600/80" />

            <li>
              <Link
                to="/settings"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/80"
                onClick={() => setMenuOpen(false)}
              >
                <Settings
                  className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
                  strokeWidth={2}
                  aria-hidden
                />
                Settings
              </Link>
            </li>
            <li>
              <Link
                to="/profile"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/80"
                onClick={() => setMenuOpen(false)}
              >
                <User
                  className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
                  strokeWidth={2}
                  aria-hidden
                />
                My profile
              </Link>
            </li>

            <li className="my-1.5 h-px bg-slate-200/90 dark:bg-slate-600/80" />

            <li>
              <a
                href="/api/auth/logout"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/35"
              >
                <LogOut
                  className="h-4 w-4 shrink-0 opacity-90"
                  strokeWidth={2}
                  aria-hidden
                />
                Log out
              </a>
            </li>
          </ul>,
          document.body,
        )}
    </div>
  );
}

export default Navbar;
