import { lazy, Suspense } from 'react';
import HeroSection from '../components/landing/HeroSection';
import LandingFooter from '../components/landing/LandingFooter';
import LandingNav from '../components/landing/LandingNav';
import LandingPageShell from '../components/landing/LandingPageShell';

const ProductTourSection = lazy(
  () => import('../components/landing/ProductTourSection'),
);
const BentoFeaturesSection = lazy(
  () => import('../components/landing/BentoFeaturesSection'),
);
const CalendarShowcaseSection = lazy(
  () => import('../components/landing/CalendarShowcaseSection'),
);
const CommunitySection = lazy(
  () => import('../components/landing/CommunitySection'),
);
const MobileExperienceSection = lazy(
  () => import('../components/landing/MobileExperienceSection'),
);
const TestimonialsSection = lazy(
  () => import('../components/landing/TestimonialsSection'),
);
const TrustStripSection = lazy(
  () => import('../components/landing/TrustStripSection'),
);
const FinalCtaSection = lazy(
  () => import('../components/landing/FinalCtaSection'),
);

function SectionFallback() {
  return <div className="min-h-[8rem]" aria-hidden />;
}

/**
 * Public academic-system homepage (guests only). Cinematic product storytelling
 * with Lenis smooth scroll, parallax hero, and modular feature sections.
 */
function Landing() {
  return (
    <LandingPageShell>
      <LandingNav />
      <main>
        <HeroSection />
        <Suspense fallback={<SectionFallback />}>
          <ProductTourSection />
          <BentoFeaturesSection />
          <CalendarShowcaseSection />
          <CommunitySection />
          <MobileExperienceSection />
          <TestimonialsSection />
          <TrustStripSection />
          <FinalCtaSection />
        </Suspense>
      </main>
      <LandingFooter />
    </LandingPageShell>
  );
}

export default Landing;
