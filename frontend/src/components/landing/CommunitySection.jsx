import { CalendarHeart, MessagesSquare, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  fadeUp,
  hoverLift,
  staggerContainer,
  staggerItem,
  useLandingMotion,
} from './landingMotion.js';

const events = [
  { title: 'Robotics showcase', date: 'May 03 · Hall B', loc: 'Upcoming' },
  { title: 'Career fair — Tech', date: 'May 10 · Quad', loc: 'Upcoming' },
];

const ACTIVITY = [
  'Sara joined CSE study group',
  'New announcement in Data Structures',
  'Daniel RSVP’d to Career fair',
];

function CommunitySection() {
  const { reduced } = useLandingMotion();

  return (
    <section
      id="community"
      className="scroll-mt-24 px-4 py-14 md:px-6 md:py-20"
      aria-labelledby="community-heading"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div {...fadeUp(reduced)} className="mx-auto mb-10 max-w-2xl text-center">
          <h2
            id="community-heading"
            className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 md:text-3xl"
          >
            Campus community, socially alive
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Events, study groups, and collaboration spaces — connected to your workflow.
          </p>
        </motion.div>

        <motion.div
          {...fadeUp(reduced, 0.08)}
          className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {['SM', 'DT', 'HK', 'YA'].map((initials, i) => (
                <motion.span
                  key={initials}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-cyan-500 to-cyan-700 text-[10px] font-bold text-white dark:border-slate-900"
                  animate={reduced ? undefined : { y: [0, -4, 0] }}
                  transition={{
                    duration: 3 + i * 0.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.2,
                  }}
                >
                  {initials}
                </motion.span>
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                120+ students active this week
              </p>
              <p className="text-xs text-slate-500">Preview activity</p>
            </div>
          </div>
          <div className="landing-glass flex flex-wrap gap-2 rounded-full px-4 py-2">
            {ACTIVITY.map((line) => (
              <span
                key={line}
                className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {line}
              </span>
            ))}
          </div>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-2">
          <motion.div {...fadeUp(reduced, 0.05)}>
            <div className="mb-4 flex items-center gap-2">
              <CalendarHeart className="h-5 w-5 text-cyan-700 dark:text-cyan-400" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                Clubs & events
              </h3>
            </div>
            <motion.div
              className="grid gap-4 sm:grid-cols-2"
              {...staggerContainer(reduced, 0.12)}
            >
              {events.map((ev) => (
                <motion.article
                  key={ev.title}
                  {...staggerItem(reduced)}
                  {...hoverLift(reduced)}
                  className="panel-card rounded-2xl p-5 transition-shadow duration-300 hover:shadow-md"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {ev.loc}
                  </p>
                  <p className="mt-2 font-display font-semibold text-slate-900 dark:text-slate-50">
                    {ev.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {ev.date}
                  </p>
                  <Link
                    to="/signup"
                    className="mt-4 inline-block w-full rounded-lg border border-cyan-300/60 bg-cyan-500/10 py-2 text-center text-xs font-semibold text-cyan-800 transition hover:bg-cyan-500/20 dark:text-cyan-300"
                  >
                    Join on USH
                  </Link>
                </motion.article>
              ))}
            </motion.div>
          </motion.div>

          <motion.div {...fadeUp(reduced, 0.12)}>
            <div className="mb-4 flex items-center gap-2">
              <MessagesSquare className="h-5 w-5 text-slate-700 dark:text-slate-300" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                Study groups & forums
              </h3>
            </div>
            <motion.div {...hoverLift(reduced)} className="panel-card rounded-2xl p-6">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-600" />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Department threads for Q&amp;A and course coordination.
                </p>
              </div>
              <motion.div
                className="flex flex-wrap gap-2"
                {...staggerContainer(reduced, 0.06)}
              >
                {['EE', 'CSE', 'ME', 'Civil'].map((d) => (
                  <motion.span
                    key={d}
                    {...staggerItem(reduced)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {d}
                  </motion.span>
                ))}
              </motion.div>
              <Link
                to="/signup"
                className="mt-6 inline-block w-full rounded-lg bg-slate-900 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500"
              >
                Start collaborating
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default CommunitySection;
