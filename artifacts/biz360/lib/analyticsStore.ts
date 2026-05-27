import { apiGet, apiSet } from "./apiStore";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ListingAnalytics {
  views:          number;
  uniqueBuyerIds: string[];
  tourStarts:     number;
  messages:       number;
  callsClicked:   number;
  savedCount:     number;
  lastUpdated:    number;
}

export type AnalyticsEvent =
  | "view"
  | "tour_start"
  | "message"
  | "call"
  | "save"
  | "unsave";

// ─── KV key ────────────────────────────────────────────────────────────────────

const kvKey = (listingId: string) => `biz360_analytics_v1_${listingId}`;

function empty(): ListingAnalytics {
  return {
    views:          0,
    uniqueBuyerIds: [],
    tourStarts:     0,
    messages:       0,
    callsClicked:   0,
    savedCount:     0,
    lastUpdated:    Date.now(),
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function getAnalytics(listingId: string): Promise<ListingAnalytics> {
  try {
    const data = await apiGet<ListingAnalytics>(kvKey(listingId));
    return data ?? empty();
  } catch {
    return empty();
  }
}

/** Fetch analytics for multiple listings in parallel. */
export async function getMultiAnalytics(
  listingIds: string[],
): Promise<Record<string, ListingAnalytics>> {
  const results = await Promise.all(listingIds.map((id) => getAnalytics(id)));
  return Object.fromEntries(listingIds.map((id, i) => [id, results[i]]));
}

/** Aggregate an array of analytics objects into one totals object. */
export function aggregateAnalytics(list: ListingAnalytics[]): ListingAnalytics {
  const allBuyerIds = new Set<string>();
  const out = empty();
  for (const a of list) {
    out.views        += a.views;
    out.tourStarts   += a.tourStarts;
    out.messages     += a.messages;
    out.callsClicked += a.callsClicked;
    out.savedCount   += a.savedCount;
    a.uniqueBuyerIds.forEach((id) => allBuyerIds.add(id));
  }
  out.uniqueBuyerIds = [...allBuyerIds];
  return out;
}

/**
 * Track a buyer interaction with a listing.
 * Uses read-modify-write — non-atomic but acceptable for MVP analytics.
 * All failures are swallowed silently; analytics is non-critical.
 */
export async function trackEvent(
  listingId: string,
  event:     AnalyticsEvent,
  buyerId:   string,
): Promise<void> {
  try {
    const current = await getAnalytics(listingId);
    const updated: ListingAnalytics = { ...current, lastUpdated: Date.now() };

    switch (event) {
      case "view":
        updated.views++;
        if (!updated.uniqueBuyerIds.includes(buyerId)) {
          updated.uniqueBuyerIds = [...updated.uniqueBuyerIds, buyerId];
        }
        break;
      case "tour_start":
        updated.tourStarts++;
        break;
      case "message":
        updated.messages++;
        break;
      case "call":
        updated.callsClicked++;
        break;
      case "save":
        updated.savedCount++;
        break;
      case "unsave":
        updated.savedCount = Math.max(0, updated.savedCount - 1);
        break;
    }

    await apiSet(kvKey(listingId), updated);
  } catch {
    // Non-critical — never throw from analytics
  }
}
