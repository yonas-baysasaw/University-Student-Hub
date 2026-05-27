import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

const LenisContext = createContext(null);

export function LenisProvider({ children, enabled = true }) {
  const lenisRef = useRef(null);
  const progressBarRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.remove('lenis', 'lenis-smooth');
      return undefined;
    }

    document.documentElement.classList.add('lenis', 'lenis-smooth');

    const lenis = new Lenis({
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
      autoRaf: true,
    });

    lenisRef.current = lenis;

    const onScroll = ({ scroll, limit }) => {
      const bar = progressBarRef.current;
      if (!bar) return;
      const max = limit || 1;
      const progress = Math.min(1, Math.max(0, scroll / max));
      bar.style.transform = `scaleX(${progress})`;
    };
    lenis.on('scroll', onScroll);

    return () => {
      lenis.destroy();
      lenisRef.current = null;
      document.documentElement.classList.remove('lenis', 'lenis-smooth');
    };
  }, [enabled]);

  const scrollTo = useCallback(
    (target, options = {}) => {
      if (!enabled || !lenisRef.current) {
        const el =
          typeof target === 'string'
            ? document.querySelector(target)
            : target;
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      lenisRef.current.scrollTo(target, {
        offset: options.offset ?? -72,
        duration: options.duration ?? 1,
        ...options,
      });
    },
    [enabled],
  );

  const value = useMemo(
    () => ({ scrollTo, progressBarRef, enabled }),
    [scrollTo, enabled],
  );

  return (
    <LenisContext.Provider value={value}>{children}</LenisContext.Provider>
  );
}

export function useLenis() {
  return useContext(LenisContext);
}
