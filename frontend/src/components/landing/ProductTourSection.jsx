import {
  Bell,
  BookOpen,
  CalendarRange,
  Search,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { EASE_OUT, fadeUp, useLandingMotion } from './landingMotion.js';

const TOUR_STEPS = [
  {
    id: 'announcements',
    label: 'Announcements',
    icon: Bell,
    title: 'Verified campus updates',
    description:
      'Official posts from instructors and departments — labeled, trusted, and easy to scan.',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: CalendarRange,
    title: 'Your day at a glance',
    description:
      'Weekly patterns and today’s slots with clear time blocks and live “now” indicators.',
  },
  {
    id: 'library',
    label: 'Library',
    icon: BookOpen,
    title: 'Structured digital library',
    description:
      'Search notes, books, and assignment bundles — filtered by type in one place.',
  },
  {
    id: 'liquai',
    label: 'LiquAI',
    icon: Sparkles,
    title: 'AI study companion',
    description:
      'Study buddy chat and exam practice — built into the hub, not a separate tool.',
  },
];

function AnnouncementsPreview() {
  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-700">
        <Bell className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
        <span className="font-display text-xs font-bold text-slate-800 dark:text-slate-100">
          Announcements
        </span>
      </div>
      {[
        { title: 'Midterm schedule posted', verified: true },
        { title: 'Registration window opens', date: 'Apr 28' },
        { title: 'Lab safety briefing', date: 'Apr 29' },
      ].map((row) => (
        <div
          key={row.title}
          className="flex items-start justify-between gap-2 rounded-lg bg-white/80 px-2.5 py-2 dark:bg-slate-800/80"
        >
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
            {row.title}
          </span>
          {row.verified ? (
            <motion.span
              className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-800 dark:text-emerald-300"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              Verified
            </motion.span>
          ) : (
            <span className="shrink-0 font-mono text-[9px] text-slate-500">
              {row.date}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function SchedulePreview() {
  const slots = [
    { label: 'Data Structures', time: '09:00–10:30', now: true },
    { label: 'Linear Algebra', time: '11:00–12:30', now: false },
    { label: 'Physics Lab', time: '14:00–15:30', now: false },
  ];
  return (
    <div className="space-y-3 p-1">
      <p className="font-display text-[11px] font-bold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">
        Today&apos;s classes
      </p>
      {slots.map((slot) => (
        <div
          key={slot.label}
          className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[11px] ${
            slot.now
              ? 'border border-cyan-300/60 bg-cyan-50/90 dark:border-cyan-700/50 dark:bg-cyan-950/30'
              : 'bg-white/80 dark:bg-slate-800/80'
          }`}
        >
          <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            {slot.now ? (
              <motion.span
                className="h-2 w-2 rounded-full bg-cyan-500"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                aria-label="Now"
              />
            ) : (
              <span className="w-2" aria-hidden />
            )}
            {slot.label}
          </span>
          <span className="font-mono font-semibold text-slate-600 dark:text-slate-400">
            {slot.time}
          </span>
        </div>
      ))}
    </div>
  );
}

function LibraryPreview() {
  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/80">
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate text-[11px] text-slate-600 dark:text-slate-300">
          Data Structures notes
          <motion.span
            className="ml-0.5 inline-block h-3 w-px bg-cyan-500 align-middle"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {['Notes', 'Books', 'Assignments'].map((c, idx) => (
          <motion.span
            key={c}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.12, duration: 0.35, ease: EASE_OUT }}
          >
            {c}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function LiquAiPreview() {
  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <span className="font-display text-xs font-bold text-slate-800 dark:text-slate-100">
          LiquAI Study Buddy
        </span>
      </div>
      <div className="rounded-xl border border-violet-200/70 bg-violet-50/50 p-3 dark:border-violet-800/50 dark:bg-violet-950/25">
        <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">
          You
        </p>
        <p className="mt-1 text-[11px] text-slate-700 dark:text-slate-300">
          Explain Big-O for merge sort
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-800/80">
        <p className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-400">
          LiquAI
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
          Merge sort runs in{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            O(n log n)
          </span>{' '}
          time — it divides the array recursively
          <motion.span
            className="ml-0.5 inline-block h-3 w-px bg-cyan-500 align-middle"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
        </p>
      </div>
    </div>
  );
}

const PREVIEWS = {
  announcements: AnnouncementsPreview,
  schedule: SchedulePreview,
  library: LibraryPreview,
  liquai: LiquAiPreview,
};

function ProductTourSection() {
  const { reduced } = useLandingMotion();
  const prefersReduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const sectionRef = useRef(null);
  const [inView, setInView] = useState(false);
  const heroMotion = fadeUp(reduced);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (prefersReduced || !inView) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % TOUR_STEPS.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [prefersReduced, inView, active]);

  function selectStep(index) {
    setActive(index);
  }

  const step = TOUR_STEPS[active];
  const Preview = PREVIEWS[step.id];

  return (
    <section
      ref={sectionRef}
      id="tour"
      className="relative scroll-mt-24 border-y border-slate-200/80 px-4 py-14 dark:border-slate-800 md:px-6 md:py-20"
      aria-labelledby="tour-heading"
    >
      <div className="relative z-[1] mx-auto max-w-6xl">
        <motion.div {...heroMotion} className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
            Product tour
          </p>
          <h2
            id="tour-heading"
            className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-50 md:text-3xl"
          >
            See the hub in action
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            One workspace — announcements, schedule, library, and AI study tools.
          </p>
        </motion.div>

        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <motion.div
            {...fadeUp(reduced, 0.1)}
            className="flex flex-col gap-3"
            role="tablist"
            aria-label="Product modules"
          >
            {TOUR_STEPS.map((item, index) => {
              const Icon = item.icon;
              const selected = index === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectStep(index)}
                  className={`group relative overflow-hidden rounded-2xl border px-4 py-4 text-start transition-colors duration-300 ${
                    selected
                      ? 'border-cyan-300/80 bg-white shadow-md shadow-cyan-900/5 dark:border-cyan-700/60 dark:bg-slate-900/90 dark:shadow-black/20'
                      : 'border-slate-200/90 bg-white/60 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-600'
                  }`}
                >
                  {selected ? (
                    <motion.span
                      layoutId="tour-active-bar"
                      className="absolute inset-y-0 start-0 w-1 rounded-full bg-gradient-to-b from-cyan-500 to-cyan-700"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  ) : null}
                  <div className="flex items-start gap-3 ps-2">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        selected
                          ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </motion.div>

          <motion.div
            {...fadeUp(reduced, 0.18)}
            className="relative min-w-0"
          >
            <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-br from-cyan-400/10 via-transparent to-violet-400/10 blur-xl" />
            <div className="panel-card relative overflow-hidden rounded-2xl p-4 md:p-5">
              <div className="mb-3 flex gap-1 rounded-lg bg-slate-100/90 p-1 dark:bg-slate-800/80">
                {TOUR_STEPS.map((s, i) => (
                  <span
                    key={s.id}
                    className={`h-2 flex-1 rounded transition-colors duration-300 ${
                      i === active
                        ? 'bg-cyan-500/70'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.id}
                  role="tabpanel"
                  initial={
                    prefersReduced
                      ? false
                      : { opacity: 0, x: 20, filter: 'blur(6px)' }
                  }
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={
                    prefersReduced
                      ? undefined
                      : { opacity: 0, x: -20, filter: 'blur(6px)' }
                  }
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                >
                  <Preview />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default ProductTourSection;
