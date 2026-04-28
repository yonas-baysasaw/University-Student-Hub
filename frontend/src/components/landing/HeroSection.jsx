import { Bell, BookOpen, CalendarDays, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

function DashboardMockup() {
  return (
    <div
      className="panel-card relative overflow-hidden rounded-2xl border-slate-200/90 p-4 shadow-lg dark:border-slate-600 md:p-5"
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
              <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
                ✓
              </span>
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
              <span>Data Structures</span>
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
    </div>
  );
}

function HeroSection() {
  return (
    <section className="border-b border-slate-200/80 bg-gradient-to-b from-slate-50/50 to-transparent px-4 py-10 dark:border-slate-800 dark:from-slate-900/40 md:px-6 md:py-14">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-12">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
            University Student Hub
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl lg:text-[2.35rem]">
            Your Academic Life, Organized in One Place
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-600 dark:text-slate-400 md:text-lg">
            Access verified updates, manage your schedule, and collaborate
            efficiently.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="btn-primary px-6 py-3 text-sm font-semibold"
            >
              Login to Dashboard
            </Link>
            <Link
              to="/signup"
              className="btn-secondary px-6 py-3 text-sm font-semibold"
            >
              Register
            </Link>
          </div>
        </div>
        <div className="relative min-w-0">
          <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-cyan-400/15 blur-2xl dark:bg-cyan-500/10" />
          <div className="pointer-events-none absolute -bottom-8 -left-4 h-24 w-24 rounded-full bg-slate-400/10 blur-2xl" />
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
