import { CalendarHeart, MessagesSquare } from 'lucide-react';
import { motion } from 'framer-motion';
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

function CommunitySection() {
  const { reduced } = useLandingMotion();

  return (
    <section
      id="community"
      className="scroll-mt-24 px-4 py-12 md:px-6 md:py-16"
      aria-labelledby="community-heading"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div {...fadeUp(reduced)} className="mx-auto mb-10 max-w-2xl text-center">
          <h2
            id="community-heading"
            className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 md:text-3xl"
          >
            Community & collaboration
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Operational tools for coordination—events, groups, and
            discussions.
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-2">
          <motion.div {...fadeUp(reduced, 0.05)}>
            <div className="mb-4 flex items-center gap-2">
              <CalendarHeart className="h-5 w-5 text-cyan-700 dark:text-cyan-400" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                Clubs & event management
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
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {ev.loc}
                  </p>
                  <p className="mt-2 font-display font-semibold text-slate-900 dark:text-slate-50">
                    {ev.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {ev.date}
                  </p>
                  <button
                    type="button"
                    disabled
                    className="mt-4 w-full cursor-not-allowed rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-400 dark:border-slate-600"
                  >
                    Join (preview)
                  </button>
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
            <motion.div
              {...hoverLift(reduced)}
              className="panel-card rounded-2xl p-6"
            >
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Department-based threads for Q&amp;A, study groups, and course
                coordination.
              </p>
              <motion.div
                className="mt-4 flex flex-wrap gap-2"
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
              <button
                type="button"
                disabled
                className="mt-6 w-full cursor-not-allowed rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-400 dark:border-slate-600"
              >
                Join discussion (preview)
              </button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default CommunitySection;
