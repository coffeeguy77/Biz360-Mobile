import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { apiGet, apiSet } from "./apiStore";

const STORAGE_KEY = "biz360_threads_v2";

export interface StoredMessage {
  id: string;
  from: "buyer" | "seller";
  text: string;
  timestamp: number;
}

export interface Thread {
  id: string;
  listingId: string;
  listingName: string;
  sellerName: string;
  buyerName: string;
  messages: StoredMessage[];
  updatedAt: number;
  unreadBuyer: number;
  unreadSeller: number;
}

function ts(msAgo: number) { return Date.now() - msAgo; }

function defaultThreadMap(): Record<string, Thread> {
  return {
    "thread-001": {
      id: "thread-001",
      listingId: "listing-cafe-001",
      listingName: "The Daily Press Espresso Bar",
      sellerName: "Sarah Mitchell",
      buyerName: "Alex Chen",
      messages: [
        { id: "d1", from: "seller", text: "Hello! Thanks for your enquiry about The Daily Press Espresso Bar. Happy to answer any questions.", timestamp: ts(7200000) },
        { id: "d2", from: "buyer",  text: "Hi Sarah! I'm very interested. Could you tell me about the lease renewal options?", timestamp: ts(6900000) },
        { id: "d3", from: "seller", text: "Of course! The current lease has two 3-year renewal options at CPI+1%. The landlord is open to assignment and has been very cooperative.", timestamp: ts(6700000) },
        { id: "d4", from: "buyer",  text: "Great. Are all the equipment items included in the sale?", timestamp: ts(6500000) },
        { id: "d5", from: "seller", text: "Yes — all equipment is included. The La Marzocco is valued at $28,000 and was serviced 3 months ago.", timestamp: ts(6300000) },
      ],
      updatedAt: ts(6300000),
      unreadBuyer: 0,
      unreadSeller: 0,
    },
    "thread-002": {
      id: "thread-002",
      listingId: "listing-gym-001",
      listingName: "Iron Republic Gym",
      sellerName: "James Harrington",
      buyerName: "Alex Chen",
      messages: [
        { id: "d6", from: "seller", text: "Hi Alex, I've forwarded your enquiry to the vendor. They'd like to arrange an inspection next week — does that suit you?", timestamp: ts(86400000) },
      ],
      updatedAt: ts(86400000),
      unreadBuyer: 1,
      unreadSeller: 0,
    },
    "thread-003": {
      id: "thread-003",
      listingId: "listing-laundromat-001",
      listingName: "SpinCity Laundromat",
      sellerName: "SpinCity Support",
      buyerName: "Alex Chen",
      messages: [
        { id: "d7", from: "seller", text: "The financial statements from FY23 are now available for download in the documents section.", timestamp: ts(259200000) },
      ],
      updatedAt: ts(259200000),
      unreadBuyer: 0,
      unreadSeller: 0,
    },
  };
}

async function readMap(): Promise<Record<string, Thread>> {
  try {
    const data = await apiGet<Record<string, Thread>>(STORAGE_KEY);
    return data ?? {};
  } catch {
    return {};
  }
}

async function writeMap(map: Record<string, Thread>): Promise<void> {
  await apiSet(STORAGE_KEY, map);
}

export async function getThreads(): Promise<Thread[]> {
  const [map, defaults] = await Promise.all([readMap(), Promise.resolve(defaultThreadMap())]);
  const merged: Record<string, Thread> = { ...defaults, ...map };
  return Object.values(merged).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getThread(id: string): Promise<Thread | null> {
  const map = await readMap();
  if (map[id]) return map[id];
  return defaultThreadMap()[id] ?? null;
}

export interface NewThreadMeta {
  listingId: string;
  listingName: string;
  sellerName: string;
  buyerName: string;
}

export async function sendMessage(
  threadId: string,
  text: string,
  from: "buyer" | "seller",
  meta?: NewThreadMeta,
): Promise<Thread> {
  const map = await readMap();

  if (!map[threadId]) {
    const defaults = defaultThreadMap();
    map[threadId] = defaults[threadId] ?? {
      id: threadId,
      listingId: meta?.listingId ?? "",
      listingName: meta?.listingName ?? "Listing",
      sellerName: meta?.sellerName ?? "Seller",
      buyerName: meta?.buyerName ?? "Buyer",
      messages: [],
      updatedAt: Date.now(),
      unreadBuyer: 0,
      unreadSeller: 0,
    };
  }

  const thread = { ...map[threadId] };
  const msg: StoredMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    from,
    text,
    timestamp: Date.now(),
  };
  thread.messages = [...thread.messages, msg];
  thread.updatedAt = Date.now();
  if (from === "buyer") thread.unreadSeller = (thread.unreadSeller ?? 0) + 1;
  else thread.unreadBuyer = (thread.unreadBuyer ?? 0) + 1;

  map[threadId] = thread;
  await writeMap(map);
  return thread;
}

export async function markRead(threadId: string, role: "buyer" | "seller"): Promise<void> {
  const map = await readMap();
  const defaults = defaultThreadMap();
  const thread = map[threadId] ?? defaults[threadId];
  if (!thread) return;
  const updated = { ...thread };
  if (role === "buyer") updated.unreadBuyer = 0;
  else updated.unreadSeller = 0;
  map[threadId] = updated;
  await writeMap(map);
}

export function formatMessageTime(timestamp: number): string {
  const d = new Date(timestamp);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function formatThreadTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return formatMessageTime(timestamp);
  if (diff < 172800000) return "Yesterday";
  return new Date(timestamp).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export function useThreadList() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getThreads().then((t) => {
        if (active) { setThreads(t); setLoading(false); }
      });
      return () => { active = false; };
    }, []),
  );

  return { threads, loading };
}

export function useThreadDetail(id: string) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    getThread(id).then(setThread);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getThread(id).then((t) => {
        if (active) { setThread(t); setLoading(false); }
      });
      return () => { active = false; };
    }, [id]),
  );

  return { thread, loading, reload };
}
