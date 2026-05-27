import { useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function useMouseParallax(strength = 12) {
  const reduced = useReducedMotion();
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (reduced) return undefined;

    const prefersCoarse =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches;
    if (prefersCoarse) return undefined;

    const handleMove = (event) => {
      const nx = (event.clientX / window.innerWidth - 0.5) * 2;
      const ny = (event.clientY / window.innerHeight - 0.5) * 2;
      setOffset({ x: nx * strength, y: ny * strength });
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMove);
  }, [reduced, strength]);

  return offset;
}
