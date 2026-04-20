import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import defaultProfile from '../assets/profile.png';

function Navbar({ children }) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const photoUrl = user?.photo || defaultProfile;
  const displayName = user ? user.displayName ?? user.username ?? 'Profile' : 'Profile';
  const menuWidth = 224;

  useEffect(() => {
    if (!menuOpen) return;

    const updateMenuPosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const maxLeft = window.innerWidth - menuWidth - 8;
      setMenuPosition({
        top: rect.bottom + 12,
        left: Math.max(8, Math.min(rect.right - menuWidth, maxLeft)),
      });
    };

    const handleOutsideClick = event => {
      const clickedButton = buttonRef.current?.contains(event.target);
      const clickedMenu = menuRef.current?.contains(event.target);
      if (!clickedButton && !clickedMenu) {
        setMenuOpen(false);
      }
    };

    const handleEscape = event => {
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
      <header className="px-3 pt-3 sm:px-4">
        <div className="glass-nav mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl px-3 py-2 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-700 to-slate-900 text-xs font-bold text-cyan-100">
              USH
            </span>
            <span className="font-display text-lg font-semibold text-slate-900 sm:text-xl">University Student Hub</span>
          </div>

          <div className="flex items-center gap-2">
            <nav>
              <ul className="flex items-center gap-1">
                <li>
                  <NavLink
                    to="/"
                    className={({ isActive }) =>
                      `rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                        isActive
                          ? 'bg-gradient-to-r from-slate-900 to-cyan-700 text-white'
                          : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                      }`
                    }
                  >
                    Dashboard
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/classroom"
                    className={({ isActive }) =>
                      `rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                        isActive
                          ? 'bg-gradient-to-r from-slate-900 to-cyan-700 text-white'
                          : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                      }`
                    }
                  >
                    Classroom
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/library"
                    className={({ isActive }) =>
                      `rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                        isActive
                          ? 'bg-gradient-to-r from-slate-900 to-cyan-700 text-white'
                          : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                      }`
                    }
                  >
                    Library
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/liqu-ai"
                    className={({ isActive }) =>
                      `rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                        isActive
                          ? 'bg-gradient-to-r from-slate-900 to-cyan-700 text-white'
                          : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                      }`
                    }
                  >
                    Liqu AI
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                      `rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                        isActive
                          ? 'bg-gradient-to-r from-slate-900 to-cyan-700 text-white'
                          : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                      }`
                    }
                  >
                    Profile
                  </NavLink>
                </li>
              </ul>
            </nav>

            <div className="relative">
              <button
                ref={buttonRef}
                type="button"
                onClick={() => setMenuOpen(open => !open)}
                className="btn btn-ghost btn-circle avatar"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Open profile menu"
              >
                <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200">
                  <img alt={`${displayName} avatar`} src={photoUrl} />
                </div>
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
            className="menu menu-sm fixed z-[2147483647] w-56 rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 shadow-2xl"
            style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
            role="menu"
          >
            <li>
              <span className="flex items-center justify-between rounded-xl px-3 py-2 font-semibold text-slate-800">
                {displayName}
                <span className="badge-dot" />
              </span>
            </li>
            <li>
              <a href="/profile" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                My profile
              </a>
            </li>
            <li>
              <a href="/password/reset" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                Reset password
              </a>
            </li>
            <li>
              <a href="/api/auth/logout" className="rounded-xl border border-rose-100 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50">
                Logout
              </a>
            </li>
          </ul>,
          document.body
        )}
    </div>
  );
}

export default Navbar;
