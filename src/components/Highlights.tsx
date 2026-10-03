import React from 'react';
import { ApartmentData } from '../data/apartmentData';
import { Key, Shield, Utensils, Sun, Sliders, Car, Check, Info } from 'lucide-react';

interface HighlightsProps {
  data: ApartmentData;
}

export const Highlights: React.FC<HighlightsProps> = ({ data }) => {
  // Helper to resolve icon dynamically
  const renderIcon = (iconName: string) => {
    const className = "w-6 h-6 text-[#C5A059]";
    switch (iconName) {
      case 'key': return <Key className={className} />;
      case 'shield': return <Shield className={className} />;
      case 'utensils': return <Utensils className={className} />;
      case 'sun': return <Sun className={className} />;
      case 'sliders': return <Sliders className={className} />;
      case 'car': return <Car className={className} />;
      default: return <Check className={className} />;
    }
  };

  return (
    <section className="bg-[#121212] py-16 border-b border-[#C5A059]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Two column detail layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-16">
          
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <span className="text-xs text-[#C5A059] uppercase tracking-[0.2em] font-medium block">
                Residence Overview
              </span>
              <h2 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-white tracking-tight">
                An Architectural Masterpiece in SoHo
              </h2>
            </div>
            
            <p className="text-[#d0d0d0] text-base sm:text-lg leading-relaxed font-sans-luxury font-light">
              {data.description}
            </p>

            <div className="bg-[#1C1C1C] border-l-4 border-[#C5A059] p-6 rounded-r-lg shadow-md space-y-3">
              <div className="flex items-center space-x-2 text-[#C5A059] font-medium text-sm">
                <Info className="w-4 h-4" />
                <span>Application & Tenancy Fast-Track</span>
              </div>
              <p className="text-sm text-[#a0a0a0] leading-normal">
                Because this property is offered directly by the ownership group, prospective applicants bypass standard broker commission fees. The $80 application fee is processed through secure hosted checkout.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#1C1C1C] border border-[#C5A059]/20 rounded-xl p-6 sm:p-8 shadow-xl space-y-6">
            <h3 className="font-serif-luxury text-xl sm:text-2xl font-semibold text-white border-b border-[#C5A059]/20 pb-4">
              Premium Property Specifications
            </h3>

            <ul className="space-y-4 text-sm sm:text-base">
              <li className="flex justify-between items-center py-2 border-b border-gray-800">
                <span className="text-[#8c8c8c]">Location / Neighborhood</span>
                <span className="font-medium text-white">SoHo Historic District</span>
              </li>
              <li className="flex justify-between items-center py-2 border-b border-gray-800">
                <span className="text-[#8c8c8c]">Building Type</span>
                <span className="font-medium text-white">Full-Floor Penthouse</span>
              </li>
              <li className="flex justify-between items-center py-2 border-b border-gray-800">
                <span className="text-[#8c8c8c]">Pet Policy</span>
                <span className="font-medium text-[#C5A059]">{data.specs.petPolicy}</span>
              </li>
              <li className="flex justify-between items-center py-2 border-b border-gray-800">
                <span className="text-[#8c8c8c]">Private Motor Court</span>
                <span className="font-medium text-white">{data.specs.parking}</span>
              </li>
              <li className="flex justify-between items-center py-2 border-b border-gray-800">
                <span className="text-[#8c8c8c]">Pre-wired Automation</span>
                <span className="font-medium text-white">Savant / Lutron Palladiom</span>
              </li>
              <li className="flex justify-between items-center py-2">
                <span className="text-[#8c8c8c]">Ceiling Height</span>
                <span className="font-medium text-white">14 Feet (Coffered)</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Amenities Section */}
        <div className="space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs text-[#C5A059] uppercase tracking-[0.2em] font-medium block">
              Legendary Comfort & Finishes
            </span>
            <h2 className="font-serif-luxury text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Curated Residence Amenities
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.amenities.map((amenity, idx) => (
              <div 
                key={idx} 
                className="bg-[#1C1C1C] border border-[#C5A059]/15 rounded-xl p-6 hover:border-[#C5A059]/40 transition-all duration-300 hover:-translate-y-1 shadow-lg group"
              >
                <div className="w-12 h-12 rounded-lg bg-[#121212] border border-[#C5A059]/30 flex items-center justify-center mb-5 group-hover:bg-[#C5A059]/10 transition-colors">
                  {renderIcon(amenity.icon)}
                </div>
                <h4 className="font-serif-luxury text-lg font-semibold text-white mb-2 group-hover:text-[#C5A059] transition-colors">
                  {amenity.name}
                </h4>
                <p className="text-sm text-[#909090] leading-relaxed font-light">
                  {amenity.description}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
