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
  isRealListing?: boolean;
  /** If set, shown as "Valuation Est." instead of asking price in the sidebar */
  valuationRange?: string;
  /** If set, overrides API-derived annual revenue display */
  fixedAnnualRevenue?: number;
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

// Listings are now fully data-driven — fetched live from the API
// (`/api/public/listings`) via `@/lib/listingsApi`. No hardcoded catalog.

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
