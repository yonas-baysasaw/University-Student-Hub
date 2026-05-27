import { Sparkles, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeUp, staggerContainer, staggerItem, useLandingMotion } from './landingMotion.js';

const STATS = [
  { label: 'Core modules', value: '10+' },
  { label: 'Daily workflows', value: '1 hub' },
  { label: 'Built for', value: 'Students' },
];

const CHIPS = ['React', 'Real-time', 'LiquAI', 'Dark mode', 'Modular UI'];

function TrustStripSection() {
  const { reduced } = useLandingMotion();

  return (
    <section
      className="scroll-mt-24 border-t border-slate-200 px-4 py-10 dark:border-slate-800 md:px-6 md:py-12"
      aria-labelledby="trust-heading"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          {...fadeUp(reduced)}
          className="rounded-2xl border border-slate-200/90 bg-white/60 px-5 py-6 dark:border-slate-700 dark:bg-slate-900/40 md:px-8 md:py-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-cyan-700 dark:text-cyan-400">
                <Zap className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2
                  id="trust-heading"
                  className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400"
                >
                  Built for reliability
                </h2>
                <p className="mt-2 max-w-xl text-sm text-slate-700 dark:text-slate-300">
                  A production-ready{' '}
                  <span className="font-semibold">React</span> hub with real-time
                  updates and{' '}
                  <span className="inline-flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    LiquAI
                  </span>{' '}
                  — focused on daily student workflows.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
                    {s.value}
                  </p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <motion.ul
            className="mt-6 flex flex-wrap gap-2"
            {...staggerContainer(reduced, 0.05)}
          >
            {CHIPS.map((chip) => (
              <motion.li
                key={chip}
                {...staggerItem(reduced)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
              >
                {chip}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>
      </div>
    </section>
  );
}

export default TrustStripSection;
