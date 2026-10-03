import React from 'react';
import { Building2, ShieldCheck, LayoutDashboard } from 'lucide-react';

interface HeaderProps {
  onScrollToApply: () => void;
  onViewConfirmation: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onScrollToApply, onViewConfirmation }) => {
  return (
    <header className="sticky top-0 z-50 bg-[#121212]/95 backdrop-blur-md border-b border-[#C5A059]/20 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Luxury Brand Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-10 h-10 rounded-full border border-[#C5A059] flex items-center justify-center bg-[#1C1C1C] flex-shrink-0">
            <Building2 className="w-5 h-5 text-[#C5A059]" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:space-x-3">
            <div>
              <span className="font-serif-luxury text-xl sm:text-2xl font-bold tracking-wider text-white block">
                THE CROWN
              </span>
              <span className="text-[10px] sm:text-xs tracking-[0.3em] text-[#C5A059] font-medium block uppercase">
                Penthouse Collection
              </span>
            </div>
            <span className="hidden md:inline-block text-[10px] bg-[#1C1C1C] text-[#a0a0a0] border border-[#C5A059]/30 px-2.5 py-1 rounded tracking-widest uppercase font-semibold select-none">
              Est. 2022
            </span>
          </div>
        </div>

        {/* Center / Right Quick Information & Actions */}
        <div className="flex items-center space-x-3 sm:space-x-6">
          
          {/* Direct Verification Badge */}
          <div className="hidden lg:flex items-center space-x-2 text-xs text-[#a0a0a0] bg-[#1C1C1C] px-3 py-1.5 rounded-full border border-[#C5A059]/20">
            <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
            <span>Verified Luxury Listing & Owner Portal</span>
          </div>

          {/* Apply CTA Button OR Payment Completed Badge */}
          {/* <button onClick={onScrollToApply} className="gold-gradient text-[#121212] font-semibold px-5 py-2.5 rounded text-xs sm:text-sm tracking-wider hover:opacity-95 transition-all shadow-lg hover:shadow-[#C5A059]/20 uppercase">Apply for a Residence</button> */}
          <button onClick={onViewConfirmation} className="hidden sm:inline-flex items-center gap-2 border border-[#C5A059]/30 px-4 py-2.5 text-xs text-[#C5A059] hover:border-[#C5A059] transition-colors"><LayoutDashboard className="h-4 w-4" /> Sales Dashboard</button>

        </div>
      </div>
    </header>
  );
};
