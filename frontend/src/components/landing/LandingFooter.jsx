import { Link } from 'react-router-dom';

function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50/95 dark:border-slate-700 dark:bg-slate-900/95">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 lg:gap-8 md:px-6">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
            University Student Hub
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Centralized academic workspace for AAiT students and staff.
          </p>
        </div>
        <div>
          <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Contact
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <li>
              <a
                href="mailto:support@aait.edu.et"
                className="transition hover:text-cyan-700 dark:hover:text-cyan-400"
              >
                support@aait.edu.et
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Help
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                to="/login"
                className="text-slate-700 transition hover:text-cyan-700 dark:text-slate-300 dark:hover:text-cyan-400"
              >
                Sign in support
              </Link>
            </li>
            <li>
              <a
                href="#"
                className="text-slate-700 transition hover:text-cyan-700 dark:text-slate-300 dark:hover:text-cyan-400"
                onClick={(e) => e.preventDefault()}
              >
                Help documentation
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Legal
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                href="#"
                className="text-slate-700 transition hover:text-cyan-700 dark:text-slate-300 dark:hover:text-cyan-400"
                onClick={(e) => e.preventDefault()}
              >
                Privacy
              </a>
            </li>
            <li>
              <a
                href="#"
                className="text-slate-700 transition hover:text-cyan-700 dark:text-slate-300 dark:hover:text-cyan-400"
                onClick={(e) => e.preventDefault()}
              >
                Terms of use
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            University
          </h2>
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
            Addis Ababa Institute of Technology (AAiT)
          </p>
          <p
            id="status"
            className="mt-4 text-xs text-slate-500 dark:text-slate-400"
          >
            <span className="inline-flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                aria-hidden
              />
              <span>All systems operational</span>
            </span>
          </p>
        </div>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-500">
        © {new Date().getFullYear()} University Student Hub · AAiT
      </div>
    </footer>
  );
}

export default LandingFooter;
