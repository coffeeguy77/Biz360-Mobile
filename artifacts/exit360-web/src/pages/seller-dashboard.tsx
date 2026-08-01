import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import {
  LayoutDashboard, Eye, ShieldCheck, Users, FileText, Compass, Share2, Copy, Check,
  Settings, LogOut, Smartphone, Plus, BarChart3, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { SiteShell } from "@/components/SiteShell";
import { PhoneGate } from "@/components/PhoneGate";

const TOKEN_KEY = "biz360_web_auth_token";

function digitsOnly(s: string) { return (s || "").replace(/\D/g, "").replace(/^0+/, "").replace(/^61/, ""); }
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
  const [tab, setTab] = useState<"listings" | "profile">("listings");
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
      const mine = all.filter((l) => digitsOnly(l.submittedBy || "") && digitsOnly(l.submittedBy || "") === myPhoneDigits);
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

        <div className="flex gap-2 mb-6">
          {([["listings", "My Listings", LayoutDashboard], ["profile", "Seller Profile", Settings]] as const).map(([id, label, Icon]) => (
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
        </div>
      </div>
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
