import { Bell, CalendarDays, ClipboardList, Trophy } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { EASE_OUT, fadeUp, useLandingMotion } from './landingMotion.js';

const SCREENS = [
  {
    id: 'calendar',
    icon: CalendarDays,
    label: 'Calendar',
    content: (
      <div className="space-y-2 p-1">
        <p className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400">Today</p>
        <div className="rounded-lg bg-cyan-500/15 p-2 text-[10px]">09:00 Data Structures</div>
        <div className="rounded-lg bg-slate-100 p-2 text-[10px] dark:bg-slate-800">14:00 Linear Algebra</div>
      </div>
    ),
  },
  {
    id: 'notifications',
    icon: Bell,
    label: 'Alerts',
    content: (
      <div className="space-y-2 p-1">
        {['Midterm schedule posted', 'New library upload', 'Event reminder'].map((t) => (
          <div key={t} className="rounded-lg bg-slate-100 p-2 text-[10px] dark:bg-slate-800">
            {t}
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'events',
    icon: Trophy,
    label: 'Events',
    content: (
      <div className="space-y-2 p-1">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[10px] dark:border-emerald-900 dark:bg-emerald-950/40">
          Robotics showcase · May 03
        </div>
      </div>
    ),
  },
  {
    id: 'assignments',
    icon: ClipboardList,
    label: 'Tasks',
    content: (
      <div className="space-y-2 p-1">
        <div className="rounded-lg bg-amber-500/15 p-2 text-[10px]">Lab report · Due Fri</div>
        <div className="rounded-lg bg-rose-500/10 p-2 text-[10px]">Midterm · Apr 22</div>
      </div>
    ),
  },
];

function PhoneFrame({ screen, paused }) {
  const prefersReduced = useReducedMotion();

  return (
    <div
      className={`relative mx-auto w-[11rem] rounded-[1.85rem] border-4 border-slate-800 bg-slate-100 shadow-2xl dark:border-slate-600 dark:bg-slate-800 sm:w-[12.5rem] ${
        prefersReduced || paused ? '' : 'landing-float'
      }`}
    >
      <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
      <div className="m-2 mt-3 min-h-[14rem] overflow-hidden rounded-xl bg-white p-2 dark:bg-slate-900">
        <div className="mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-2 dark:border-slate-800">
          <screen.icon className="h-3.5 w-3.5 text-cyan-600" />
          <span className="text-[10px] font-bold">{screen.label}</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={screen.id}
            initial={prefersReduced ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, x: -12 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            {screen.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function MobileExperienceSection() {
  const { reduced } = useLandingMotion();
  const prefersReduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (prefersReduced || paused) return undefined;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SCREENS.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [prefersReduced, paused]);

  const screen = SCREENS[active];

  return (
    <section
      id="mobile"
      className="scroll-mt-24 border-y border-slate-200 bg-slate-50/90 px-4 py-14 dark:border-slate-800 dark:bg-slate-900/45 md:px-6 md:py-20"
      aria-labelledby="mobile-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <motion.div {...fadeUp(reduced)}>
            <h2
              id="mobile-heading"
              className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 md:text-3xl"
            >
              Your campus hub, in your pocket
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 md:text-base">
              Calendar, notifications, events, and assignments — touch-friendly and
              consistent on every device.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {SCREENS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    i === active
                      ? 'bg-cyan-600 text-white'
                      : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div
            {...fadeUp(reduced, 0.12)}
            className="flex flex-wrap items-center justify-center gap-8"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <PhoneFrame screen={screen} paused={paused} />
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="hidden w-full max-w-xs rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900 md:block"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Desktop companion
              </p>
              <div className="mt-3">{screen.content}</div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default MobileExperienceSection;
