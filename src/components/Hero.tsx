import React, { useState } from 'react';
import { ApartmentData } from '../data/apartmentData';
import { MapPin, Bed, Bath, Expand, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react';

interface HeroProps {
  data: ApartmentData;
  onScrollToApply: () => void;
}

export const Hero: React.FC<HeroProps> = ({ data, onScrollToApply }) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const currentImage = data.images[activeImageIndex];

  return (
    <section className="relative bg-[#121212] pt-8 pb-16 border-b border-[#C5A059]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Headline Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center space-x-2 text-xs text-[#C5A059] uppercase tracking-[0.2em] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse"></span>
              <span>Exclusive Direct Rental Offering</span>
            </div>
            <h1 className="font-serif-luxury text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.15]">
              {data.title}
            </h1>
            <p className="flex items-center text-sm sm:text-base text-[#a0a0a0] mt-2">
              <MapPin className="w-4 h-4 text-[#C5A059] mr-2 flex-shrink-0" />
              {data.address}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-4 bg-[#1C1C1C] p-6 rounded-lg border border-[#C5A059]/20 shadow-xl">
            <div>
              <span className="text-xs text-[#8c8c8c] uppercase tracking-wider block lg:text-right">MONTHLY RENT</span>
              <span className="font-serif-luxury text-2xl sm:text-4xl font-bold text-[#C5A059]">{data.price}</span>
            </div>
            
            <button
              onClick={onScrollToApply}
              className="w-full sm:w-auto gold-gradient text-[#121212] font-bold px-8 py-3.5 rounded text-sm tracking-wider hover:opacity-95 transition-all shadow-lg shadow-[#C5A059]/10 uppercase flex items-center justify-center space-x-3 active:scale-98"
            >
              <span>SUBMIT APPLICATION ($80)</span>
              <ArrowRight className="w-4 h-4 text-[#121212]" />
            </button>
          </div>
        </div>

        {/* Gallery Interactive Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-10">
          
          {/* Main Large Display */}
          <div className="lg:col-span-8 bg-[#1C1C1C] rounded-xl overflow-hidden relative aspect-[16/10] sm:aspect-[16/9] shadow-2xl border border-[#C5A059]/10 group">
            <img 
              src={currentImage.url} 
              alt={currentImage.caption} 
              className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-102" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent opacity-80"></div>
            
            <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs text-[#C5A059] uppercase tracking-widest font-semibold block mb-1">
                  Residence View {activeImageIndex + 1} of {data.images.length}
                </span>
                <p className="font-serif-luxury text-lg sm:text-2xl text-white font-medium">
                  {currentImage.caption}
                </p>
              </div>
              <div className="bg-[#121212]/80 backdrop-blur-sm border border-[#C5A059]/30 px-3 py-1.5 rounded text-xs text-gray-200 flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>True Representation</span>
              </div>
            </div>
          </div>

          {/* Thumbnails Selector */}
          <div className="lg:col-span-4 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto max-h-[600px] pb-2 lg:pb-0">
            {data.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`flex-shrink-0 w-36 lg:w-full h-24 lg:h-28 rounded-lg overflow-hidden relative border-2 transition-all text-left group ${
                  activeImageIndex === idx 
                    ? 'border-[#C5A059] shadow-lg shadow-[#C5A059]/20' 
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img.url} alt={img.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className={`absolute inset-0 bg-[#121212] transition-opacity ${activeImageIndex === idx ? 'opacity-20' : 'opacity-50 group-hover:opacity-30'}`}></div>
                <div className="absolute bottom-2 left-2 right-2 hidden lg:block">
                  <p className="text-[11px] font-medium text-white truncate drop-shadow-md">
                    {img.caption}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* High-level Quick Specs Banner */}
        <div className="bg-[#1C1C1C] border border-[#C5A059]/20 rounded-xl p-6 sm:p-8 shadow-xl">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y sm:divide-y-0 sm:divide-x divide-[#C5A059]/10">
            
            <div className="pt-4 sm:pt-0 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-[#121212] border border-[#C5A059]/40 flex items-center justify-center mb-3">
                <Bed className="w-5 h-5 text-[#C5A059]" />
              </div>
              <span className="text-2xl sm:text-3xl font-bold font-serif-luxury text-white">{data.specs.beds}</span>
              <span className="text-xs text-[#a0a0a0] uppercase tracking-widest mt-1">Bedrooms</span>
            </div>

            <div className="pt-4 sm:pt-0 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-[#121212] border border-[#C5A059]/40 flex items-center justify-center mb-3">
                <Bath className="w-5 h-5 text-[#C5A059]" />
              </div>
              <span className="text-2xl sm:text-3xl font-bold font-serif-luxury text-white">{data.specs.baths}</span>
              <span className="text-xs text-[#a0a0a0] uppercase tracking-widest mt-1">Bathrooms</span>
            </div>

            <div className="pt-4 sm:pt-0 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-[#121212] border border-[#C5A059]/40 flex items-center justify-center mb-3">
                <Expand className="w-5 h-5 text-[#C5A059]" />
              </div>
              <span className="text-2xl sm:text-3xl font-bold font-serif-luxury text-white">{data.specs.sqft.toLocaleString()}</span>
              <span className="text-xs text-[#a0a0a0] uppercase tracking-widest mt-1">Interior Sq Ft</span>
            </div>

            <div className="pt-4 sm:pt-0 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-[#121212] border border-[#C5A059]/40 flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5 text-[#C5A059]" />
              </div>
              <span className="text-xl sm:text-2xl font-bold font-serif-luxury text-white">{data.specs.availability}</span>
              <span className="text-xs text-[#a0a0a0] uppercase tracking-widest mt-1">Move-in Availability</span>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
