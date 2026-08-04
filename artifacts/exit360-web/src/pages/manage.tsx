import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  LayoutDashboard, FileText, FileCheck2, Users, Globe, ShieldCheck, Settings as SettingsIcon,
  Search as SearchIcon, Loader2, Check, X, Ban, RotateCcw, Eye, EyeOff, Save, ArrowLeft,
  Sparkles, Upload, Image as ImageIcon, TrendingUp, Plus, Minus, Menu, ExternalLink, Type, Activity,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { PAGE_CONTENT } from "@/content/copy";

const TOKEN_KEY = "biz360_web_auth_token";
const inp = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus:border-primary/60";
const money = (v: any) => { const n = Number(v ?? 0) || 0; return n ? `$${n.toLocaleString()}` : "—"; };

const SEO_PAGES: [string, string][] = Object.entries(PAGE_CONTENT).map(([p, c]) => [p, c.label]);

// ─── Root shell ───────────────────────────────────────────────────────────────
export function Manage() {
  const token = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [me, setMe] = useState<{ isAdmin: boolean; isSuperAdmin: boolean } | null | undefined>(undefined);
  const [section, setSection] = useState<string>("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [zoom, setZoom] = useState<number>(() => { try { return Number(localStorage.getItem("cms_zoom")) || 1; } catch { return 1; } });
  useEffect(() => { try { localStorage.setItem("cms_zoom", String(zoom)); } catch { /* ignore */ } }, [zoom]);

  useEffect(() => {
    if (!token) { setMe(null); return; }
    fetch("/api/admin/me", { headers: auth }).then((r) => r.json()).then(setMe).catch(() => setMe(null));
    // eslint-disable-next-line
  }, [token]);

  if (me === undefined) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin" /></div>;
  if (!token || !me?.isAdmin) return (
    <div className="min-h-screen grid place-items-center text-center p-8">
      <div className="max-w-md">
        <ShieldCheck className="mx-auto mb-3 text-muted-foreground" size={34} aria-hidden />
        <h1 className="mb-2 text-lg font-bold">Admin access only</h1>
        <p className="text-sm text-muted-foreground mb-4">This area is restricted to EXIT360 site administrators.</p>
        <Link href="/"><Button variant="outline">Back to site</Button></Link>
      </div>
    </div>
  );

  const NAV: [string, string, any][] = [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["pages", "Pages & SEO", FileText],
    ["listings", "Listings", FileCheck2],
    ["users", "Users & roles", Users],
    ["settings", "Site settings", SettingsIcon],
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#cms-main" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground">Skip to content</a>
      <Seo title="EXIT360 CMS · Manage" description="EXIT360 site administration." path="/manage" />
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <nav aria-label="Admin navigation" className={`fixed lg:static z-40 inset-y-0 left-0 w-64 shrink-0 border-r border-border bg-card/70 backdrop-blur-xl transition-transform ${navOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
            <div className="w-8 h-8 rounded-xl grid place-items-center theme-btn-gradient"><Sparkles size={16} className="text-primary-foreground" aria-hidden /></div>
            <div><div className="font-extrabold tracking-tight leading-none">EXIT360</div><div className="text-[10px] text-muted-foreground uppercase tracking-widest">CMS</div></div>
          </div>
          <div className="p-3 flex flex-col gap-1">
            {NAV.map(([id, label, Icon]) => (
              <button key={id} onClick={() => { setSection(id); setNavOpen(false); }} aria-current={section === id ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 ${section === id ? "theme-btn-gradient text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
                <Icon size={17} aria-hidden /> {label}
              </button>
            ))}
          </div>
          <div className="mt-auto p-3 absolute bottom-0 inset-x-0 border-t border-border">
            <Link href="/"><button className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50"><ExternalLink size={15} aria-hidden /> View site</button></Link>
          </div>
        </nav>
        {navOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden />}

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-16 sticky top-0 z-20 flex items-center gap-3 px-4 sm:px-6 border-b border-border bg-background/80 backdrop-blur-xl">
            <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted" onClick={() => setNavOpen((o) => !o)} aria-label="Toggle navigation"><Menu size={18} /></button>
            <h1 className="font-bold capitalize">{NAV.find((n) => n[0] === section)?.[1] ?? section}</h1>
            {me.isSuperAdmin && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">super-admin</span>}
            <div className="ml-auto flex items-center gap-1 rounded-lg border border-border p-0.5" role="group" aria-label="Text size">
              <button onClick={() => setZoom((z) => Math.max(0.85, +(z - 0.1).toFixed(2)))} className="p-1.5 rounded-md hover:bg-muted" aria-label="Decrease text size"><Minus size={14} /></button>
              <Type size={14} className="text-muted-foreground" aria-hidden />
              <button onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))} className="p-1.5 rounded-md hover:bg-muted" aria-label="Increase text size"><Plus size={14} /></button>
            </div>
          </header>
          <main id="cms-main" className="flex-1 p-4 sm:p-6" style={{ zoom }}>
            <div className="max-w-5xl mx-auto">
              {section === "dashboard" && <Dashboard auth={auth} />}
              {section === "pages" && <Pages auth={auth} />}
              {section === "listings" && <Listings auth={auth} />}
              {section === "users" && <UsersTab auth={auth} isSuper={me.isSuperAdmin} />}
              {section === "settings" && <Settings auth={auth} />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: any; className?: string }) { return <div className={`rounded-2xl border border-border bg-card/70 backdrop-blur p-4 ${className}`}>{children}</div>; }

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ auth }: { auth: any }) {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/admin/dashboard", { headers: auth }).then((r) => r.json()).then(setD).catch(() => setD(null)).finally(() => setLoading(false)); }, []);
  if (loading) return <Loader2 className="animate-spin" />;
  if (!d) return <Card>Couldn't load dashboard.</Card>;
  const c = d.counts ?? {};
  const statusData = [
    { name: "Approved", value: c.approved ?? 0, fill: "#16A34A" },
    { name: "Pending", value: c.pending ?? 0, fill: "#F59E0B" },
    { name: "Rejected", value: c.rejected ?? 0, fill: "#EF4444" },
  ];
  const maxViews = Math.max(...(d.topListings ?? []).map((l: any) => l.views), 1);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Listings" value={c.listings ?? 0} icon={FileCheck2} />
        <Kpi label="Pending" value={c.pending ?? 0} icon={Activity} accent="#F59E0B" />
        <Kpi label="Approved" value={c.approved ?? 0} icon={Check} accent="#16A34A" />
        <Kpi label="Users" value={c.users ?? 0} icon={Users} />
        <Kpi label="Listing views" value={(d.totalViews ?? 0).toLocaleString()} icon={Eye} />
        <Kpi label="Report opens" value={(d.totalOpens ?? 0).toLocaleString()} icon={TrendingUp} />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold inline-flex items-center gap-1.5"><TrendingUp size={15} aria-hidden /> Report opens — last 30 days</h2>
          <span className="text-[11px] text-muted-foreground">{d.totalOpens ?? 0} total</span>
        </div>
        <div style={{ height: 220 }} role="img" aria-label={`Report opens over the last 30 days, ${d.totalOpens ?? 0} total`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.series ?? []} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <defs><linearGradient id="cmsArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => String(v).slice(5)} minTickGap={24} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} width={28} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Area type="monotone" dataKey="opens" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#cmsArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-5">
        <Card>
          <h2 className="text-sm font-bold mb-3">Popular listings</h2>
          <div className="flex flex-col gap-2">
            {(d.topListings ?? []).filter((l: any) => l.views > 0).length === 0 && <p className="text-xs text-muted-foreground">No view data yet.</p>}
            {(d.topListings ?? []).filter((l: any) => l.views > 0).map((l: any) => (
              <div key={l.listingId} className="flex items-center gap-2">
                <a href={`/listings/${l.listingId}`} target="_blank" rel="noreferrer" className="text-sm truncate hover:text-primary w-40">{l.businessName}</a>
                <div className="flex-1 h-4 bg-muted/40 rounded-full overflow-hidden"><div className="h-full theme-btn-gradient rounded-full" style={{ width: `${(l.views / maxViews) * 100}%` }} /></div>
                <span className="text-xs font-semibold w-14 text-right">{l.views.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-bold mb-3">Listings by status</h2>
          <div style={{ height: 180 }} role="img" aria-label={`Approved ${c.approved}, pending ${c.pending}, rejected ${c.rejected}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={72} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>{statusData.map((s, i) => <Cell key={i} fill={s.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-bold mb-3">Recent report activity</h2>
        {(d.recent ?? []).length === 0 ? <p className="text-xs text-muted-foreground">No recent activity.</p> : (
          <ul className="flex flex-col gap-1.5">
            {(d.recent ?? []).map((e: any, i: number) => (
              <li key={i} className="flex items-center justify-between text-sm border-b border-border/40 pb-1.5">
                <span className="truncate">{e.businessName}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{e.viewerPhone ?? "anon"} · {e.openedAt ? new Date(e.openedAt).toLocaleString("en-AU") : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
function Kpi({ label, value, icon: Icon, accent }: { label: string; value: any; icon: any; accent?: string }) {
  return (
    <Card className="!p-3">
      <Icon size={16} style={accent ? { color: accent } : undefined} className={accent ? "" : "text-muted-foreground"} aria-hidden />
      <div className="text-2xl font-bold mt-1 leading-none">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
    </Card>
  );
}

// ─── Pages & SEO ──────────────────────────────────────────────────────────────
function Pages({ auth }: { auth: any }) {
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setS(await fetch("/api/admin/seo", { headers: auth }).then((r) => r.json())); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  if (loading || !s) return <Loader2 className="animate-spin" />;
  if (editing) return <PageEditor auth={auth} path={editing} settings={s} onClose={() => { setEditing(null); load(); }} />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Edit every page's content, on-page SEO and share image. Use the AI assistant to auto-optimise titles, meta and keywords to best-practice.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {SEO_PAGES.map(([path, label]) => {
          const pg = s.pages?.[path] ?? {};
          const done = !!(pg.title && pg.description);
          return (
            <button key={path} onClick={() => setEditing(path)} className="text-left rounded-2xl border border-border bg-card/70 backdrop-blur p-4 hover:border-primary/50 transition group focus-visible:ring-2 focus-visible:ring-primary/50">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">{label}</div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${done ? "border-emerald-500/40 text-emerald-300" : "border-border text-muted-foreground"}`}>{done ? "SEO set" : "default"}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{path}</div>
              <div className="text-xs text-muted-foreground mt-2 line-clamp-1 group-hover:text-foreground">{pg.title || "— using default title —"}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PageEditor({ auth, path, settings, onClose }: { auth: any; path: string; settings: any; onClose: () => void }) {
  const label = PAGE_CONTENT[path]?.label ?? path;
  const [pg, setPg] = useState<any>(() => ({ copy: {}, ...(settings.pages?.[path] ?? {}) }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ai, setAi] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const slots = PAGE_CONTENT[path]?.slots ?? [];

  function setField(k: string, v: any) { setPg((p: any) => ({ ...p, [k]: v })); }
  function setCopy(k: string, v: string) { setPg((p: any) => ({ ...p, copy: { ...(p.copy ?? {}), [k]: v } })); }

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const pages = { ...settings.pages, [path]: pg };
      await fetch("/api/admin/seo", { method: "PUT", headers: auth, body: JSON.stringify({ pages }) });
      settings.pages = pages; setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  async function autoOptimise() {
    setAi(true); setAiNote(null);
    try {
      const r = await fetch("/api/admin/seo/ai-suggest", { method: "POST", headers: auth, body: JSON.stringify({ path, label, currentTitle: pg.title, copy: pg.copy }) }).then((x) => x.json());
      const sug = r.suggestion;
      if (!sug) { setAiNote(r.error || "AI could not generate suggestions."); return; }
      setPg((p: any) => ({
        ...p,
        title: sug.title ?? p.title,
        description: sug.description ?? p.description,
        keywords: Array.isArray(sug.keywords) ? sug.keywords.join(", ") : (sug.keywords ?? p.keywords),
        ogImageAlt: sug.ogImageAlt ?? p.ogImageAlt,
        copy: sug.h1 && slots.some((s: any) => s.key === "heroTitle") ? { ...(p.copy ?? {}), heroTitle: sug.h1 } : p.copy,
      }));
      setAiNote(sug.notes ? `AI: ${sug.notes}` : "AI suggestions applied — review and Save.");
    } catch { setAiNote("AI request failed."); }
    finally { setAi(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Pages</button>
        <h2 className="font-bold">{label} <span className="text-xs text-muted-foreground font-normal">{path}</span></h2>
        <a href={path} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 ml-auto">Preview <ExternalLink size={12} /></a>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold inline-flex items-center gap-1.5"><Globe size={15} aria-hidden /> On-page SEO</h3>
          <Button size="sm" onClick={autoOptimise} disabled={ai} className="theme-btn-gradient border-0 gap-1.5">{ai ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Auto-optimise with AI</Button>
        </div>
        {aiNote && <div className="text-[11px] px-3 py-2 mb-3 rounded-lg border border-primary/30 bg-primary/5 text-foreground">{aiNote}</div>}
        <div className="grid gap-3">
          <L label={`Title ${lenHint(pg.title, 50, 60)}`}><input value={pg.title ?? ""} onChange={(e) => setField("title", e.target.value)} placeholder="SEO title (50–60 chars)" className={inp} /></L>
          <L label={`Meta description ${lenHint(pg.description, 140, 160)}`}><textarea rows={2} value={pg.description ?? ""} onChange={(e) => setField("description", e.target.value)} placeholder="140–160 chars, active voice, a call to action" className={`${inp} resize-none`} /></L>
          <L label="Keywords (comma-separated)"><input value={pg.keywords ?? ""} onChange={(e) => setField("keywords", e.target.value)} placeholder="business for sale, 360 tour, …" className={inp} /></L>
          <div className="grid sm:grid-cols-2 gap-3">
            <L label="Canonical URL (optional)"><input value={pg.canonical ?? ""} onChange={(e) => setField("canonical", e.target.value)} placeholder="https://exit360.com.au/…" className={inp} /></L>
            <L label="OG image alt text"><input value={pg.ogImageAlt ?? ""} onChange={(e) => setField("ogImageAlt", e.target.value)} placeholder="Descriptive alt text" className={inp} /></L>
          </div>
          <ImageField auth={auth} label="Share image (Open Graph)" value={pg.ogImage} suggestedName={`og-${path.replace(/\//g, "-") || "home"}`} onChange={(url) => setField("ogImage", url)} />
          <label className="text-xs inline-flex items-center gap-2"><input type="checkbox" checked={!!pg.noindex} onChange={(e) => setField("noindex", e.target.checked)} /> Hide this page from search engines (noindex)</label>
        </div>
      </Card>

      {slots.length > 0 && (
        <Card>
          <h3 className="text-sm font-bold mb-1">Page content</h3>
          <p className="text-[11px] text-muted-foreground mb-3">Edit the on-page wording. <b>==text==</b> = gradient highlight, <b>**text**</b> = bold. Blank keeps the current default (shown as placeholder).</p>
          <div className="grid gap-3">
            {slots.map((slot: any) => (
              <L key={slot.key} label={slot.label}>
                {slot.type === "textarea"
                  ? <textarea rows={2} value={pg.copy?.[slot.key] ?? ""} onChange={(e) => setCopy(slot.key, e.target.value)} placeholder={slot.default} className={`${inp} resize-none`} />
                  : <input value={pg.copy?.[slot.key] ?? ""} onChange={(e) => setCopy(slot.key, e.target.value)} placeholder={slot.default} className={inp} />}
              </L>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3 sticky bottom-4">
        <Button onClick={save} disabled={saving} className="theme-btn-gradient border-0 gap-1.5 shadow-xl">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save page</Button>
        {saved && <span className="text-sm text-emerald-400 inline-flex items-center gap-1"><Check size={14} /> Saved</span>}
      </div>
    </div>
  );
}
function L({ label, children }: { label: string; children: any }) { return <label className="text-xs font-semibold text-muted-foreground block">{label}<div className="mt-1 font-normal">{children}</div></label>; }
function lenHint(v: string | undefined, lo: number, hi: number) { const n = (v ?? "").length; if (!n) return ""; const ok = n >= lo && n <= hi; return `· ${n} chars ${ok ? "✓" : n < lo ? "(short)" : "(long)"}`; }

// Cloudinary image upload with an SEO-friendly filename.
function ImageField({ auth, label, value, suggestedName, onChange }: { auth: any; label: string; value?: string; suggestedName: string; onChange: (url: string) => void }) {
  const [name, setName] = useState(suggestedName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  async function pick(file: File) {
    setBusy(true); setErr(null);
    try {
      const data: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(file); });
      const seoName = (name || file.name.replace(/\.[^.]+$/, "")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
      const r = await fetch("/api/biz360/img", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: seoName, data, mimeType: file.type, userId: "site", listingId: "site-pages" }) }).then((x) => x.json());
      if (r.url) onChange(r.url); else setErr(r.error || "Upload failed");
    } catch (e: any) { setErr(e?.message || "Upload failed"); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-24 h-16 rounded-lg border border-border bg-muted/30 grid place-items-center overflow-hidden shrink-0">
          {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={18} className="text-muted-foreground" aria-hidden />}
        </div>
        <div className="flex-1 min-w-[180px]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="image-file-name (for SEO)" className={`${inp} mb-2`} aria-label="Image file name for SEO" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); }} />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy} className="gap-1.5">{busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload</Button>
            {value && <button onClick={() => onChange("")} className="text-xs text-muted-foreground hover:text-red-400">Remove</button>}
          </div>
          {err && <div className="text-[11px] text-red-400 mt-1">{err}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Listings moderation ──────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  rejected: "bg-red-500/15 text-red-300 border-red-500/40",
};
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
      <p className="text-sm text-muted-foreground">New listings arrive <b>pending</b> and stay hidden from the public site, search and sitemap until approved.</p>
      <div className="flex items-center gap-2 flex-wrap">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize focus-visible:ring-2 focus-visible:ring-primary/50 ${filter === f ? "theme-btn-gradient border-0 text-primary-foreground" : "border-border text-muted-foreground"}`}>{f}{f !== "all" && <span className="ml-1 opacity-70">{(counts as any)[f]}</span>}</button>
        ))}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 ml-auto"><SearchIcon size={13} className="text-muted-foreground" aria-hidden /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="bg-transparent text-sm outline-none w-40" aria-label="Search listings" /></div>
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
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{[r.category, [r.suburb, r.state].filter((x: string) => x && x !== "Unknown").join(", ")].filter(Boolean).join(" · ")}{r.askingPrice ? ` · ${money(r.askingPrice)}` : ""} · by {r.submittedByName ?? "Seller"}{r.submittedAt ? ` · ${new Date(r.submittedAt).toLocaleDateString("en-AU")}` : ""}</div>
              {r.rejectionReason && <div className="text-[11px] text-red-300 mt-1">Reason: {r.rejectionReason}</div>}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <a href={`/listings/${r.listingId}`} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground">View</a>
              {r.status !== "approved" && <BusyBtn busy={busy === r.listingId + "approve"} onClick={() => act(r.listingId, "approve")} className="border-emerald-500/40 text-emerald-300"><Check size={13} /> Approve</BusyBtn>}
              {r.status !== "rejected" && <BusyBtn busy={busy === r.listingId + "reject"} onClick={() => { const reason = prompt("Reason for rejection (optional):") ?? undefined; act(r.listingId, "reject", undefined, reason); }} className="border-red-500/40 text-red-300"><X size={13} /> Reject</BusyBtn>}
              {r.status === "approved" && (r.suspended
                ? <BusyBtn busy={busy === r.listingId + "unsuspend"} onClick={() => act(r.listingId, "unsuspend")} className="border-border"><RotateCcw size={13} /> Unsuspend</BusyBtn>
                : <BusyBtn busy={busy === r.listingId + "suspend"} onClick={() => act(r.listingId, "suspend")} className="border-border"><Ban size={13} /> Suspend</BusyBtn>)}
              <BusyBtn busy={busy === r.listingId + "setIndexable"} onClick={() => act(r.listingId, "setIndexable", !r.seoIndexable)} className="border-border">{r.seoIndexable ? <><EyeOff size={13} /> noindex</> : <><Eye size={13} /> index</>}</BusyBtn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
function BusyBtn({ busy, onClick, className = "", children }: any) {
  return <button disabled={busy} onClick={onClick} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/50 ${className}`}>{busy ? <Loader2 size={13} className="animate-spin" /> : children}</button>;
}

// ─── Users & roles ────────────────────────────────────────────────────────────
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
      <p className="text-sm text-muted-foreground">Everyone who has created a listing. {isSuper ? "Grant admin or super-admin, or remove a role." : "Only a super-admin can change roles."}</p>
      {rows.map((u) => (
        <Card key={u.phone} className="!py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">{u.name ?? "Unnamed"} <span className="text-[11px] text-muted-foreground">·····{u.phone.slice(-3)}</span>{u.role && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">{u.role}</span>}</div>
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

// ─── Site settings (GSC + defaults) ───────────────────────────────────────────
function Settings({ auth }: { auth: any }) {
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { fetch("/api/admin/seo", { headers: auth }).then((r) => r.json()).then(setS).catch(() => {}).finally(() => setLoading(false)); }, []);
  function setGsc(k: string, v: string) { setS((p: any) => ({ ...p, gsc: { ...p.gsc, [k]: v } })); }
  function setDefault(k: string, v: string) { setS((p: any) => ({ ...p, defaults: { ...p.defaults, [k]: v } })); }
  async function save() { setSaving(true); setSaved(false); try { const d = await fetch("/api/admin/seo", { method: "PUT", headers: auth, body: JSON.stringify({ gsc: s.gsc, defaults: s.defaults }) }).then((r) => r.json()); setS(d); setSaved(true); setTimeout(() => setSaved(false), 2500); } finally { setSaving(false); } }
  if (loading || !s) return <Loader2 className="animate-spin" />;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="font-bold text-sm mb-1 inline-flex items-center gap-1.5"><ShieldCheck size={15} aria-hidden /> Google Search Console verification</h3>
        <p className="text-[11px] text-muted-foreground mb-3">Paste Google's whole meta tag or just the token — either works, saved instantly.</p>
        <L label="Verification meta token"><input value={s.gsc?.metaToken ?? ""} onChange={(e) => setGsc("metaToken", e.target.value)} placeholder='Paste the <meta …> tag or token' className={inp} /></L>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <L label="HTML file name"><input value={s.gsc?.htmlFileName ?? ""} onChange={(e) => setGsc("htmlFileName", e.target.value)} placeholder="google1234abcd.html" className={inp} /></L>
          <L label="HTML file contents"><input value={s.gsc?.htmlFileContent ?? ""} onChange={(e) => setGsc("htmlFileContent", e.target.value)} placeholder="google-site-verification: …" className={inp} /></L>
        </div>
      </Card>
      <Card>
        <h3 className="font-bold text-sm mb-3 inline-flex items-center gap-1.5"><Globe size={15} aria-hidden /> Site-wide SEO defaults</h3>
        <div className="grid gap-3">
          <L label="Title suffix"><input value={s.defaults?.titleSuffix ?? ""} onChange={(e) => setDefault("titleSuffix", e.target.value)} className={inp} /></L>
          <L label="Default meta description"><textarea rows={2} value={s.defaults?.defaultDescription ?? ""} onChange={(e) => setDefault("defaultDescription", e.target.value)} className={`${inp} resize-none`} /></L>
          <L label="Default share image (OG)"><input value={s.defaults?.defaultOgImage ?? ""} onChange={(e) => setDefault("defaultOgImage", e.target.value)} className={inp} /></L>
        </div>
      </Card>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="theme-btn-gradient border-0 gap-1.5">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save settings</Button>
        {saved && <span className="text-sm text-emerald-400 inline-flex items-center gap-1"><Check size={14} /> Saved</span>}
      </div>
    </div>
  );
}
