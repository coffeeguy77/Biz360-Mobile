import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Loader2, RefreshCw, Plus, Trash2, X, Check, Link2, Layers, TrendingUp, BarChart3, FileText, Upload as UploadIcon } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";

const TOKEN_KEY = "biz360_web_auth_token";
const inp = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60";
const money = (v: any) => { const n = Number(v ?? 0) || 0; if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`; if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}K`; return `$${Math.round(n).toLocaleString()}`; };
// Exact, full-precision currency (no lossy K-rounding) — use where real figures matter.
const money0 = (v: any) => `$${Math.round(Number(v ?? 0) || 0).toLocaleString()}`;
// Compact but non-collapsing (keeps one decimal on K so $2.3K ≠ $2.0K) — for axes/chips.
const moneyK = (v: any) => { const n = Number(v ?? 0) || 0; if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`; if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`; return `$${Math.round(n).toLocaleString()}`; };
const TABS = [["overview", "Overview", TrendingUp], ["divisions", "Divisions", Layers], ["connections", "Connections", Link2], ["addbacks", "Add-backs", Plus], ["reports", "Fin. Reports", FileText], ["insights", "Square Insights", BarChart3]] as const;

export function Valuation() {
  const listingId = (useParams().listingId as string) || "";
  const token = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [cafeId, setCafeId] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("overview");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const c = await fetch(`/api/buyer-portal/seller/listing-cafe/${listingId}`, { headers: auth }).then((r) => r.json()); setCafeId(c.cafeId ?? null); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line
  }, [listingId]);

  if (!token) return <Center><p className="mb-3">Please sign in.</p><Link href="/seller"><Button className="theme-btn-gradient border-0">Seller dashboard</Button></Link></Center>;
  if (loading) return <Center><Loader2 className="animate-spin mr-2" /> Loading valuation…</Center>;

  return (
    <div className="min-h-screen text-foreground">
      <Seo title="Business Valuation | EXIT360" description="Your business valuation, financials and Square insights." path={`/seller/valuation/${listingId}`} />
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur">
        <Link href="/seller" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Dashboard</Link>
        <span className="font-bold">Business valuation</span>
      </div>
      {cafeId === null ? (
        <Center>This listing doesn't have a valuation record yet. It's created when you first build the report or sync financials in the app; once it exists, everything here is fully editable on the web.</Center>
      ) : (
        <div className="max-w-5xl mx-auto p-4">
          <div className="flex gap-2 flex-wrap mb-5">
            {TABS.map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${tab === id ? "theme-btn-gradient border-0 text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}><Icon size={14} /> {label}</button>
            ))}
          </div>
          {cafeId && tab === "overview" && <Overview cafeId={cafeId} auth={auth} />}
          {cafeId && tab === "divisions" && <Divisions cafeId={cafeId} auth={auth} />}
          {cafeId && tab === "connections" && <Connections cafeId={cafeId} auth={auth} token={token!} />}
          {cafeId && tab === "addbacks" && <AddBacks cafeId={cafeId} auth={auth} />}
          {cafeId && tab === "reports" && <FinReports cafeId={cafeId} auth={auth} />}
          {cafeId && tab === "insights" && <Insights cafeId={cafeId} auth={auth} />}
        </div>
      )}
    </div>
  );
}
function Center({ children }: { children: any }) { return <div className="min-h-[60vh] grid place-items-center text-muted-foreground text-center p-8 max-w-lg mx-auto">{children}</div>; }
function Card({ children, className = "" }: { children: any; className?: string }) { return <div className={`rounded-2xl border border-border bg-card/40 p-4 ${className}`}>{children}</div>; }

// ── Overview ──
function Overview({ cafeId, auth }: { cafeId: string; auth: any }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await fetch(`/api/valuation/cafes/${cafeId}/snapshots/latest`, { headers: auth }).then((r) => r.json()); setData(d); } finally { setLoading(false); }
  }, [cafeId]);
  useEffect(() => { load(); }, [load]);
  async function sync() { setBusy("sync"); try { await fetch(`/api/valuation/cafes/${cafeId}/snapshots/recalculate`, { method: "POST", headers: auth, body: JSON.stringify({ periodMonths: 12 }) }); await load(); } finally { setBusy(""); } }
  async function publish() { setBusy("pub"); try { await fetch(`/api/valuation/cafes/${cafeId}/snapshots/publish`, { method: "POST", headers: auth, body: JSON.stringify({}) }); await load(); } finally { setBusy(""); } }
  if (loading) return <Loader2 className="animate-spin" />;
  const c = data?.combined ?? {};
  const units = data?.units ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Card className="!p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Estimated value</div>
            <div className="text-4xl font-extrabold theme-text-gradient">{money(c.valuationMidpoint)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{c.snapshotDate ? `as of ${c.snapshotDate}` : "not yet calculated"}{c.isPublished ? " · published" : " · draft"}</div>
          </div>
          <div className="text-sm text-right space-y-0.5">
            <div><span className="text-muted-foreground">Revenue </span><b>{money(c.grossRevenue)}</b></div>
            <div><span className="text-muted-foreground">COGS </span><b>{money(c.cogs)}</b></div>
            <div><span className="text-muted-foreground">Adj. EBITDA </span><b>{money(c.adjustedEbitda)}</b></div>
            <div><span className="text-muted-foreground">Equipment </span><b>{money(c.totalEquipmentValue)}</b></div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={sync} disabled={!!busy} className="theme-btn-gradient border-0"><RefreshCw size={14} className={`mr-1 ${busy === "sync" ? "animate-spin" : ""}`} /> Sync now</Button>
          <Button onClick={publish} disabled={!!busy} variant="outline">{busy === "pub" ? "Publishing…" : "Publish to buyers"}</Button>
        </div>
      </Card>
      <div>
        <h3 className="text-sm font-bold mb-2">Divisions</h3>
        <div className="flex flex-col gap-2">
          {units.map((u: any) => (
            <Card key={u.unit?.id} className="flex items-center justify-between !py-3">
              <div><div className="font-semibold text-sm">{u.unit?.name} {u.unit?.isIncludedInSale === false && <span className="text-[10px] text-red-400">EXCLUDED</span>}</div><div className="text-[11px] text-muted-foreground">Revenue {money(u.snapshot?.grossRevenue)}</div></div>
              <div className="font-bold text-primary">{money(u.snapshot?.valuationMidpoint)}</div>
            </Card>
          ))}
          {units.length === 0 && <p className="text-sm text-muted-foreground">No divisions — the whole business is valued as one. Add divisions in the Divisions tab.</p>}
        </div>
      </div>
    </div>
  );
}

// ── Divisions ──
function Divisions({ cafeId, auth }: { cafeId: string; auth: any }) {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [mapping, setMapping] = useState<{ unitId: string | null; kind: "pl" | "cogs"; unitName: string } | null>(null);
  const load = useCallback(async () => { setLoading(true); try { const u = await fetch(`/api/valuation/cafes/${cafeId}/units`, { headers: auth }).then((r) => r.json()); setUnits(Array.isArray(u) ? u : []); } finally { setLoading(false); } }, [cafeId]);
  useEffect(() => { load(); }, [load]);
  const inc = (u: any) => (u.isIncludedInSale ?? u.is_included_in_sale) !== false;
  async function add() { if (!name.trim()) return; await fetch(`/api/valuation/cafes/${cafeId}/units`, { method: "POST", headers: auth, body: JSON.stringify({ name: name.trim() }) }); setName(""); load(); }
  async function toggle(u: any) { await fetch(`/api/valuation/cafes/${cafeId}/units/${u.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ is_included_in_sale: !inc(u) }) }); load(); }
  async function rename(u: any, nm: string) { await fetch(`/api/valuation/cafes/${cafeId}/units/${u.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ name: nm }) }); }
  async function del(id: string) { await fetch(`/api/valuation/cafes/${cafeId}/units/${id}`, { method: "DELETE", headers: auth }); load(); }
  if (loading) return <Loader2 className="animate-spin" />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Each division claims its own Xero income accounts + COGS suppliers for an independent valuation. Toggle a division out of the sale to exclude it from the valuation.</p>
      {units.map((u) => (
        <Card key={u.id} className="!py-3">
          <div className="flex items-center gap-2">
            <input defaultValue={u.name} onBlur={(e) => rename(u, e.target.value)} className="bg-transparent border-b border-transparent hover:border-border focus:border-primary/60 outline-none font-semibold text-sm flex-1" />
            <button onClick={() => toggle(u)} className={`text-[11px] px-2 py-1 rounded-full border ${inc(u) ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400"}`}>{inc(u) ? "In sale" : "Excluded"}</button>
            <button onClick={() => del(u.id)} className="text-red-400"><Trash2 size={14} /></button>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setMapping({ unitId: u.id, kind: "pl", unitName: u.name })} className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-border text-primary">Income accounts</button>
            <button onClick={() => setMapping({ unitId: u.id, kind: "cogs", unitName: u.name })} className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-border text-emerald-400">COGS suppliers</button>
          </div>
        </Card>
      ))}
      <div className="flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="New division e.g. Roastery" className={inp} /><Button onClick={add} className="theme-btn-gradient border-0">Add</Button></div>
      {mapping && <MappingModal cafeId={cafeId} auth={auth} unitId={mapping.unitId} unitName={mapping.unitName} kind={mapping.kind} onClose={() => setMapping(null)} />}
    </div>
  );
}

// ── Xero P&L / COGS mapping modal (whole-business or per-division) ──
function MappingModal({ cafeId, auth, unitId, unitName, kind, onClose }: { cafeId: string; auth: any; unitId: string | null; unitName?: string; kind: "pl" | "cogs"; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      setLoading(true); setErr(null);
      try {
        const u = unitId ? `&unit_id=${unitId}` : "";
        if (kind === "pl") {
          const d = await fetch(`/api/valuation/xero/reports?cafeId=${cafeId}&months=12${u}`, { headers: auth }).then((r) => r.json());
          if (d.error) { setErr(d.error); return; }
          const flat: any[] = [];
          (d.sections ?? []).forEach((s: any) => (s.rows ?? []).forEach((r: any) => flat.push({ ...r, section: s.title, isIncome: s.isIncome })));
          setRows(flat.filter((r) => r.isIncome));
        } else {
          const d = await fetch(`/api/valuation/xero/suppliers?cafeId=${cafeId}&months=12${u}`, { headers: auth }).then((r) => r.json());
          if (d.error) { setErr(d.error); return; }
          setRows((d.suppliers ?? []).map((s: any) => ({ ...r0(s) })));
        }
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line
  }, []);
  function r0(s: any) { return { name: s.name, contactId: s.contactId, total: s.total, included: s.isCogs, assignedToUnitId: null }; }
  function toggle(i: number) { setRows((rs) => rs.map((r, ix) => (ix === i ? { ...r, included: !r.included } : r))); }
  async function save() {
    setSaving(true);
    try {
      if (kind === "pl") {
        const mappings = unitId ? rows.filter((r) => r.included && !r.assignedToUnitId).map((r) => ({ name: r.name, included: true, section: r.section })) : rows.map((r) => ({ name: r.name, included: !!r.included, section: r.section }));
        await fetch(`/api/valuation/xero/pl-mappings`, { method: "PATCH", headers: auth, body: JSON.stringify({ cafeId, unit_id: unitId ?? undefined, mappings }) });
      } else {
        const mappings = rows.map((r) => ({ name: r.name, contactId: r.contactId, isCogs: !!r.included }));
        await fetch(`/api/valuation/xero/supplier-mappings`, { method: "PATCH", headers: auth, body: JSON.stringify({ cafeId, unit_id: unitId ?? undefined, mappings }) });
      }
      onClose();
    } finally { setSaving(false); }
  }
  return (
    <Modal onClose={onClose} title={`${kind === "pl" ? "Income accounts" : "COGS suppliers"}${unitName ? ` · ${unitName}` : " · whole business"}`}>
      {loading ? <Loader2 className="animate-spin" /> : err ? <p className="text-sm text-amber-400">{err}<br /><span className="text-muted-foreground text-xs">Connect Xero in the Connections tab first.</span></p> : (
        <>
          <p className="text-xs text-muted-foreground mb-2">{kind === "pl" ? "Tick which Xero income lines count as revenue for this scope." : "Tick which suppliers are Cost of Goods Sold."}</p>
          <div className="flex flex-col gap-1 max-h-[50vh] overflow-y-auto themed-scroll">
            {rows.map((r, i) => (
              <button key={i} onClick={() => toggle(i)} disabled={!!r.assignedToUnitId} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left ${r.included ? "border-primary bg-primary/10" : "border-border"} ${r.assignedToUnitId ? "opacity-50" : ""}`}>
                <span className="text-sm truncate">{r.name}{r.assignedToUnitName && <span className="text-[10px] text-muted-foreground"> · {r.assignedToUnitName}</span>}</span>
                <span className="flex items-center gap-2 flex-shrink-0"><span className="text-xs text-muted-foreground">{money(r.total ?? r.amount)}</span>{r.included && <Check size={14} className="text-primary" />}</span>
              </button>
            ))}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">No lines found.</p>}
          </div>
          <Button onClick={save} disabled={saving} className="theme-btn-gradient border-0 mt-3">{saving ? "Saving…" : "Save"}</Button>
        </>
      )}
    </Modal>
  );
}

// ── Connections ──
function Connections({ cafeId, auth, token }: { cafeId: string; auth: any; token: string }) {
  const [ints, setInts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState<"pl" | "cogs" | null>(null);
  const load = useCallback(async () => { setLoading(true); try { const c = await fetch(`/api/valuation/cafes/${cafeId}`, { headers: auth }).then((r) => r.json()); setInts(Array.isArray(c.integrations) ? c.integrations : []); } finally { setLoading(false); } }, [cafeId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = (e: MessageEvent) => { if ((e.data as any)?.exit360OAuth) setTimeout(load, 800); }; window.addEventListener("message", h); return () => window.removeEventListener("message", h); }, [load]);
  const get = (t: string) => ints.find((i) => i.type === t && i.status === "connected");
  function connect(provider: string) { const url = `/api/valuation/oauth/${provider}/start?cafeId=${cafeId}&token=${encodeURIComponent(token)}`; window.open(url, "oauth", "width=520,height=680"); }
  async function disconnect(id: string) { await fetch(`/api/valuation/integrations/${id}/disconnect`, { method: "DELETE", headers: auth }); load(); }
  if (loading) return <Loader2 className="animate-spin" />;
  const sq = get("square"), xe = get("xero");
  return (
    <div className="flex flex-col gap-3">
      <IntCard name="Square" desc="Provides your sales revenue by day & category." connected={sq} onConnect={() => connect("square")} onDisconnect={() => disconnect(sq.id)} />
      <IntCard name="Xero" desc="Provides P&L, supplier spend and bank transactions." connected={xe} onConnect={() => connect("xero")} onDisconnect={() => disconnect(xe.id)} />
      <p className="text-[11px] text-muted-foreground">Both are shared across all divisions — only income-account and COGS tagging is per-division.</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setMapping("pl")} className="rounded-xl border border-border p-3 text-left hover:border-primary/50"><div className="font-semibold text-sm">P&L line mapping</div><div className="text-[11px] text-muted-foreground">Which Xero income counts as revenue</div></button>
        <button onClick={() => setMapping("cogs")} className="rounded-xl border border-border p-3 text-left hover:border-primary/50"><div className="font-semibold text-sm">COGS supplier tags</div><div className="text-[11px] text-muted-foreground">Which suppliers are Cost of Goods Sold</div></button>
      </div>
      {mapping && <MappingModal cafeId={cafeId} auth={auth} unitId={null} kind={mapping} onClose={() => setMapping(null)} />}
    </div>
  );
}
function IntCard({ name, desc, connected, onConnect, onDisconnect }: any) {
  return (
    <Card className="flex items-center justify-between !py-4">
      <div><div className="font-bold">{name}</div><div className="text-xs text-muted-foreground">{connected ? <span className="text-emerald-400">Connected{connected.merchantName ? `: ${connected.merchantName}` : ""}</span> : desc}</div></div>
      {connected ? <button onClick={onDisconnect} className="text-sm px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400">Disconnect</button> : <Button size="sm" onClick={onConnect} className="theme-btn-gradient border-0">Connect</Button>}
    </Card>
  );
}

// ── Add-backs ──
function AddBacks({ cafeId, auth }: { cafeId: string; auth: any }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ label: "", annualAmount: "", type: "other" });
  const load = useCallback(async () => { setLoading(true); try { const d = await fetch(`/api/valuation/cafes/${cafeId}/adjustments`, { headers: auth }).then((r) => r.json()); setRows(Array.isArray(d) ? d : (d.adjustments ?? [])); } finally { setLoading(false); } }, [cafeId]);
  useEffect(() => { load(); }, [load]);
  async function add() { if (!f.label.trim()) return; await fetch(`/api/valuation/cafes/${cafeId}/adjustments`, { method: "POST", headers: auth, body: JSON.stringify({ label: f.label.trim(), annualAmount: Number(String(f.annualAmount).replace(/[^0-9.-]/g, "")) || 0, type: f.type }) }); setF({ label: "", annualAmount: "", type: "other" }); load(); }
  async function del(id: string) { await fetch(`/api/valuation/cafes/${cafeId}/adjustments/${id}`, { method: "DELETE", headers: auth }); load(); }
  const total = rows.reduce((a, r) => a + (Number(r.annualAmount) || 0), 0);
  if (loading) return <Loader2 className="animate-spin" />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Add-backs (owner adjustments) are non-business or one-off costs added back to profit — this is how you handle mixed books to reflect true earnings and value.</p>
      {rows.map((r) => (
        <Card key={r.id} className="flex items-center justify-between !py-3"><div><div className="font-semibold text-sm">{r.label}</div><div className="text-[11px] text-muted-foreground capitalize">{(r.type || "other").replace(/_/g, " ")}</div></div><div className="flex items-center gap-3"><span className="font-bold text-emerald-400">+{money(r.annualAmount)}</span><button onClick={() => del(r.id)} className="text-red-400"><Trash2 size={14} /></button></div></Card>
      ))}
      {rows.length > 0 && <div className="text-right text-sm">Total add-backs: <b className="text-emerald-400">+{money(total)}</b> p.a.</div>}
      <Card className="!py-3">
        <div className="grid sm:grid-cols-[1fr_140px_140px_auto] gap-2 items-end">
          <label className="text-xs font-semibold text-muted-foreground">Description<input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} className={`${inp} mt-1 font-normal`} placeholder="e.g. Owner's car" /></label>
          <label className="text-xs font-semibold text-muted-foreground">Annual $<input value={f.annualAmount} onChange={(e) => setF({ ...f, annualAmount: e.target.value })} className={`${inp} mt-1 font-normal`} inputMode="numeric" /></label>
          <label className="text-xs font-semibold text-muted-foreground">Type<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={`${inp} mt-1 font-normal`}><option value="owner_wage">Owner wage</option><option value="personal">Personal</option><option value="one_off">One-off</option><option value="non_business">Non-business</option><option value="other">Other</option></select></label>
          <Button onClick={add} className="theme-btn-gradient border-0">Add</Button>
        </div>
      </Card>
    </div>
  );
}

// ── Financial Reports (custom) ──
function FinReports({ cafeId, auth }: { cafeId: string; auth: any }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const load = useCallback(async () => { setLoading(true); try { const d = await fetch(`/api/valuation/custom-reports?cafeId=${cafeId}`, { headers: auth }).then((r) => r.json()); setReports(d.reports ?? []); } finally { setLoading(false); } }, [cafeId]);
  useEffect(() => { load(); }, [load]);
  async function create() { if (!name.trim()) return; const d = await fetch(`/api/valuation/custom-reports`, { method: "POST", headers: auth, body: JSON.stringify({ cafeId, name: name.trim(), dateRangeMonths: 12 }) }).then((r) => r.json()); setName(""); await load(); if (d.report) setEditing(d.report); }
  async function del(id: string) { await fetch(`/api/valuation/custom-reports/${id}`, { method: "DELETE", headers: auth }); load(); }
  if (loading) return <Loader2 className="animate-spin" />;
  if (editing) return <ReportEditor cafeId={cafeId} auth={auth} report={editing} onClose={() => { setEditing(null); load(); }} />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Build custom profit/loss reports from Square + Xero — e.g. kitchen-only: include Square food categories as income, minus food suppliers + chef wages from Xero, to see a real monthly P&L. Toggle “Include in IM” to surface a summary in your report.</p>
      {reports.map((r) => (
        <Card key={r.id} className="flex items-center justify-between !py-3">
          <div><div className="font-semibold text-sm">{r.name} {r.includeInIm && <span className="text-[10px] text-primary">· in IM</span>}</div><div className="text-[11px] text-muted-foreground">{r.incomeCount} income · {r.expenseCount} expense · {r.dateRangeMonths}mo</div></div>
          <div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => setEditing(r)}>Open</Button><button onClick={() => del(r.id)} className="text-red-400"><Trash2 size={14} /></button></div>
        </Card>
      ))}
      <div className="flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="New report e.g. Kitchen P&L" className={inp} /><Button onClick={create} className="theme-btn-gradient border-0"><Plus size={14} className="mr-1" /> New</Button></div>
    </div>
  );
}
function ReportEditor({ cafeId, auth, report, onClose }: { cafeId: string; auth: any; report: any; onClose: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [xero, setXero] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [includeIm, setIncludeIm] = useState(!!report.includeInIm);
  const [sqConnected, setSqConnected] = useState(false);
  const [syncingCats, setSyncingCats] = useState(false);
  const loadCats = useCallback(async () => {
    const [cd, mt] = await Promise.all([
      fetch(`/api/valuation/square/categories?cafeId=${cafeId}`, { headers: auth }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/valuation/cafes/${cafeId}/insights/meta`, { headers: auth }).then((r) => r.json()).catch(() => ({})),
    ]);
    setCats(cd.categories ?? []);
    setSqConnected(!!mt?.squareConnected);
  }, [cafeId]);
  async function syncCats() {
    setSyncingCats(true);
    try { await fetch(`/api/valuation/square/sync`, { method: "POST", headers: auth, body: JSON.stringify({ cafeId, periodMonths: 12, forceSync: true }) }); await loadCats(); }
    finally { setSyncingCats(false); }
  }
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [li, xr] = await Promise.all([
        fetch(`/api/valuation/custom-reports/${report.id}/line-items`, { headers: auth }).then((r) => r.json()),
        fetch(`/api/valuation/xero/reports?cafeId=${cafeId}&months=12`, { headers: auth }).then((r) => r.json()).catch(() => ({})),
      ]);
      setItems(li.items ?? []);
      const flat: any[] = []; (xr.sections ?? []).forEach((s: any) => (s.rows ?? []).forEach((r: any) => flat.push({ name: r.name, section: s.title, isIncome: s.isIncome })));
      setXero(flat);
      await loadCats();
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, []);
  const has = (source: string, name: string) => items.some((i) => i.source === source && i.xeroAccountName === name);
  function toggle(source: string, name: string, kind: string, label: string) {
    setItems((it) => has(source, name) ? it.filter((i) => !(i.source === source && i.xeroAccountName === name)) : [...it, { kind, source, xeroAccountName: name, label, sortOrder: it.length }]);
  }
  function setKind(source: string, name: string, kind: string) { setItems((it) => it.map((i) => (i.source === source && i.xeroAccountName === name ? { ...i, kind } : i))); }
  async function save() {
    await fetch(`/api/valuation/custom-reports/${report.id}/line-items`, { method: "PUT", headers: auth, body: JSON.stringify({ items: items.map((i, ix) => ({ kind: i.kind, label: i.label, source: i.source, xeroAccountName: i.xeroAccountName, sortOrder: ix })) }) });
    await fetch(`/api/valuation/custom-reports/${report.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ includeInIm: includeIm }) });
    const d = await fetch(`/api/valuation/custom-reports/${report.id}/data`, { headers: auth }).then((r) => r.json());
    setData(d);
  }
  if (loading) return <Loader2 className="animate-spin" />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between"><button onClick={onClose} className="text-sm text-muted-foreground inline-flex items-center gap-1.5"><ArrowLeft size={14} /> Reports</button><h3 className="font-bold">{report.name}</h3><label className="text-xs inline-flex items-center gap-1.5"><input type="checkbox" checked={includeIm} onChange={(e) => setIncludeIm(e.target.checked)} /> Include in IM</label></div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold">Square categories (income/expense)</h4>
            {sqConnected && <button onClick={syncCats} disabled={syncingCats} className="text-[11px] inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-60">{syncingCats ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Sync</button>}
          </div>
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto themed-scroll">
            {cats.map((c) => { const on = has("square_category", c.name); const it = items.find((i) => i.source === "square_category" && i.xeroAccountName === c.name); return (
              <div key={c.name} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${on ? "border-primary bg-primary/10" : "border-border"}`}>
                <button onClick={() => toggle("square_category", c.name, "income", c.name)} className="flex-1 text-left text-sm truncate">{c.name} <span className="text-[10px] text-muted-foreground">{money0(c.total)}</span></button>
                {on && <select value={it?.kind} onChange={(e) => setKind("square_category", c.name, e.target.value)} className="text-[11px] bg-background border border-border rounded px-1"><option value="income">income</option><option value="expense">expense</option></select>}
              </div>); })}
            {cats.length === 0 && (sqConnected
              ? <div className="text-xs text-muted-foreground">Square is connected but categories aren't cached yet. <button onClick={syncCats} disabled={syncingCats} className="text-primary hover:underline">{syncingCats ? "Syncing…" : "Sync now"}</button> to pull them (up to a minute).</div>
              : <p className="text-xs text-muted-foreground">Connect Square under Connections, then sync to see categories.</p>)}
          </div>
        </Card>
        <Card>
          <h4 className="text-sm font-bold mb-2">Xero P&L lines</h4>
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto themed-scroll">
            {xero.map((x) => { const on = has("xero_pl", x.name); return (
              <button key={x.name} onClick={() => toggle("xero_pl", x.name, x.isIncome ? "income" : "expense", x.name)} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left ${on ? "border-primary bg-primary/10" : "border-border"}`}>
                <span className="text-sm truncate">{x.name}</span><span className={`text-[10px] ${x.isIncome ? "text-emerald-400" : "text-red-400"}`}>{x.isIncome ? "income" : "expense"}</span>
              </button>); })}
            {xero.length === 0 && <p className="text-xs text-muted-foreground">Connect Xero to see P&L lines.</p>}
          </div>
        </Card>
      </div>
      <Button onClick={save} className="theme-btn-gradient border-0 self-start">Save & calculate</Button>
      {data && (
        <Card>
          <div className="flex gap-6 mb-3 text-sm"><div><div className="text-[10px] text-muted-foreground uppercase">Income</div><b className="text-emerald-400">{money(data.totals?.income)}</b></div><div><div className="text-[10px] text-muted-foreground uppercase">Expenses</div><b className="text-red-400">{money(data.totals?.expenses)}</b></div><div><div className="text-[10px] text-muted-foreground uppercase">Net profit</div><b>{money(data.totals?.net)}</b></div></div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.months ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => money(v)} width={48} />
                <Tooltip formatter={(v: any) => money(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="income" stroke="#16A34A" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="net" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Net profit line shows the peaks and troughs across 12 months.</p>
        </Card>
      )}
    </div>
  );
}

// ── Square insights ──
const PERIODS = [[3, "3 mo"], [6, "6 mo"], [12, "12 mo"], [24, "24 mo"]] as const;
const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Insights({ cafeId, auth }: { cafeId: string; auth: any }) {
  const [monthly, setMonthly] = useState<any[]>([]);
  const [dow, setDow] = useState<any[]>([]);
  const [top, setTop] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);
  const [metric, setMetric] = useState<"gross" | "net" | "orders">("gross");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [locData, setLocData] = useState<any>(null);
  const [sel, setSel] = useState<Set<string> | null>(null); // null = all
  const [showSource, setShowSource] = useState(false);
  const [selDirty, setSelDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, d, t, mt, lc] = await Promise.all([
      fetch(`/api/valuation/cafes/${cafeId}/insights/monthly?months=${months}`, { headers: auth }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/valuation/cafes/${cafeId}/insights/day-of-week?months=${months}`, { headers: auth }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/valuation/cafes/${cafeId}/insights/top-categories?months=${months}`, { headers: auth }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/valuation/cafes/${cafeId}/insights/meta`, { headers: auth }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/valuation/square/locations?cafeId=${cafeId}`, { headers: auth }).then((r) => r.json()).catch(() => ({})),
    ]);
    setMonthly(m.months ?? []); setDow(d.days ?? []); setTop(t.items ?? []); setMeta(mt ?? null);
    setLocData(lc ?? null);
    setSel(Array.isArray(lc?.selectedLocationIds) && lc.selectedLocationIds.length ? new Set<string>(lc.selectedLocationIds) : null);
    setSelDirty(false);
    setLoading(false);
  }, [cafeId, months]);
  useEffect(() => { load(); }, [load]);

  function toggleLoc(id: string, allIds: string[]) {
    setSelDirty(true);
    setSel((cur) => {
      const base = cur ? new Set(cur) : new Set(allIds); // null(all) → materialise then toggle off
      if (base.has(id)) base.delete(id); else base.add(id);
      return base;
    });
  }
  async function saveSourceAndSync() {
    const ids = sel ? Array.from(sel) : null;
    await fetch(`/api/valuation/square/locations`, { method: "POST", headers: auth, body: JSON.stringify({ cafeId, selectedLocationIds: ids }) });
    await syncSquare();
  }

  async function syncSquare() {
    setSyncing(true); setSyncMsg(null);
    try {
      const r = await fetch(`/api/valuation/square/sync`, { method: "POST", headers: auth, body: JSON.stringify({ cafeId, periodMonths: Math.max(months, 12), forceSync: true }) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); setSyncMsg(e.error || `Sync failed (${r.status})`); }
      else { setSyncMsg("Synced from Square ✓ (bucketed by your local trading day)"); await load(); }
    } catch { setSyncMsg("Sync failed — check your connection"); }
    finally { setSyncing(false); }
  }

  // Derived KPIs
  const totalRev = monthly.reduce((a, m) => a + (Number(m.gross) || 0), 0);
  const totalOrders = monthly.reduce((a, m) => a + (Number(m.orders) || 0), 0);
  const avgMonth = monthly.length ? totalRev / monthly.length : 0;
  const bestMonth = monthly.reduce((b, m) => (Number(m.gross) > Number(b?.gross ?? -1) ? m : b), null as any);
  const avgSale = totalOrders ? totalRev / totalOrders : 0;
  const lastM = monthly[monthly.length - 1], prevM = monthly[monthly.length - 2];
  const mom = lastM && prevM && Number(prevM.gross) > 0 ? ((Number(lastM.gross) - Number(prevM.gross)) / Number(prevM.gross)) * 100 : null;
  const topShareTotal = top.reduce((a, t) => a + (Number(t.total) || 0), 0);
  const busiest = dow[0], quietest = dow[dow.length - 1];
  const lastSynced = meta?.lastSyncedDate ? new Date(meta.lastSyncedDate) : null;
  const stale = lastSynced ? (Date.now() - lastSynced.getTime()) / 86400000 > 3 : true;

  if (loading) return <Loader2 className="animate-spin" />;

  const hasData = monthly.length || dow.length || top.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {PERIODS.map(([m, lbl]) => (
            <button key={m} onClick={() => setMonths(m)} className={`px-2.5 py-1 rounded-md text-xs font-semibold ${months === m ? "theme-btn-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{lbl}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {lastSynced && <span className={`text-[11px] ${stale ? "text-amber-400" : "text-muted-foreground"}`}>{stale ? "Data may be stale · " : "Synced to "}{lastSynced.toLocaleDateString("en-AU")}</span>}
          <Button size="sm" onClick={syncSquare} disabled={syncing || !meta?.squareConnected} className="theme-btn-gradient border-0 gap-1.5">
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {syncing ? "Syncing…" : "Sync Square"}
          </Button>
        </div>
      </div>
      {syncMsg && <div className="text-xs px-3 py-2 rounded-lg border border-border bg-muted/30">{syncMsg}</div>}
      {!meta?.squareConnected && <div className="text-xs px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300">Square isn't connected. Add it under Connections to unlock these insights.</div>}

      {/* Data source — which Square account/locations (income streams) feed these numbers */}
      {meta?.squareConnected && (
        <Card className="!py-3">
          <button onClick={() => setShowSource((s) => !s)} className="w-full flex items-center justify-between text-left">
            <div>
              <div className="text-sm font-bold">Data source{locData?.merchantName ? ` · ${locData.merchantName}` : ""}</div>
              <div className="text-[11px] text-muted-foreground">
                {(() => {
                  const locs = locData?.locations ?? [];
                  const active = locs.filter((l: any) => l.status === "ACTIVE");
                  const inUse = sel ? active.filter((l: any) => sel.has(l.id)) : active;
                  if (!locs.length) return "Square account connected — no locations returned.";
                  if (inUse.length === active.length) return `All ${active.length} location${active.length !== 1 ? "s" : ""} included${active.length > 1 ? " (summed)" : ""}. Tap to choose which income streams to include.`;
                  return `${inUse.length} of ${active.length} locations included: ${inUse.map((l: any) => l.name).join(", ")}. Tap to change.`;
                })()}
              </div>
            </div>
            <span className="text-[11px] text-primary shrink-0">{showSource ? "Hide" : "Choose"}</span>
          </button>
          {showSource && (
            <div className="mt-3 flex flex-col gap-1.5">
              {(locData?.locations ?? []).length === 0 && <p className="text-xs text-muted-foreground">No locations returned by Square.</p>}
              {(locData?.locations ?? []).map((l: any) => {
                const allIds = (locData?.locations ?? []).filter((x: any) => x.status === "ACTIVE").map((x: any) => x.id);
                const checked = sel ? sel.has(l.id) : l.status === "ACTIVE";
                return (
                  <label key={l.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${checked ? "border-primary bg-primary/10" : "border-border"} ${l.status !== "ACTIVE" ? "opacity-60" : "cursor-pointer"}`}>
                    <input type="checkbox" checked={checked} disabled={l.status !== "ACTIVE"} onChange={() => toggleLoc(l.id, allIds)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{l.name} {l.status !== "ACTIVE" && <span className="text-[10px] text-muted-foreground">({l.status.toLowerCase()})</span>}</div>
                      <div className="text-[11px] text-muted-foreground">{l.timezone}{l.currency ? ` · ${l.currency}` : ""}</div>
                    </div>
                  </label>
                );
              })}
              <div className="flex items-center gap-2 mt-1">
                <Button size="sm" onClick={saveSourceAndSync} disabled={syncing || !selDirty} className="theme-btn-gradient border-0 gap-1.5">{syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Save &amp; re-sync</Button>
                {selDirty && <span className="text-[11px] text-amber-400">Selection changed — save &amp; re-sync to apply.</span>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Include only the location(s) that belong to <b>this</b> business. Takings are counted on your local trading day, so a day you're closed reads $0.</p>
            </div>
          )}
        </Card>
      )}
      {meta?.squareConnected && !hasData && (
        <Center>Square is connected but no sales are cached yet. Hit <b className="mx-1">Sync Square</b> above to pull your transactions — this can take up to a minute for a full year.</Center>
      )}

      {hasData && (<>
        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <Kpi label={`Revenue · ${months}mo`} value={money0(totalRev)} />
          <Kpi label="Avg / month" value={money0(avgMonth)} />
          <Kpi label="Best month" value={bestMonth ? money0(bestMonth.gross) : "—"} sub={bestMonth?.month} />
          <Kpi label="Transactions" value={totalOrders.toLocaleString()} />
          <Kpi label="Avg sale" value={money0(avgSale)} sub={mom != null ? `${mom >= 0 ? "▲" : "▼"} ${Math.abs(mom).toFixed(0)}% MoM` : undefined} subColor={mom == null ? undefined : mom >= 0 ? "text-emerald-400" : "text-red-400"} />
        </div>

        {/* Revenue trend with metric toggle */}
        <Card>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h4 className="text-sm font-bold inline-flex items-center gap-1.5"><TrendingUp size={14} /> Revenue trend</h4>
            <div className="flex gap-1 rounded-lg border border-border p-0.5">
              {([["gross", "Gross"], ["net", "Net"], ["orders", "Orders"]] as const).map(([k, lbl]) => (
                <button key={k} onClick={() => setMetric(k)} className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${metric === k ? "theme-btn-gradient text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{lbl}</button>
              ))}
            </div>
          </div>
          <div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => metric === "orders" ? String(v) : moneyK(v)} width={48} />
              <Tooltip formatter={(v: any) => metric === "orders" ? `${Number(v).toLocaleString()} orders` : money0(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey={metric} stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer></div>
          <p className="text-[11px] text-muted-foreground mt-1">Peaks and troughs across {monthly.length} month{monthly.length !== 1 ? "s" : ""}. Toggle gross / net / order count above.</p>
        </Card>

        {/* Strongest days */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold">Strongest days of the week</h4>
            {busiest && quietest && <span className="text-[11px] text-muted-foreground">Busiest <b className="text-foreground">{busiest.day}</b> · Quietest <b className="text-foreground">{quietest.day}</b></span>}
          </div>
          <div className="flex flex-col gap-1.5">
            {dow.map((d) => { const max = Math.max(...dow.map((x) => x.avgGross), 1); return (
              <div key={d.dow} className="flex items-center gap-2">
                <span className="w-24 text-sm">{d.day}</span>
                <div className="flex-1 bg-muted/40 rounded-full h-5 overflow-hidden"><div className="h-full theme-btn-gradient rounded-full" style={{ width: `${Math.max((d.avgGross / max) * 100, 2)}%` }} /></div>
                <span className="text-sm font-semibold w-20 text-right">{money0(d.avgGross)}</span>
                <span className="hidden sm:inline text-[11px] text-muted-foreground w-28 text-right">{d.tradingDays} days · {Number(d.totalOrders).toLocaleString()} sales</span>
              </div>); })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Average takings per trading day over the selected period — the true per-day figure, so a busy weekday reads higher than a quiet weekend.</p>
        </Card>

        {/* Top sellers + category mix */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <h4 className="text-sm font-bold mb-2">Top sellers (by revenue)</h4>
            {top.length === 0 ? (
              <p className="text-xs text-muted-foreground">No item-level data cached yet. Hit <b>Sync Square</b> — this pulls your line-items and categories.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {top.slice(0, 15).map((t, i) => { const share = topShareTotal ? (Number(t.total) / topShareTotal) * 100 : 0; return (
                  <div key={i} className="py-1.5 border-b border-border/40">
                    <div className="flex items-center justify-between">
                      <span className="text-sm truncate pr-2"><span className="text-muted-foreground mr-2">{i + 1}.</span>{t.name}</span>
                      <span className="text-sm shrink-0"><b>{money0(t.total)}</b> <span className="text-[11px] text-muted-foreground">· {Number(t.orders).toLocaleString()} sold</span></span>
                    </div>
                    <div className="mt-1 h-1.5 bg-muted/40 rounded-full overflow-hidden"><div className="h-full theme-btn-gradient rounded-full" style={{ width: `${Math.max(share, 1)}%` }} /></div>
                  </div>); })}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">Grouped by Square category/item (the finest breakdown Square provides).</p>
          </Card>
          <Card>
            <h4 className="text-sm font-bold mb-2">Revenue mix</h4>
            {top.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sync Square to see how revenue splits across categories.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {top.slice(0, 8).map((t, i) => { const share = topShareTotal ? (Number(t.total) / topShareTotal) * 100 : 0; return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-28 text-xs truncate">{t.name}</span>
                    <div className="flex-1 bg-muted/40 rounded-full h-3.5 overflow-hidden"><div className="h-full theme-btn-gradient rounded-full" style={{ width: `${Math.max(share, 1)}%` }} /></div>
                    <span className="text-[11px] text-muted-foreground w-10 text-right">{share.toFixed(0)}%</span>
                  </div>); })}
                <p className="text-[11px] text-muted-foreground mt-1">Use this to spot which categories to exclude for a division-specific P&L (e.g. kitchen = food only) under Fin. Reports.</p>
              </div>
            )}
          </Card>
        </div>
      </>)}
    </div>
  );
}
function Kpi({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
      {sub && <div className={`text-[11px] mt-0.5 ${subColor ?? "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: any; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}><div className="bg-card border border-border rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto themed-scroll" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between mb-3"><h3 className="font-bold text-sm">{title}</h3><button onClick={onClose}><X size={18} /></button></div>{children}</div></div>;
}
