import { useState } from 'react';
import { apartmentData } from './data/apartmentData';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Highlights } from './components/Highlights';
import { TrustSection } from './components/TrustSection';
import { ApplicationFlow } from './components/ApplicationFlow';
import { TenantReviews } from './components/TenantReviews';
import { SalesDashboard } from './components/SalesDashboard';
import { ApplicantRecord } from './data/applicationStore';
import { Footer } from './components/Footer';

export function App() {
  const [activeView, setActiveView] = useState<'landing' | 'dashboard'>('landing');

  // Smooth scroll helper
  const handleScrollToApply = () => {
    if (activeView !== 'landing') {
      setActiveView('landing');
      setTimeout(() => {
        const applySection = document.getElementById('apply');
        if (applySection) {
          applySection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      const applySection = document.getElementById('apply');
      if (applySection) {
        applySection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleApplicationComplete = (_record: ApplicantRecord) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#121212] text-gray-200 flex flex-col font-sans-luxury selection:bg-[#C5A059] selection:text-[#121212]">
      
      {/* Universal Luxury Header */}
      <Header 
        onScrollToApply={handleScrollToApply}
        onViewConfirmation={() => setActiveView('dashboard')}
      />

      {/* Main View Manager */}
      <main className="flex-1">
        {activeView === 'landing' ? (
          <>
            <Hero 
              data={apartmentData}
              onScrollToApply={handleScrollToApply}
            />
            <Highlights 
              data={apartmentData}
            />
            <TrustSection 
              data={apartmentData}
            />
            <ApplicationFlow 
              data={apartmentData}
              onComplete={handleApplicationComplete}
            />
            <TenantReviews />
          </>
        ) : (
          <SalesDashboard onBack={() => setActiveView('landing')} />
        )}
      </main>

      {/* Universal Luxury Footer */}
      <Footer 
        onScrollToApply={handleScrollToApply}
        onViewConfirmation={() => setActiveView('dashboard')}
      />

    </div>
  );
}

export default App;
