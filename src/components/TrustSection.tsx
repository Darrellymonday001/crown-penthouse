import React from 'react';
import { ApartmentData } from '../data/apartmentData';
import { ShieldCheck, Lock, Star, CheckCircle2 } from 'lucide-react';

interface TrustSectionProps {
  data: ApartmentData;
}

export const TrustSection: React.FC<TrustSectionProps> = ({ data }) => {
  return (
    <section className="bg-[#0F0F0F] py-16 border-b border-[#C5A059]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Trust Badges Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          
          <div className="bg-[#1C1C1C] border border-[#C5A059]/20 rounded-xl p-6 flex items-start space-x-4 shadow-md">
            <div className="w-12 h-12 rounded-lg bg-[#121212] border border-[#C5A059]/30 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-[#C5A059]" />
            </div>
            <div>
              <h4 className="font-serif-luxury text-base font-semibold text-white mb-1">
                Direct Verified Ownership
              </h4>
              <p className="text-xs text-[#909090] leading-relaxed">
                Listing verified directly by the ownership trust. No secondary broker fees or unverified intermediaries.
              </p>
            </div>
          </div>

          <div className="bg-[#1C1C1C] border border-[#C5A059]/20 rounded-xl p-6 flex items-start space-x-4 shadow-md">
            <div className="w-12 h-12 rounded-lg bg-[#121212] border border-[#C5A059]/30 flex items-center justify-center flex-shrink-0">
              <Lock className="w-6 h-6 text-[#C5A059]" />
            </div>
            <div>
              <h4 className="font-serif-luxury text-base font-semibold text-white mb-1">
                Secure Crypto Checkout
              </h4>
              <p className="text-xs text-[#909090] leading-relaxed">
                Hosted checkout through NOWPayments with signed payment notifications and server-side transaction confirmation.
              </p>
            </div>
          </div>

          <div className="bg-[#1C1C1C] border border-[#C5A059]/20 rounded-xl p-6 flex items-start space-x-4 shadow-md">
            <div className="w-12 h-12 rounded-lg bg-[#121212] border border-[#C5A059]/30 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-[#C5A059]" />
            </div>
            <div>
              <h4 className="font-serif-luxury text-base font-semibold text-white mb-1">
                Fair Credit Screening
              </h4>
              <p className="text-xs text-[#909090] leading-relaxed">
                The $80 application fee is confirmed by the payment provider before the tenant portal is unlocked.
              </p>
            </div>
          </div>

        </div>

        {/* Testimonials */}
        <div className="space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs text-[#C5A059] uppercase tracking-[0.2em] font-medium block">
              Testimonials & Resident Feedback
            </span>
            <h2 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Words From Past Elite Residents
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {data.testimonials.map((testi, idx) => (
              <div 
                key={idx}
                className="bg-[#1C1C1C] border border-[#C5A059]/20 rounded-xl p-8 relative shadow-xl flex flex-col justify-between"
              >
                <div>
                  {/* Stars */}
                  <div className="flex items-center space-x-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-[#C5A059] text-[#C5A059]" />
                    ))}
                  </div>

                  <p className="text-[#d0d0d0] text-sm sm:text-base leading-relaxed italic mb-6">
                    "{testi.quote}"
                  </p>
                </div>

                <div className="pt-4 border-t border-[#C5A059]/10 flex items-center justify-between">
                  <div>
                    <h5 className="font-serif-luxury font-bold text-white">{testi.author}</h5>
                    <span className="text-xs text-[#8c8c8c]">{testi.role}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-[#C5A059] bg-[#121212] px-2.5 py-1 rounded-full border border-[#C5A059]/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified Resident</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
