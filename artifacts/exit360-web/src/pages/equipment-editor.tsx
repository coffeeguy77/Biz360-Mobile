import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Plus, Trash2, Loader2, X, Layers, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";

const TOKEN_KEY = "biz360_web_auth_token";
const CONDITIONS = ["excellent", "good", "fair", "poor"];
const inp = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60";
function money(v: any) { const n = Number(v ?? 0) || 0; return n ? `$${n.toLocaleString()}` : "—"; }

interface Unit { id: string; name: string; isIncludedInSale?: boolean; is_included_in_sale?: boolean; }
interface Equip {
  id: string; name: string; category?: string | null; brand?: string | null; condition?: string | null;
  secondhandValue?: string | null; replacementCost?: string | null; currentValue?: string | null;
  valuationMode?: string | null; ownership?: string | null; isLeased?: boolean; notes?: string | null; unitId?: string | null;
}

export function EquipmentEditor() {
  const params = useParams();
  const listingId = params.listingId as string;
  const token = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [cafeId, setCafeId] = useState<string | null | undefined>(undefined);
  const [units, setUnits] = useState<Unit[]>([]);
  const [items, setItems] = useState<Equip[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("__all__");
  const [editing, setEditing] = useState<Equip | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showUnits, setShowUnits] = useState(false);

  const inc = (u: Unit) => (u.is_included_in_sale ?? u.isIncludedInSale) !== false;

  async function loadAll(cid: string) {
    const [u, e] = await Promise.all([
      fetch(`/api/valuation/cafes/${cid}/units`, { headers: auth }).then((r) => r.json()).catch(() => []),
      fetch(`/api/valuation/cafes/${cid}/equipment`, { headers: auth }).then((r) => r.json()).catch(() => []),
    ]);
    setUnits(Array.isArray(u) ? u : []);
    setItems(Array.isArray(e) ? e : []);
  }
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const c = await fetch(`/api/buyer-portal/seller/listing-cafe/${listingId}`, { headers: auth }).then((r) => r.json());
        setCafeId(c.cafeId ?? null);
        if (c.cafeId) await loadAll(c.cafeId);
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  const shown = items.filter((it) => tab === "__all__" ? true : it.unitId === tab);
  const totalCurrent = shown.filter((i) => i.ownership !== "leased" && !i.isLeased).reduce((a, i) => a + (Number(i.secondhandValue ?? i.currentValue ?? 0) || 0), 0);

  async function saveItem(item: Equip) {
    if (!cafeId || !item.name?.trim()) { setErr("Name is required."); return; }
    setErr(null);
    const body: any = {
      name: item.name.trim(), category: item.category || null, brand: item.brand || null, condition: item.condition || null,
      secondhandValue: item.secondhandValue ? Number(String(item.secondhandValue).replace(/[^0-9.]/g, "")) : null,
      replacementCost: item.replacementCost ? Number(String(item.replacementCost).replace(/[^0-9.]/g, "")) : null,
      valuationMode: "secondhand", ownership: item.ownership === "leased" ? "leased" : null, isLeased: item.ownership === "leased",
      notes: item.notes || null, unit_id: item.unitId || null,
    };
    const isNew = !item.id;
    const url = isNew ? `/api/valuation/cafes/${cafeId}/equipment` : `/api/valuation/cafes/${cafeId}/equipment/${item.id}`;
    const r = await fetch(url, { method: isNew ? "POST" : "PATCH", headers: auth, body: JSON.stringify(body) });
    if (!r.ok) { setErr("Could not save item."); return; }
    setEditing(null); await loadAll(cafeId);
  }
  async function delItem(id: string) { if (!cafeId) return; await fetch(`/api/valuation/cafes/${cafeId}/equipment/${id}`, { method: "DELETE", headers: auth }); await loadAll(cafeId); }
  async function addUnit(name: string) { if (!cafeId || !name.trim()) return; await fetch(`/api/valuation/cafes/${cafeId}/units`, { method: "POST", headers: auth, body: JSON.stringify({ name: name.trim() }) }); await loadAll(cafeId); }
  async function toggleUnit(u: Unit) { if (!cafeId) return; await fetch(`/api/valuation/cafes/${cafeId}/units/${u.id}`, { method: "PATCH", headers: auth, body: JSON.stringify({ is_included_in_sale: !inc(u) }) }); await loadAll(cafeId); }
  async function delUnit(id: string) { if (!cafeId) return; await fetch(`/api/valuation/cafes/${cafeId}/units/${id}`, { method: "DELETE", headers: auth }); await loadAll(cafeId); }

  if (!token) return <div className="min-h-screen grid place-items-center text-foreground p-8"><div className="text-center"><p className="mb-3">Please sign in.</p><Link href="/seller"><Button className="theme-btn-gradient border-0">Seller dashboard</Button></Link></div></div>;
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin mr-2" /> Loading equipment…</div>;

  return (
    <div className="min-h-screen text-foreground">
      <Seo title="Equipment Register | EXIT360" description="Manage your business equipment register." path={`/seller/equipment/${listingId}`} />
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur">
        <Link href="/seller" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Dashboard</Link>
        <span className="font-bold">Equipment register</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Total (owned): <b className="text-foreground">{money(totalCurrent)}</b></span>
          <Button size="sm" onClick={() => setEditing({ id: "", name: "", ownership: "", unitId: tab === "__all__" ? null : tab })} className="theme-btn-gradient border-0"><Plus size={14} className="mr-1" /> Add item</Button>
        </div>
      </div>

      {cafeId === null ? (
        <div className="max-w-2xl mx-auto p-10 text-center text-muted-foreground">This listing doesn't have a valuation/business record yet. Create the report first (in the app or the report builder), then the equipment register will be available here.</div>
      ) : (
        <div className="max-w-5xl mx-auto p-4">
          {/* Division tabs */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <button onClick={() => setTab("__all__")} className={`text-sm px-3 py-1.5 rounded-lg border ${tab === "__all__" ? "theme-btn-gradient border-0 text-primary-foreground" : "border-border"}`}>All</button>
            {units.filter(inc).map((u) => (
              <button key={u.id} onClick={() => setTab(u.id)} className={`text-sm px-3 py-1.5 rounded-lg border ${tab === u.id ? "theme-btn-gradient border-0 text-primary-foreground" : "border-border"}`}>{u.name}</button>
            ))}
            <button onClick={() => setShowUnits((s) => !s)} className="text-sm px-3 py-1.5 rounded-lg border border-border text-muted-foreground inline-flex items-center gap-1.5"><Layers size={13} /> Divisions</button>
          </div>

          {showUnits && <DivisionsManager units={units} inc={inc} onAdd={addUnit} onToggle={toggleUnit} onDelete={delUnit} />}

          {shown.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card/40 p-10 text-center text-muted-foreground">No equipment here yet. Click “Add item”.</div>
          ) : (
            <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase text-muted-foreground border-b border-border"><tr>
                  <th className="p-3">Item</th><th className="p-3 hidden sm:table-cell">Category</th><th className="p-3 hidden md:table-cell">Condition</th><th className="p-3 text-right">Second-hand</th><th className="p-3 text-right hidden sm:table-cell">Replacement</th><th className="p-3"></th>
                </tr></thead>
                <tbody>
                  {shown.map((it) => (
                    <tr key={it.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setEditing({ ...it, ownership: (it.ownership === "leased" || it.isLeased) ? "leased" : "" })}>
                      <td className="p-3"><div className="font-semibold">{it.name}</div>{it.brand && <div className="text-[11px] text-muted-foreground">{it.brand}</div>}{(it.ownership === "leased" || it.isLeased) && <span className="text-[10px] text-amber-400">Leased</span>}</td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground">{it.category || "—"}</td>
                      <td className="p-3 hidden md:table-cell capitalize text-muted-foreground">{it.condition || "—"}</td>
                      <td className="p-3 text-right font-semibold">{money(it.secondhandValue ?? it.currentValue)}</td>
                      <td className="p-3 text-right hidden sm:table-cell text-muted-foreground">{money(it.replacementCost)}</td>
                      <td className="p-3 text-right"><button onClick={(e) => { e.stopPropagation(); delItem(it.id); }} className="text-red-400"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editing && <ItemModal item={editing} units={units} onChange={setEditing} onSave={() => saveItem(editing)} onClose={() => setEditing(null)} err={err} />}
    </div>
  );
}

function DivisionsManager({ units, inc, onAdd, onToggle, onDelete }: { units: Unit[]; inc: (u: Unit) => boolean; onAdd: (n: string) => void; onToggle: (u: Unit) => void; onDelete: (id: string) => void }) {
  const [name, setName] = useState("");
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4 mb-4">
      <p className="text-xs text-muted-foreground mb-2">Divisions group equipment (e.g. Café, Roastery). Items in divisions not included in the sale are excluded from totals and the buyer register.</p>
      <div className="flex flex-col gap-1.5 mb-3">
        {units.map((u) => (
          <div key={u.id} className="flex items-center gap-2">
            <span className="text-sm flex-1">{u.name}</span>
            <button onClick={() => onToggle(u)} className={`text-[11px] px-2 py-1 rounded-full border ${inc(u) ? "border-emerald-500/40 text-emerald-400" : "border-border text-muted-foreground"}`}>{inc(u) ? "In sale" : "Excluded"}</button>
            <button onClick={() => onDelete(u.id)} className="text-red-400"><Trash2 size={13} /></button>
          </div>
        ))}
        {units.length === 0 && <p className="text-xs text-muted-foreground">No divisions yet.</p>}
      </div>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New division e.g. Roastery" className={inp} />
        <Button size="sm" onClick={() => { onAdd(name); setName(""); }} className="theme-btn-gradient border-0">Add</Button>
      </div>
    </div>
  );
}

function ItemModal({ item, units, onChange, onSave, onClose, err }: { item: Equip; units: Unit[]; onChange: (i: Equip) => void; onSave: () => void; onClose: () => void; err: string | null }) {
  const set = (k: keyof Equip, v: any) => onChange({ ...item, [k]: v });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto themed-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="font-bold">{item.id ? "Edit item" : "Add item"}</h3><button onClick={onClose}><X size={18} /></button></div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold col-span-2">Name *<input value={item.name} onChange={(e) => set("name", e.target.value)} className={`${inp} mt-1 font-normal`} placeholder="e.g. La Marzocco Espresso Machine" /></label>
          <label className="text-xs font-semibold">Category<input value={item.category ?? ""} onChange={(e) => set("category", e.target.value)} className={`${inp} mt-1 font-normal`} placeholder="e.g. Coffee" /></label>
          <label className="text-xs font-semibold">Brand<input value={item.brand ?? ""} onChange={(e) => set("brand", e.target.value)} className={`${inp} mt-1 font-normal`} /></label>
          <label className="text-xs font-semibold">Condition<select value={item.condition ?? ""} onChange={(e) => set("condition", e.target.value)} className={`${inp} mt-1 font-normal`}><option value="">—</option>{CONDITIONS.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}</select></label>
          <label className="text-xs font-semibold">Division<select value={item.unitId ?? ""} onChange={(e) => set("unitId", e.target.value || null)} className={`${inp} mt-1 font-normal`}><option value="">Unassigned</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label className="text-xs font-semibold">Second-hand value ($)<input value={item.secondhandValue ?? ""} onChange={(e) => set("secondhandValue", e.target.value)} className={`${inp} mt-1 font-normal`} inputMode="numeric" /></label>
          <label className="text-xs font-semibold">Replacement cost ($)<input value={item.replacementCost ?? ""} onChange={(e) => set("replacementCost", e.target.value)} className={`${inp} mt-1 font-normal`} inputMode="numeric" /></label>
          <div className="col-span-2 flex items-center gap-2"><button onClick={() => set("ownership", item.ownership === "leased" ? "" : "leased")} className={`relative inline-flex h-6 w-11 items-center rounded-full ${item.ownership === "leased" ? "theme-btn-gradient" : "bg-muted"}`}><span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${item.ownership === "leased" ? "translate-x-6" : "translate-x-1"}`} /></button><span className="text-sm">Leased (not owned / excluded from sale value)</span></div>
          <label className="text-xs font-semibold col-span-2">Notes<textarea value={item.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} className={`${inp} mt-1 font-normal`} /></label>
        </div>
        {err && <p className="text-sm text-red-500 mt-3">{err}</p>}
        <div className="flex gap-2 mt-4"><Button onClick={onSave} className="theme-btn-gradient border-0"><Check size={14} className="mr-1" /> Save</Button><Button variant="outline" onClick={onClose}>Cancel</Button></div>
      </div>
    </div>
  );
}
