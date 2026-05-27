import { useReducedMotion } from 'framer-motion';
import { useCallback, useRef } from 'react';

export function useMagneticHover(strength = 0.28) {
  const reduced = useReducedMotion();
  const ref = useRef(null);

  const onMouseMove = useCallback(
    (event) => {
      if (reduced || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = event.clientX - (rect.left + rect.width / 2);
      const y = event.clientY - (rect.top + rect.height / 2);
      ref.current.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    },
    [reduced, strength],
  );

  const onMouseLeave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.transform = 'translate(0px, 0px)';
  }, []);

  return { ref, onMouseMove, onMouseLeave, disabled: reduced };
}
