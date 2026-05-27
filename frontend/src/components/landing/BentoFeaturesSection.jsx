import { motion } from 'framer-motion';
import { LANDING_FEATURES } from './data/landingFeatures.js';
import {
  fadeUp,
  staggerContainer,
  staggerItem,
  tiltHover,
  useLandingMotion,
} from './landingMotion.js';

function FeaturePreview({ type }) {
  const base = 'rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50';

  switch (type) {
    case 'calendar':
      return (
        <div className={`${base} mt-4 grid grid-cols-7 gap-1 p-2`}>
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-md ${
                i === 8
                  ? 'bg-cyan-500/25 ring-1 ring-cyan-500/50'
                  : i === 5
                    ? 'bg-rose-500/20'
                    : 'bg-white/80 dark:bg-slate-800/80'
              }`}
            />
          ))}
        </div>
      );
    case 'liquai':
      return (
        <div className={`${base} mt-4 border-violet-200/60 dark:border-violet-800/40`}>
          <p className="text-[11px] text-violet-700 dark:text-violet-300">
            LiquAI: Merge sort is O(n log n)…
          </p>
        </div>
      );
    case 'announcements':
      return (
        <div className={`${base} mt-4`}>
          <p className="text-[11px] font-semibold">Exam timetable released</p>
          <span className="mt-1 inline-block rounded bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
            Verified
          </span>
        </div>
      );
    case 'assignments':
      return (
        <div className={`${base} mt-4`}>
          <p className="text-[11px] font-semibold text-amber-700">Due Friday</p>
          <p className="text-[10px] text-slate-500">Lab report · Physics</p>
        </div>
      );
    case 'exams':
      return (
        <div className={`${base} mt-4`}>
          <p className="text-[11px]">Question bank · 24 items</p>
        </div>
      );
    case 'events':
      return (
        <div className={`${base} mt-4`}>
          <p className="text-[11px] font-semibold">Career fair — May 10</p>
        </div>
      );
    case 'classroom':
      return (
        <div className={`${base} mt-4 flex gap-1`}>
          {['EE', 'CSE'].map((d) => (
            <span key={d} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">
              {d}
            </span>
          ))}
        </div>
      );
    case 'notifications':
      return (
        <div className={`${base} mt-4`}>
          <p className="text-[11px]">3 new updates today</p>
        </div>
      );
    case 'integrations':
      return (
        <div className={`${base} mt-4`}>
          <p className="text-[11px] text-slate-500">Your campus systems</p>
        </div>
      );
    default:
      return (
        <div className={`${base} mt-4`}>
          <p className="text-[11px] text-slate-500">Search courses, titles…</p>
        </div>
      );
  }
}

function accentClasses(accent) {
  const map = {
    cyan: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
    violet: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    slate: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  };
  return map[accent] ?? map.cyan;
}

function BentoFeaturesSection() {
  const { reduced } = useLandingMotion();

  return (
    <section
      id="features"
      className="scroll-mt-24 px-4 py-14 md:px-6 md:py-20"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div {...fadeUp(reduced)} className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
            Platform modules
          </p>
          <h2
            id="features-heading"
            className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-50 md:text-3xl"
          >
            Everything you need, beautifully organized
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Real USH tools — calendar, library, LiquAI, events, and more.
          </p>
        </motion.div>

        <motion.div
          className="grid auto-rows-[minmax(9rem,auto)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          {...staggerContainer(reduced, 0.06)}
        >
          {LANDING_FEATURES.map((feature) => {
            const Icon = feature.icon;
            const Wrapper = feature.external ? 'a' : 'article';
            const wrapperProps = feature.external
              ? {
                  href: feature.external,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                }
              : {};

            return (
              <motion.div
                key={feature.id}
                {...staggerItem(reduced)}
                className={feature.span}
              >
                <Wrapper
                  {...wrapperProps}
                  className="panel-card group flex h-full flex-col rounded-2xl p-5 transition-shadow duration-300 hover:shadow-lg"
                >
                  <motion.div
                    {...tiltHover(reduced)}
                    className="flex h-full flex-col"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentClasses(feature.accent)}`}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <h3 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-slate-50 lg:text-lg">
                      {feature.title}
                    </h3>
                    <p className="mt-1 flex-1 text-sm text-slate-600 dark:text-slate-400">
                      {feature.description}
                    </p>
                    <FeaturePreview type={feature.preview} />
                  </motion.div>
                </Wrapper>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

export default BentoFeaturesSection;
