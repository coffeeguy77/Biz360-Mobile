/**
 * EXIT360 Buyer Portal — Dashboard
 * Route: /buyers/portal
 *
 * Each granted listing is one card: the business + access + action buttons on
 * top, then its conversation on the left and hero image on the right (same size)
 * so every property carries its own little chat history. Fully theme-driven.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Eye, LogOut, Building2, MapPin, FileText, Video,
  BarChart2, Wrench, ChevronRight, Lock, Loader2,
  Shield, CheckCircle2, Phone, MessageSquare, Send, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

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
  heroImageUrl?: string | null;
  permissions: Permissions;
  accessToken: string | null;
}

interface PortalData {
  listings: ListingAccess[];
  phone: string;
  email?: string | null;
  emailVerified?: boolean;
  name?: string | null;
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

function toLocalPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("61")) {
    const local = "0" + digits.slice(2);
    return [local.slice(0, 4), local.slice(4, 7), local.slice(7, 10)].filter(Boolean).join(" ");
  }
  return e164;
}

// Theme-driven chat styling: scrollbar + iMessage bubble tails. The ::after mask
// uses the chat background (theme --background) to carve the curve; the ::before
// wedge uses the bubble colour (--primary for me, --secondary for the seller).
const CHAT_STYLE = `
.exit-chat::-webkit-scrollbar { width: 8px; }
.exit-chat::-webkit-scrollbar-track { background: hsl(var(--muted) / 0.4); border-radius: 8px; margin: 6px 0; }
.exit-chat::-webkit-scrollbar-thumb { background: hsl(var(--primary) / 0.6); border-radius: 8px; }
.exit-chat::-webkit-scrollbar-thumb:hover { background: hsl(var(--primary)); }
.exit-chat { scrollbar-width: thin; scrollbar-color: hsl(var(--primary) / 0.6) transparent; background: hsl(var(--background)); }
.exit-bubble { position: relative; }
.exit-bubble::before, .exit-bubble::after { content:""; position:absolute; bottom:-0.1rem; height:1rem; }
.exit-bubble-mine::before { border-bottom-left-radius: 0.8rem 0.7rem; border-right: 1rem solid hsl(var(--primary)); right: -0.35rem; transform: translate(0, -0.1rem); }
.exit-bubble-mine::after { background: hsl(var(--background)); border-bottom-left-radius: 0.5rem; right: -40px; width: 10px; transform: translate(-30px, -2px); }
.exit-bubble-them::before { border-bottom-right-radius: 0.8rem 0.7rem; border-left: 1rem solid hsl(var(--secondary)); left: -0.35rem; transform: translate(0, -0.1rem); }
.exit-bubble-them::after { background: hsl(var(--background)); border-bottom-right-radius: 0.5rem; left: 20px; width: 10px; transform: translate(-30px, -2px); }
`;

function EmailAlertsCard({ data, onSaved }: { data: PortalData; onSaved: (email: string) => void }) {
  const [email, setEmail] = useState(data.email ?? "");
  const [editing, setEditing] = useState(!data.email);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const verified = !!data.emailVerified && !!data.email;

  async function save() {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { setMsg("Enter a valid email address."); return; }
    setSaving(true); setMsg(null);
    try {
      const token = localStorage.getItem("exit360_buyer_token");
      const r = await fetch("/api/buyer-portal/email/set", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: clean }),
      });
      if (r.ok) { setMsg("Check your inbox to confirm your address."); setEditing(false); onSaved(clean); }
      else { const e = await r.json().catch(() => ({})); setMsg(e.error ?? "Could not save email."); }
    } catch { setMsg("Network error — please try again."); }
    finally { setSaving(false); }
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 px-5 py-4 mb-5">
      <div className="flex items-center gap-2 mb-1">
        <Mail size={15} className="text-primary" />
        <span className="text-foreground font-semibold text-sm">Email alerts</span>
        {verified && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
            <CheckCircle2 size={11} /> Verified
          </span>
        )}
        {!verified && data.email && (
          <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            Pending verification
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-xs mb-3">
        {verified
          ? "You'll get an email whenever a seller replies to you."
          : "Add your email to get notified the moment a seller replies."}
      </p>
      {editing || !data.email ? (
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground text-sm font-semibold">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-foreground">{data.email}</span>
          <button onClick={() => setEditing(true)} className="text-xs text-primary hover:opacity-80 font-semibold">Change</button>
        </div>
      )}
      {msg && <p className="text-xs text-muted-foreground mt-2">{msg}</p>}
    </div>
  );
}

function AccessBadge({ granted, label, icon: Icon }: { granted: boolean; label: string; icon: React.ElementType }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
      granted
        ? "bg-primary/10 border-primary/25 text-primary"
        : "bg-muted border-border text-muted-foreground"
    )}>
      <Icon size={11} />
      {label}
      {granted && <CheckCircle2 size={10} className="text-primary" />}
    </div>
  );
}

/** The conversation panel — fills its grid cell, themed bubbles + reply box. */
function ThreadPanel({ thread, listingName, sellerName, onSend }: {
  thread: Thread | null; listingName: string; sellerName: string;
  onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);
  const msgs = thread?.messages ?? [];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const grew = msgs.length > prevCount.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (grew || prevCount.current === 0) el.scrollTo({ top: el.scrollHeight, behavior: prevCount.current === 0 ? "auto" : "smooth" });
    else if (nearBottom) el.scrollTop = el.scrollHeight;
    prevCount.current = msgs.length;
  }, [msgs.length]);

  async function submit() {
    if (!text.trim() || sending) return;
    setSending(true);
    try { await onSend(text.trim()); setText(""); } finally { setSending(false); }
  }

  return (
    <div className="flex flex-col h-full min-h-[24rem]">
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2 flex-shrink-0">
        <MessageSquare size={15} className="text-primary" />
        <span className="text-foreground font-semibold text-sm truncate">Conversation</span>
      </div>
      <div ref={scrollRef} className="exit-chat flex-1 px-4 py-4 flex flex-col gap-2.5 overflow-y-auto">
        {msgs.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-sm text-center">No messages yet — say hello to the seller.</p>
          </div>
        )}
        {msgs.map((m, i) => {
          const mine = m.from === "buyer";
          const prev = msgs[i - 1];
          const showName = !prev || prev.from !== m.from;
          return (
            <div key={m.id} className={cn("flex flex-col max-w-[80%]", mine ? "self-end items-end" : "self-start items-start")}>
              <div className={cn(
                "exit-bubble px-3.5 py-2 text-sm leading-snug rounded-[1.15rem]",
                mine ? "exit-bubble-mine bg-primary text-primary-foreground" : "exit-bubble-them bg-secondary text-secondary-foreground",
              )}>
                {m.text}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 px-1">
                {(showName ? (mine ? "You" : (sellerName || "Seller")) + " · " : "")}{fmtTime(m.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-border/60 flex items-center gap-2 flex-shrink-0">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Write a reply…"
          className="flex-1 bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
        />
        <button onClick={submit} disabled={sending || !text.trim()} className="w-10 h-10 rounded-xl bg-primary hover:opacity-90 disabled:opacity-40 flex items-center justify-center flex-shrink-0">
          {sending ? <Loader2 size={15} className="animate-spin text-primary-foreground" /> : <Send size={15} className="text-primary-foreground" />}
        </button>
      </div>
    </div>
  );
}

/** One property card: header (name + access + actions) on top, then chat left + image right. */
function PortalCard({ item, thread, onSend }: {
  item: ListingAccess; thread: Thread | null; onSend: (text: string) => Promise<void>;
}) {
  const hasAnyAccess = item.permissions.canViewImReport || item.permissions.canViewWalkthrough ||
    item.permissions.canViewFinancials || item.permissions.canViewEquipment;
  const reportHref = item.listingId && item.accessToken
    ? `/reports/${item.listingId}?accessToken=${encodeURIComponent(item.accessToken)}`
    : null;
  const [callNote, setCallNote] = useState<string | null>(null);

  async function callSeller() {
    if (!item.listingId) return;
    setCallNote(null);
    try {
      const token = localStorage.getItem("exit360_buyer_token");
      const r = await fetch(`/api/public/listing/${item.listingId}/seller/reveal-phone`, {
        method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.phone) { window.location.href = `tel:${d.phone}`; }
      else { setCallNote(d.message ?? "This seller prefers messages."); }
    } catch { setCallNote("Couldn't place the call — try again."); }
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
      {/* ── Header (full width): business + access + actions ── */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mb-2">
              <Shield size={10} /> CONFIDENTIAL
            </span>
            <h3 className="text-foreground font-bold text-xl leading-snug">{item.businessName}</h3>
            {item.city && (
              <div className="flex items-center gap-1.5 mt-1 text-muted-foreground text-sm">
                <MapPin size={12} /> <span>{item.city}</span>
              </div>
            )}
            <div className="mt-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Your Access</p>
              <div className="flex flex-wrap gap-2">
                <AccessBadge granted={item.permissions.canViewImReport}    label="Report"          icon={FileText}  />
                <AccessBadge granted={item.permissions.canViewWalkthrough} label="360° Walkthrough" icon={Video}     />
                <AccessBadge granted={item.permissions.canViewFinancials}  label="Financials"       icon={BarChart2} />
                <AccessBadge granted={item.permissions.canViewEquipment}   label="Equipment"        icon={Wrench}    />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5 lg:w-80 flex-shrink-0">
            {hasAnyAccess ? (
              <>
                {item.permissions.canViewImReport && reportHref && (
                  <Link href={reportHref}>
                    <a className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-semibold text-sm transition-opacity group">
                      <span className="flex items-center gap-2"><FileText size={15} /> View Information Memorandum</span>
                      <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                    </a>
                  </Link>
                )}
                {/* 360° listing + Call share one line to keep the header compact */}
                <div className="flex gap-2.5">
                  {item.permissions.canViewWalkthrough && item.listingId && (
                    <Link href={`/listings/${item.listingId}`}>
                      <a className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold text-sm transition-colors">
                        <Video size={15} className="text-primary" /> 360° Business Listing
                      </a>
                    </Link>
                  )}
                  <button onClick={callSeller} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold text-sm transition-colors">
                    <Phone size={15} className="text-green-500" /> Call
                  </button>
                </div>
                {callNote && <p className="text-[11px] text-muted-foreground text-center">{callNote}</p>}
              </>
            ) : (
              <div className="flex items-center gap-3 py-2 text-muted-foreground text-sm">
                <Lock size={14} /> <span>No content shared yet. Contact the seller.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Chat (left) + hero image (right), same size ── */}
      <div className="grid md:grid-cols-2 border-t border-border items-stretch">
        <div id={item.listingId ? `thread-${item.listingId}` : undefined} className="min-w-0 md:border-r border-border scroll-mt-24">
          <ThreadPanel thread={thread} listingName={item.businessName} sellerName={thread?.sellerName || "Seller"} onSend={onSend} />
        </div>
        <div className="relative min-h-[16rem] md:min-h-full bg-muted order-first md:order-none">
          {item.heroImageUrl ? (
            <img src={item.heroImageUrl} alt={item.businessName} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"><Building2 size={40} className="text-muted-foreground/40" /></div>
          )}
        </div>
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
          const mine = Object.values(all).filter((t) => t?.buyerId === myId).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
          setThreads(mine);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 4000);
    return () => { active = false; clearInterval(iv); };
  }, [data?.phone]);

  const unreadTotal = threads.reduce((n, t) => n + (t.unreadBuyer ?? 0), 0);
  const accessListingIds = new Set((data?.listings ?? []).map((l) => l.listingId));
  const orphanThreads = threads.filter((t) => !accessListingIds.has(t.listingId));

  // Send a message — creating the thread if this listing doesn't have one yet.
  async function sendMessageFor(item: { listingId: string | null; businessName: string }, existing: Thread | null, text: string) {
    if (!item.listingId || !data?.phone) return;
    const myId = "u-" + data.phone.replace(/\D/g, "");
    const threadId = existing?.id ?? `${item.listingId}_${myId}`;
    const optimistic: ThreadMsg = { id: `msg-${Date.now()}-web`, from: "buyer", text, timestamp: Date.now() };
    setThreads((prev) => {
      const has = prev.find((t) => t.id === threadId);
      if (has) return prev.map((t) => (t.id === threadId ? { ...t, messages: [...(t.messages ?? []), optimistic], updatedAt: optimistic.timestamp, unreadBuyer: 0 } : t));
      return [{ id: threadId, listingId: item.listingId!, listingName: item.businessName, sellerName: "Seller", buyerId: myId, messages: [optimistic], updatedAt: optimistic.timestamp, unreadBuyer: 0, unreadSeller: 1 }, ...prev];
    });
    try {
      // Atomic append — never rewrites the whole store, so messages can't be lost.
      await fetch("/api/biz360/threads/append", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, listingId: item.listingId, listingName: item.businessName, buyerId: myId, buyerName: data?.name ?? "Buyer", sellerName: existing?.sellerName ?? "Seller", from: "buyer", text }),
      });
      fetch("/api/biz360/notify-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId, from: "buyer" }) }).catch(() => {});
    } catch { /* ignore */ }
  }

  useEffect(() => {
    const token = localStorage.getItem("exit360_buyer_token");
    if (!token) { navigate("/buyers"); return; }
    fetch("/api/buyer-portal/my-access", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401) { localStorage.removeItem("exit360_buyer_token"); navigate("/buyers"); return null; }
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => setError("Could not load your listings. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  function handleSignOut() {
    try {
      localStorage.removeItem("exit360_buyer_token");
      localStorage.removeItem("biz360_web_user");
      localStorage.removeItem("biz360_web_auth_token");
    } catch { /* ignore */ }
    navigate("/buyers");
  }

  return (
    <div className="min-h-screen text-foreground flex flex-col">
      <style>{CHAT_STYLE}</style>
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <div className="flex items-center cursor-pointer text-foreground">
                <Logo height={28} />
              </div>
            </Link>
            <span className="text-border">/</span>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Buyer Portal</span>
          </div>
          {data && (
            <div className="flex items-center gap-3">
              {data.phone && (
                <div className="hidden sm:flex items-center gap-2 bg-secondary border border-border rounded-full px-3 py-1.5 text-xs text-muted-foreground">
                  <Phone size={11} /> {toLocalPhone(data.phone)}
                </div>
              )}
              <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <LogOut size={13} /> Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="border-b border-border theme-aurora-bg">
        <div className="relative z-10 max-w-[1440px] mx-auto px-6 py-10">
          <p className="text-primary text-xs font-bold uppercase tracking-widest mb-2">Confidential</p>
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Shared Listings</h1>
          <p className="text-muted-foreground text-sm">
            The seller has granted you secure access to the information below. All content is confidential and subject to NDA.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-[1440px] mx-auto w-full px-6 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Loading your listings…</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <p className="text-red-500 font-semibold mb-2">Something went wrong</p>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Try again</Button>
          </div>
        )}

        {!loading && !error && data && data.listings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center">
              <Building2 size={28} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-foreground font-bold text-lg mb-2">No listings shared yet</p>
              <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                The seller hasn't granted you access to any listings yet. Contact them directly if you were expecting to see information here.
              </p>
            </div>
            <Link href="/listings"><Button variant="outline" className="mt-2">Browse public listings</Button></Link>
          </div>
        )}

        {!loading && !error && data && data.listings.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground text-sm">
                {data.listings.length} {data.listings.length === 1 ? "listing" : "listings"} shared with you
              </p>
              <div className="flex items-center gap-1.5 text-xs text-primary font-medium"><Shield size={11} /> Verified access</div>
            </div>
            <EmailAlertsCard data={data} onSaved={(email) => setData((d) => (d ? { ...d, email, emailVerified: false } : d))} />
            <div className="flex flex-col gap-8">
              {data.listings.map((item) => {
                const thread = threads.find((t) => t.listingId === item.listingId) ?? null;
                return (
                  <PortalCard key={item.cafeId} item={item} thread={thread} onSend={(text) => sendMessageFor(item, thread, text)} />
                );
              })}
            </div>
          </>
        )}

        {/* Conversations not tied to a shared listing */}
        {!loading && !error && orphanThreads.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-2 mb-5">
              <MessageSquare size={16} className="text-primary" />
              <h2 className="text-foreground font-bold text-lg">Messages</h2>
              {unreadTotal > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold">
                  {unreadTotal > 9 ? "9+" : unreadTotal}
                </span>
              )}
            </div>
            {data && data.listings.length === 0 && (
              <EmailAlertsCard data={data} onSaved={(email) => setData((d) => (d ? { ...d, email, emailVerified: false } : d))} />
            )}
            <div className="flex flex-col gap-5">
              {orphanThreads.map((t) => (
                <div key={t.id} className="rounded-2xl border border-border bg-card/60 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-border/60 flex items-center gap-2">
                    <MessageSquare size={15} className="text-primary" />
                    <span className="text-foreground font-semibold text-sm flex-1 truncate">{t.listingName || "Enquiry"}</span>
                  </div>
                  <ThreadPanel thread={t} listingName={t.listingName} sellerName={t.sellerName || "Seller"}
                    onSend={(text) => sendMessageFor({ listingId: t.listingId, businessName: t.listingName }, t, text)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border py-6 px-6 text-center">
        <p className="text-xs text-muted-foreground">
          EXIT360 Buyer Portal — All content is confidential and may not be shared or distributed.{" "}
          <Link href="/listings"><span className="text-primary hover:opacity-80 cursor-pointer transition-opacity">Browse public listings</span></Link>
        </p>
      </div>
    </div>
  );
}
