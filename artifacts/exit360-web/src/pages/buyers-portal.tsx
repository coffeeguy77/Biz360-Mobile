/**
 * EXIT360 Buyer Portal — Dashboard
 * Route: /buyers/portal
 *
 * Shows all listings the verified buyer has been granted access to,
 * with per-listing content cards and direct report links.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Eye, LogOut, Building2, MapPin, FileText, Video,
  BarChart2, Wrench, ChevronRight, Lock, Loader2,
  Shield, CheckCircle2, Phone, MessageSquare, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Permissions {
  canViewImReport: boolean;
  canViewWalkthrough: boolean;
  canViewFinancials: boolean;
  canViewEquipment: boolean;
}

interface ListingAccess {
  cafeId: string;
  listingId: string | null;
  businessName: string;
  city: string | null;
  businessType: string;
  permissions: Permissions;
  accessToken: string | null;
}

interface PortalData {
  listings: ListingAccess[];
  phone: string;
}

function toLocalPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("61")) {
    const local = "0" + digits.slice(2);
    return [local.slice(0, 4), local.slice(4, 7), local.slice(7, 10)].filter(Boolean).join(" ");
  }
  return e164;
}

function AccessBadge({ granted, label, icon: Icon }: { granted: boolean; label: string; icon: React.ElementType }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
      granted
        ? "bg-green-500/10 border-green-500/20 text-green-400"
        : "bg-slate-800/60 border-slate-700/40 text-slate-500"
    )}>
      <Icon size={11} />
      {label}
      {granted && <CheckCircle2 size={10} className="text-green-400" />}
    </div>
  );
}

function ListingCard({ item }: { item: ListingAccess }) {
  const hasAnyAccess = item.permissions.canViewImReport ||
    item.permissions.canViewWalkthrough ||
    item.permissions.canViewFinancials ||
    item.permissions.canViewEquipment;

  const reportHref = item.listingId && item.accessToken
    ? `/reports/${item.listingId}?accessToken=${encodeURIComponent(item.accessToken)}`
    : null;

  return (
    <div className="rounded-2xl border border-[#1E3A5C] bg-[#0A1828]/60 overflow-hidden">
      {/* Card header */}
      <div className="px-6 py-5 border-b border-[#1E3A5C]/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                <Shield size={10} /> CONFIDENTIAL
              </span>
            </div>
            <h3 className="text-white font-bold text-lg leading-snug">{item.businessName}</h3>
            {item.city && (
              <div className="flex items-center gap-1.5 mt-1 text-slate-400 text-sm">
                <MapPin size={12} />
                <span>{item.city}</span>
              </div>
            )}
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Building2 size={20} className="text-blue-400" />
          </div>
        </div>
      </div>

      {/* Access summary */}
      <div className="px-6 py-4 border-b border-[#1E3A5C]/40">
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">Your Access</p>
        <div className="flex flex-wrap gap-2">
          <AccessBadge granted={item.permissions.canViewImReport}    label="IM Report"     icon={FileText}  />
          <AccessBadge granted={item.permissions.canViewWalkthrough} label="360° Walkthrough" icon={Video}  />
          <AccessBadge granted={item.permissions.canViewFinancials}  label="Financials"    icon={BarChart2} />
          <AccessBadge granted={item.permissions.canViewEquipment}   label="Equipment"     icon={Wrench}    />
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4">
        {hasAnyAccess ? (
          <div className="flex flex-col gap-2.5">
            {item.permissions.canViewImReport && reportHref && (
              <Link href={reportHref}>
                <a className="flex items-center justify-between px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors group">
                  <span className="flex items-center gap-2">
                    <FileText size={15} />
                    View Information Memorandum
                  </span>
                  <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </a>
              </Link>
            )}
            {item.permissions.canViewWalkthrough && reportHref && (
              <Link href={`${reportHref}#chapter-virtual_tour`}>
                <a className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#0F2040] hover:bg-[#142950] border border-[#1E3A5C] text-white font-semibold text-sm transition-colors group">
                  <span className="flex items-center gap-2">
                    <Video size={15} className="text-purple-400" />
                    360° Business Walkthrough
                  </span>
                  <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </a>
              </Link>
            )}
            {(item.permissions.canViewFinancials || item.permissions.canViewEquipment) && reportHref && (
              <Link href={`${reportHref}#chapter-${item.permissions.canViewFinancials ? "financial_performance" : "assets_equipment"}`}>
                <a className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#0F2040] hover:bg-[#142950] border border-[#1E3A5C] text-white font-semibold text-sm transition-colors group">
                  <span className="flex items-center gap-2">
                    <BarChart2 size={15} className="text-emerald-400" />
                    {item.permissions.canViewFinancials && item.permissions.canViewEquipment
                      ? "Financials & Equipment"
                      : item.permissions.canViewFinancials ? "Financial Data" : "Equipment List"}
                  </span>
                  <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                </a>
              </Link>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 py-2 text-slate-400 text-sm">
            <Lock size={14} />
            <span>No content has been shared with you yet. Contact the seller.</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ThreadMsg { id: string; from: string; text: string; timestamp: number; }
interface Thread {
  id: string; listingId: string; listingName: string;
  sellerName?: string; buyerName?: string; buyerId: string;
  messages: ThreadMsg[]; updatedAt: number;
  unreadBuyer?: number; unreadSeller?: number;
}

function fmtTime(ts: number): string {
  try { return new Date(ts).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

// Shared chat styling: themed scrollbar + iMessage-style bubble tails.
const CHAT_STYLE = `
.exit-chat::-webkit-scrollbar { width: 8px; }
.exit-chat::-webkit-scrollbar-track { background: rgba(30,58,92,0.12); border-radius: 8px; margin: 6px 0; }
.exit-chat::-webkit-scrollbar-thumb { background: #24466e; border-radius: 8px; }
.exit-chat::-webkit-scrollbar-thumb:hover { background: #2f5a8c; }
.exit-chat { scrollbar-width: thin; scrollbar-color: #24466e transparent; }
.exit-bubble { position: relative; }
.exit-bubble-mine::after {
  content:""; position:absolute; bottom:1px; right:-5px;
  width:0; height:0; border-top:9px solid #2563eb; border-right:8px solid transparent;
}
.exit-bubble-them::after {
  content:""; position:absolute; bottom:1px; left:-5px;
  width:0; height:0; border-top:9px solid #16233a; border-left:8px solid transparent;
}
`;

function ThreadCard({ thread, onReply }: { thread: Thread; onReply: (id: string, text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);
  const msgs = thread.messages ?? [];
  const unread = thread.unreadBuyer ?? 0;

  // Auto-scroll to newest: on first render, and whenever a new message arrives.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const grew = msgs.length > prevCount.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (grew || prevCount.current === 0) {
      // Jump on first paint, smooth for subsequent messages.
      el.scrollTo({ top: el.scrollHeight, behavior: prevCount.current === 0 ? "auto" : "smooth" });
    } else if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
    prevCount.current = msgs.length;
  }, [msgs.length]);

  async function submit() {
    if (!text.trim() || sending) return;
    setSending(true);
    try { await onReply(thread.id, text.trim()); setText(""); } finally { setSending(false); }
  }

  return (
    <div className="rounded-2xl border border-[#1E3A5C] bg-[#0A1828]/60 overflow-hidden flex flex-col">
      <div className="px-5 py-3.5 border-b border-[#1E3A5C]/60 flex items-center gap-2">
        <MessageSquare size={15} className="text-blue-400" />
        <span className="text-white font-semibold text-sm flex-1 truncate">{thread.listingName || "Enquiry"}</span>
        {unread > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>
      <div ref={scrollRef} className="exit-chat px-4 py-4 flex flex-col gap-2.5 h-[24rem] overflow-y-auto">
        {msgs.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-500 text-sm text-center">No messages yet — say hello.</p>
          </div>
        )}
        {msgs.map((m, i) => {
          const mine = m.from === "buyer";
          const prev = msgs[i - 1];
          const showName = !prev || prev.from !== m.from;
          return (
            <div key={m.id} className={cn("flex flex-col max-w-[78%]", mine ? "self-end items-end" : "self-start items-start")}>
              <div
                className={cn(
                  "exit-bubble px-3.5 py-2 text-sm leading-snug shadow-sm",
                  mine
                    ? "exit-bubble-mine bg-blue-600 text-white rounded-2xl rounded-br-md"
                    : "exit-bubble-them bg-[#16233a] text-slate-100 rounded-2xl rounded-bl-md",
                )}
              >
                {m.text}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 px-1">
                {(showName ? (mine ? "You" : (thread.sellerName || "Seller")) + " · " : "")}{fmtTime(m.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-[#1E3A5C]/60 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Write a reply…"
          className="flex-1 bg-[#070F1C] border border-[#1E3A5C] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500"
        />
        <button onClick={submit} disabled={sending || !text.trim()} className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center flex-shrink-0">
          {sending ? <Loader2 size={15} className="animate-spin text-white" /> : <Send size={15} className="text-white" />}
        </button>
      </div>
    </div>
  );
}

export function BuyersPortal() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<PortalData | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the buyer's enquiry threads (public KV), filtered to this buyer, and
  // keep them live so seller replies appear without a manual refresh.
  useEffect(() => {
    if (!data?.phone) return;
    const myId = "u-" + data.phone.replace(/\D/g, "");
    let active = true;
    const load = () =>
      fetch("/api/biz360/kv/biz360_threads_v3")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!active) return;
          const all = (j?.value ?? {}) as Record<string, Thread>;
          const mine = Object.values(all)
            .filter((t) => t?.buyerId === myId)
            .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
          setThreads(mine);
        })
        .catch(() => { /* ignore */ });
    load();
    const iv = setInterval(load, 4000);
    return () => { active = false; clearInterval(iv); };
  }, [data?.phone]);

  const unreadTotal = threads.reduce((n, t) => n + (t.unreadBuyer ?? 0), 0);

  async function sendReply(threadId: string, text: string) {
    // Optimistic: show the message instantly, then persist.
    const optimistic: ThreadMsg = { id: `msg-${Date.now()}-web`, from: "buyer", text, timestamp: Date.now() };
    setThreads((prev) => prev.map((t) => (t.id === threadId
      ? { ...t, messages: [...(t.messages ?? []), optimistic], updatedAt: optimistic.timestamp, unreadBuyer: 0 }
      : t)));
    try {
      const r = await fetch("/api/biz360/kv/biz360_threads_v3");
      const j = await r.json();
      const all = (j?.value ?? {}) as Record<string, any>;
      if (!all[threadId]) return;
      all[threadId].messages = [...(all[threadId].messages ?? []), optimistic];
      all[threadId].updatedAt = optimistic.timestamp;
      all[threadId].unreadSeller = (all[threadId].unreadSeller ?? 0) + 1;
      all[threadId].unreadBuyer = 0; // buyer has engaged with this thread
      await fetch("/api/biz360/kv/biz360_threads_v3", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: all }),
      });
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...all[threadId] } : t)));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    const token = localStorage.getItem("exit360_buyer_token");
    if (!token) {
      navigate("/buyers");
      return;
    }
    fetch("/api/buyer-portal/my-access", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) {
          localStorage.removeItem("exit360_buyer_token");
          navigate("/buyers");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => setError("Could not load your listings. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  function handleSignOut() {
    localStorage.removeItem("exit360_buyer_token");
    navigate("/buyers");
  }

  return (
    <div className="min-h-screen bg-[#070F1C] text-white flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#1E3A5C] bg-[#070F1C]/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
                  <Eye className="text-primary-foreground" size={14} />
                </div>
                <span className="font-bold text-sm">EXIT360</span>
              </div>
            </Link>
            <span className="text-[#1E3A5C]">/</span>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Buyer Portal</span>
          </div>
          {data && (
            <div className="flex items-center gap-3">
              {data.phone && (
                <div className="hidden sm:flex items-center gap-2 bg-[#0F2040] border border-[#1E3A5C] rounded-full px-3 py-1.5 text-xs text-slate-400">
                  <Phone size={11} />
                  {toLocalPhone(data.phone)}
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="border-b border-[#1E3A5C] bg-gradient-to-br from-[#02060E] via-[#070F1C] to-[#0A1A30]">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Confidential</p>
          <h1 className="text-3xl font-bold text-white mb-2">Your Shared Listings</h1>
          <p className="text-slate-400 text-sm">
            The seller has granted you secure access to the information below.
            All content is confidential and subject to NDA.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <p className="text-slate-400 text-sm">Loading your listings…</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <p className="text-red-400 font-semibold mb-2">Something went wrong</p>
            <p className="text-slate-400 text-sm">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !error && data && data.listings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#0F2040] border border-[#1E3A5C] flex items-center justify-center">
              <Building2 size={28} className="text-slate-500" />
            </div>
            <div>
              <p className="text-white font-bold text-lg mb-2">No listings shared yet</p>
              <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                The seller hasn't granted you access to any listings yet.
                Contact them directly if you were expecting to see information here.
              </p>
            </div>
            <Link href="/listings">
              <Button variant="outline" className="mt-2">Browse public listings</Button>
            </Link>
          </div>
        )}

        {!loading && !error && data && data.listings.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-slate-400 text-sm">
                {data.listings.length} {data.listings.length === 1 ? "listing" : "listings"} shared with you
              </p>
              <div className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                <Shield size={11} />
                Verified access
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {data.listings.map((item) => (
                <ListingCard key={item.cafeId} item={item} />
              ))}
            </div>
          </>
        )}

        {/* Messages — the buyer's enquiry threads */}
        {!loading && !error && threads.length > 0 && (
          <div className="mt-12">
            <style>{CHAT_STYLE}</style>
            <div className="flex items-center gap-2 mb-5">
              <MessageSquare size={16} className="text-blue-400" />
              <h2 className="text-white font-bold text-lg">Messages</h2>
              {unreadTotal > 0 ? (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold">
                  {unreadTotal > 9 ? "9+" : unreadTotal}
                </span>
              ) : (
                <span className="text-xs text-slate-500">({threads.length})</span>
              )}
            </div>
            <div className="grid gap-5">
              {threads.map((t) => (
                <ThreadCard key={t.id} thread={t} onReply={sendReply} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#1E3A5C] py-6 px-6 text-center">
        <p className="text-xs text-slate-600">
          EXIT360 Buyer Portal — All content is confidential and may not be shared or distributed.{" "}
          <Link href="/listings">
            <span className="text-slate-500 hover:text-slate-400 cursor-pointer transition-colors">Browse public listings</span>
          </Link>
        </p>
      </div>
    </div>
  );
}
