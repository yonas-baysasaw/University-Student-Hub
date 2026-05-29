import { useReducedMotion } from 'framer-motion';

export const EASE_OUT = [0.22, 1, 0.36, 1];

export function useLandingMotion() {
  const reduced = useReducedMotion();
  return {
    reduced: Boolean(reduced),
    duration: reduced ? 0 : undefined,
    viewport: { once: true, amount: 0.2, margin: '-40px' },
  };
}

export function fadeUp(reduced, delay = 0) {
  if (reduced) {
    return {
      initial: { opacity: 1, y: 0 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true },
      transition: { duration: 0 },
    };
  }
  return {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2, margin: '-40px' },
    transition: { duration: 0.55, delay, ease: EASE_OUT },
  };
}

export function fadeIn(reduced, delay = 0) {
  if (reduced) {
    return {
      initial: { opacity: 1 },
      whileInView: { opacity: 1 },
      viewport: { once: true },
      transition: { duration: 0 },
    };
  }
  return {
    initial: { opacity: 0 },
    whileInView: { opacity: 1 },
    viewport: { once: true, amount: 0.25 },
    transition: { duration: 0.5, delay, ease: EASE_OUT },
  };
}

export function staggerContainer(reduced, stagger = 0.08) {
  if (reduced) {
    return {
      initial: 'show',
      whileInView: 'show',
      viewport: { once: true },
      variants: {
        show: { transition: { staggerChildren: 0 } },
      },
    };
  }
  return {
    initial: 'hidden',
    whileInView: 'show',
    viewport: { once: true, amount: 0.15 },
    variants: {
      hidden: {},
      show: { transition: { staggerChildren: stagger, delayChildren: 0.05 } },
    },
  };
}

export function staggerItem(reduced) {
  if (reduced) {
    return {
      variants: {
        hidden: { opacity: 1, y: 0 },
        show: { opacity: 1, y: 0 },
      },
    };
  }
  return {
    variants: {
      hidden: { opacity: 0, y: 22 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: EASE_OUT },
      },
    },
  };
}

export function hoverLift(reduced) {
  if (reduced) return {};
  return {
    whileHover: { y: -5, transition: { duration: 0.22, ease: EASE_OUT } },
  };
}

export function blurReveal(reduced, delay = 0) {
  if (reduced) {
    return {
      initial: { opacity: 1, y: 0, filter: 'blur(0px)' },
      animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
      transition: { duration: 0 },
    };
  }
  return {
    initial: { opacity: 0, y: 20, filter: 'blur(8px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.65, delay, ease: EASE_OUT },
  };
}

export function tiltHover(reduced) {
  if (reduced) return {};
  return {
    whileHover: {
      rotateX: -3,
      rotateY: 4,
      scale: 1.02,
      transition: { duration: 0.25, ease: EASE_OUT },
    },
    style: { transformPerspective: 900 },
  };
}
