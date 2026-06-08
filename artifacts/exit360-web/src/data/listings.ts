export interface Listing {
  id: string;
  businessName: string;
  category: string;
  subcategory: string;
  state: string;
  suburb: string;
  askingPrice: number;
  weeklyRevenue: number;
  adjustedProfit: number;
  rent: number;
  leaseExpiry: string;
  staffCount: number;
  ownerHours: number;
  verified: boolean;
  badges: string[];
  hasTour: boolean;
  confidential: boolean;
  heroColor: string;
  description: string;
  imageUrl?: string;
  savedCount: number;
  viewCount: number;
  tourStarts: number;
}

export const DEMO_LISTINGS: Listing[] = [
  {
    id: "listing-cafe-001",
    businessName: "The Daily Press Espresso Bar",
    category: "Food & Beverage",
    subcategory: "Cafe",
    state: "VIC",
    suburb: "Fitzroy",
    askingPrice: 185000,
    weeklyRevenue: 18500,
    adjustedProfit: 72000,
    rent: 4200,
    leaseExpiry: "2027-06-30",
    staffCount: 4,
    ownerHours: 45,
    verified: true,
    badges: ["identity", "abn", "financials", "lease", "tour"],
    hasTour: true,
    confidential: false,
    heroColor: "#7C4A1E",
    imageUrl: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=800",
    description:
      "Established espresso bar in the heart of Fitzroy. Strong loyal customer base, premium equipment, and a proven revenue model. Turnkey operation with trained staff in place.",
    savedCount: 47,
    viewCount: 312,
    tourStarts: 89,
  },
  {
    id: "listing-salon-001",
    businessName: "Luxe & Co Hair Studio",
    category: "Health & Beauty",
    subcategory: "Hair Salon",
    state: "NSW",
    suburb: "Surry Hills",
    askingPrice: 95000,
    weeklyRevenue: 9800,
    adjustedProfit: 52000,
    rent: 3100,
    leaseExpiry: "2026-12-31",
    staffCount: 3,
    ownerHours: 40,
    verified: true,
    badges: ["identity", "abn", "financials", "tour"],
    hasTour: true,
    confidential: false,
    heroColor: "#8B5CF6",
    imageUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=800",
    description:
      "Premium hair studio with 3 styling chairs and a loyal client base of 400+ regulars. Designer fit-out with $40K investment. Turnkey including all products and software.",
    savedCount: 28,
    viewCount: 187,
    tourStarts: 45,
  },
  {
    id: "listing-laundromat-001",
    businessName: "SpinCity Laundromat",
    category: "Services",
    subcategory: "Laundromat",
    state: "QLD",
    suburb: "West End",
    askingPrice: 145000,
    weeklyRevenue: 6200,
    adjustedProfit: 68000,
    rent: 2800,
    leaseExpiry: "2028-03-31",
    staffCount: 1,
    ownerHours: 15,
    verified: true,
    badges: ["identity", "abn", "financials", "lease", "equipment"],
    hasTour: false,
    confidential: false,
    heroColor: "#0EA5E9",
    imageUrl: "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&q=80&w=800",
    description:
      "Highly automated coin-operated laundromat running with 15 owner hours per week. Strong passive income with 5-year lease secured. 22 washers, 16 dryers — all commercial grade.",
    savedCount: 61,
    viewCount: 445,
    tourStarts: 12,
  },
  {
    id: "listing-gym-001",
    businessName: "Iron Republic Gym",
    category: "Health & Fitness",
    subcategory: "Gym",
    state: "VIC",
    suburb: "Richmond",
    askingPrice: 320000,
    weeklyRevenue: 22000,
    adjustedProfit: 98000,
    rent: 7500,
    leaseExpiry: "2029-01-31",
    staffCount: 8,
    ownerHours: 50,
    verified: true,
    badges: ["identity", "abn", "financials", "lease", "equipment", "tour", "accountant"],
    hasTour: true,
    confidential: true,
    heroColor: "#1E3A5C",
    imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800",
    description:
      "Established premium gym with 800+ active members. 450sqm state-of-the-art facility with $180K equipment. Strong PT revenue stream and growing corporate accounts.",
    savedCount: 93,
    viewCount: 678,
    tourStarts: 201,
  },
  {
    id: "listing-restaurant-001",
    businessName: "Ember & Stone Restaurant",
    category: "Food & Beverage",
    subcategory: "Restaurant",
    state: "NSW",
    suburb: "Newtown",
    askingPrice: 250000,
    weeklyRevenue: 28000,
    adjustedProfit: 115000,
    rent: 9500,
    leaseExpiry: "2027-09-30",
    staffCount: 12,
    ownerHours: 60,
    verified: true,
    badges: ["identity", "abn", "financials", "lease"],
    hasTour: false,
    confidential: true,
    heroColor: "#92400E",
    imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800",
    description:
      "Award-winning contemporary Australian restaurant. 80-cover dining room, full commercial kitchen, liquor licence. Rated in The Age Good Food Guide 2023.",
    savedCount: 54,
    viewCount: 389,
    tourStarts: 28,
  },
];

export function formatPrice(price: number): string {
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  return `$${(price / 1000).toFixed(0)}K`;
}

export function formatRevenue(weekly: number): string {
  const annual = weekly * 52;
  if (annual >= 1000000) return `$${(annual / 1000000).toFixed(1)}M p.a.`;
  return `$${(annual / 1000).toFixed(0)}K p.a.`;
}

export const BADGE_LABELS: Record<string, string> = {
  identity: "ID Verified",
  abn: "ABN Verified",
  financials: "Financials",
  lease: "Lease Docs",
  equipment: "Equipment List",
  tour: "360 Tour",
  broker: "Broker Listed",
  accountant: "Accountant Verified",
};
