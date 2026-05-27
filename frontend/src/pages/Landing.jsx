import CommunitySection from '../components/landing/CommunitySection';
import CoreFeaturesSection from '../components/landing/CoreFeaturesSection';
import CrossPlatformSection from '../components/landing/CrossPlatformSection';
import FinalCtaSection from '../components/landing/FinalCtaSection';
import HeroSection from '../components/landing/HeroSection';
import LandingAmbient from '../components/landing/LandingAmbient';
import LandingFooter from '../components/landing/LandingFooter';
import LandingNav from '../components/landing/LandingNav';
import ProductTourSection from '../components/landing/ProductTourSection';
import TechSection from '../components/landing/TechSection';

/**
 * Public academic-system homepage (guests only). Dashboard-style preview
 * with motion-enhanced product storytelling.
 */
function Landing() {
  return (
    <div className="landing-page relative min-h-screen bg-transparent">
      <LandingAmbient />
      <div className="relative z-[1]">
        <LandingNav />
        <main>
          <HeroSection />
          <ProductTourSection />
          <CoreFeaturesSection />
          <CommunitySection />
          <CrossPlatformSection />
          <TechSection />
          <FinalCtaSection />
        </main>
        <LandingFooter />
      </div>
    </div>
  );
}

export default Landing;
