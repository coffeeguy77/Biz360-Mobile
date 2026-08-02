import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import {
  LayoutDashboard, Eye, ShieldCheck, Users, FileText, Compass, Share2, Copy, Check,
  Settings, LogOut, Smartphone, Plus, BarChart3, Loader2, Layers, Star,
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
  const [tab, setTab] = useState<"listings" | "nda" | "profile">("listings");
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
          {([["listings", "My Listings", LayoutDashboard], ["nda", "NDA & Access", ShieldCheck], ["profile", "Seller Profile", Settings]] as const).map(([id, label, Icon]) => (
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
          <TourZones listing={listing} token={token} />
        </div>
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
