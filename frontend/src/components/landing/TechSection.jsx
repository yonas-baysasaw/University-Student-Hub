import { Sparkles, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeUp, staggerContainer, staggerItem, useLandingMotion } from './landingMotion.js';

const chips = [
  'Real-time updates',
  'LiquAI built-in',
  'Dark mode',
  'Modular React UI',
  'Fast & scalable',
];

function TechSection() {
  const { reduced } = useLandingMotion();

  return (
    <section
      className="scroll-mt-24 border-t border-slate-200 px-4 py-10 dark:border-slate-800 md:px-6 md:py-12"
      aria-labelledby="tech-heading"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          {...fadeUp(reduced)}
          className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/60 dark:border-slate-700 dark:bg-slate-900/40 md:px-8 md:py-8"
        >
          <div className="relative px-5 py-6">
            <motion.div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/10 blur-2xl"
              animate={reduced ? undefined : { scale: [1, 1.15, 1] }}
              transition={
                reduced
                  ? undefined
                  : { duration: 8, repeat: Infinity, ease: 'easeInOut' }
              }
            />
            <div className="relative flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-cyan-700 dark:text-cyan-400">
                <Zap className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2
                  id="tech-heading"
                  className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400"
                >
                  Built for reliability
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  A{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    React
                  </span>{' '}
                  frontend with real-time socket updates, a structured library,
                  classroom tools, and{' '}
                  <span className="inline-flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    LiquAI
                  </span>{' '}
                  — one maintainable hub focused on daily student workflows.
                </p>
              </div>
            </div>
            <motion.ul
              className="relative mt-6 flex flex-wrap gap-3"
              {...staggerContainer(reduced, 0.07)}
            >
              {chips.map((chip) => (
                <motion.li
                  key={chip}
                  {...staggerItem(reduced)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
                >
                  {chip}
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default TechSection;
