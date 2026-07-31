/** Which figure a seller chose to surface in a stat slot (mirrors the mobile app). */
export type StatSlotOption =
  | "none"
  | "sde"
  | "staffCount"
  | "weeklyRevenue"
  | "rent"
  | "ownerHours"
  | "leaseExpiry";

/** How the seller wants the headline price slot rendered (mirrors the mobile app). */
export type PriceDisplayOption = "askingPrice" | "weeklyRevenue" | "poa";

export interface Listing {
  id: string;
  businessName: string;
  category: string;
  subcategory: string;
  state: string;
  suburb: string;
  askingPrice: number;
  /** Optional From/To asking-price range. When both are set the card shows a range. */
  askingPriceMin?: number;
  askingPriceMax?: number;
  weeklyRevenue: number;
  adjustedProfit: number;
  /** Seller's chosen display config, mirrored from the app's listing card. */
  priceDisplay?: PriceDisplayOption;
  stat2Display?: StatSlotOption;
  stat3Display?: StatSlotOption;
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

/** Compact currency for stat slots, e.g. 558000 → "$558K", 2100000 → "$2.1M". */
export function formatMoney(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
}

export interface Stat {
  value: string;
  label: string;
  accent?: boolean;
}

/**
 * The headline price slot — mirrors the app's price rendering, plus an
 * optional From/To asking-price range.
 */
export function getPriceStat(listing: Listing): Stat {
  if (listing.priceDisplay === "poa") {
    return { value: "POA", label: "Contact Seller" };
  }
  if (listing.priceDisplay === "weeklyRevenue") {
    return { value: formatMoney(listing.weeklyRevenue), label: "Revenue / week" };
  }
  const min = listing.askingPriceMin ?? 0;
  const max = listing.askingPriceMax ?? 0;
  if (min > 0 && max > 0 && max !== min) {
    return { value: `${formatMoney(min)} – ${formatMoney(max)}`, label: "Asking Price" };
  }
  if (max > 0 && min === 0) return { value: `Up to ${formatMoney(max)}`, label: "Asking Price" };
  if (min > 0 && max === 0) return { value: `From ${formatMoney(min)}`, label: "Asking Price" };
  return { value: formatPrice(listing.askingPrice), label: "Asking Price" };
}

/**
 * Resolve a secondary/tertiary stat slot exactly the way the mobile app's
 * ListingCard does (`getStatSlot`), so the website shows whatever the seller
 * configured — no hardcoded "Revenue p.a." / "Profit Multiple".
 */
export function getStatSlot(opt: StatSlotOption | undefined, listing: Listing): Stat | null {
  switch (opt) {
    case "none":          return null;
    case "sde":           return listing.adjustedProfit > 0 ? { value: formatMoney(listing.adjustedProfit), label: "SDE p.a.", accent: true } : null;
    case "staffCount":    return { value: String(listing.staffCount), label: "Staff" };
    case "weeklyRevenue": return listing.weeklyRevenue > 0 ? { value: formatMoney(listing.weeklyRevenue), label: "Revenue / week" } : null;
    case "rent":          return listing.rent > 0 ? { value: formatMoney(listing.rent), label: "Rent / month" } : null;
    case "ownerHours":    return listing.ownerHours > 0 ? { value: `${listing.ownerHours}h`, label: "Owner hrs / wk" } : null;
    case "leaseExpiry":   return listing.leaseExpiry ? { value: listing.leaseExpiry, label: "Lease Expiry" } : null;
    default:              return null;
  }
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
