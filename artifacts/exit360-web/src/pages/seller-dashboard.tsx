import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import {
  LayoutDashboard, Eye, ShieldCheck, Users, FileText, Compass, Share2, Copy, Check,
  Settings, LogOut, Smartphone, Plus, BarChart3, Loader2, Layers, Star,
  MessageSquare, Send, Inbox, Phone, Mail, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { SiteShell } from "@/components/SiteShell";
import { PhoneGate } from "@/components/PhoneGate";

const TOKEN_KEY = "biz360_web_auth_token";

function digitsOnly(s: string) { return (s || "").replace(/\D/g, "").replace(/^0+/, "").replace(/^61/, ""); }
/**
 * Canonical AU mobile (national 9 digits) for owner matching. Handles every
 * shape the same seller appears as: u-61414631463, u-61414631463-<timestamp>
 * (app-created listings carry the timestamp), 0414631463, +61414631463, etc.
 */
function phoneKey(s: string) {
  let d = (s || "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.startsWith("61")) d = d.slice(2);
  return d.slice(0, 9);
}
function listingOwnedBy(l: Listing, mine: string): boolean {
  return [l.submittedBy, (l as any).sellerPhone, (l as any).ownerPhone, (l as any).phone, (l as any).contactPhone]
    .some((f) => { const k = phoneKey(String(f ?? "")); return !!k && k === mine; });
}
function subFromToken(t: string): string | null {
  try { const p = JSON.parse(atob(t.split(".")[1] || "")); return typeof p?.sub === "string" ? p.sub : null; } catch { return null; }
}

interface Listing { listingId: string; businessName?: string; sellerName?: string; city?: string; submittedBy?: string; heroImageUrl?: string; photos?: string[]; analyticsViewers?: string[]; }
interface Stats { reportViews: number; uniqueBuyers: number; ndaSigned: number; requestInfo: number; requestCall: number; requestVisit: number; tourClicks: number; }

export function SellerDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [myPhoneDigits, setMyPhoneDigits] = useState<string>("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [statsById, setStatsById] = useState<Record<string, Stats>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"listings" | "messages" | "crm" | "nda" | "profile">("listings");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      if (t) { setToken(t); const sub = subFromToken(t); if (sub) setMyPhoneDigits(digitsOnly(sub)); }
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch("/api/biz360/kv/biz360_admin_pending_v2");
      const j = await r.json().catch(() => ({}));
      const all: Listing[] = Array.isArray(j?.value) ? j.value : [];
      const me = phoneKey(myPhoneDigits);
      const mine = all.filter((l) => listingOwnedBy(l, me));
      setListings(mine);
      // Fetch analytics per listing
      const entries = await Promise.all(mine.map(async (l) => {
        try {
          const ar = await fetch(`/api/public/listing/${l.listingId}/analytics`, { headers: { Authorization: `Bearer ${token}` } });
          if (!ar.ok) return [l.listingId, null] as const;
          const ad = await ar.json();
          return [l.listingId, ad.stats as Stats] as const;
        } catch { return [l.listingId, null] as const; }
      }));
      const map: Record<string, Stats> = {};
      for (const [id, s] of entries) if (s) map[id] = s;
      setStatsById(map);
    } finally { setLoading(false); }
  }, [token, myPhoneDigits]);

  useEffect(() => { if (token && myPhoneDigits) load(); }, [token, myPhoneDigits, load]);

  function onVerified(t: string) {
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
    const sub = subFromToken(t); if (sub) setMyPhoneDigits(digitsOnly(sub));
    setToken(t);
  }
  function signOut() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
    setToken(null); setListings([]); setStatsById({});
  }

  if (!token) {
    return (
      <SiteShell>
        <Seo title="Seller Dashboard | EXIT360" description="Manage your business listings, 360° tours and buyer analytics on EXIT360." path="/seller" />
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl grid place-items-center theme-btn-gradient mx-auto mb-4"><LayoutDashboard className="text-primary-foreground" size={26} /></div>
            <h1 className="text-3xl font-extrabold tracking-tight">Seller dashboard</h1>
            <p className="text-muted-foreground mt-2">Sign in with your mobile number — the same one you use in the app.</p>
          </div>
          <PhoneGate title="Access your listings" subtitle="Your account is keyed to your phone, so everything syncs with the app." cta="Send my code" onVerified={onVerified} />
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <Seo title="Seller Dashboard | EXIT360" description="Manage your business listings, 360° tours and buyer analytics on EXIT360." path="/seller" />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Seller dashboard</h1>
            <p className="text-muted-foreground">Everything here stays in sync with the EXIT360 app.</p>
          </div>
          <button onClick={signOut} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-border bg-card/50 hover:border-primary/50"><LogOut size={14} /> Sign out</button>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {([["listings", "My Listings", LayoutDashboard], ["messages", "Messages", MessageSquare], ["crm", "CRM", Users], ["nda", "NDA & Access", ShieldCheck], ["profile", "Seller Profile", Settings]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${tab === id ? "theme-btn-gradient border-0 text-primary-foreground" : "border-border bg-card/40 text-muted-foreground hover:text-foreground"}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === "listings" ? (
          creating ? (
            <NewListingForm token={token} onDone={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} />
          ) : loading ? (
            <div className="text-center py-20 text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18} /> Loading your listings…</div>
          ) : listings.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card/50 p-10 text-center">
              <FileText className="mx-auto text-muted-foreground mb-3" size={34} />
              <h2 className="text-xl font-bold mb-2">No listings on this number yet</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-5">Start a listing right here on the web, then add your 360° walkthrough, photos and financial report in the EXIT360 app. Everything syncs by your phone number.</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button className="theme-btn-gradient border-0" onClick={() => setCreating(true)}><Plus size={16} className="mr-1" /> Create a listing</Button>
                <a href="#" className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-border text-muted-foreground"><Smartphone size={15} /> Get the app</a>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <Button className="theme-btn-gradient border-0" onClick={() => setCreating(true)}><Plus size={16} className="mr-1" /> New listing</Button>
              </div>
              <div className="space-y-5">
                {listings.map((l) => <ListingCard key={l.listingId} listing={l} stats={statsById[l.listingId]} token={token} myPhoneDigits={myPhoneDigits} onChange={load} />)}
              </div>
            </>
          )
        ) : tab === "messages" ? (
          <SellerInbox listings={listings} myPhoneDigits={myPhoneDigits} />
        ) : tab === "crm" ? (
          <SellerCRM listings={listings} token={token} onGoMessages={() => setTab("messages")} />
        ) : tab === "nda" ? (
          <NdaManager token={token} listings={listings} />
        ) : (
          <ProfileEditor token={token} />
        )}
      </div>
    </SiteShell>
  );
}

function StatChip({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 px-3 py-2.5 text-center">
      <Icon size={15} className="text-primary mx-auto mb-1" />
      <div className="text-lg font-bold leading-none">{value ?? 0}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function ListingCard({ listing, stats, token, myPhoneDigits, onChange }: { listing: Listing; stats?: Stats; token: string; myPhoneDigits: string; onChange: () => void }) {
  const [share, setShare] = useState(false);
  const [clientPhone, setClientPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const hero = listing.heroImageUrl || listing.photos?.[0];
  const shareUrl = `${window.location.origin}/broker/analytics/${listing.listingId}`;
  const viewers = listing.analyticsViewers ?? [];

  async function addViewer() {
    if (clientPhone.replace(/\D/g, "").length < 8) return;
    setSaving(true);
    try {
      await fetch(`/api/public/listing/${listing.listingId}/analytics-viewers`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: clientPhone, action: "add" }),
      });
      setClientPhone(""); onChange();
    } finally { setSaving(false); }
  }
  function copyLink() { navigator.clipboard?.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="sm:w-52 h-40 sm:h-auto bg-muted flex-shrink-0">
          {hero ? <img src={hero} alt={listing.businessName} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><FileText className="text-muted-foreground" size={28} /></div>}
        </div>
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-lg font-bold">{listing.businessName || listing.sellerName || "Untitled listing"}</h3>
              {listing.city && <p className="text-sm text-muted-foreground">{listing.city}</p>}
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Link href={`/reports/${listing.listingId}`}><Button size="sm" variant="outline" className="gap-1.5"><FileText size={14} /> Report</Button></Link>
              <Link href={`/listings/${listing.listingId}`}><Button size="sm" variant="outline" className="gap-1.5"><Compass size={14} /> Listing</Button></Link>
              <Link href={`/seller/tour/${listing.listingId}`}><Button size="sm" className="gap-1.5 theme-btn-gradient border-0"><Layers size={14} /> Tour editor</Button></Link>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
            <StatChip icon={Eye} label="Views" value={stats?.reportViews ?? 0} />
            <StatChip icon={Users} label="Buyers" value={stats?.uniqueBuyers ?? 0} />
            <StatChip icon={ShieldCheck} label="NDAs" value={stats?.ndaSigned ?? 0} />
            <StatChip icon={Compass} label="Tours" value={stats?.tourClicks ?? 0} />
            <StatChip icon={BarChart3} label="Info req" value={stats?.requestInfo ?? 0} />
            <StatChip icon={BarChart3} label="Calls" value={stats?.requestCall ?? 0} />
          </div>
          <button onClick={() => setShare((s) => !s)} className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold"><Share2 size={14} /> Share analytics with a client</button>
          {share && (
            <div className="mt-3 rounded-xl border border-border bg-background/50 p-4">
              <p className="text-xs text-muted-foreground mb-2">Add your client's mobile number so they can log in and see this listing's live stats — no need to ask you.</p>
              <div className="flex gap-2 mb-3">
                <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Client mobile e.g. 0412 345 678" className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60" />
                <Button size="sm" onClick={addViewer} disabled={saving} className="theme-btn-gradient border-0">{saving ? "…" : "Add"}</Button>
              </div>
              {viewers.length > 0 && <p className="text-xs text-muted-foreground mb-3">Authorised: {viewers.join(", ")}</p>}
              <div className="flex items-center gap-2">
                <input readOnly value={shareUrl} className="flex-1 px-3 py-2 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground" />
                <Button size="sm" variant="outline" onClick={copyLink} className="gap-1.5">{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</Button>
              </div>
            </div>
          )}
          <VisitorActivity listing={listing} token={token} />
          <EditDetails listing={listing} token={token} onSaved={onChange} />
          <TourBuilder listing={listing} token={token} />
          <BuyerAccess listing={listing} token={token} />
        </div>
      </div>
    </div>
  );
}

interface Member { id: string; phone: string; name: string | null; }
interface Perms { canViewImReport: boolean; canViewWalkthrough: boolean; canViewFinancials: boolean; canViewEquipment: boolean; }
interface Grp { id: string; name: string; description: string | null; members: Member[]; permissions: Perms | null; }

const PERM_ROWS: { key: keyof Perms; label: string; desc: string }[] = [
  { key: "canViewImReport",    label: "IM Report",       desc: "Full information memorandum" },
  { key: "canViewWalkthrough", label: "360° Walkthrough", desc: "Virtual tour of the premises" },
  { key: "canViewFinancials",  label: "Financials",       desc: "Revenue, EBITDA & chart data" },
  { key: "canViewEquipment",   label: "Equipment List",   desc: "Asset register with values" },
];

function BuyerAccess({ listing, token }: { listing: Listing; token: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cafeId, setCafeId] = useState<string | null | undefined>(undefined);
  const [groups, setGroups] = useState<Grp[]>([]);
  const [newGroup, setNewGroup] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const auth = { Authorization: `Bearer ${token}` };

  async function loadAll() {
    setLoading(true); setErr(null);
    try {
      const cr = await fetch(`/api/buyer-portal/seller/listing-cafe/${listing.listingId}`, { headers: auth });
      const cd = await cr.json();
      setCafeId(cd.cafeId ?? null);
      if (cd.cafeId) {
        const gr = await fetch(`/api/buyer-portal/groups?cafeId=${cd.cafeId}`, { headers: auth });
        const gd = await gr.json();
        setGroups(Array.isArray(gd.groups) ? gd.groups : []);
      }
    } catch { setErr("Could not load buyer access."); } finally { setLoading(false); }
  }
  function toggle() { const n = !open; setOpen(n); if (n && cafeId === undefined) loadAll(); }

  async function createGroup() {
    if (!newGroup.trim() || !cafeId) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/buyer-portal/groups`, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ cafeId, name: newGroup.trim() }) });
      const d = await r.json();
      if (r.ok && d.group) { setNewGroup(""); await loadAll(); } else setErr(d.error ?? "Could not create group.");
    } finally { setBusy(false); }
  }
  async function delGroup(id: string) {
    setBusy(true);
    try { await fetch(`/api/buyer-portal/groups/${id}`, { method: "DELETE", headers: auth }); await loadAll(); } finally { setBusy(false); }
  }
  async function addMember(gid: string, phone: string, name: string) {
    if (!phone.trim()) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/buyer-portal/groups/${gid}/members`, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ phone: phone.trim(), name: name.trim() || null }) });
      const d = await r.json();
      if (r.ok) await loadAll(); else setErr(d.error ?? "Could not add member.");
    } finally { setBusy(false); }
  }
  async function removeMember(gid: string, mid: string) {
    setBusy(true);
    try { await fetch(`/api/buyer-portal/groups/${gid}/members/${mid}`, { method: "DELETE", headers: auth }); await loadAll(); } finally { setBusy(false); }
  }
  async function setPerm(g: Grp, key: keyof Perms, val: boolean) {
    const base: Perms = g.permissions ?? { canViewImReport: false, canViewWalkthrough: false, canViewFinancials: false, canViewEquipment: false };
    const next = { ...base, [key]: val };
    setGroups((gs) => gs.map((x) => (x.id === g.id ? { ...x, permissions: next } : x)));
    try {
      await fetch(`/api/buyer-portal/groups/${g.id}/permissions`, { method: "PUT", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ cafeId, ...next }) });
    } catch { setErr("Could not save permission."); await loadAll(); }
  }

  return (
    <div className="mt-3">
      <button onClick={toggle} className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold">
        <ShieldCheck size={14} /> Buyer access {cafeId && groups.length > 0 && `(${groups.length} group${groups.length > 1 ? "s" : ""})`}
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-border bg-background/50 p-4">
          <p className="text-xs text-muted-foreground mb-3">Approve exactly who can see this report and which sections — right from the web. Buyers log in at exit360.com.au/buyers with their mobile.</p>
          {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading…</div>}
          {!loading && cafeId === null && (
            <p className="text-sm text-muted-foreground">Build this listing's report first (add your 360° tour, photos and financials in the EXIT360 app or the report builder), then you can manage buyer access here.</p>
          )}
          {!loading && cafeId && (
            <>
              <div className="flex gap-2 mb-3">
                <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="New group e.g. Shortlisted buyers" className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60" />
                <Button size="sm" onClick={createGroup} disabled={busy} className="theme-btn-gradient border-0">Add group</Button>
              </div>
              <div className="flex flex-col gap-3">
                {groups.map((g) => <GroupCard key={g.id} g={g} busy={busy} onDelete={() => delGroup(g.id)} onAddMember={(p, n) => addMember(g.id, p, n)} onRemoveMember={(mid) => removeMember(g.id, mid)} onPerm={(k, v) => setPerm(g, k, v)} />)}
                {groups.length === 0 && <p className="text-sm text-muted-foreground">No groups yet. Create one, add buyers by mobile, then switch on what they can see.</p>}
              </div>
            </>
          )}
          {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
        </div>
      )}
    </div>
  );
}

function GroupCard({ g, busy, onDelete, onAddMember, onRemoveMember, onPerm }: {
  g: Grp; busy: boolean; onDelete: () => void; onAddMember: (phone: string, name: string) => void; onRemoveMember: (mid: string) => void; onPerm: (k: keyof Perms, v: boolean) => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">{g.name}</span>
        <button onClick={onDelete} disabled={busy} className="text-[11px] text-red-400 hover:text-red-300">Delete</button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
        {PERM_ROWS.map((row) => {
          const on = g.permissions?.[row.key] ?? false;
          return (
            <div key={row.key} className="flex items-center justify-between gap-2">
              <span className={`text-xs ${on ? "text-foreground" : "text-muted-foreground"}`} title={row.desc}>{row.label}</span>
              <button onClick={() => onPerm(row.key, !on)} className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${on ? "theme-btn-gradient" : "bg-muted"}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {g.members.map((m) => (
          <span key={m.id} className="inline-flex items-center gap-1 text-[11px] bg-muted/60 rounded-full pl-2.5 pr-1 py-0.5">
            {m.name ? `${m.name} · ` : ""}{m.phone}
            <button onClick={() => onRemoveMember(m.id)} className="w-4 h-4 grid place-items-center rounded-full hover:bg-red-500/30 text-muted-foreground">×</button>
          </span>
        ))}
        {g.members.length === 0 && <span className="text-[11px] text-muted-foreground">No buyers yet</span>}
      </div>
      <div className="flex gap-1.5">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Buyer mobile e.g. +61412 345 678" className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs outline-none focus:border-primary/60" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className="w-28 px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs outline-none focus:border-primary/60" />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => { onAddMember(phone, name); setPhone(""); setName(""); }}>Add</Button>
      </div>
    </div>
  );
}

interface Zone { id: string; name: string; enabled: boolean; isStartScene: boolean; hasPano: boolean; }

function TourZones({ listing, token }: { listing: Listing; token: string }) {
  const [open, setOpen] = useState(false);
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadZones() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/buyer-portal/seller/tour-zones/${listing.listingId}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setZones(Array.isArray(d.zones) ? d.zones : []);
    } catch { setZones([]); } finally { setLoading(false); }
  }

  function toggle() { const next = !open; setOpen(next); if (next && zones === null) loadZones(); }

  async function setZone(z: Zone, enabled: boolean) {
    if (!zones) return;
    // Block switching off the last remaining zone.
    if (!enabled && zones.filter((x) => x.enabled).length <= 1) {
      setErr("At least one zone must stay switched on."); return;
    }
    setErr(null); setSavingId(z.id);
    const prev = zones;
    setZones(zones.map((x) => (x.id === z.id ? { ...x, enabled } : x)));
    try {
      const r = await fetch(`/api/buyer-portal/seller/tour-zones/${listing.listingId}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ zones: [{ id: z.id, enabled }] }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { setZones(prev); setErr(d.error ?? "Could not save."); }
    } catch { setZones(prev); setErr("Could not save."); } finally { setSavingId(null); }
  }

  return (
    <div className="mt-3">
      <button onClick={toggle} className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold">
        <Layers size={14} /> Tour zones {zones && `(${zones.filter((z) => z.enabled).length}/${zones.length} on)`}
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-border bg-background/50 p-4">
          <p className="text-xs text-muted-foreground mb-3">Switch a zone off to hide it from the public tour and report — it stays saved, so you can switch it back on anytime. Handy for areas not included in the sale.</p>
          {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading zones…</div>}
          {!loading && zones && zones.length === 0 && <p className="text-sm text-muted-foreground">No tour zones found for this listing yet. Add them in the EXIT360 app.</p>}
          {!loading && zones && zones.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {zones.map((z) => (
                <div key={z.id} className="flex items-center justify-between gap-3 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm truncate ${z.enabled ? "text-foreground" : "text-muted-foreground line-through"}`}>{z.name}</span>
                    {z.isStartScene && <span title="Start scene" className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary/80"><Star size={10} /> start</span>}
                    {!z.hasPano && <span className="text-[10px] text-muted-foreground">(no 360)</span>}
                  </div>
                  <button
                    onClick={() => setZone(z, !z.enabled)}
                    disabled={savingId === z.id}
                    title={z.enabled ? "Switch off (hide)" : "Switch on (show)"}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${z.enabled ? "theme-btn-gradient" : "bg-muted"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${z.enabled ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
        </div>
      )}
    </div>
  );
}

function NewListingForm({ token, onDone, onCancel }: { token: string; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ businessName: "", suburb: "", state: "VIC", category: "", description: "", askingPrice: "", priceDisplay: "askingPrice" as "askingPrice" | "poa" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = "w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60";
  const STATES = ["VIC", "NSW", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

  async function submit() {
    if (f.businessName.trim().length < 2) { setError("Please enter a business name."); return; }
    setSaving(true); setError(null);
    try {
      const r = await fetch("/api/biz360/seller/listings", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(f),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setError(d.error ?? "Could not create listing."); return; }
      onDone();
    } catch { setError("Network error. Please try again."); } finally { setSaving(false); }
  }

  return (
    <div className="max-w-2xl rounded-2xl border border-border bg-card/50 p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold">Create a listing</h2>
        <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Start here on the web, then open the app to add your 360° tour, photos and financial report — it's the same listing on both.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><label className="block text-xs font-medium text-muted-foreground mb-1.5">Business name *</label><input className={field} value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} placeholder="e.g. Bean Culture Coffee Roastery" /></div>
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Suburb</label><input className={field} value={f.suburb} onChange={(e) => setF({ ...f, suburb: e.target.value })} placeholder="e.g. Noosa Heads" /></div>
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">State</label><select className={field} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}>{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Category</label><input className={field} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="e.g. Café / Hospitality" /></div>
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Asking price ($)</label><input className={field} value={f.askingPrice} onChange={(e) => setF({ ...f, askingPrice: e.target.value })} placeholder="e.g. 185000" /></div>
        <div className="sm:col-span-2"><label className="block text-xs font-medium text-muted-foreground mb-1.5">Short description</label><textarea className={field} rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="A concise overview buyers see first" /></div>
      </div>
      <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer"><input type="checkbox" checked={f.priceDisplay === "poa"} onChange={(e) => setF({ ...f, priceDisplay: e.target.checked ? "poa" : "askingPrice" })} className="w-4 h-4 accent-[hsl(var(--primary))]" /> Show price as "POA" instead of a figure</label>
      {error && <p className="text-sm text-destructive mt-3">{error}</p>}
      <div className="flex gap-3 mt-5">
        <Button onClick={submit} disabled={saving} className="theme-btn-gradient border-0">{saving ? "Creating…" : "Create listing"}</Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function NdaManager({ token, listings }: { token: string; listings: Listing[] }) {
  const [tpl, setTpl] = useState("");
  const [def, setDef] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingTpl, setSavingTpl] = useState(false);
  const [savedTpl, setSavedTpl] = useState(false);

  useEffect(() => {
    fetch("/api/buyer-portal/seller/nda-template", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setTpl(d.template ?? ""); setDef(d.default ?? ""); } })
      .finally(() => setLoading(false));
  }, [token]);

  async function saveTpl() {
    setSavingTpl(true); setSavedTpl(false);
    try {
      await fetch("/api/buyer-portal/seller/nda-template", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ template: tpl }) });
      setSavedTpl(true); setTimeout(() => setSavedTpl(false), 2000);
    } finally { setSavingTpl(false); }
  }

  const field = "w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60";
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Default template */}
      <div className="rounded-2xl border border-border bg-card/50 p-6">
        <h2 className="text-lg font-bold mb-1">Your default NDA template</h2>
        <p className="text-sm text-muted-foreground mb-4">
          This wording is shown to every buyer before your reports unlock — across all your listings. Edit it once and
          it becomes your default for every future listing. Leave blank to use the EXIT360 standard NDA.
        </p>
        {loading ? <p className="text-sm text-muted-foreground py-4">Loading…</p> : (
          <>
            <textarea className={field} rows={8} value={tpl} onChange={(e) => setTpl(e.target.value)} placeholder={def} />
            <div className="flex gap-2 mt-3">
              <Button onClick={saveTpl} disabled={savingTpl} className="theme-btn-gradient border-0">{savingTpl ? "Saving…" : savedTpl ? <><Check size={16} className="mr-1" /> Saved</> : "Save template"}</Button>
              <Button variant="outline" onClick={() => setTpl(def)}>Reset to standard</Button>
            </div>
          </>
        )}
      </div>

      {/* Per-listing access control */}
      <div>
        <h2 className="text-lg font-bold mb-1">Per-listing access</h2>
        <p className="text-sm text-muted-foreground mb-4">Grant a specific buyer access manually (case-by-case), or make a listing seller-grant-only.</p>
        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No listings yet.</p>
        ) : (
          <div className="space-y-4">
            {listings.map((l) => <NdaListingRow key={l.listingId} token={token} listing={l} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function NdaListingRow({ token, listing }: { token: string; listing: Listing }) {
  const [manualOnly, setManualOnly] = useState(false);
  const [sigs, setSigs] = useState<{ name: string; phone: string; version?: string }[]>([]);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [granting, setGranting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/buyer-portal/seller/nda/${listing.listingId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setManualOnly(!!d.manualOnly); setSigs(d.signatures ?? []); } });
  }, [token, listing.listingId]);
  useEffect(() => { load(); }, [load]);

  async function toggleManual(v: boolean) {
    setManualOnly(v);
    await fetch(`/api/buyer-portal/seller/nda/${listing.listingId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ manualOnly: v }) });
  }
  async function grant() {
    if (phone.replace(/\D/g, "").length < 8) { setMsg("Enter a valid mobile number."); return; }
    setGranting(true); setMsg(null);
    try {
      const r = await fetch(`/api/buyer-portal/seller/nda/${listing.listingId}/grant`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ phone, name }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setMsg(d.error ?? "Could not grant access."); return; }
      setPhone(""); setName(""); setMsg("Access granted."); load();
    } finally { setGranting(false); }
  }

  const field = "px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60";
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className="font-bold">{listing.businessName || listing.sellerName || "Listing"}</h3>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={manualOnly} onChange={(e) => toggleManual(e.target.checked)} className="w-4 h-4 accent-[hsl(var(--primary))]" />
          Seller-grant only (buyers can't self-sign)
        </label>
      </div>
      <div className="flex gap-2 flex-wrap items-end">
        <div><label className="block text-[11px] text-muted-foreground mb-1">Buyer mobile</label><input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0412 345 678" /></div>
        <div><label className="block text-[11px] text-muted-foreground mb-1">Buyer name (optional)</label><input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" /></div>
        <Button size="sm" onClick={grant} disabled={granting} className="theme-btn-gradient border-0">{granting ? "…" : "Grant access"}</Button>
      </div>
      {msg && <p className="text-xs text-muted-foreground mt-2">{msg}</p>}
      <p className="text-xs text-muted-foreground mt-3">
        {sigs.length} {sigs.length === 1 ? "buyer has" : "buyers have"} access{sigs.length ? `: ${sigs.slice(0, 6).map((s) => s.name || s.phone).join(", ")}${sigs.length > 6 ? "…" : ""}` : "."}
      </p>
    </div>
  );
}

function ProfileEditor({ token }: { token: string }) {
  const [form, setForm] = useState({ displayName: "", company: "", bio: "", phone: "", showPhone: true, anonymous: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/biz360/seller/profile", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setForm((f) => ({ ...f, displayName: d.displayName ?? "", company: d.company ?? "", bio: d.bio ?? "", phone: d.phone ?? "", showPhone: d.showPhone !== false, anonymous: d.anonymous === true })); })
      .finally(() => setLoading(false));
  }, [token]);

  async function save() {
    setSaving(true); setSaved(false);
    try {
      await fetch("/api/biz360/seller/profile", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="text-center py-16 text-muted-foreground">Loading profile…</div>;
  const field = "w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60";
  return (
    <div className="max-w-xl rounded-2xl border border-border bg-card/50 p-6">
      <h2 className="text-lg font-bold mb-1">Seller profile</h2>
      <p className="text-sm text-muted-foreground mb-5">Shown to buyers on your listings. Syncs with the app.</p>
      <div className="space-y-4">
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Display name</label><input className={field} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="e.g. Sarah — Bean Culture" /></div>
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Company / firm</label><input className={field} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Optional" /></div>
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Bio</label><textarea className={field} rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="A short intro buyers see" /></div>
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Contact phone</label><input className={field} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Revealed only after a buyer verifies theirs" /></div>
        <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.showPhone} onChange={(e) => setForm({ ...form, showPhone: e.target.checked })} className="w-4 h-4 accent-[hsl(var(--primary))]" /><span className="text-sm">Allow buyers to reveal my phone (after they verify theirs)</span></label>
        <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.anonymous} onChange={(e) => setForm({ ...form, anonymous: e.target.checked })} className="w-4 h-4 accent-[hsl(var(--primary))]" /><span className="text-sm">Stay anonymous — buyers contact me by secure message only</span></label>
      </div>
      <Button onClick={save} disabled={saving} className="mt-6 theme-btn-gradient border-0">{saving ? "Saving…" : saved ? <><Check size={16} className="mr-1" /> Saved</> : "Save profile"}</Button>
    </div>
  );
}

// ─── Seller messaging inbox ───────────────────────────────────────────────────
interface InboxMsg { id: string; from: string; text: string; timestamp: number; }
interface InboxThread {
  id: string; listingId: string; listingName?: string; sellerName?: string;
  buyerName?: string; buyerId: string; messages: InboxMsg[]; updatedAt: number;
  unreadBuyer?: number; unreadSeller?: number;
}

function buyerLabel(t: InboxThread): string {
  if (t.buyerName && !/^u-/.test(t.buyerName) && !/^\+?\d+$/.test(t.buyerName)) return t.buyerName;
  const d = String(t.buyerId ?? "").replace(/\D/g, "");
  if (d.length >= 9) return "+" + d;
  return "Buyer";
}
function fmtWhen(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function SellerInbox({ listings, myPhoneDigits }: { listings: Listing[]; myPhoneDigits: string }) {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const ownedIds = new Set(listings.map((l) => l.listingId));
  const nameById: Record<string, string> = {};
  listings.forEach((l) => { nameById[l.listingId] = l.businessName || l.sellerName || "Listing"; });

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/biz360/kv/biz360_threads_v3");
      const j = await r.json();
      const all = (j?.value ?? {}) as Record<string, InboxThread>;
      const mine = Object.values(all).filter((t) => t && ownedIds.has(t.listingId)).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      setThreads(mine);
    } catch { /* ignore */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv); /* eslint-disable-next-line */ }, [listings.length]);

  const selected = threads.find((t) => t.id === selId) ?? null;

  async function markRead(threadId: string) {
    // Atomic — only zeroes a counter, never rewrites the message store.
    fetch("/api/biz360/threads/mark-read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId, side: "seller" }) }).catch(() => {});
  }
  function openThread(t: InboxThread) {
    setSelId(t.id);
    if (t.unreadSeller) { setThreads((prev) => prev.map((x) => (x.id === t.id ? { ...x, unreadSeller: 0 } : x))); markRead(t.id); }
  }

  async function send() {
    if (!reply.trim() || !selected) return;
    setSending(true);
    const text = reply.trim();
    const msg: InboxMsg = { id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, from: "seller", text, timestamp: Date.now() };
    setThreads((prev) => prev.map((t) => (t.id === selected.id ? { ...t, messages: [...(t.messages ?? []), msg], updatedAt: msg.timestamp } : t)));
    setReply("");
    try {
      // Atomic append — never rewrites the whole store, so nothing can be lost.
      await fetch("/api/biz360/threads/append", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: selected.id, listingId: selected.listingId, listingName: nameById[selected.listingId] ?? selected.listingName, buyerId: selected.buyerId, buyerName: selected.buyerName, sellerName: selected.sellerName || "Seller", from: "seller", text }),
      });
      fetch("/api/biz360/notify-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: selected.id, from: "seller" }) }).catch(() => {});
    } finally { setSending(false); }
  }

  if (loading) return <div className="text-center py-20 text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18} /> Loading conversations…</div>;
  if (threads.length === 0) return (
    <div className="rounded-2xl border border-border bg-card/50 p-10 text-center">
      <Inbox className="mx-auto text-muted-foreground mb-3" size={34} />
      <h2 className="text-xl font-bold mb-2">No conversations yet</h2>
      <p className="text-muted-foreground max-w-md mx-auto">When a buyer messages you about a listing, it appears here. Replies sync with the app and the buyer's portal instantly.</p>
    </div>
  );

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-4 rounded-2xl border border-border bg-card/40 overflow-hidden" style={{ minHeight: 480 }}>
      <div className="border-b md:border-b-0 md:border-r border-border max-h-[560px] overflow-y-auto themed-scroll">
        {threads.map((t) => {
          const last = t.messages?.[t.messages.length - 1];
          const active = t.id === selId;
          return (
            <button key={t.id} onClick={() => openThread(t)} className={`w-full text-left p-3.5 border-b border-border/60 transition-colors ${active ? "bg-primary/10" : "hover:bg-muted/40"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold truncate">{buyerLabel(t)}</span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{fmtWhen(t.updatedAt)}</span>
              </div>
              <div className="text-[11px] text-primary/80 truncate">{nameById[t.listingId] ?? t.listingName ?? "Listing"}</div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">{last ? (last.from === "seller" ? "You: " : "") + last.text : "No messages yet"}</div>
              {!!t.unreadSeller && <span className="inline-block mt-1 text-[10px] font-bold text-primary-foreground theme-btn-gradient rounded-full px-1.5">{t.unreadSeller} new</span>}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col max-h-[560px]">
        {selected ? (
          <>
            <div className="p-3.5 border-b border-border flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{buyerLabel(selected)}</div>
                <div className="text-[11px] text-muted-foreground truncate">{nameById[selected.listingId] ?? selected.listingName}</div>
              </div>
              <a href={`tel:${"+" + String(selected.buyerId).replace(/\D/g, "")}`} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:border-primary/50"><Phone size={12} /> Call</a>
            </div>
            <div className="flex-1 overflow-y-auto themed-scroll p-4 flex flex-col gap-2">
              {(selected.messages ?? []).map((m) => (
                <div key={m.id} className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${m.from === "seller" ? "self-end theme-btn-gradient text-primary-foreground rounded-br-sm" : "self-start bg-muted text-foreground rounded-bl-sm"}`}>
                  {m.text}
                  <div className={`text-[9px] mt-1 ${m.from === "seller" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{fmtWhen(m.timestamp)}</div>
                </div>
              ))}
              {(selected.messages ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center my-auto">No messages yet.</p>}
            </div>
            <div className="p-3 border-t border-border flex gap-2">
              <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Type a reply…" className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60" />
              <Button size="sm" onClick={send} disabled={sending || !reply.trim()} className="theme-btn-gradient border-0"><Send size={14} /></Button>
            </div>
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-muted-foreground text-sm p-8">Select a conversation to read and reply.</div>
        )}
      </div>
    </div>
  );
}

// ─── Seller CRM ───────────────────────────────────────────────────────────────
interface Contact { phone: string; name: string; listings: Set<string>; messaged: boolean; ndaSigned: boolean; lastActivity: number; }

function SellerCRM({ listings, token, onGoMessages }: { listings: Listing[]; token: string; onGoMessages: () => void }) {
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const nameById: Record<string, string> = {};
  listings.forEach((l) => { nameById[l.listingId] = l.businessName || l.sellerName || "Listing"; });

  useEffect(() => {
    let cancelled = false;
    async function build() {
      setLoading(true);
      const map = new Map<string, Contact>();
      const key = (p: string) => { let d = p.replace(/\D/g, "").replace(/^0+/, ""); if (d.startsWith("61")) d = d.slice(2); return d.slice(-9); };
      const upsert = (phone: string, name: string, listingId: string, opts: Partial<Contact>, ts: number) => {
        const k = key(phone); if (k.length < 6) return;
        const disp = "+" + phone.replace(/\D/g, "");
        const c = map.get(k) ?? { phone: disp, name: "", listings: new Set<string>(), messaged: false, ndaSigned: false, lastActivity: 0 };
        if (name && !/^u-/.test(name) && !/^\+?\d+$/.test(name)) c.name = c.name || name;
        c.listings.add(nameById[listingId] ?? listingId);
        if (opts.messaged) c.messaged = true;
        if (opts.ndaSigned) c.ndaSigned = true;
        c.lastActivity = Math.max(c.lastActivity, ts || 0);
        map.set(k, c);
      };
      try {
        const ownedIds = new Set(listings.map((l) => l.listingId));
        // Threads (enquirers)
        const tr = await fetch("/api/biz360/kv/biz360_threads_v3").then((r) => r.json()).catch(() => ({}));
        const all = (tr?.value ?? {}) as Record<string, any>;
        Object.values(all).forEach((t: any) => {
          if (!t || !ownedIds.has(t.listingId)) return;
          const digits = String(t.buyerId ?? "").replace(/\D/g, "");
          if (digits) upsert(digits, t.buyerName ?? "", t.listingId, { messaged: true }, t.updatedAt ?? 0);
        });
        // NDA signers per listing
        await Promise.all(listings.map(async (l) => {
          try {
            const d = await fetch(`/api/buyer-portal/seller/nda/${l.listingId}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
            (d?.signatures ?? []).forEach((s: any) => { if (s?.phone) upsert(s.phone, s.name ?? "", l.listingId, { ndaSigned: true }, s.signedAt ? new Date(s.signedAt).getTime() : 0); });
          } catch { /* ignore */ }
        }));
      } catch { /* ignore */ }
      if (!cancelled) { setContacts(Array.from(map.values()).sort((a, b) => b.lastActivity - a.lastActivity)); setLoading(false); }
    }
    build();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings.length]);

  const filtered = contacts.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q));

  if (loading) return <div className="text-center py-20 text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18} /> Building your CRM…</div>;

  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold">Buyer CRM</h3>
          <p className="text-xs text-muted-foreground">Everyone who's enquired, signed an NDA or is in your buyer portal — across all your listings.</p>
        </div>
        <div className="relative">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or number" className="pl-3 pr-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60 w-56" />
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground text-sm">No buyer contacts yet. They'll appear here as buyers enquire and sign NDAs.</div>
      ) : (
        <div className="divide-y divide-border/60">
          {filtered.map((c) => (
            <div key={c.phone} className="p-3.5 flex items-center gap-3 flex-wrap">
              <div className="w-9 h-9 rounded-full theme-btn-gradient grid place-items-center text-primary-foreground text-sm font-bold flex-shrink-0">{(c.name || c.phone).replace("+", "").slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{c.name || c.phone}</div>
                <div className="text-[11px] text-muted-foreground truncate">{c.name ? c.phone + " · " : ""}{Array.from(c.listings).join(", ")}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {c.messaged && <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-primary/15 text-primary">Messaged</span>}
                {c.ndaSigned && <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-emerald-500/15 text-emerald-400">NDA signed</span>}
                {c.lastActivity > 0 && <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><Clock size={10} />{fmtWhen(c.lastActivity)}</span>}
                <a href={`tel:${c.phone}`} className="w-7 h-7 grid place-items-center rounded-lg border border-border hover:border-primary/50" title="Call"><Phone size={12} /></a>
                <button onClick={onGoMessages} className="w-7 h-7 grid place-items-center rounded-lg border border-border hover:border-primary/50" title="Messages"><MessageSquare size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Edit listing details (web) ───────────────────────────────────────────────
const STATES = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "ACT", "NT"];
function EditDetails({ listing, token, onSaved }: { listing: Listing; token: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState<any>(null);
  const auth = { Authorization: `Bearer ${token}` };

  async function loadOne() {
    setLoading(true);
    try {
      const j = await fetch("/api/biz360/kv/biz360_admin_pending_v2").then((r) => r.json());
      const rec = (Array.isArray(j?.value) ? j.value : []).find((l: any) => l?.listingId === listing.listingId) ?? {};
      setF({
        businessName: rec.businessName ?? listing.businessName ?? "",
        suburb: rec.suburb ?? "", state: rec.state ?? "VIC", category: rec.category ?? "",
        description: rec.description ?? "",
        priceDisplay: rec.priceDisplay ?? "askingPrice",
        askingPrice: rec.askingPrice ? String(rec.askingPrice) : "",
        askingPriceMin: rec.askingPriceMin ? String(rec.askingPriceMin) : "",
        askingPriceMax: rec.askingPriceMax ? String(rec.askingPriceMax) : "",
      });
    } finally { setLoading(false); }
  }
  function toggle() { const n = !open; setOpen(n); if (n && !f) loadOne(); }
  async function save() {
    if (!f) return;
    setSaving(true); setSaved(false);
    try {
      await fetch(`/api/biz360/seller/listings/${listing.listingId}`, { method: "PUT", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify(f) });
      setSaved(true); onSaved(); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <div className="mt-3">
      <button onClick={toggle} className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold"><FileText size={14} /> Edit details</button>
      {open && (
        <div className="mt-3 rounded-xl border border-border bg-background/50 p-4">
          {loading || !f ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading…</div> : (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold sm:col-span-2">Business name
                <input value={f.businessName} onChange={(e) => set("businessName", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-normal outline-none focus:border-primary/60" />
              </label>
              <label className="text-xs font-semibold">Suburb
                <input value={f.suburb} onChange={(e) => set("suburb", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-normal outline-none focus:border-primary/60" />
              </label>
              <label className="text-xs font-semibold">State
                <select value={f.state} onChange={(e) => set("state", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-normal outline-none focus:border-primary/60">{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              </label>
              <label className="text-xs font-semibold sm:col-span-2">Category
                <input value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="e.g. Food & Beverage" className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-normal outline-none focus:border-primary/60" />
              </label>
              <label className="text-xs font-semibold sm:col-span-2">Description
                <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={4} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-normal outline-none focus:border-primary/60" />
              </label>
              <label className="text-xs font-semibold">Price display
                <select value={f.priceDisplay} onChange={(e) => set("priceDisplay", e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-normal outline-none focus:border-primary/60">
                  <option value="askingPrice">Asking price</option><option value="poa">POA</option>
                </select>
              </label>
              <label className="text-xs font-semibold">Asking price ($)
                <input value={f.askingPrice} onChange={(e) => set("askingPrice", e.target.value)} placeholder="e.g. 1800000" className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-normal outline-none focus:border-primary/60" />
              </label>
              <div className="sm:col-span-2">
                <Button size="sm" onClick={save} disabled={saving} className="theme-btn-gradient border-0">{saving ? "Saving…" : saved ? <><Check size={14} className="mr-1" /> Saved</> : "Save details"}</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Web tour builder ─────────────────────────────────────────────────────────
interface BSpace { id: string; name: string; panoramaUrl: string; isStartScene?: boolean; enabled?: boolean; pins?: any[]; autoPan?: boolean; }
function fileToB64(file: File): Promise<{ data: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); resolve({ data: s.split(",")[1] ?? "", mime: (s.match(/^data:(.*?);/) ?? [])[1] ?? file.type }); };
    r.onerror = reject; r.readAsDataURL(file);
  });
}
function TourBuilder({ listing, token }: { listing: Listing; token: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [spaces, setSpaces] = useState<BSpace[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const auth = { Authorization: `Bearer ${token}` };

  async function loadSpaces() {
    setLoading(true); setErr(null);
    try {
      const j = await fetch(`/api/biz360/kv/biz360_tour_spaces_v2_${listing.listingId}`).then((r) => r.json());
      const arr = Array.isArray(j?.value) ? j.value : (Array.isArray(j) ? j : []);
      setSpaces(arr.map((s: any) => ({ id: s.id, name: s.name, panoramaUrl: s.panoramaUrl ?? "", isStartScene: !!s.isStartScene, enabled: s.enabled, pins: s.pins ?? [], autoPan: !!s.autoPan })));
    } catch { setErr("Could not load tour."); } finally { setLoading(false); }
  }
  function toggle() { const n = !open; setOpen(n); if (n && spaces.length === 0) loadSpaces(); }

  function mutate(fn: (s: BSpace[]) => BSpace[]) { setSpaces((s) => fn(s)); setDirty(true); }
  async function save() {
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/buyer-portal/seller/tour-spaces/${listing.listingId}`, { method: "PUT", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ spaces }) });
      const d = await r.json();
      if (r.ok && d.ok) { setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000); } else setErr(d.error ?? "Could not save.");
    } finally { setSaving(false); }
  }

  async function onUpload(file: File) {
    if (!file) return;
    setUploading(true); setErr(null);
    try {
      const { data, mime } = await fileToB64(file);
      const key = `pano_${Date.now()}`;
      const r = await fetch("/api/biz360/img", { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ key, data, mimeType: mime, listingId: listing.listingId }) });
      const d = await r.json();
      if (!r.ok || !d.url) { setErr(d.error ?? "Upload failed."); return; }
      const space: BSpace = { id: `space-${Date.now()}`, name: newName.trim() || `Space ${spaces.length + 1}`, panoramaUrl: d.url, isStartScene: spaces.length === 0, enabled: true, pins: [] };
      mutate((s) => [...s, space]); setNewName("");
    } catch { setErr("Upload failed."); } finally { setUploading(false); }
  }

  function move(i: number, dir: -1 | 1) { const j = i + dir; if (j < 0 || j >= spaces.length) return; mutate((s) => { const a = [...s]; [a[i], a[j]] = [a[j], a[i]]; return a; }); }
  function setStart(id: string) { mutate((s) => s.map((x) => ({ ...x, isStartScene: x.id === id }))); }
  function rename(id: string, name: string) { mutate((s) => s.map((x) => (x.id === id ? { ...x, name } : x))); }
  function toggleEnabled(id: string) { mutate((s) => s.map((x) => (x.id === id ? { ...x, enabled: x.enabled === false ? true : false } : x))); }
  function del(id: string) { mutate((s) => s.filter((x) => x.id !== id)); }

  return (
    <div className="mt-3">
      <button onClick={toggle} className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold"><Layers size={14} /> Tour builder {spaces.length > 0 && `(${spaces.length})`}</button>
      {open && (
        <div className="mt-3 rounded-xl border border-border bg-background/50 p-4">
          <p className="text-xs text-muted-foreground mb-3">Build and edit the 360° tour from your computer — add spaces, upload panoramas, reorder, pick the start scene and hide zones. Saves back to the same tour the app uses. (Nav-pin placement between rooms is still done in the app.)</p>
          {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading tour…</div>}
          {!loading && (
            <>
              <div className="flex flex-col gap-2 mb-3">
                {spaces.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border bg-card/40 p-2">
                    {s.panoramaUrl ? <img src={s.panoramaUrl} alt="" className="w-14 h-10 object-cover rounded flex-shrink-0" /> : <div className="w-14 h-10 rounded bg-muted grid place-items-center text-muted-foreground flex-shrink-0"><Layers size={14} /></div>}
                    <input value={s.name} onChange={(e) => rename(s.id, e.target.value)} className={`flex-1 min-w-0 px-2 py-1 rounded border border-transparent hover:border-border bg-transparent text-sm outline-none focus:border-primary/60 ${s.enabled === false ? "line-through text-muted-foreground" : ""}`} />
                    <button onClick={() => setStart(s.id)} title="Start scene" className={`text-[10px] px-1.5 py-1 rounded ${s.isStartScene ? "theme-btn-gradient text-primary-foreground" : "border border-border text-muted-foreground"}`}><Star size={11} /></button>
                    <button onClick={() => toggleEnabled(s.id)} title={s.enabled === false ? "Hidden — show" : "Shown — hide"} className="text-muted-foreground hover:text-foreground p-1">{s.enabled === false ? <Eye size={13} /> : <ShieldCheck size={13} />}</button>
                    <div className="flex flex-col">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground disabled:opacity-30 leading-none">▲</button>
                      <button onClick={() => move(i, 1)} disabled={i === spaces.length - 1} className="text-muted-foreground disabled:opacity-30 leading-none">▼</button>
                    </div>
                    <button onClick={() => del(s.id)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
                  </div>
                ))}
                {spaces.length === 0 && <p className="text-sm text-muted-foreground">No spaces yet. Upload your first 360° panorama below.</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New space name (optional)" className="flex-1 min-w-[140px] px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60" />
                <label className={`inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border cursor-pointer hover:border-primary/50 ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                  {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Plus size={14} /> Upload panorama</>}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file); e.currentTarget.value = ""; }} />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={save} disabled={saving || !dirty} className="theme-btn-gradient border-0">{saving ? "Saving…" : saved ? <><Check size={14} className="mr-1" /> Saved</> : dirty ? "Save tour" : "Saved"}</Button>
                {dirty && <span className="text-[11px] text-muted-foreground">Unsaved changes</span>}
              </div>
            </>
          )}
          {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Report visitor activity ──────────────────────────────────────────────────
interface Visitor { phone: string | null; name: string | null; anonymous: boolean; visits: number; firstSeen: number; lastSeen: number; docs?: Record<string, number>; }
function relTime(ts: number): string {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" });
}
function VisitorActivity({ listing, token }: { listing: Listing; token: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visitors, setVisitors] = useState<Visitor[] | null>(null);
  const [totals, setTotals] = useState<{ totalViews: number; uniqueVisitors: number }>({ totalViews: 0, uniqueVisitors: 0 });

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/public/listing/${listing.listingId}/visitors`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setVisitors(Array.isArray(d.visitors) ? d.visitors : []);
      setTotals({ totalViews: d.totalViews ?? 0, uniqueVisitors: d.uniqueVisitors ?? 0 });
    } catch { setVisitors([]); } finally { setLoading(false); }
  }
  function toggle() { const n = !open; setOpen(n); if (n && visitors === null) load(); }

  return (
    <div className="mt-3">
      <button onClick={toggle} className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold"><Clock size={14} /> Visitor activity {visitors && `· ${totals.totalViews} views`}</button>
      {open && (
        <div className="mt-3 rounded-xl border border-border bg-background/50 p-4">
          <p className="text-xs text-muted-foreground mb-3">Who's opened this report, when, and how often. Signed-in buyers show their name/number; others show as anonymous.</p>
          {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading activity…</div>}
          {!loading && visitors && (
            <>
              <div className="flex gap-4 mb-3">
                <div><div className="text-lg font-bold">{totals.totalViews}</div><div className="text-[10px] text-muted-foreground uppercase">Total views</div></div>
                <div><div className="text-lg font-bold">{totals.uniqueVisitors}</div><div className="text-[10px] text-muted-foreground uppercase">Unique visitors</div></div>
                <div><div className="text-lg font-bold">{visitors.filter((v) => !v.anonymous).length}</div><div className="text-[10px] text-muted-foreground uppercase">Signed-in</div></div>
              </div>
              {visitors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No report visits yet.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {visitors.map((v, i) => (
                    <div key={i} className="py-2 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full grid place-items-center text-[11px] font-bold flex-shrink-0 ${v.anonymous ? "bg-muted text-muted-foreground" : "theme-btn-gradient text-primary-foreground"}`}>{v.anonymous ? "?" : (v.name || v.phone || "").replace(/\D/g, "").slice(-2) || "B"}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{v.anonymous ? "Anonymous visitor" : (v.name || v.phone)}</div>
                        <div className="text-[11px] text-muted-foreground">{v.anonymous ? "Not signed in" : v.phone} · first seen {relTime(v.firstSeen)}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold">{v.visits}<span className="text-[10px] font-normal text-muted-foreground"> {v.visits === 1 ? "visit" : "visits"}</span></div>
                        <div className="text-[10px] text-muted-foreground">last {relTime(v.lastSeen)}</div>
                      </div>
                      {!v.anonymous && v.phone && <a href={`tel:${v.phone}`} className="w-7 h-7 grid place-items-center rounded-lg border border-border hover:border-primary/50" title="Call"><Phone size={12} /></a>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
