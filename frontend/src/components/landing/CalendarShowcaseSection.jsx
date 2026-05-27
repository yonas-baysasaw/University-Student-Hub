import { motion } from 'framer-motion';
import {
  fadeUp,
  staggerContainer,
  staggerItem,
  useLandingMotion,
} from './landingMotion.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CALENDAR_DAYS = Array.from({ length: 35 }, (_, i) => {
  const day = i - 2;
  return {
    key: i,
    label: day > 0 && day <= 30 ? day : '',
    today: day === 14,
    exam: day === 8 || day === 22,
    assignment: day === 5 || day === 18 || day === 26,
    event: day === 10,
  };
});

const UPCOMING = [
  { title: 'Data Structures lab report', date: 'Apr 18', type: 'assignment' },
  { title: 'Linear Algebra midterm', date: 'Apr 22', type: 'exam' },
  { title: 'Robotics showcase', date: 'May 03', type: 'event' },
];

function CalendarShowcaseSection() {
  const { reduced } = useLandingMotion();

  return (
    <section
      id="calendar"
      className="scroll-mt-24 border-y border-slate-200/80 bg-slate-50/90 px-4 py-16 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 md:px-6 md:py-24"
      aria-labelledby="calendar-heading"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div {...fadeUp(reduced)} className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
            Smart calendar
          </p>
          <h2
            id="calendar-heading"
            className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-50 md:text-3xl"
          >
            Your semester, visualized
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Classes, assignments, exams, and events — synced in one premium view.
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
          <motion.div
            {...fadeUp(reduced, 0.1)}
            className="panel-card overflow-hidden rounded-2xl border-slate-200/90 p-4 shadow-lg dark:border-slate-800 dark:shadow-2xl md:p-6"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="font-display font-bold text-slate-900 dark:text-slate-50">
                April 2026
              </p>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 font-semibold text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300">
                  Classes
                </span>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                  Assignments
                </span>
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                  Exams
                </span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-500">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <motion.div
              className="mt-1 grid grid-cols-7 gap-1"
              {...staggerContainer(reduced, 0.015)}
            >
              {CALENDAR_DAYS.map((cell) => (
                <motion.div
                  key={cell.key}
                  {...staggerItem(reduced)}
                  className={`relative flex min-h-[2.75rem] flex-col items-center justify-start rounded-lg p-1 text-[11px] text-slate-700 dark:text-slate-300 ${
                    cell.label
                      ? cell.today
                        ? 'bg-cyan-500/15 ring-1 ring-cyan-500/50 dark:bg-cyan-500/20 dark:ring-cyan-400/60'
                        : 'bg-white/80 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                      : ''
                  }`}
                >
                  {cell.label ? (
                    <>
                      <span
                        className={
                          cell.today
                            ? 'font-bold text-cyan-700 dark:text-cyan-300'
                            : ''
                        }
                      >
                        {cell.label}
                      </span>
                      {cell.today ? (
                        <motion.span
                          className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400"
                          animate={reduced ? undefined : { opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      ) : null}
                      {cell.exam ? (
                        <span className="mt-auto h-1 w-full rounded-full bg-rose-500/80" />
                      ) : null}
                      {cell.assignment ? (
                        <span className="mt-auto h-1 w-full rounded-full bg-amber-500/70" />
                      ) : null}
                      {cell.event ? (
                        <span className="mt-auto h-1 w-full rounded-full bg-emerald-500/70" />
                      ) : null}
                    </>
                  ) : null}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div {...fadeUp(reduced, 0.15)} className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500">
              Upcoming
            </p>
            {UPCOMING.map((item) => (
              <motion.div
                key={item.title}
                initial={reduced ? false : { opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45 }}
                className="panel-card rounded-xl border-slate-200/90 p-3 dark:border-slate-800"
              >
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  {item.type}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {item.title}
                </p>
                <p className="mt-1 font-mono text-[11px] text-cyan-700 dark:text-cyan-400">
                  {item.date}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default CalendarShowcaseSection;
