import { motion, useReducedMotion } from 'framer-motion';

/** Unsplash preview — swap for a local campus photo: /campus/hero.jpg */
export const LANDING_CAMPUS_BG =
  'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=2400&q=80';

function LandingAmbient() {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div
        className="landing-campus-bg landing-campus-scrim pointer-events-none fixed inset-0 z-0"
        aria-hidden
      />
    );
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="landing-campus-bg absolute inset-0" />
      <div className="landing-campus-scrim absolute inset-0" />
      <div className="landing-mesh-gradient absolute inset-0 opacity-70" />

      <motion.div
        className="absolute -left-24 top-[8%] h-64 w-64 rounded-full bg-cyan-400/12 blur-3xl dark:bg-cyan-500/8"
        animate={{ x: [0, 20, 0], y: [0, -12, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-16 top-[20%] h-72 w-72 rounded-full bg-violet-400/10 blur-3xl dark:bg-violet-500/8"
        animate={{ x: [0, -16, 0], y: [0, 12, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

export default LandingAmbient;
