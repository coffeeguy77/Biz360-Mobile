import { useEffect, useState } from "react";
import { apiGet, apiSet } from "./apiStore";

const STORAGE_KEY = "biz360_threads_v3";

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

function defaultThreadMap(): Record<string, Thread> {
  return {};
}

async function writeMap(map: Record<string, Thread>): Promise<void> {
  await apiSet(STORAGE_KEY, map);
}

async function getOrInitMap(): Promise<Record<string, Thread>> {
  try {
    const data = await apiGet<Record<string, Thread>>(STORAGE_KEY);
    if (data !== null) return data;
    const defaults = defaultThreadMap();
    await writeMap(defaults);
    return defaults;
  } catch {
    return {};
  }
}

export async function getThreads(): Promise<Thread[]> {
  const map = await getOrInitMap();
  return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getThread(id: string): Promise<Thread | null> {
  const map = await getOrInitMap();
  return map[id] ?? null;
}

export async function deleteThread(threadId: string): Promise<void> {
  const map = await getOrInitMap();
  delete map[threadId];
  await writeMap(map);
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
  const map = await getOrInitMap();

  if (!map[threadId]) {
    map[threadId] = {
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
  const map = await getOrInitMap();
  const thread = map[threadId];
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    getThreads()
      .then((t) => { if (active) { setThreads(t); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const remove = async (id: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    await deleteThread(id);
  };

  return { threads, loading, remove };
}

export function useThreadDetail(id: string) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    getThread(id).then(setThread).catch(() => {});
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    getThread(id)
      .then((t) => { if (active) { setThread(t); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  return { thread, loading, reload };
}
