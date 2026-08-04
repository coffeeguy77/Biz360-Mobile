import { useState } from "react";
import { Link } from "wouter";
import {
  Sparkles, LifeBuoy, Store, Compass, FileText, Boxes, LineChart, ShieldCheck,
  MessagesSquare, ScrollText, BarChart3, ArrowRight, Check, Loader2, Send,
  PlayCircle, Phone, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { SiteShell, CtaBand } from "@/components/SiteShell";

// One running example used through the whole support system.
const EG = {
  name: "Crema Lane Espresso",
  owner: "Ava",
  where: "Fitzroy, VIC",
  kind: "café & micro-roastery",
  price: "$420,000",
  divisions: ["Espresso Bar", "Micro-Roastery"],
};

function ask(q?: string) { window.dispatchEvent(new CustomEvent("exit360:openHelp", { detail: q ? { ask: q } : {} })); }

const JOURNEY = [
  { icon: Store, title: "1 · Create your listing", href: "/seller", body: `Ava starts her ${EG.name} listing from the Seller dashboard — business name, category (${EG.kind}), ${EG.where}, an asking price of ${EG.price} (a single figure, a From–To range, or POA), the headline stats and a short description. Nothing goes public until it's finished and approved.` },
  { icon: Compass, title: "2 · Build the 360° walkthrough", href: "/seller", body: `She captures a panorama of each space — the espresso bar, the roastery, the storeroom — links them into a guided path, and drops hotspots on the La Marzocco machine and the roaster. Buyers explore room to room, on app or web, no headset.` },
  { icon: FileText, title: "3 · Build the report (IM)", href: "/seller", body: `The report builder turns her figures into a professional information memorandum — around 40 sections. Auto-fill pulls from her data; she sets each section's visibility (public, approved buyers, or seller-only) and whether it appears in the PDF.` },
  { icon: Boxes, title: "4 · Equipment & divisions", href: "/seller", body: `Ava lists her plant and equipment with second-hand and replacement values, and splits the business into two divisions — ${EG.divisions.join(" and ")} — so each can be valued on its own and included or excluded from the sale.` },
  { icon: LineChart, title: "5 · Connect Xero & Square", href: "/seller", body: `One tap connects Xero (P&L, supplier spend) and Square (sales by day and category). She maps which income accounts are revenue per division, tags her food suppliers as COGS, and adds add-backs (her own wage, one-offs) so the numbers reflect true earnings.` },
  { icon: ShieldCheck, title: "6 · Buyer access & NDA", href: "/seller", body: `Financials stay locked. Buyers verify their phone and sign an NDA before a single figure appears, and Ava approves each buyer individually — she can always see who signed.` },
  { icon: MessagesSquare, title: "7 · Talk to buyers", href: "/seller", body: `Enquiries land in Messages with a simple CRM pipeline. Buyers request info, a call or a site visit in one tap, and Ava replies securely — every interested buyer in one place.` },
  { icon: BarChart3, title: "8 · Watch it work", href: "/seller", body: `Analytics show listing views, tour engagement, report opens and who visited (when signed in), so Ava always knows which buyers are worth her time.` },
];

const AREAS = [
  { icon: Store, title: "Creating a listing", what: "Your public shopfront: name, category, location, price, headline stats and description.", how: [`From ${"/seller"} choose “Start a listing”.`, "Fill the details — price can be a figure, a range, or POA.", "Save; it's reviewed before going public."] , href: "/seller" },
  { icon: Compass, title: "360° tour builder", what: "An immersive, navigable walkthrough built from linked panoramas with interactive hotspots.", how: ["Capture a panorama of each space.", "Link scenes into a guided path and set the arrival-facing angle.", "Add hotspots on equipment/divisions; enable or disable zones."], href: "/walkthroughs" },
  { icon: FileText, title: "Report / IM builder", what: "A data-room-grade information memorandum with ~40 sections and per-section visibility.", how: ["Open the report builder from your listing.", "Auto-fill from your data, then edit each section.", "Set visibility (public / approved buyers / seller-only) and PDF/web/app toggles."], href: "/seller" },
  { icon: LineChart, title: "Financials — Xero & Square", what: "Your real numbers: P&L and supplier spend from Xero, sales analytics from Square.", how: ["Business valuation → Connections → connect Xero and Square.", "Map income accounts to divisions; tag COGS suppliers.", "Use Square Insights and custom P&L reports to show true monthly profit."], href: "/seller" },
  { icon: BarChart3, title: "Valuation & add-backs", what: "Revenue, COGS, EBITDA, add-backs and an indicative valuation, per division and combined.", how: ["Add owner adjustments (wage, one-offs, personal costs).", "Include or exclude each division from the sale.", "Publish the snapshot so approved buyers can see it."], href: "/seller" },
  { icon: ShieldCheck, title: "Buyer access & NDA", what: "Gate your financials so only verified, NDA-signed buyers you approve can see them.", how: ["Buyers verify their phone and sign the NDA.", "Approve buyers individually.", "See exactly who signed and when."], href: "/seller" },
  { icon: ScrollText, title: "Leases", what: "Upload your lease for an AI risk analysis, browse a clause library, and build a negotiation draft.", how: ["Go to Leases and upload a PDF/DOCX.", "Review the flagged risks and tenant protections.", "Build a draft from favourable clauses."], href: "/seller/leases" },
];

const FAQ = [
  { q: "Do I need to finish everything in one go?", a: "No. Build your listing over a few sessions — capture the tour one day, connect Xero another. Nothing is public until you're ready and it's approved." },
  { q: "Is my financial information safe?", a: "Yes. Financials sit behind an NDA gate. Buyers verify their phone and sign before any figure is shown, and you approve each buyer individually and see who signed." },
  { q: "Do buyers need an app or headset?", a: "No. The 360° tour runs in any modern browser and in the EXIT360 app — nothing to install, no VR headset." },
  { q: "What if my books are a bit messy?", a: "That's normal. Add-backs let you add owner wages, one-offs and personal costs back to profit, and Square insights help separate income streams — so the valuation reflects true earnings." },
  { q: "How much does it cost to list?", a: "Building your listing and tour is free. For capture help, you can rent a camera or book a shoot — see the Walkthroughs page. For anything else, contact our team below." },
];

export function Help() {
  const [f, setF] = useState({ name: "", email: "", topic: "General", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSending(true); setErr(null);
    try {
      const r = await fetch("/api/support/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, path: "/help" }) });
      const d = await r.json();
      if (d.ok) setSent(true); else setErr(d.error || "Something went wrong.");
    } catch { setErr("Couldn't send — please try again."); }
    finally { setSending(false); }
  }
  const card = "rounded-2xl border border-border bg-card/50 p-6";

  return (
    <SiteShell>
      <Seo title="Help & Support · How EXIT360 works" description="Everything you need to sell your business on EXIT360 — a step-by-step guide to listings, 360° tours, financials, NDAs and more, plus our AI assistant and support team." path="/help" />

      {/* Hero */}
      <section id="main" className="theme-aurora-bg">
        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5"><LifeBuoy size={13} /> Help &amp; support</span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">Everything you need, <span className="theme-text-gradient">explained simply.</span></h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">Selling a business is a big deal — usually a once-in-a-lifetime one. This guide walks you through every part of EXIT360 using one real-world example, {EG.name}. Or just ask our assistant anything.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button size="lg" onClick={() => ask()} className="h-13 px-7 text-base theme-btn-gradient border-0 gap-2"><Sparkles size={18} /> Ask the assistant</Button>
            <a href="#journey"><Button size="lg" variant="outline" className="h-13 px-7 text-base gap-2"><PlayCircle size={18} /> See the full walkthrough</Button></a>
          </div>
        </div>
      </section>

      {/* Assistant explainer */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="rounded-3xl border border-border theme-aurora-bg overflow-hidden">
          <div className="relative z-10 grid md:grid-cols-[1.3fr_1fr] gap-8 p-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-4"><Sparkles size={13} /> AI assistant</div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">A guide that knows the whole platform</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">The EXIT360 assistant (the <b>Help</b> button, bottom-left of every page) answers your questions in plain English, walks you through any task, and takes you straight to the right screen. Ask it things like:</p>
              <div className="flex flex-wrap gap-2">
                {["How do I connect Xero?", "How do I set up the NDA?", "How do I add a division?", "How do I publish my tour?"].map((q) => (
                  <button key={q} onClick={() => ask(q)} className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:border-primary/50 hover:text-primary transition">{q}</button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 p-5">
              <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-xl grid place-items-center theme-btn-gradient"><Sparkles size={15} className="text-primary-foreground" /></div><span className="font-bold text-sm">EXIT360 Assistant</span></div>
              <p className="text-sm text-muted-foreground leading-relaxed">"To value your {EG.divisions[1]} separately, add it as a division, tag your coffee-bean suppliers as COGS in Xero, then open Business valuation — I can take you there."</p>
              <Button onClick={() => ask()} className="mt-4 w-full theme-btn-gradient border-0 gap-2"><Sparkles size={16} /> Start a conversation</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Guided journey */}
      <section id="journey" className="max-w-5xl mx-auto px-6 py-14">
        <div className="max-w-2xl mb-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">Selling, step by step</h2>
          <p className="text-lg text-muted-foreground">Follow {EG.owner} as she takes {EG.name} ({EG.where}) from an idea to a live, buyer-ready listing.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {JOURNEY.map((s) => (
            <div key={s.title} className={card}>
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-10 h-10 rounded-xl grid place-items-center bg-primary/10 text-primary shrink-0"><s.icon size={19} /></div>
                <h3 className="font-bold">{s.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{s.body}</p>
              <Link href={s.href}><button className="text-sm font-semibold text-primary inline-flex items-center gap-1 hover:gap-1.5 transition-all">Open <ArrowRight size={14} /></button></Link>
            </div>
          ))}
        </div>
      </section>

      {/* Area reference */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <div className="max-w-2xl mb-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">Every part of the platform</h2>
          <p className="text-lg text-muted-foreground">What each area does, and how to use it. Tap the assistant on any of these for a live walkthrough.</p>
        </div>
        <div className="space-y-4">
          {AREAS.map((a) => (
            <details key={a.title} className="group rounded-2xl border border-border bg-card/50 p-5">
              <summary className="flex items-center gap-3 cursor-pointer list-none">
                <div className="w-10 h-10 rounded-xl grid place-items-center bg-primary/10 text-primary shrink-0"><a.icon size={19} /></div>
                <div className="flex-1 min-w-0"><h3 className="font-bold">{a.title}</h3><p className="text-xs text-muted-foreground truncate">{a.what}</p></div>
                <span className="text-primary text-2xl leading-none transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="mt-4 pl-13 grid sm:grid-cols-[1fr_auto] gap-4 items-start">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{a.what}</p>
                  <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-5">{a.how.map((h) => <li key={h}>{h}</li>)}</ol>
                </div>
                <div className="flex flex-col gap-2">
                  <Link href={a.href}><Button variant="outline" size="sm" className="gap-1.5 w-full">Open <ArrowRight size={13} /></Button></Link>
                  <button onClick={() => ask(`How do I use ${a.title.toLowerCase()}?`)} className="text-xs px-3 py-2 rounded-lg border border-border hover:border-primary/50 hover:text-primary inline-flex items-center gap-1.5 justify-center"><Sparkles size={13} /> Ask</button>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-8 text-center">Common questions</h2>
        <div className="space-y-3">
          {FAQ.map((x) => (
            <details key={x.q} className="group rounded-2xl border border-border bg-card/50 p-5">
              <summary className="flex items-center justify-between cursor-pointer list-none"><span className="font-semibold pr-4">{x.q}</span><span className="text-primary text-2xl leading-none transition-transform group-open:rotate-45">+</span></summary>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">{x.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="max-w-3xl mx-auto px-6 py-14">
        <div className={card}>
          <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-xl grid place-items-center bg-primary/10 text-primary"><Phone size={19} /></div><div><h2 className="text-xl font-extrabold">Talk to a human</h2><p className="text-xs text-muted-foreground">We'll get back to you by email. For instant answers, ask the assistant.</p></div></div>
          {sent ? (
            <div className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-300 inline-flex items-center gap-2"><Check size={16} /> Thanks — your message is with our team. We'll be in touch.</div>
          ) : (
            <form onSubmit={submit} className="mt-5 grid gap-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Your name" className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label="Your name" />
                <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} type="email" placeholder="Email" className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label="Email" />
              </div>
              <select value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label="Topic">
                {["General", "Creating a listing", "360° tour", "Financials (Xero/Square)", "Buyer access / NDA", "Billing", "Something's broken"].map((t) => <option key={t}>{t}</option>)}
              </select>
              <textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} rows={4} placeholder="How can we help?" className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-none" aria-label="Message" required />
              {err && <div className="text-sm text-red-400">{err}</div>}
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={sending} className="theme-btn-gradient border-0 gap-2">{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send message</Button>
                <button type="button" onClick={() => ask()} className="text-sm text-primary inline-flex items-center gap-1.5"><Sparkles size={14} /> or ask the assistant</button>
              </div>
            </form>
          )}
        </div>
      </section>

      <CtaBand heading="Ready to start?" sub="Create your listing, build your 360° tour and reach verified buyers — we'll guide you the whole way." primary={{ label: "Start a listing", href: "/seller" }} secondary={{ label: "Browse listings", href: "/listings" }} />
    </SiteShell>
  );
}
