import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { EASE_OUT, fadeUp, useLandingMotion } from './landingMotion.js';

function FinalCtaSection() {
  const { reduced } = useLandingMotion();
  const prefersReduced = useReducedMotion();

  return (
    <section
      id="cta"
      className="relative scroll-mt-24 overflow-hidden px-4 py-14 md:px-6 md:py-20"
      aria-labelledby="cta-heading"
    >
      {!prefersReduced ? (
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-48 max-w-lg -translate-y-1/2 rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-500/10"
          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
      ) : null}
      <motion.div
        {...fadeUp(reduced)}
        className="relative z-[1] mx-auto max-w-3xl text-center"
      >
        <h2
          id="cta-heading"
          className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 md:text-3xl"
        >
          Start Using the University Student Hub Today
        </h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Register for a new account or sign in if you already have access.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <motion.div
            whileHover={reduced ? undefined : { scale: 1.04 }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <Link
              to="/signup"
              className="btn-primary min-w-[9rem] px-8 py-3 text-sm font-semibold shadow-lg shadow-cyan-900/10"
            >
              Register
            </Link>
          </motion.div>
          <motion.div
            whileHover={reduced ? undefined : { scale: 1.04 }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <Link
              to="/login"
              className="btn-secondary min-w-[9rem] px-8 py-3 text-sm font-semibold"
            >
              Login
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

export default FinalCtaSection;
