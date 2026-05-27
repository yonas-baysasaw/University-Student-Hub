import { Bell, BookOpen, CalendarDays, Search } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { EASE_OUT } from './landingMotion.js';

function DashboardMockup() {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="panel-card relative overflow-hidden rounded-2xl border-slate-200/90 p-4 shadow-lg dark:border-slate-600 md:p-5"
      animate={reduced ? undefined : { y: [0, -8, 0] }}
      transition={
        reduced
          ? undefined
          : { duration: 7, repeat: Infinity, ease: 'easeInOut' }
      }
      aria-hidden
    >
      <div className="mb-3 flex gap-1 rounded-lg bg-slate-100/90 p-1 dark:bg-slate-800/80">
        <span className="h-2 w-8 rounded bg-slate-300 dark:bg-slate-600" />
        <span className="h-2 w-8 rounded bg-slate-200 dark:bg-slate-700" />
        <span className="h-2 w-8 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-700">
            <Bell className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span className="font-display text-xs font-bold text-slate-800 dark:text-slate-100">
              Announcements
            </span>
          </div>
          <ul className="mt-2 space-y-2 text-[11px]">
            <li className="flex items-start justify-between gap-2">
              <span className="text-slate-700 dark:text-slate-300">
                Midterm schedule posted
              </span>
              <motion.span
                className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:text-emerald-300"
                animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
                transition={
                  reduced
                    ? undefined
                    : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                }
              >
                ✓ Verified
              </motion.span>
            </li>
            <li className="flex items-start justify-between gap-2 text-slate-500 dark:text-slate-400">
              <span>Library hours update</span>
              <span className="shrink-0 text-[9px]">Apr 26</span>
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900/60">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-700">
            <CalendarDays className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span className="font-display text-xs font-bold text-slate-800 dark:text-slate-100">
              Today&apos;s classes
            </span>
          </div>
          <ul className="mt-2 space-y-1.5 font-mono text-[10px] text-slate-700 dark:text-slate-300">
            <li className="flex justify-between">
              <span className="flex items-center gap-1.5">
                <motion.span
                  className="h-1.5 w-1.5 rounded-full bg-cyan-500"
                  animate={reduced ? undefined : { opacity: [1, 0.35, 1] }}
                  transition={
                    reduced
                      ? undefined
                      : { duration: 1.5, repeat: Infinity }
                  }
                />
                Data Structures
              </span>
              <span className="text-cyan-700 dark:text-cyan-400">09:00</span>
            </li>
            <li className="flex justify-between">
              <span>Linear Algebra</span>
              <span className="text-cyan-700 dark:text-cyan-400">14:00</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/50">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="text-[11px] text-slate-400">Search library…</span>
        <BookOpen className="ml-auto h-4 w-4 text-slate-400" />
      </div>
    </motion.div>
  );
}

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT },
  },
};

function HeroSection() {
  const reduced = useReducedMotion();

  return (
    <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-slate-50/50 to-transparent px-4 py-10 dark:border-slate-800 dark:from-slate-900/40 md:px-6 md:py-16">
      <div className="relative z-[1] mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-12">
        <motion.div
          className="min-w-0"
          variants={reduced ? undefined : container}
          initial={reduced ? false : 'hidden'}
          animate="show"
        >
          <motion.p
            variants={reduced ? undefined : item}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400"
          >
            University Student Hub
          </motion.p>
          <motion.h1
            variants={reduced ? undefined : item}
            className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl lg:text-[2.35rem]"
          >
            Your Academic Life, Organized in One Place
          </motion.h1>
          <motion.p
            variants={reduced ? undefined : item}
            className="mt-4 max-w-xl text-base text-slate-600 dark:text-slate-400 md:text-lg"
          >
            Access verified updates, manage your schedule, explore the library,
            and study smarter with LiquAI — built for AAiT.
          </motion.p>
          <motion.div
            variants={reduced ? undefined : item}
            className="mt-8 flex flex-wrap gap-3"
          >
            <motion.div whileHover={reduced ? undefined : { scale: 1.03 }} whileTap={reduced ? undefined : { scale: 0.98 }}>
              <Link
                to="/signup"
                className="btn-primary px-6 py-3 text-sm font-semibold"
              >
                Get started free
              </Link>
            </motion.div>
            <motion.div whileHover={reduced ? undefined : { scale: 1.03 }} whileTap={reduced ? undefined : { scale: 0.98 }}>
              <Link
                to="/login"
                className="btn-secondary px-6 py-3 text-sm font-semibold"
              >
                Login to Dashboard
              </Link>
            </motion.div>
          </motion.div>
          <motion.div
            variants={reduced ? undefined : item}
            className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400"
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              All systems operational
            </span>
            <span>·</span>
            <span>Verified announcements</span>
            <span>·</span>
            <span>Dark mode ready</span>
          </motion.div>
        </motion.div>
        <motion.div
          className="relative min-w-0"
          initial={reduced ? false : { opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE_OUT }}
        >
          <motion.div
            className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-cyan-400/15 blur-2xl dark:bg-cyan-500/10"
            animate={reduced ? undefined : { scale: [1, 1.12, 1] }}
            transition={
              reduced
                ? undefined
                : { duration: 8, repeat: Infinity, ease: 'easeInOut' }
            }
          />
          <motion.div
            className="pointer-events-none absolute -bottom-8 -left-4 h-24 w-24 rounded-full bg-slate-400/10 blur-2xl"
            animate={reduced ? undefined : { scale: [1, 1.15, 1] }}
            transition={
              reduced
                ? undefined
                : { duration: 10, repeat: Infinity, ease: 'easeInOut' }
            }
          />
          <DashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}

export default HeroSection;
