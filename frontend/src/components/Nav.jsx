import { Link, NavLink } from 'react-router-dom';

function Nav() {
  return (
    <header className="px-3 pt-3 sm:px-4">
      <div className="glass-nav mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl px-3 py-2 sm:px-5">
        <Link to="/" className="font-display text-lg font-bold text-slate-900 sm:text-xl">
          University Student Hub
        </Link>
        <nav>
          <ul className="flex items-center gap-1 sm:gap-2">
            <li>
              <NavLink to="/" className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-800 sm:text-sm">
                About
              </NavLink>
            </li>
            <li>
              <NavLink to="/login" className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-cyan-50 hover:text-cyan-800 sm:text-sm">
                Sign in
              </NavLink>
            </li>
            <li>
              <NavLink to="/signup" className="btn-primary px-4 py-1.5 text-xs sm:text-sm">
                Sign up
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default Nav;
