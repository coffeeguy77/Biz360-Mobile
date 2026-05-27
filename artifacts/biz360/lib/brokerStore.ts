import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

// ─── Leads ───────────────────────────────────────────────────────────────────

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

const LEADS_KEY = "biz360_broker_leads_v2";

export const TEAM_MEMBERS = ["James H.", "Emma K.", "Ryan B.", "Unassigned"];

function defaultLeads(): Lead[] {
  const now = Date.now();
  return [
    { id: "l1", name: "Michael Reynolds", listing: "Iron Republic Gym",        listingId: "listing-gym-001",        action: "Tour completed · 6:12 avg", assignedTo: "James H.", quality: "hot",  status: "open", timestamp: now - 1800000   },
    { id: "l2", name: "Angela Torres",    listing: "Ember & Stone Restaurant", listingId: "listing-restaurant-001", action: "Financials requested",       assignedTo: "Emma K.",  quality: "hot",  status: "open", timestamp: now - 7200000   },
    { id: "l3", name: "Sam Wu",           listing: "Iron Republic Gym",        listingId: "listing-gym-001",        action: "Saved listing",              assignedTo: "James H.", quality: "warm", status: "open", timestamp: now - 86400000  },
    { id: "l4", name: "Rebecca Lane",     listing: "Ember & Stone Restaurant", listingId: "listing-restaurant-001", action: "Listing viewed × 3",         assignedTo: "Unassigned", quality: "cold", status: "open", timestamp: now - 259200000 },
  ];
}

export async function getLeads(): Promise<Lead[]> {
  try {
    const raw = await AsyncStorage.getItem(LEADS_KEY);
    return raw ? (JSON.parse(raw) as Lead[]) : defaultLeads();
  } catch { return defaultLeads(); }
}

export async function saveLeads(leads: Lead[]): Promise<void> {
  await AsyncStorage.setItem(LEADS_KEY, JSON.stringify(leads));
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

// ─── Team Members ─────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  color: string;
}

const TEAM_KEY = "biz360_broker_team_v1";

const MEMBER_COLORS = ["#2563EB", "#8B5CF6", "#F59E0B", "#16A34A", "#EC4899", "#0891B2", "#DC2626", "#9333EA"];

export const TEAM_ROLES = ["Senior Broker", "Associate Broker", "Junior Agent", "Business Analyst", "Admin Assistant"];

function defaultTeam(): TeamMember[] {
  return [
    { id: "t1", name: "James Harrington", role: "Senior Broker",   color: "#2563EB" },
    { id: "t2", name: "Emma Kavanaugh",   role: "Associate Broker", color: "#8B5CF6" },
    { id: "t3", name: "Ryan Brooks",      role: "Junior Agent",     color: "#F59E0B" },
  ];
}

export function pickMemberColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  try {
    const raw = await AsyncStorage.getItem(TEAM_KEY);
    return raw ? (JSON.parse(raw) as TeamMember[]) : defaultTeam();
  } catch { return defaultTeam(); }
}

export async function saveTeamMembers(members: TeamMember[]): Promise<void> {
  await AsyncStorage.setItem(TEAM_KEY, JSON.stringify(members));
}

export function useTeamMembers() {
  const [members, setMembersState] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getTeamMembers().then((d) => { if (active) { setMembersState(d); setLoading(false); } });
      return () => { active = false; };
    }, []),
  );

  const setMembers = (updated: TeamMember[] | ((prev: TeamMember[]) => TeamMember[])) => {
    setMembersState((prev) => {
      const next = typeof updated === "function" ? updated(prev) : updated;
      saveTeamMembers(next).catch(() => {});
      return next;
    });
  };

  return { members, setMembers, loading };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatLeadTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000)     return "Just now";
  if (diff < 3600000)   return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000)  return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(timestamp).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
