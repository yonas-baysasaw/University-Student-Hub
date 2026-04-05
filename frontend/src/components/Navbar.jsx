import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import defaultProfile from '../assets/profile.png';

function Navbar({ children }) {
  const { user } = useAuth();
  const photoUrl = user?.photo || defaultProfile;
  const displayName = user ? user.displayName ?? user.username ?? 'Profile' : 'Profile';
  console.log(user)
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
              </ul>
            </nav>

            <div className="dropdown dropdown-end">
              <button type="button" tabIndex={0} className="btn btn-ghost btn-circle avatar">
                <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200">
                  <img alt={`${displayName} avatar`} src={photoUrl} />
                </div>
              </button>
              <ul
                tabIndex={0}
                className="menu menu-sm dropdown-content z-[999] mt-3 w-56 rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 shadow-xl"
              >
                <li>
                  <span className="flex items-center justify-between rounded-xl px-3 py-2 font-semibold text-slate-800">
                    {displayName}
                    <span className="badge-dot" />
                  </span>
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
              </ul>
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}

export default Navbar;
