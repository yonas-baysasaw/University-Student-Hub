import { ChevronDown, Moon, Sun } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { setThemePreference } from '../../theme.js';
import { useLenis } from './LenisContext.jsx';

const navLinks = [
  { href: '#tour', label: 'Tour', sectionId: 'tour' },
  { href: '#features', label: 'Features', sectionId: 'features' },
  { href: '#calendar', label: 'Calendar', sectionId: 'calendar' },
  { href: '#community', label: 'Community', sectionId: 'community' },
  { href: '#mobile', label: 'Mobile', sectionId: 'mobile' },
  { href: '#stories', label: 'Stories', sectionId: 'stories' },
  { href: '#join', label: 'Join', sectionId: 'join' },
];

function LandingNav() {
  const [dark, setDark] = useState(
    () => document.documentElement.classList.contains('dark'),
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const moreRef = useRef(null);
  const reduced = useReducedMotion();
  const lenis = useLenis();

  function handleAnchorClick(event, href) {
    if (!href.startsWith('#')) return;
    event.preventDefault();
    lenis?.scrollTo(href, { offset: -72 });
  }

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

  useEffect(() => {
    const sections = navLinks
      .map(({ sectionId }) => document.getElementById(sectionId))
      .filter(Boolean);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: '-40% 0px -45% 0px', threshold: [0, 0.25, 0.5] },
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function linkClass(sectionId) {
    const active = activeSection === sectionId;
    return [
      'relative rounded-full px-3 py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
      active
        ? 'text-cyan-800 dark:text-cyan-300'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
    ].join(' ');
  }

  return (
    <motion.header
      className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur-md dark:border-slate-700/90 dark:bg-slate-900/95"
      initial={reduced ? false : { y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
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
              One hub for campus life
            </span>
          </span>
        </Link>

        <nav
          className="hidden flex-1 justify-center xl:flex"
          aria-label="Page sections"
        >
          <ul className="flex items-center gap-0.5 xl:gap-1">
            {navLinks.map(({ href, label, sectionId }) => (
              <li key={href} className="relative">
                <a
                  href={href}
                  className={linkClass(sectionId)}
                  onClick={(e) => handleAnchorClick(e, href)}
                >
                  {label}
                  {activeSection === sectionId ? (
                    <motion.span
                      layoutId="landing-nav-indicator"
                      className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-cyan-500"
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 32,
                      }}
                    />
                  ) : null}
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
              <motion.div
                id="landing-more-menu"
                role="menu"
                aria-labelledby="landing-more-trigger"
                initial={reduced ? false : { opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
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
              </motion.div>
            ) : null}
          </div>
        </div>
      </div>

      <nav
        className="border-t border-slate-100 px-3 py-2 xl:hidden dark:border-slate-800"
        aria-label="Page sections (mobile)"
      >
        <ul className="flex flex-wrap justify-center gap-1">
          {navLinks.map(({ href, label, sectionId }) => (
            <li key={href}>
              <a
                href={href}
                className={`inline-block rounded-full px-2 py-1 text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:px-2.5 sm:text-[11px] ${
                  activeSection === sectionId
                    ? 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
                onClick={(e) => handleAnchorClick(e, href)}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </motion.header>
  );
}

export default LandingNav;
