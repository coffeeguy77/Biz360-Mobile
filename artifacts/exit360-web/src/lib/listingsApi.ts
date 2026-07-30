import type { Listing } from "@/data/listings";

const httpImg = (v: any): v is string => typeof v === "string" && /^https?:\/\//.test(v);

/**
 * Map a listing object from the API into the web `Listing` type.
 * Handles both shapes:
 *  - the `/api/public/listings` index (already public-safe, has `imageUrl`/`hasTour`)
 *  - the raw PendingListing from `/api/public/listing/:id` (has `listingId`/`photos`)
 */
export function mapApiListing(l: any): Listing {
  const badges = Array.isArray(l?.badges) ? l.badges : [];
  const imageUrl =
    (httpImg(l?.imageUrl) ? l.imageUrl : undefined) ??
    (Array.isArray(l?.photos) ? l.photos.find(httpImg) : undefined);
  return {
    id:             l?.listingId ?? l?.id ?? "",
    businessName:   l?.businessName ?? "Business for Sale",
    category:       l?.category ?? "",
    subcategory:    l?.subcategory ?? "",
    state:          l?.state ?? "",
    suburb:         l?.suburb ?? "",
    askingPrice:    Number(l?.askingPrice ?? 0),
    weeklyRevenue:  Number(l?.weeklyRevenue ?? 0),
    adjustedProfit: Number(l?.adjustedProfit ?? 0),
    rent:           Number(l?.rent ?? 0),
    leaseExpiry:    l?.leaseExpiry ?? "",
    staffCount:     Number(l?.staffCount ?? 0),
    ownerHours:     Number(l?.ownerHours ?? 0),
    verified:       l?.verified ?? (badges.includes("identity") || badges.includes("abn")),
    badges,
    hasTour:        l?.hasTour ?? badges.includes("tour"),
    confidential:   !!l?.confidential,
    heroColor:      l?.heroColor ?? "#2563EB",
    description:    l?.description ?? "",
    imageUrl,
    savedCount:     Number(l?.savedCount ?? 0),
    viewCount:      Number(l?.viewCount ?? 0),
    tourStarts:     Number(l?.tourStarts ?? 0),
    isRealListing:  true,
  };
}

/** Fetch all approved listings from the API, mapped to the web `Listing` type. */
export async function fetchListings(): Promise<Listing[]> {
  try {
    const res = await fetch("/api/public/listings");
    if (!res.ok) return [];
    const data = await res.json();
    const arr = Array.isArray(data?.listings) ? data.listings : [];
    return arr.map(mapApiListing);
  } catch {
    return [];
  }
}
