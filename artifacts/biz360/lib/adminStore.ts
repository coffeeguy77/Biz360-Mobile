import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { DEMO_LISTINGS } from "@/data/listings";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "suspended";
  joined: string;
}

export interface AdminBroker {
  id: string;
  name: string;
  firm: string;
  listings: number;
  status: "approved" | "pending";
  plan: string;
}

export interface AdminReport {
  id: string;
  type: string;
  listing: string;
  reporter: string;
  severity: "high" | "medium" | "low";
  status: "open" | "dismissed" | "suspended";
  createdAt: number;
}

export interface AdminCategory {
  id: string;
  name: string;
  icon: string;
  listingCount: number;
  active: boolean;
  featured: boolean;
  sortOrder: number;
}

export interface PendingListing {
  id: string;
  listingId: string;
  submittedAt: number;
  status: "pending" | "approved" | "rejected";
  submittedBy: string;
  submittedByRole: string;
  // Inline data for user-created listings (not in DEMO_LISTINGS)
  businessName?: string;
  suburb?: string;
  state?: string;
  category?: string;
  askingPrice?: number;
  weeklyRevenue?: number;
  heroColor?: string;
}

const K = {
  users:      "biz360_admin_users",
  brokers:    "biz360_admin_brokers",
  reports:    "biz360_admin_reports",
  categories: "biz360_admin_categories",
  pending:    "biz360_admin_pending",
};

const HERO_COLORS = ["#2563EB", "#7C3AED", "#0891B2", "#059669", "#D97706", "#DC2626", "#0F766E", "#9333EA"];
export function randomHeroColor() {
  return HERO_COLORS[Math.floor(Math.random() * HERO_COLORS.length)];
}

// ─── Default seed data ────────────────────────────────────────────────────────

function defaultUsers(): AdminUser[] {
  return [
    { id: "u1", name: "Alex Chen",        email: "alex@example.com",         role: "buyer",  status: "active",    joined: "Jan 2024" },
    { id: "u2", name: "Sarah Mitchell",   email: "sarah@example.com",        role: "seller", status: "active",    joined: "Mar 2024" },
    { id: "u3", name: "James Harrington", email: "james@premiumbiz.com.au",  role: "broker", status: "active",    joined: "Feb 2024" },
    { id: "u4", name: "David Park",       email: "david@example.com",        role: "buyer",  status: "active",    joined: "Apr 2024" },
    { id: "u5", name: "Priya Sharma",     email: "priya@example.com",        role: "seller", status: "active",    joined: "Apr 2024" },
    { id: "u6", name: "Unknown User",     email: "spam@example.com",         role: "buyer",  status: "suspended", joined: "May 2024" },
  ];
}

function defaultBrokers(): AdminBroker[] {
  return [
    { id: "b1", name: "James Harrington", firm: "Premium Business Brokers", listings: 2, status: "approved", plan: "Broker Pro"    },
    { id: "b2", name: "Rachel Kim",       firm: "EXIT Strategies Australia", listings: 0, status: "pending",  plan: "Broker Lite"   },
    { id: "b3", name: "Nathan Price",     firm: "First National Business",   listings: 1, status: "approved", plan: "Broker Growth" },
  ];
}

function defaultReports(): AdminReport[] {
  const now = Date.now();
  return [
    { id: "r1", type: "Misleading financials", listing: "The Daily Press Espresso Bar", reporter: "Anonymous buyer", severity: "medium", status: "open", createdAt: now - 7200000  },
    { id: "r2", type: "Spam / fake listing",   listing: "ABC Cafe (test)",              reporter: "System",          severity: "high",   status: "open", createdAt: now - 86400000 },
  ];
}

function defaultCategories(): AdminCategory[] {
  return [
    { id: "cat-01", name: "Food & Beverage",       icon: "coffee",       listingCount: 142, active: true,  featured: true,  sortOrder: 1  },
    { id: "cat-02", name: "Retail",                icon: "shopping-bag", listingCount: 89,  active: true,  featured: true,  sortOrder: 2  },
    { id: "cat-03", name: "Health & Wellness",     icon: "heart",        listingCount: 67,  active: true,  featured: true,  sortOrder: 3  },
    { id: "cat-04", name: "Professional Services", icon: "briefcase",    listingCount: 54,  active: true,  featured: false, sortOrder: 4  },
    { id: "cat-05", name: "Manufacturing",         icon: "tool",         listingCount: 31,  active: true,  featured: false, sortOrder: 5  },
    { id: "cat-06", name: "Hospitality",           icon: "home",         listingCount: 28,  active: true,  featured: true,  sortOrder: 6  },
    { id: "cat-07", name: "Transport & Logistics", icon: "truck",        listingCount: 22,  active: true,  featured: false, sortOrder: 7  },
    { id: "cat-08", name: "Technology",            icon: "monitor",      listingCount: 19,  active: true,  featured: false, sortOrder: 8  },
    { id: "cat-09", name: "Education & Training",  icon: "book-open",    listingCount: 14,  active: true,  featured: false, sortOrder: 9  },
    { id: "cat-10", name: "Agriculture",           icon: "sun",          listingCount: 8,   active: false, featured: false, sortOrder: 10 },
  ];
}

function defaultPending(): PendingListing[] {
  return DEMO_LISTINGS.slice(0, 2).map((l, i) => ({
    id: `p${i + 1}`,
    listingId: l.id,
    submittedAt: Date.now() - (i + 1) * 3600000,
    status: "pending" as const,
    submittedBy: i === 0 ? "seller-001" : "broker-001",
    submittedByRole: i === 0 ? "seller" : "broker",
  }));
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function load<T>(key: string, defaults: () => T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : defaults();
  } catch { return defaults(); }
}

async function save<T>(key: string, data: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

export const getUsers            = () => load(K.users,      defaultUsers);
export const saveUsers           = (d: AdminUser[])      => save(K.users,      d);
export const getBrokers          = () => load(K.brokers,    defaultBrokers);
export const saveBrokers         = (d: AdminBroker[])    => save(K.brokers,    d);
export const getReports          = () => load(K.reports,    defaultReports);
export const saveReports         = (d: AdminReport[])    => save(K.reports,    d);
export const getCategories       = () => load(K.categories, defaultCategories);
export const saveCategories      = (d: AdminCategory[])  => save(K.categories, d);
export const getPendingListings  = () => load(K.pending,   defaultPending);
export const savePendingListings = (d: PendingListing[]) => save(K.pending,    d);

// ─── Generic persisted list hook ─────────────────────────────────────────────

function usePersistedList<T>(
  fetchFn: () => Promise<T[]>,
  saveFn:  (d: T[]) => Promise<void>,
) {
  const [data, setDataState] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      fetchFn().then((d) => { if (active) { setDataState(d); setLoading(false); } });
      return () => { active = false; };
    }, []),
  );

  const setData = async (updated: T[] | ((prev: T[]) => T[])) => {
    setDataState((prev) => {
      const next = typeof updated === "function" ? updated(prev) : updated;
      saveFn(next).catch(() => {});
      return next;
    });
  };

  return { data, setData, loading };
}

export const useAdminUsers      = () => usePersistedList(getUsers,           saveUsers);
export const useAdminBrokers    = () => usePersistedList(getBrokers,         saveBrokers);
export const useAdminReports    = () => usePersistedList(getReports,         saveReports);
export const useAdminCategories = () => usePersistedList(getCategories,      saveCategories);
export const useAdminPending    = () => usePersistedList(getPendingListings,  savePendingListings);
