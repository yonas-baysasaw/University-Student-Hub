import { motion } from 'framer-motion';
import { LANDING_TESTIMONIALS } from './data/landingTestimonials.js';
import { fadeUp, useLandingMotion } from './landingMotion.js';

function TestimonialCard({ item }) {
  return (
    <article className="landing-glass mx-3 w-[min(100vw-2rem,22rem)] shrink-0 rounded-2xl p-6 md:w-[24rem]">
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        &ldquo;{item.quote}&rdquo;
      </p>
      <div className="mt-4 border-t border-slate-200/80 pt-4 dark:border-slate-700">
        <p className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
          {item.name}
        </p>
        <p className="text-xs text-slate-500">{item.detail}</p>
      </div>
    </article>
  );
}

function TestimonialsSection() {
  const { reduced } = useLandingMotion();
  const doubled = [...LANDING_TESTIMONIALS, ...LANDING_TESTIMONIALS];

  return (
    <section
      id="stories"
      className="scroll-mt-24 overflow-hidden px-4 py-14 md:px-6 md:py-20"
      aria-labelledby="stories-heading"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div {...fadeUp(reduced)} className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">
            Student stories · Preview
          </p>
          <h2
            id="stories-heading"
            className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-50 md:text-3xl"
          >
            Built for how university students actually work
          </h2>
        </motion.div>

        {reduced ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {LANDING_TESTIMONIALS.slice(0, 4).map((item) => (
              <TestimonialCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="relative -mx-4 md:-mx-6">
            <div className="landing-marquee-track py-2">
              {doubled.map((item, i) => (
                <TestimonialCard key={`${item.id}-${i}`} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default TestimonialsSection;
