import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useMagneticHover } from './hooks/useMagneticHover.js';
import { EASE_OUT, fadeUp, useLandingMotion } from './landingMotion.js';

function MagneticButton({ to, className, children }) {
  const { ref, onMouseMove, onMouseLeave } = useMagneticHover(0.25);

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="inline-block will-change-transform"
    >
      <Link to={to} className={className}>
        {children}
      </Link>
    </div>
  );
}

function FinalCtaSection() {
  const { reduced } = useLandingMotion();
  const prefersReduced = useReducedMotion();

  return (
    <section
      id="join"
      className="relative scroll-mt-24 overflow-hidden px-4 py-16 md:px-6 md:py-24"
      aria-labelledby="cta-heading"
    >
      {!prefersReduced ? (
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-56 max-w-2xl -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-400/20 via-cyan-500/15 to-violet-500/20 blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
      ) : null}
      <motion.div
        {...fadeUp(reduced)}
        className="relative z-[1] mx-auto max-w-3xl text-center"
      >
        <h2
          id="cta-heading"
          className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 md:text-4xl"
        >
          Ready to run your campus life from one hub?
        </h2>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 md:text-base">
          Join USH today — register for a new account or sign in if you already
          have access.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <MagneticButton
            to="/signup"
            className="btn-primary min-w-[10rem] px-8 py-3.5 text-sm font-semibold shadow-xl shadow-cyan-900/15"
          >
            Register free
          </MagneticButton>
          <motion.div
            whileHover={reduced ? undefined : { scale: 1.04 }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <Link
              to="/login"
              className="btn-secondary min-w-[10rem] px-8 py-3.5 text-sm font-semibold"
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
