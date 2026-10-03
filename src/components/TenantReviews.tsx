import React from 'react';
import { Star, CheckCircle2, Calendar } from 'lucide-react';

interface Review {
  name: string;
  stayed: string;
  rating: number;
  text: string;
  highlight: string;
}

export const TenantReviews: React.FC = () => {
  const reviews: Review[] = [
    {
      name: "Marcus Vance",
      stayed: "2022-2023",
      rating: 5,
      highlight: "Phenomenal SoHo Location & Elite Management",
      text: "Living at The Crown was an absolute masterclass in luxury. The full-floor layout gave us total privacy, and the location right in the historic district made walking to our favorite dinner spots incredibly convenient. Whenever we needed assistance, the building management was remarkably responsive and attentive."
    },
    {
      name: "Sophia L.",
      stayed: "2023-2024",
      rating: 5,
      highlight: "Unmatched Luxury & Impeccable Maintenance",
      text: "The bespoke finishes and the chef's kitchen exceeded all expectations. We frequently hosted private dinners, and our guests were always blown away by the 14-foot coffered ceilings and skyline views. Maintenance was completely seamless and always handled with the utmost discretion."
    },
    {
      name: "James K.",
      stayed: "2024-2025",
      rating: 5,
      highlight: "White-Glove Security & Total Peace of Mind",
      text: "As someone who travels extensively for business, having the private keyed elevator and secure motor court was a game-changer. I never had to worry about security or package deliveries. It felt like living in a private five-star boutique hotel."
    },
    {
      name: "David & Elena R.",
      stayed: "2025-2026",
      rating: 5,
      highlight: "Top-Tier Smart Home & Modern Convenience",
      text: "We just wrapped up our lease here, and the smart home integration made everyday living effortless. Controlling the motorized shades, lighting, and climate from our phones was incredibly convenient. It's rare to find an apartment with such historic charm that also features top-tier modern amenities."
    }
  ];

  return (
    <section className="bg-[#0F0F0F] py-20 border-b border-[#C5A059]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
          <div className="inline-flex items-center space-x-2 bg-[#1C1C1C] border border-[#C5A059]/30 px-4 py-1.5 rounded-full text-xs text-[#C5A059] font-semibold tracking-widest uppercase shadow-md">
            <span>Verified Resident History • Established 2022</span>
          </div>
          <h2 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Past Resident Testimonials
          </h2>
          <p className="text-[#a0a0a0] text-sm sm:text-base">
            Read authentic feedback from past tenants who have called our penthouse collection home over the years.
          </p>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {reviews.map((review, idx) => (
            <div 
              key={idx}
              className="bg-[#1C1C1C] border border-[#C5A059]/20 rounded-2xl p-8 relative shadow-xl flex flex-col justify-between hover:border-[#C5A059]/40 transition-all duration-300 group"
            >
              <div>
                {/* Top Row: Stars and Dates */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div className="flex items-center space-x-1">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-[#C5A059] text-[#C5A059]" />
                    ))}
                  </div>
                  <div className="flex items-center space-x-1.5 text-xs text-[#a0a0a0] bg-[#121212] px-3 py-1 rounded-full border border-gray-800">
                    <Calendar className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>Stayed: <strong className="text-white">{review.stayed}</strong></span>
                  </div>
                </div>

                {/* Highlight Title */}
                <h4 className="font-serif-luxury text-lg font-bold text-white mb-3 group-hover:text-[#C5A059] transition-colors">
                  "{review.highlight}"
                </h4>

                {/* Body Text */}
                <p className="text-[#d0d0d0] text-sm sm:text-base leading-relaxed font-light mb-8">
                  {review.text}
                </p>
              </div>

              {/* Bottom Author Row */}
              <div className="pt-4 border-t border-gray-800 flex items-center justify-between">
                <div>
                  <h5 className="font-serif-luxury font-bold text-white text-base">{review.name}</h5>
                </div>
                <div className="flex items-center space-x-1.5 text-xs text-[#C5A059] bg-[#121212] px-3 py-1.5 rounded-full border border-[#C5A059]/30 shadow">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="font-medium">Verified Tenant</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
