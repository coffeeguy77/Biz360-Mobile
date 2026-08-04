import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, Upload, Star, Trash2 } from "lucide-react";

// Comprehensive category tree modelled on the leading AU business-for-sale sites
// (BusinessesForSale, SEEK Business, Commercial Real Estate, AnyBusiness).
const CATEGORY_TREE: Record<string, string[]> = {
  "Food & Beverage": ["Café", "Restaurant", "Takeaway / Fast Food", "Bakery", "Coffee / Roastery", "Bar / Pub / Tavern", "Catering", "Food Truck", "Juice / Smoothie", "Function Venue", "Other food & beverage"],
  "Retail": ["Clothing / Fashion", "Convenience Store", "Newsagency / Tobacconist", "Supermarket / Grocery", "Pharmacy / Chemist", "Homewares / Giftware", "Florist", "Liquor / Bottle Shop", "Pet / Aquarium", "Electronics", "Jewellery", "Hardware", "Other retail"],
  "Hospitality & Accommodation": ["Hotel / Motel", "Bed & Breakfast", "Caravan Park / Camping", "Backpackers / Hostel", "Serviced Apartments", "Function / Events"],
  "Health & Beauty": ["Hair Salon", "Beauty Salon", "Nail Salon", "Day Spa", "Massage", "Tanning", "Tattoo / Piercing", "Cosmetic / Injectables"],
  "Health & Medical": ["Medical Practice / GP", "Dental", "Physiotherapy", "Allied Health", "Optometry", "Pharmacy", "Veterinary", "Aged Care / NDIS"],
  "Health & Fitness": ["Gym / Fitness Centre", "Personal Training / Studio", "Yoga / Pilates", "Martial Arts", "Sports Club"],
  "Professional Services": ["Accounting / Bookkeeping", "Legal", "Real Estate Agency", "Financial / Insurance", "Consulting", "Marketing / Advertising", "Recruitment", "Architecture / Design"],
  "Trade & Services": ["Cleaning", "Landscaping / Gardening", "Plumbing", "Electrical", "Building / Construction", "Automotive / Mechanic", "Car Wash / Detailing", "Locksmith", "Pest Control", "Waste / Skip"],
  "Manufacturing & Industrial": ["Food Manufacturing", "Engineering / Fabrication", "Textiles / Apparel", "Signage / Printing", "Joinery / Cabinetry", "Chemical / Plastics", "Other manufacturing"],
  "Automotive": ["Dealership", "Mechanic / Workshop", "Panel / Smash Repair", "Tyres", "Car Wash", "Spare Parts", "Towing"],
  "Transport & Logistics": ["Courier / Delivery", "Freight / Trucking", "Removalist", "Warehousing", "Taxi / Rideshare"],
  "Education & Childcare": ["Childcare / Daycare", "Tutoring", "Training / RTO", "Driving School", "Early Learning"],
  "Technology": ["Software / SaaS", "IT Services / MSP", "E-commerce", "Web / Digital Agency", "App / Development"],
  "Import / Export / Wholesale": ["Wholesale", "Distribution", "Import", "Export"],
  "Franchise": ["Food Franchise", "Retail Franchise", "Services Franchise", "Other Franchise"],
  "Leisure & Entertainment": ["Cinema / Theatre", "Amusement / Arcade", "Sports / Recreation", "Tourism / Tours", "Events / Ticketing"],
  "Agriculture & Rural": ["Farming", "Orchard / Vineyard", "Nursery / Landscaping supply", "Aquaculture", "Livestock"],
  "Home & Garden": ["Nursery / Garden Centre", "Furniture", "Interiors / Decor", "Pool / Spa"],
  "Online / Internet": ["Online Store", "Content / Media", "Marketplace", "Subscription / Membership"],
  "Other": ["Other"],
};
const CATEGORIES = Object.keys(CATEGORY_TREE);
const SALE_STATUS: { v: string; label: string }[] = [
  { v: "available", label: "Available" }, { v: "new", label: "New listing" }, { v: "hot", label: "Hot / High demand" },
  { v: "price_reduced", label: "Price reduced" }, { v: "under_offer", label: "Under offer" }, { v: "under_contract", label: "Under contract" },
  { v: "sold", label: "Sold" }, { v: "coming_soon", label: "Coming soon" },
];
const TENURE = ["", "Leasehold", "Freehold", "Freehold going concern", "Franchise", "Licence"];
const STATES = ["VIC", "NSW", "QLD", "WA", "SA", "ACT", "TAS", "NT"];
const FRANCHISE = ["Independent", "Franchise", "License Agreement", "Cooperative"];
const STAT_OPTS: { v: string; label: string }[] = [
  { v: "sde", label: "SDE p.a." }, { v: "staffCount", label: "Staff" }, { v: "weeklyRevenue", label: "Weekly Rev." },
  { v: "rent", label: "Monthly Rent" }, { v: "equipmentValue", label: "Equipment $" }, { v: "ownerHours", label: "Owner Hrs" },
  { v: "leaseExpiry", label: "Lease Expiry" }, { v: "none", label: "None" },
];
const BADGES: { v: string; label: string; desc: string }[] = [
  { v: "identity", label: "Identity Verified", desc: "Seller ID confirmed" },
  { v: "abn", label: "ABN Verified", desc: "Active ABN confirmed" },
  { v: "financials", label: "Financials Verified", desc: "P&L/BAS verified" },
  { v: "lease", label: "Lease Verified", desc: "Lease reviewed" },
  { v: "equipment", label: "Equipment List", desc: "Full schedule provided" },
  { v: "tour", label: "360° Tour", desc: "Interactive tour available" },
  { v: "broker", label: "Broker Represented", desc: "Licensed broker engaged" },
  { v: "accountant", label: "Accountant Signed", desc: "CPA/CA sign-off" },
  { v: "seller_supplied", label: "Seller Supplied Docs", desc: "Supporting docs uploaded" },
];
const CONTACT = [
  { v: "message", label: "Message only", desc: "Buyers contact via message" },
  { v: "call", label: "Message + Call", desc: "Buyers can message or call" },
  { v: "broker_only", label: "Broker only", desc: "Enquiries via broker" },
];

const inp = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60";
function Field({ label, children, span }: { label: string; children: any; span?: boolean }) {
  return <label className={`text-xs font-semibold text-muted-foreground block ${span ? "sm:col-span-2" : ""}`}>{label}<div className="mt-1 font-normal text-foreground">{children}</div></label>;
}
function Chips({ options, value, onChange }: { options: { v: string; label: string }[] | string[]; value: string; onChange: (v: string) => void }) {
  const opts = options.map((o) => (typeof o === "string" ? { v: o, label: o } : o));
  return <div className="flex flex-wrap gap-1.5">{opts.map((o) => (
    <button type="button" key={o.v} onClick={() => onChange(o.v)} className={`text-xs px-3 py-1.5 rounded-full border ${value === o.v ? "theme-btn-gradient border-0 text-primary-foreground" : "border-border hover:border-primary/40"}`}>{o.label}</button>
  ))}</div>;
}

async function fileToB64(file: File): Promise<{ data: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); resolve({ data: s.split(",")[1] ?? "", mime: (s.match(/^data:(.*?);/) ?? [])[1] ?? file.type }); };
    r.onerror = reject; r.readAsDataURL(file);
  });
}

export interface ListingFormValues {
  businessName: string; category: string; subcategory: string; saleStatus: string; tenure: string; state: string; suburb: string; description: string; confidential: boolean; seoIndexable: boolean;
  priceDisplay: string; askingPrice: string; askingPriceMin: string; askingPriceMax: string; weeklyRevenue: string;
  adjustedProfit: string; rent: string; staffCount: string; ownerHours: string; leaseExpiry: string; leaseOptions: string;
  stat2Display: string; stat3Display: string; franchiseStatus: string; trainingPeriod: string; reasonForSale: string;
  growthOpportunities: string; risks: string; equipmentValue: string; contactPreference: string; sellerPhone: string;
  badges: string[]; photos: string[];
}
const EMPTY: ListingFormValues = {
  businessName: "", category: "", subcategory: "", saleStatus: "available", tenure: "", state: "VIC", suburb: "", description: "", confidential: false, seoIndexable: true,
  priceDisplay: "askingPrice", askingPrice: "", askingPriceMin: "", askingPriceMax: "", weeklyRevenue: "",
  adjustedProfit: "", rent: "", staffCount: "", ownerHours: "", leaseExpiry: "", leaseOptions: "",
  stat2Display: "sde", stat3Display: "staffCount", franchiseStatus: "", trainingPeriod: "", reasonForSale: "",
  growthOpportunities: "", risks: "", equipmentValue: "", contactPreference: "message", sellerPhone: "",
  badges: [], photos: [],
};

export function ListingForm({ mode, listingId, token, onDone, onCancel }: {
  mode: "create" | "edit"; listingId?: string; token: string; onDone: () => void; onCancel: () => void;
}) {
  const [f, setF] = useState<ListingFormValues>(EMPTY);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof ListingFormValues, v: any) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (mode !== "edit" || !listingId) return;
    (async () => {
      try {
        const j = await fetch("/api/biz360/kv/biz360_admin_pending_v2").then((r) => r.json());
        const rec = (Array.isArray(j?.value) ? j.value : []).find((l: any) => l?.listingId === listingId) ?? {};
        const s = (v: any) => (v === undefined || v === null ? "" : String(v));
        const n = (v: any) => (v ? String(v) : "");
        setF({
          ...EMPTY,
          businessName: s(rec.businessName), category: s(rec.category), subcategory: s(rec.subcategory), saleStatus: s(rec.saleStatus) || "available", tenure: s(rec.tenure), state: s(rec.state) || "VIC", suburb: s(rec.suburb === "Unknown" ? "" : rec.suburb),
          description: s(rec.description), confidential: !!rec.confidential, seoIndexable: rec.seoIndexable !== false, priceDisplay: s(rec.priceDisplay) || "askingPrice",
          askingPrice: n(rec.askingPrice), askingPriceMin: n(rec.askingPriceMin), askingPriceMax: n(rec.askingPriceMax), weeklyRevenue: n(rec.weeklyRevenue),
          adjustedProfit: n(rec.adjustedProfit), rent: n(rec.rent), staffCount: n(rec.staffCount), ownerHours: n(rec.ownerHours),
          leaseExpiry: s(rec.leaseExpiry), leaseOptions: s(rec.leaseOptions), stat2Display: s(rec.stat2Display) || "sde", stat3Display: s(rec.stat3Display) || "staffCount",
          franchiseStatus: s(rec.franchiseStatus), trainingPeriod: s(rec.trainingPeriod), reasonForSale: s(rec.reasonForSale),
          growthOpportunities: s(rec.growthOpportunities), risks: s(rec.risks), equipmentValue: n(rec.equipmentValue),
          contactPreference: s(rec.contactPreference) || "message", sellerPhone: s(rec.sellerPhone),
          badges: Array.isArray(rec.badges) ? rec.badges : [], photos: Array.isArray(rec.photos) ? rec.photos : [],
        });
      } finally { setLoading(false); }
    })();
  }, [mode, listingId]);

  async function addPhotos(files: FileList) {
    setUploading(true); setError(null);
    try {
      for (const file of Array.from(files).slice(0, 12)) {
        const { data, mime } = await fileToB64(file);
        const r = await fetch("/api/biz360/img", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ key: `listing_photo_${Date.now()}`, data, mimeType: mime, listingId: listingId ?? "new" }) });
        const d = await r.json();
        if (d.url) setF((p) => ({ ...p, photos: [...p.photos, d.url].slice(0, 12) }));
      }
    } catch { setError("Photo upload failed."); } finally { setUploading(false); }
  }
  function removePhoto(i: number) { setF((p) => ({ ...p, photos: p.photos.filter((_, ix) => ix !== i) })); }
  function makeHero(i: number) { setF((p) => { const ph = [...p.photos]; const [x] = ph.splice(i, 1); return { ...p, photos: [x, ...ph] }; }); }
  function toggleBadge(v: string) { setF((p) => ({ ...p, badges: p.badges.includes(v) ? p.badges.filter((b) => b !== v) : [...p.badges, v] })); }

  async function save() {
    if (f.businessName.trim().length < 2) { setError("Business name is required."); return; }
    setSaving(true); setError(null);
    const body: any = { ...f };
    try {
      const url = mode === "edit" ? `/api/biz360/seller/listings/${listingId}` : "/api/biz360/seller/listings";
      const method = mode === "edit" ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok || (!d.ok && !d.listing)) { setError(d.error ?? "Could not save."); return; }
      onDone();
    } catch { setError("Could not save."); } finally { setSaving(false); }
  }

  if (loading) return <div className="rounded-2xl border border-border bg-card/50 p-10 text-center text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18} /> Loading…</div>;

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">{mode === "edit" ? "Edit listing" : "New listing"}</h2>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
      </div>

      <Section title="Basics">
        <Field label="Business name *" span><input value={f.businessName} onChange={(e) => set("businessName", e.target.value)} className={inp} placeholder="e.g. Bean Culture Coffee Roastery" /></Field>
        <Field label="Category"><select value={f.category} onChange={(e) => { set("category", e.target.value); set("subcategory", ""); }} className={inp}><option value="">— choose —</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Subcategory"><select value={f.subcategory} onChange={(e) => set("subcategory", e.target.value)} className={inp} disabled={!f.category}><option value="">— choose —</option>{(CATEGORY_TREE[f.category] ?? []).map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
        <Field label="State"><Chips options={STATES} value={f.state} onChange={(v) => set("state", v)} /></Field>
        <Field label="Suburb"><input value={f.suburb} onChange={(e) => set("suburb", e.target.value)} className={inp} placeholder="e.g. Mitchell" /></Field>
        <Field label="Sale status"><select value={f.saleStatus} onChange={(e) => set("saleStatus", e.target.value)} className={inp}>{SALE_STATUS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}</select></Field>
        <Field label="Tenure"><select value={f.tenure} onChange={(e) => set("tenure", e.target.value)} className={inp}>{TENURE.map((t) => <option key={t} value={t}>{t || "— not set —"}</option>)}</select></Field>
        <Field label="Confidential listing"><Toggle on={f.confidential} onToggle={() => set("confidential", !f.confidential)} label="Hide business name from public search" /></Field>
        <Field label="Search engine visibility"><Toggle on={f.seoIndexable} onToggle={() => set("seoIndexable", !f.seoIndexable)} label="Allow Google & other search engines to index this listing (recommended)" /></Field>
        <Field label="Description" span><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} className={inp} placeholder="History, what makes it attractive, what's included…" /></Field>
      </Section>

      <Section title="Financials & price">
        <Field label="Card price display"><Chips options={[{ v: "askingPrice", label: "Asking Price" }, { v: "weeklyRevenue", label: "Weekly Revenue" }, { v: "poa", label: "POA" }]} value={f.priceDisplay} onChange={(v) => set("priceDisplay", v)} /></Field>
        <Field label="Asking price ($)"><input value={f.askingPrice} onChange={(e) => set("askingPrice", e.target.value)} className={inp} placeholder="185000" inputMode="numeric" /></Field>
        <Field label="Asking price range — From ($)"><input value={f.askingPriceMin} onChange={(e) => set("askingPriceMin", e.target.value)} className={inp} placeholder="1500000" inputMode="numeric" /></Field>
        <Field label="Asking price range — To ($)"><input value={f.askingPriceMax} onChange={(e) => set("askingPriceMax", e.target.value)} className={inp} placeholder="2100000" inputMode="numeric" /></Field>
        <p className="text-[11px] text-muted-foreground sm:col-span-2 -mt-1">Fill both From & To to show a price range on the card (e.g. “$1.5M – $2.1M”). Leave blank to use the single asking price.</p>
        <Field label="Weekly revenue ($)"><input value={f.weeklyRevenue} onChange={(e) => set("weeklyRevenue", e.target.value)} className={inp} placeholder="18500" inputMode="numeric" /></Field>
        <Field label="Adjusted profit / SDE ($ p.a.)"><input value={f.adjustedProfit} onChange={(e) => set("adjustedProfit", e.target.value)} className={inp} placeholder="72000" inputMode="numeric" /></Field>
        <Field label="Monthly rent ($)"><input value={f.rent} onChange={(e) => set("rent", e.target.value)} className={inp} placeholder="4200" inputMode="numeric" /></Field>
        <Field label="Equipment value ($)"><input value={f.equipmentValue} onChange={(e) => set("equipmentValue", e.target.value)} className={inp} placeholder="120000" inputMode="numeric" /></Field>
        <Field label="Staff count"><input value={f.staffCount} onChange={(e) => set("staffCount", e.target.value)} className={inp} placeholder="4" inputMode="numeric" /></Field>
        <Field label="Owner hours / week"><input value={f.ownerHours} onChange={(e) => set("ownerHours", e.target.value)} className={inp} placeholder="40" inputMode="numeric" /></Field>
        <Field label="Lease expiry"><input value={f.leaseExpiry} onChange={(e) => set("leaseExpiry", e.target.value)} className={inp} placeholder="e.g. June 2027" /></Field>
        <Field label="Lease options"><input value={f.leaseOptions} onChange={(e) => set("leaseOptions", e.target.value)} className={inp} placeholder="e.g. 2 × 3-year options" /></Field>
        <Field label="Card stat — slot 2"><select value={f.stat2Display} onChange={(e) => set("stat2Display", e.target.value)} className={inp}>{STAT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}</select></Field>
        <Field label="Card stat — slot 3"><select value={f.stat3Display} onChange={(e) => set("stat3Display", e.target.value)} className={inp}>{STAT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}</select></Field>
      </Section>

      <Section title="Details">
        <Field label="Franchise / license status"><Chips options={FRANCHISE} value={f.franchiseStatus} onChange={(v) => set("franchiseStatus", v)} /></Field>
        <Field label="Training period"><input value={f.trainingPeriod} onChange={(e) => set("trainingPeriod", e.target.value)} className={inp} placeholder="e.g. 4 weeks included" /></Field>
        <Field label="Reason for sale" span><textarea value={f.reasonForSale} onChange={(e) => set("reasonForSale", e.target.value)} rows={2} className={inp} placeholder="e.g. Relocating interstate, retirement…" /></Field>
        <Field label="Growth opportunities" span><textarea value={f.growthOpportunities} onChange={(e) => set("growthOpportunities", e.target.value)} rows={2} className={inp} placeholder="What could a new owner do to grow revenue?" /></Field>
        <Field label="Risks / disclosures" span><textarea value={f.risks} onChange={(e) => set("risks", e.target.value)} rows={2} className={inp} placeholder="Anything a buyer should know…" /></Field>
      </Section>

      <Section title="Photos">
        <div className="sm:col-span-2">
          <div className="flex flex-wrap gap-2 mb-2">
            {f.photos.map((p, i) => (
              <div key={i} className="relative w-24 h-16 rounded-lg overflow-hidden border border-border group">
                <img src={p} className="w-full h-full object-cover" />
                {i === 0 && <span className="absolute top-1 left-1 text-[9px] bg-primary text-primary-foreground px-1 rounded">Hero</span>}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                  {i !== 0 && <button onClick={() => makeHero(i)} title="Make hero" className="text-white"><Star size={14} /></button>}
                  <button onClick={() => removePhoto(i)} title="Remove" className="text-white"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            <label className="w-24 h-16 rounded-lg border-2 border-dashed border-border grid place-items-center cursor-pointer hover:border-primary/50 text-muted-foreground">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addPhotos(e.target.files); e.currentTarget.value = ""; }} />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">First photo is the hero image. Up to 12.</p>
        </div>
      </Section>

      <Section title="Verification badges">
        <div className="sm:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-2">
          {BADGES.map((b) => (
            <button type="button" key={b.v} onClick={() => toggleBadge(b.v)} className={`text-left rounded-lg border p-2.5 ${f.badges.includes(b.v) ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
              <div className="text-xs font-semibold flex items-center gap-1.5">{f.badges.includes(b.v) && <Check size={12} className="text-primary" />}{b.label}</div>
              <div className="text-[10px] text-muted-foreground">{b.desc}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Contact">
        <Field label="Contact preference"><Chips options={CONTACT} value={f.contactPreference} onChange={(v) => set("contactPreference", v)} /></Field>
        {f.contactPreference === "call" && <Field label="Phone number"><input value={f.sellerPhone} onChange={(e) => set("sellerPhone", e.target.value)} className={inp} placeholder="e.g. 0400 000 000" /></Field>}
      </Section>

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving} className="theme-btn-gradient border-0">{saving ? "Saving…" : mode === "edit" ? "Save changes" : "Create listing"}</Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">{title}</h3>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}
function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return <div className="flex items-center gap-2"><button type="button" onClick={onToggle} className={`relative inline-flex h-6 w-11 items-center rounded-full flex-shrink-0 ${on ? "theme-btn-gradient" : "bg-muted"}`}><span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} /></button><span className="text-xs text-muted-foreground">{label}</span></div>;
}
