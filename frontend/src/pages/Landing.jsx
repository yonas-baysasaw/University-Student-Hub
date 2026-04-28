import AccessPanelsSection from '../components/landing/AccessPanelsSection';
import CommunitySection from '../components/landing/CommunitySection';
import CoreFeaturesSection from '../components/landing/CoreFeaturesSection';
import CrossPlatformSection from '../components/landing/CrossPlatformSection';
import FinalCtaSection from '../components/landing/FinalCtaSection';
import HeroSection from '../components/landing/HeroSection';
import LandingFooter from '../components/landing/LandingFooter';
import LandingNav from '../components/landing/LandingNav';
import TechSection from '../components/landing/TechSection';

/**
 * Public academic-system homepage (guests only). Dashboard-style preview;
 * not a marketing splash page.
 */
function Landing() {
  return (
    <div className="min-h-screen bg-transparent">
      <LandingNav />
      <main>
        <HeroSection />
        <CoreFeaturesSection />
        <AccessPanelsSection />
        <CommunitySection />
        <CrossPlatformSection />
        <TechSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}

export default Landing;
