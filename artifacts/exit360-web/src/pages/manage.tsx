import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ShieldCheck, Users, FileCheck2, Search as SearchIcon, Loader2, Check, X, Ban,
  RotateCcw, Eye, EyeOff, Globe, Save, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { PAGE_CONTENT } from "@/content/copy";

const TOKEN_KEY = "biz360_web_auth_token";
const inp = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60";

export function Manage() {
  const token = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [me, setMe] = useState<{ isAdmin: boolean; isSuperAdmin: boolean } | null | undefined>(undefined);
  const [tab, setTab] = useState<"listings" | "users" | "seo">("listings");

  useEffect(() => {
    if (!token) { setMe(null); return; }
    fetch("/api/admin/me", { headers: auth }).then((r) => r.json()).then(setMe).catch(() => setMe(null));
    // eslint-disable-next-line
  }, [token]);

  if (me === undefined) return <Center><Loader2 className="animate-spin" /></Center>;
  if (!token || !me?.isAdmin) return (
    <Center>
      <ShieldCheck className="mx-auto mb-3 text-muted-foreground" size={32} />
      <p className="mb-3 font-semibold">Admin access only</p>
      <p className="text-sm text-muted-foreground mb-4">This area is restricted to EXIT360 site administrators.</p>
      <Link href="/"><Button variant="outline">Back to site</Button></Link>
    </Center>
  );

  const TABS = [["listings", "Listings", FileCheck2], ["users", "Users & roles", Users], ["seo", "SEO & site", Globe]] as const;
  return (
    <div className="min-h-screen">
      <Seo title="Manage · EXIT360" description="EXIT360 site administration." path="/manage" />
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Site</Link>
        <span className="font-bold inline-flex items-center gap-1.5"><ShieldCheck size={16} className="text-primary" /> Site management</span>
        {me.isSuperAdmin && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">super-admin</span>}
      </div>
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex gap-2 flex-wrap mb-5">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${tab === id ? "theme-btn-gradient border-0 text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}><Icon size={14} /> {label}</button>
          ))}
        </div>
        {tab === "listings" && <Listings auth={auth} />}
        {tab === "users" && <UsersTab auth={auth} isSuper={me.isSuperAdmin} />}
        {tab === "seo" && <SeoTab auth={auth} />}
      </div>
    </div>
  );
}
function Center({ children }: { children: any }) { return <div className="min-h-[70vh] grid place-items-center text-center p-8 max-w-lg mx-auto">{children}</div>; }
function Card({ children, className = "" }: { children: any; className?: string }) { return <div className={`rounded-2xl border border-border bg-card p-4 ${className}`}>{children}</div>; }
const money = (v: any) => { const n = Number(v ?? 0) || 0; return n ? `$${n.toLocaleString()}` : "—"; };

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  rejected: "bg-red-500/15 text-red-300 border-red-500/40",
};

// ── Listings moderation ──
function Listings({ auth }: { auth: any }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { const d = await fetch("/api/admin/listings", { headers: auth }).then((r) => r.json()); setRows(d.listings ?? []); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);

  async function act(listingId: string, action: string, value?: boolean, reason?: string) {
    setBusy(listingId + action);
    try { await fetch(`/api/admin/listings/${listingId}/moderate`, { method: "POST", headers: auth, body: JSON.stringify({ action, value, reason }) }); await load(); }
    finally { setBusy(null); }
  }

  const counts = { pending: rows.filter((r) => r.status === "pending").length, approved: rows.filter((r) => r.status === "approved").length, rejected: rows.filter((r) => r.status === "rejected").length };
  const shown = rows.filter((r) => (filter === "all" || r.status === filter) && (!q || (r.businessName + r.suburb + r.state + (r.submittedByName ?? "")).toLowerCase().includes(q.toLowerCase())));
  if (loading) return <Loader2 className="animate-spin" />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Every new listing arrives as <b>pending</b> and stays hidden from the public site, search and sitemap until you approve it. Approve, reject, suspend a live listing, or toggle whether search engines may index it.</p>
      <div className="flex items-center gap-2 flex-wrap">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize ${filter === f ? "theme-btn-gradient border-0 text-primary-foreground" : "border-border text-muted-foreground"}`}>
            {f}{f !== "all" && <span className="ml-1 opacity-70">{counts[f]}</span>}
          </button>
        ))}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 ml-auto">
          <SearchIcon size={13} className="text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="bg-transparent text-sm outline-none w-40" />
        </div>
      </div>

      {shown.length === 0 && <Card className="text-center text-sm text-muted-foreground py-8">Nothing here.</Card>}
      {shown.map((r) => (
        <Card key={r.listingId} className="!py-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{r.businessName}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLE[r.status] ?? "border-border text-muted-foreground"}`}>{r.status}</span>
                {r.suspended && <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-500/40 text-red-300">suspended</span>}
                {!r.seoIndexable && <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">noindex</span>}
                {r.confidential && <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">confidential</span>}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {[r.category, [r.suburb, r.state].filter((x: string) => x && x !== "Unknown").join(", ")].filter(Boolean).join(" · ")}
                {r.askingPrice ? ` · ${money(r.askingPrice)}` : ""} · by {r.submittedByName ?? "Seller"}
                {r.submittedAt ? ` · ${new Date(r.submittedAt).toLocaleDateString("en-AU")}` : ""}
              </div>
              {r.rejectionReason && <div className="text-[11px] text-red-300 mt-1">Reason: {r.rejectionReason}</div>}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <a href={`/listings/${r.listingId}`} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground">View</a>
              {r.status !== "approved" && <BusyBtn busy={busy === r.listingId + "approve"} onClick={() => act(r.listingId, "approve")} className="border-emerald-500/40 text-emerald-300"><Check size={13} /> Approve</BusyBtn>}
              {r.status !== "rejected" && <BusyBtn busy={busy === r.listingId + "reject"} onClick={() => { const reason = prompt("Reason for rejection (optional):") ?? undefined; act(r.listingId, "reject", undefined, reason); }} className="border-red-500/40 text-red-300"><X size={13} /> Reject</BusyBtn>}
              {r.status === "approved" && (r.suspended
                ? <BusyBtn busy={busy === r.listingId + "unsuspend"} onClick={() => act(r.listingId, "unsuspend")} className="border-border"><RotateCcw size={13} /> Unsuspend</BusyBtn>
                : <BusyBtn busy={busy === r.listingId + "suspend"} onClick={() => act(r.listingId, "suspend")} className="border-border"><Ban size={13} /> Suspend</BusyBtn>)}
              <BusyBtn busy={busy === r.listingId + "setIndexable"} onClick={() => act(r.listingId, "setIndexable", !r.seoIndexable)} className="border-border">
                {r.seoIndexable ? <><EyeOff size={13} /> noindex</> : <><Eye size={13} /> index</>}
              </BusyBtn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
function BusyBtn({ busy, onClick, className = "", children }: any) {
  return <button disabled={busy} onClick={onClick} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border disabled:opacity-50 ${className}`}>{busy ? <Loader2 size={13} className="animate-spin" /> : children}</button>;
}

// ── Users & roles ──
function UsersTab({ auth, isSuper }: { auth: any; isSuper: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { const d = await fetch("/api/admin/users", { headers: auth }).then((r) => r.json()); setRows(d.users ?? []); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  async function setRole(phone: string, role: string) { setBusy(phone); try { await fetch("/api/admin/users/role", { method: "POST", headers: auth, body: JSON.stringify({ phone, role }) }); await load(); } finally { setBusy(null); } }
  if (loading) return <Loader2 className="animate-spin" />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Everyone who has created a listing appears here. {isSuper ? "Grant admin (moderate listings + edit SEO) or super-admin (also manage roles)." : "Only a super-admin can change roles."}</p>
      {rows.map((u) => (
        <Card key={u.phone} className="!py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">{u.name ?? "Unnamed"} <span className="text-[11px] text-muted-foreground">·······{u.phone.slice(-3)}</span>
              {u.role && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">{u.role}</span>}
            </div>
            <div className="text-[11px] text-muted-foreground">{u.listings} listing{u.listings !== 1 ? "s" : ""}{u.isBootstrap ? " · owner" : ""}</div>
          </div>
          {isSuper && !u.isBootstrap && (
            <div className="flex items-center gap-1.5">
              {u.role !== "admin" && <BusyBtn busy={busy === u.phone} onClick={() => setRole(u.phone, "admin")} className="border-border">Make admin</BusyBtn>}
              {u.role !== "superadmin" && <BusyBtn busy={busy === u.phone} onClick={() => setRole(u.phone, "superadmin")} className="border-border">Make super-admin</BusyBtn>}
              {u.role && <BusyBtn busy={busy === u.phone} onClick={() => setRole(u.phone, "none")} className="border-red-500/40 text-red-300">Remove</BusyBtn>}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── SEO & site settings ──
const SEO_PAGES = [
  ["/", "Home"], ["/listings", "Listings"], ["/buying", "Buying"], ["/selling", "Selling"], ["/brokers", "Brokers"],
  ["/walkthroughs", "Walkthroughs"], ["/how-it-works", "How it works"], ["/compare", "Compare"],
  ["/list-your-business", "List your business"], ["/photographers", "Photographers"], ["/find-a-partner", "Find a partner"],
] as const;

function SeoTab({ auth }: { auth: any }) {
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [page, setPage] = useState<string>("/");
  const load = useCallback(async () => { setLoading(true); try { const d = await fetch("/api/admin/seo", { headers: auth }).then((r) => r.json()); setS(d); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);

  function setGsc(k: string, v: string) { setS((p: any) => ({ ...p, gsc: { ...p.gsc, [k]: v } })); }
  function setDefault(k: string, v: string) { setS((p: any) => ({ ...p, defaults: { ...p.defaults, [k]: v } })); }
  function setPageField(k: string, v: any) { setS((p: any) => ({ ...p, pages: { ...p.pages, [page]: { ...(p.pages?.[page] ?? {}), [k]: v } } })); }
  function setCopyField(k: string, v: string) { setS((p: any) => ({ ...p, pages: { ...p.pages, [page]: { ...(p.pages?.[page] ?? {}), copy: { ...((p.pages?.[page] ?? {}).copy ?? {}), [k]: v } } } })); }

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const d = await fetch("/api/admin/seo", { method: "PUT", headers: auth, body: JSON.stringify({ gsc: s.gsc, defaults: s.defaults, pages: s.pages }) }).then((r) => r.json());
      setS(d); setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }
  if (loading || !s) return <Loader2 className="animate-spin" />;
  const pg = s.pages?.[page] ?? {};

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="font-bold text-sm mb-1 inline-flex items-center gap-1.5"><ShieldCheck size={14} /> Google Search Console verification</h3>
        <p className="text-[11px] text-muted-foreground mb-3">Use either method Google offers. Paste the meta-tag token, or the HTML file's name and contents. Saved instantly — no redeploy.</p>
        <label className="text-xs font-semibold text-muted-foreground">Verification meta token
          <input value={s.gsc?.metaToken ?? ""} onChange={(e) => setGsc("metaToken", e.target.value)} placeholder='Paste the whole <meta …> tag or just the token — either works' className={`${inp} mt-1 font-normal`} />
          <span className="block text-[10px] text-muted-foreground mt-1 font-normal">Tip: paste Google's full tag; we'll keep just the token and inject it correctly on every page.</span>
        </label>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <label className="text-xs font-semibold text-muted-foreground">HTML file name
            <input value={s.gsc?.htmlFileName ?? ""} onChange={(e) => setGsc("htmlFileName", e.target.value)} placeholder="google1234abcd.html" className={`${inp} mt-1 font-normal`} />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">HTML file contents
            <input value={s.gsc?.htmlFileContent ?? ""} onChange={(e) => setGsc("htmlFileContent", e.target.value)} placeholder="google-site-verification: google1234abcd.html" className={`${inp} mt-1 font-normal`} />
          </label>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-sm mb-3 inline-flex items-center gap-1.5"><Globe size={14} /> Site-wide SEO defaults</h3>
        <div className="grid gap-3">
          <label className="text-xs font-semibold text-muted-foreground">Title suffix<input value={s.defaults?.titleSuffix ?? ""} onChange={(e) => setDefault("titleSuffix", e.target.value)} className={`${inp} mt-1 font-normal`} /></label>
          <label className="text-xs font-semibold text-muted-foreground">Default meta description<textarea rows={2} value={s.defaults?.defaultDescription ?? ""} onChange={(e) => setDefault("defaultDescription", e.target.value)} className={`${inp} mt-1 font-normal resize-none`} /></label>
          <label className="text-xs font-semibold text-muted-foreground">Default share image (OG)<input value={s.defaults?.defaultOgImage ?? ""} onChange={(e) => setDefault("defaultOgImage", e.target.value)} className={`${inp} mt-1 font-normal`} /></label>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-sm mb-3">Per-page SEO</h3>
        <select value={page} onChange={(e) => setPage(e.target.value)} className={`${inp} mb-3`}>
          {SEO_PAGES.map(([p, label]) => <option key={p} value={p}>{label} ({p})</option>)}
        </select>
        <div className="grid gap-3">
          <label className="text-xs font-semibold text-muted-foreground">Title (leave blank for default)<input value={pg.title ?? ""} onChange={(e) => setPageField("title", e.target.value)} className={`${inp} mt-1 font-normal`} /></label>
          <label className="text-xs font-semibold text-muted-foreground">Meta description<textarea rows={2} value={pg.description ?? ""} onChange={(e) => setPageField("description", e.target.value)} className={`${inp} mt-1 font-normal resize-none`} /></label>
          <label className="text-xs font-semibold text-muted-foreground">Share image (OG)<input value={pg.ogImage ?? ""} onChange={(e) => setPageField("ogImage", e.target.value)} className={`${inp} mt-1 font-normal`} /></label>
          <label className="text-xs inline-flex items-center gap-2"><input type="checkbox" checked={!!pg.noindex} onChange={(e) => setPageField("noindex", e.target.checked)} /> Hide this page from search engines (noindex)</label>
        </div>
      </Card>

      {PAGE_CONTENT[page] && (
        <Card>
          <h3 className="font-bold text-sm mb-1">Page copy — {PAGE_CONTENT[page].label}</h3>
          <p className="text-[11px] text-muted-foreground mb-3">Edit the on-page wording for this page. Use <b>==text==</b> for a gradient highlight and <b>**text**</b> for bold. Leave a field blank to keep the current default (shown as the placeholder).</p>
          <div className="grid gap-3">
            {PAGE_CONTENT[page].slots.map((slot: any) => {
              const val = pg.copy?.[slot.key] ?? "";
              return (
                <label key={slot.key} className="text-xs font-semibold text-muted-foreground">{slot.label}
                  {slot.type === "textarea"
                    ? <textarea rows={2} value={val} onChange={(e) => setCopyField(slot.key, e.target.value)} placeholder={slot.default} className={`${inp} mt-1 font-normal resize-none`} />
                    : <input value={val} onChange={(e) => setCopyField(slot.key, e.target.value)} placeholder={slot.default} className={`${inp} mt-1 font-normal`} />}
                </label>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="theme-btn-gradient border-0 gap-1.5">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save settings</Button>
        {saved && <span className="text-sm text-emerald-400 inline-flex items-center gap-1"><Check size={14} /> Saved</span>}
      </div>
    </div>
  );
}
