export interface ApartmentData {
  title: string;
  tagline: string;
  price: string;
  applicationFee: number;
  address: string;
  specs: {
    beds: number;
    baths: number;
    sqft: number;
    availability: string;
    petPolicy: string;
    parking: string;
  };
  description: string;
  images: { url: string; caption: string }[];
  amenities: { name: string; description: string; icon: string }[];
  testimonials: { quote: string; author: string; role: string; verified: boolean }[];
}

export const apartmentData: ApartmentData = {
  title: "The Crown Penthouse at 50 Sullivan",
  tagline: "Unparalleled Panoramic Views & Extraordinary Bespoke Finishes",
  price: "$1,890/month",
  applicationFee: 5,
  address: "50 Sullivan Street, Penthouse A, SoHo, New York, NY 10012",
  specs: {
    beds: 3,
    baths: 3.5,
    sqft: 3420,
    availability: "Immediate / Flexible",
    petPolicy: "Pets Allowed (Case by Case)",
    parking: "2 Private Underground Spaces Included",
  },
  description: 
    "Spanning over 3,400 square feet of magnificent interior living space, The Crown Penthouse offers an elite standard of living in the historic heart of SoHo. Designed by award-winning architectural firm Studio Cetra, this full-floor residence features soaring 14-foot coffered ceilings, direct key-locked elevator access, private wraparound terraces, and floor-to-ceiling glass wrapping the entire grand salon with unobstructed iconic skyline views.",
  images: [
    {
      url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80",
      caption: "Grand Salon & Expansive Living Room"
    },
    {
      url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
      caption: "Bespoke Chef's Kitchen with Marble Island"
    },
    {
      url: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1600&q=80",
      caption: "Master Suite with Floor-to-Ceiling Skyline Windows"
    },
    {
      url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1600&q=80",
      caption: "Spa-Inspired En-Suite Bath with Soaking Tub"
    },
    {
      url: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=80",
      caption: "Private Wraparound Landscaped Terrace"
    }
  ],
  amenities: [
    {
      name: "Private Keyed Elevator",
      description: "Direct secure access opens straight into your private gallery foyer.",
      icon: "key"
    },
    {
      name: "White-Glove Concierge",
      description: "24/7 dedicated door attendant, package reception, and valet dry cleaning.",
      icon: "shield"
    },
    {
      name: "Chef-Grade Sub-Zero Kitchen",
      description: "Dual wine climate towers, double Wolf ovens, and custom Italian walnut cabinetry.",
      icon: "utensils"
    },
    {
      name: "Wraparound Private Terrace",
      description: "Over 1,200 sq ft of outdoor entertaining space with an automated irrigation system.",
      icon: "sun"
    },
    {
      name: "Smart Home & Acoustic Comfort",
      description: "Pre-wired Savant automation system, automated motorized shades, and multi-zone climate.",
      icon: "sliders"
    },
    {
      name: "Private Secure Motor Court",
      description: "Direct entry parking structure with EV fast-charging stations included.",
      icon: "car"
    }
  ],
  testimonials: [
    {
      quote: "The application process was incredibly smooth and transparent. Payment confirmation was automatic, and the sales team kept us informed throughout. The residence looks even more spectacular in person than in the pictures.",
      author: "Marcus Vance",
      role: "Global FinTech Managing Director",
      verified: true
    },
    {
      quote: "As someone who values total privacy and white-glove security, 50 Sullivan exceeded all expectations. The building management is hyper-responsive and respectful of elite professional lifestyles.",
      author: "Elena Rostova",
      role: "Art Gallery Owner & Curator",
      verified: true
    }
  ]
};
