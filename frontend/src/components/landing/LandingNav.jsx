import { ChevronDown, ExternalLink, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { setThemePreference } from '../../theme.js';

const navLinks = [
  { href: '#announcements', label: 'Announcements' },
  { href: '#schedule', label: 'Schedule' },
  { href: '#library', label: 'Library' },
  { href: '#community', label: 'Community' },
];

function LandingNav() {
  const [dark, setDark] = useState(
    () => document.documentElement.classList.contains('dark'),
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  function toggleTheme() {
    const nextDark = !document.documentElement.classList.contains('dark');
    setThemePreference(nextDark ? 'dark' : 'light');
    setDark(nextDark);
  }

  useEffect(() => {
    if (!moreOpen) return;

    const handlePointerDown = (event) => {
      if (!moreRef.current?.contains(event.target)) {
        setMoreOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur-md dark:border-slate-700/90 dark:bg-slate-900/95">
      <div className="mx-auto flex h-[3.5rem] max-w-6xl items-center gap-4 px-4 md:h-16 md:px-6">
        <Link
          to="/"
          className="flex min-w-0 shrink-0 items-center gap-2.5"
        >
          <img
            src="/logo.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg object-contain"
          />
          <span className="font-display font-bold leading-tight text-slate-900 dark:text-slate-50">
            <span className="block truncate text-[0.92rem] sm:text-base">
              USH
            </span>
            <span className="hidden text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:block">
              Addis Ababa Institute of Technology
            </span>
          </span>
        </Link>

        <nav
          className="hidden flex-1 justify-center lg:flex"
          aria-label="Page sections"
        >
          <ul className="flex items-center gap-1 xl:gap-2">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <a
                  href={href}
                  className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 outline-none transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex flex-shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white/90 text-slate-600 shadow-sm outline-none transition hover:border-cyan-300/80 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:border-cyan-600/50 dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? (
              <Sun className="h-4 w-4" strokeWidth={2} aria-hidden />
            ) : (
              <Moon className="h-4 w-4" strokeWidth={2} aria-hidden />
            )}
          </button>
          <Link
            to="/login"
            className="btn-primary px-3 py-2 text-xs sm:px-4 sm:text-sm"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="btn-secondary inline-flex shrink-0 px-2.5 py-2 text-xs sm:px-4 sm:text-sm"
          >
            Register
          </Link>
          <div className="relative shrink-0" ref={moreRef}>
            <button
              type="button"
              id="landing-more-trigger"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-controls="landing-more-menu"
              onClick={() => setMoreOpen((open) => !open)}
              className="inline-flex h-9 items-center gap-0.5 rounded-lg border border-slate-200/90 bg-white/90 px-2 py-2 text-[10px] font-semibold leading-none text-slate-700 shadow-sm outline-none transition hover:border-cyan-300/80 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:border-cyan-600/50 dark:hover:text-white dark:focus-visible:ring-offset-slate-900 sm:gap-1 sm:px-2.5 sm:text-[11px]"
            >
              More
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                  moreOpen ? 'rotate-180' : ''
                }`}
                strokeWidth={2}
                aria-hidden
              />
            </button>
            {moreOpen ? (
              <div
                id="landing-more-menu"
                role="menu"
                aria-labelledby="landing-more-trigger"
                className="absolute end-0 top-full z-50 mt-1.5 min-w-[11.5rem] rounded-xl border border-slate-200/90 bg-white/98 p-1 shadow-lg shadow-slate-900/10 backdrop-blur-md dark:border-slate-600 dark:bg-slate-900/98 dark:shadow-black/30"
              >
                <Link
                  to="/admin/login"
                  role="menuitem"
                  className="flex items-center rounded-lg px-2.5 py-2 text-[11px] font-semibold text-violet-800 transition hover:bg-violet-50 dark:text-violet-200 dark:hover:bg-violet-950/40 sm:text-sm"
                  onClick={() => setMoreOpen(false)}
                >
                  Admin
                </Link>
                <a
                  href="https://portal.aau.edu.et/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200/90 px-2.5 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800/60 dark:hover:text-slate-100 sm:text-sm"
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="min-w-0 flex-1">Portal</span>
                  <ExternalLink
                    className="h-3.5 w-3.5 shrink-0 opacity-70"
                    strokeWidth={2}
                    aria-hidden
                  />
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <nav
        className="border-t border-slate-100 px-3 py-2 lg:hidden dark:border-slate-800"
        aria-label="Page sections (mobile)"
      >
        <ul className="flex flex-wrap justify-center gap-1">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <a
                href={href}
                className="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export default LandingNav;
