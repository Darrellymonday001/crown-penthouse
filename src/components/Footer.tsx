import React from 'react';
import { Building2, ShieldCheck, Lock, ExternalLink, LayoutDashboard } from 'lucide-react';

interface FooterProps {
  onScrollToApply: () => void;
  onViewConfirmation: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onScrollToApply, onViewConfirmation }) => {
  return (
    <footer className="bg-[#0F0F0F] border-t border-[#C5A059]/20 pt-16 pb-12 text-[#a0a0a0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
          
          {/* Brand Info */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="w-10 h-10 rounded-full border border-[#C5A059] flex items-center justify-center bg-[#1C1C1C]">
                <Building2 className="w-5 h-5 text-[#C5A059]" />
              </div>
              <div>
                <span className="font-serif-luxury text-xl font-bold tracking-wider text-white block">
                  THE CROWN
                </span>
                <span className="text-[10px] tracking-[0.3em] text-[#C5A059] font-medium block uppercase">
                  Penthouse Collection
                </span>
              </div>
            </div>
            <p className="text-xs text-[#8c8c8c] leading-relaxed font-light">
              Representing New York's most extraordinary unlisted and private full-floor penthouse rental assets. Directly managed by the ownership trust with no external brokerage loading fees.
            </p>
            <div className="inline-flex items-center space-x-2 bg-[#1C1C1C] border border-[#C5A059]/20 px-3 py-1.5 rounded text-xs text-[#C5A059] font-medium tracking-wider uppercase select-none">
              <span>Established 2022</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="font-serif-luxury text-sm font-semibold text-white tracking-wider uppercase border-b border-gray-800 pb-2">
              Application & Policies
            </h4>
            <ul className="space-y-3 text-xs">
              <li>
                <button onClick={onScrollToApply} className="hover:text-[#C5A059] transition-colors inline-flex items-center space-x-1.5 font-medium text-white"><span>Apply for a Residence</span><ExternalLink className="w-3 h-3 text-[#C5A059]" /></button>
              </li>
              <li>
                <button onClick={onViewConfirmation} className="hover:text-[#C5A059] transition-colors inline-flex items-center space-x-1.5 font-medium text-white"><LayoutDashboard className="h-4 w-4 text-[#C5A059]" /><span>Open Sales Dashboard</span></button>
              </li>
              <li>
                <p className="text-gray-300 leading-snug">
                  Your private application is reviewed by the Crown sales team before any payment instruction is issued.
                </p>
              </li>
              <li>
                <span className="text-gray-400 block pt-1 leading-relaxed">
                  <strong>Screening Policy:</strong> Application fees cover external background check and financial risk assessment reports. Non-refundable upon authorization.
                </span>
              </li>
            </ul>
          </div>

          {/* Trust Signals */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="font-serif-luxury text-sm font-semibold text-white tracking-wider uppercase border-b border-gray-800 pb-2">
              White-Glove Verification
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-gray-300">
                <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
                <span>Verified Studio Cetra Architectural Asset</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300">
                <Lock className="w-4 h-4 text-[#C5A059]" />
                <span>Verified payment instructions only</span>
              </div>
              <p className="text-[#7c7c7c] pt-1 leading-normal">
                Need immediate private motor court access or physical preview clearance? Direct messaging is unlocked immediately upon application queue registration.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6c6c6c]">
          <p>© 2022 The Crown Penthouse Collection LLC</p>
          <div className="flex space-x-6">
            <span className="hover:text-gray-400 cursor-pointer" onClick={() => alert("Privacy Policy: Your credentials are fully protected and never sold to third parties.")}>Privacy Policy</span>
            <span className="hover:text-gray-400 cursor-pointer" onClick={() => alert("Terms of Application: The $80 application fee is processed through secure NOWPayments checkout.")}>Terms of Application</span>
            <span className="hover:text-gray-400 cursor-pointer" onClick={() => alert("Fair Housing Act Compliance: Equal Housing Opportunity Provider.")}>Equal Housing Opportunity</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
