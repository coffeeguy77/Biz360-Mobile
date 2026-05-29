import { DEFAULT_TOUR_SETTINGS, TourRequest, TourSettings, TourSpace } from "@/data/listings";
import { apiGet, apiSet } from "./apiStore";

// ─── KV keys ──────────────────────────────────────────────────────────────────

const tourSpacesKey   = (listingId: string) => `biz360_tour_spaces_v2_${listingId}`;
const tourSpacesKeyV1 = (listingId: string) => `biz360_tour_spaces_v1_${listingId}`;
const tourRequestKey  = (listingId: string) => `biz360_tour_requests_v1_${listingId}`;
const tourSettingsKey = (listingId: string) => `biz360_tour_settings_v1_${listingId}`;

// ─── Tour spaces (with v1 migration) ─────────────────────────────────────────

export async function getTourSpaces(listingId: string): Promise<TourSpace[]> {
  try {
    const v2 = await apiGet<TourSpace[]>(tourSpacesKey(listingId));
    // v2 !== null means the key exists (even if empty array) — treat as authoritative
    if (v2 !== null) return v2;
    // v2 is null → key has never been written → attempt v1 migration
    const v1 = await apiGet<TourSpace[]>(tourSpacesKeyV1(listingId));
    if (v1 && v1.length > 0) {
      await apiSet(tourSpacesKey(listingId), v1);
      return v1;
    }
    return [];
  } catch { return []; }
}

export async function saveTourSpaces(listingId: string, spaces: TourSpace[]): Promise<void> {
  await apiSet(tourSpacesKey(listingId), spaces);
}

// ─── Tour settings ────────────────────────────────────────────────────────────

export async function getTourSettings(listingId: string): Promise<TourSettings> {
  try {
    const data = await apiGet<TourSettings>(tourSettingsKey(listingId));
    return data ? { ...DEFAULT_TOUR_SETTINGS, ...data } : DEFAULT_TOUR_SETTINGS;
  } catch { return DEFAULT_TOUR_SETTINGS; }
}

export async function saveTourSettings(listingId: string, settings: TourSettings): Promise<void> {
  await apiSet(tourSettingsKey(listingId), settings);
}

// ─── Tour requests ────────────────────────────────────────────────────────────

export async function getTourRequests(listingId: string): Promise<TourRequest[]> {
  try {
    const data = await apiGet<TourRequest[]>(tourRequestKey(listingId));
    return data ?? [];
  } catch { return []; }
}

export async function addTourRequest(req: TourRequest): Promise<void> {
  const existing = await getTourRequests(req.listingId);
  await apiSet(tourRequestKey(req.listingId), [req, ...existing]);
}

export async function markTourRequestSeen(listingId: string, requestId: string): Promise<void> {
  const all = await getTourRequests(listingId);
  const updated = all.map((r) => r.id === requestId ? { ...r, status: "seen" as const } : r);
  await apiSet(tourRequestKey(listingId), updated);
}

export const REQUEST_CATEGORIES = [
  { id: "room",      label: "Another Room",        icon: "map-pin"   },
  { id: "financial", label: "Financial Details",    icon: "dollar-sign" },
  { id: "equipment", label: "Equipment Details",    icon: "tool"       },
  { id: "lease",     label: "Lease Information",    icon: "home"       },
  { id: "staff",     label: "Staff / Process Info", icon: "users"      },
  { id: "other",     label: "Other",                icon: "more-horizontal" },
] as const;
