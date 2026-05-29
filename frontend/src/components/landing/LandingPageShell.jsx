import { useReducedMotion } from 'framer-motion';
import LandingAmbient from './LandingAmbient.jsx';
import { LenisProvider, useLenis } from './LenisContext.jsx';

function ScrollProgressBar() {
  const lenis = useLenis();
  const progressBarRef = lenis?.progressBarRef;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 bg-transparent"
      aria-hidden
    >
      <div
        ref={progressBarRef}
        className="h-full origin-left scale-x-0 bg-gradient-to-r from-cyan-600 via-cyan-400 to-violet-500 will-change-transform"
      />
    </div>
  );
}

function LandingPageShellInner({ children }) {
  return (
    <div className="landing-page relative min-h-screen bg-transparent">
      <LandingAmbient />
      <ScrollProgressBar />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

function LandingPageShell({ children }) {
  const reduced = useReducedMotion();

  return (
    <LenisProvider enabled={!reduced}>
      <LandingPageShellInner>{children}</LandingPageShellInner>
    </LenisProvider>
  );
}

export default LandingPageShell;
