import { motion, useReducedMotion } from 'framer-motion';

function LandingAmbient() {
  const reduced = useReducedMotion();

  if (reduced) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <motion.div
        className="absolute -left-24 top-[8%] h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/10"
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-16 top-[22%] h-80 w-80 rounded-full bg-violet-400/15 blur-3xl dark:bg-violet-500/10"
        animate={{ x: [0, -24, 0], y: [0, 18, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[12%] left-[35%] h-56 w-56 rounded-full bg-sky-300/15 blur-3xl dark:bg-sky-600/10"
        animate={{ x: [0, 20, 0], y: [0, -14, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="workspace-hero-mesh absolute inset-0 opacity-60" />
    </div>
  );
}

export default LandingAmbient;
