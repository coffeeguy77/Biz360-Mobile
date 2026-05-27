import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export type LeadQuality = "hot" | "warm" | "cold";
export type LeadStatus  = "open" | "contacted" | "qualified" | "closed";

export interface Lead {
  id: string;
  name: string;
  listing: string;
  listingId: string;
  action: string;
  assignedTo: string;
  quality: LeadQuality;
  status: LeadStatus;
  timestamp: number;
}

const KEY = "biz360_broker_leads_v2";

export const TEAM_MEMBERS = ["James H.", "Emma K.", "Ryan B.", "Unassigned"];

function defaultLeads(): Lead[] {
  const now = Date.now();
  return [
    { id: "l1", name: "Michael Reynolds", listing: "Iron Republic Gym",       listingId: "listing-gym-001",        action: "Tour completed · 6:12 avg", assignedTo: "James H.", quality: "hot",  status: "open", timestamp: now - 1800000   },
    { id: "l2", name: "Angela Torres",    listing: "Ember & Stone Restaurant", listingId: "listing-restaurant-001", action: "Financials requested",       assignedTo: "Emma K.",  quality: "hot",  status: "open", timestamp: now - 7200000   },
    { id: "l3", name: "Sam Wu",           listing: "Iron Republic Gym",       listingId: "listing-gym-001",        action: "Saved listing",              assignedTo: "James H.", quality: "warm", status: "open", timestamp: now - 86400000  },
    { id: "l4", name: "Rebecca Lane",     listing: "Ember & Stone Restaurant", listingId: "listing-restaurant-001", action: "Listing viewed × 3",         assignedTo: "Unassigned", quality: "cold", status: "open", timestamp: now - 259200000 },
  ];
}

export async function getLeads(): Promise<Lead[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Lead[]) : defaultLeads();
  } catch { return defaultLeads(); }
}

export async function saveLeads(leads: Lead[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(leads));
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<Lead[]> {
  const leads = await getLeads();
  const updated = leads.map((l) => (l.id === id ? { ...l, ...updates } : l));
  await saveLeads(updated);
  return updated;
}

export function useLeads() {
  const [leads, setLeadsState] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getLeads().then((d) => { if (active) { setLeadsState(d); setLoading(false); } });
      return () => { active = false; };
    }, []),
  );

  const setLeads = async (updated: Lead[] | ((prev: Lead[]) => Lead[])) => {
    setLeadsState((prev) => {
      const next = typeof updated === "function" ? updated(prev) : updated;
      saveLeads(next).catch(() => {});
      return next;
    });
  };

  return { leads, setLeads, loading };
}

export function formatLeadTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000)    return "Just now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(timestamp).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
