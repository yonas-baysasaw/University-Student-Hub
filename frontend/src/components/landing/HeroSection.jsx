import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import HeroEcosystem from './HeroEcosystem.jsx';
import { useMagneticHover } from './hooks/useMagneticHover.js';
import { useLenis } from './LenisContext.jsx';
import { blurReveal, EASE_OUT } from './landingMotion.js';

function MagneticLink({ to, className, children, onClick }) {
  const { ref, onMouseMove, onMouseLeave } = useMagneticHover(0.22);

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="inline-block transition-transform duration-200 will-change-transform"
    >
      <Link to={to} className={className} onClick={onClick}>
        {children}
      </Link>
    </div>
  );
}

function HeroSection() {
  const reduced = useReducedMotion();
  const lenis = useLenis();

  const items = [
    { key: 'eyebrow', el: (
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
        University Student Hub
      </p>
    )},
    { key: 'headline', el: (
      <h1 className="mt-3 font-display text-3xl font-bold leading-[1.08] tracking-tight text-slate-900 dark:text-slate-50 md:text-5xl lg:text-[3.25rem]">
        Everything University Life Needs. In One Hub.
      </h1>
    )},
    { key: 'sub', el: (
      <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
        Manage classes, assignments, events, library, and AI study tools — unified
        for university students in one intelligent platform.
      </p>
    )},
    { key: 'ctas', el: (
      <div className="mt-8 flex flex-wrap gap-3">
        <MagneticLink to="/signup" className="btn-primary px-6 py-3 text-sm font-semibold shadow-lg shadow-cyan-900/15">
          Get Started
        </MagneticLink>
        <button
          type="button"
          className="btn-secondary px-6 py-3 text-sm font-semibold"
          onClick={() => lenis?.scrollTo('#features', { offset: -72 })}
        >
          Explore Features
        </button>
        <Link
          to="/login"
          className="inline-flex items-center px-4 py-3 text-sm font-semibold text-slate-600 underline-offset-4 hover:text-cyan-700 hover:underline dark:text-slate-400 dark:hover:text-cyan-400"
        >
          Login
        </Link>
      </div>
    )},
    { key: 'trust', el: (
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          All systems operational
        </span>
        <span className="hidden sm:inline">·</span>
        <span>Verified announcements</span>
        <span className="hidden sm:inline">·</span>
        <span>Dark mode ready</span>
      </div>
    )},
  ];

  return (
    <section className="relative flex min-h-[100dvh] items-center overflow-hidden border-b border-slate-200/80 px-4 py-16 dark:border-slate-800 md:px-6 md:py-20">
      <div className="relative z-[1] mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-10">
        <div className="min-w-0">
          {items.map((item, i) => (
            <motion.div key={item.key} {...blurReveal(reduced, i * 0.08)}>
              {item.el}
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.94, y: 32 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.2, ease: EASE_OUT }}
          className="relative min-w-0"
        >
          <HeroEcosystem />
        </motion.div>
      </div>
    </section>
  );
}

export default HeroSection;
