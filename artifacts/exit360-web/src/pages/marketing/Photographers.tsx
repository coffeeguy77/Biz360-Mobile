import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Camera, CheckCircle2, GraduationCap, MapPin, DollarSign, Award, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { SiteShell, CtaBand } from "@/components/SiteShell";

const fade = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.5 } };
const STATES = ["ACT", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT"];

export function Photographers() {
  const [f, setF] = useState({ name: "", phone: "", email: "", city: "", region: "ACT", ownsCamera: false, experience: "" });
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (f.name.trim().length < 2 || f.phone.replace(/\D/g, "").length < 8) { setError("Please enter your name and mobile number."); return; }
    setSaving(true); setError(null);
    try {
      const r = await fetch("/api/public/partners/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setError(d.error ?? "Could not submit. Please try again."); return; }
      setSent(true);
    } catch { setError("Network error. Please try again."); } finally { setSaving(false); }
  }

  const field = "w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60";
  return (
    <SiteShell>
      <Seo
        title="Become an EXIT360 Walkthrough Partner | 360° Photographer Program"
        description="Join the EXIT360 partner network as a 360° walkthrough photographer. Own an Insta360, complete sample listings as training, get approved and receive referral work capturing businesses for sale."
        keywords="360 photographer jobs, virtual tour photographer, insta360 photographer, walkthrough photographer australia, 360 tour partner, real estate photography partner"
        path="/photographers"
        jsonLd={{ "@context": "https://schema.org", "@type": "JobPosting", title: "EXIT360 Walkthrough Partner (360° Photographer)", employmentType: "CONTRACTOR", hiringOrganization: { "@type": "Organization", name: "EXIT360" } }}
      />

      <section className="theme-aurora-bg">
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <motion.div {...fade}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5">
              <Sparkles size={13} /> Partner program
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
              Get paid to capture businesses in <span className="theme-text-gradient">immersive 360°.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
              EXIT360 needs skilled local photographers to build stunning 360° walkthroughs for businesses
              going to market. Own an Insta360, pass our short training, and get referred paid shoots in your
              area — with the tools, templates and support to make every listing look world-class.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href="#apply"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">Apply to join <ArrowRight size={18} className="ml-1" /></Button></a>
              <Link href="/find-a-partner"><Button size="lg" variant="outline" className="h-13 px-8 text-base">Find a partner near me</Button></Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How to qualify */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.h2 {...fade} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3 text-center">How to become a partner</motion.h2>
        <motion.p {...fade} className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">A simple, quality-first path — because every EXIT360 walkthrough carries our name.</motion.p>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { icon: Camera, t: "Own an Insta360", b: "You supply your own Insta360 camera (X4 or similar). It's the gear we build our capture workflow around — compact, fast and stunning quality." },
            { icon: GraduationCap, t: "Complete training listings", b: "Shoot a small number of sample listings to our spec so we can check quality, scene linking and narration placement before you go live." },
            { icon: Award, t: "Get approved", b: "Pass the review and you're an approved EXIT360 partner, listed in our directory for buyers, sellers and brokers to find." },
            { icon: MapPin, t: "Receive local referrals", b: "We refer paid walkthrough work in your region straight to you, with templates and support for every shoot." },
          ].map((s, i) => (
            <motion.div key={s.t} {...fade} transition={{ duration: 0.5, delay: i * 0.06 }} className="rounded-2xl border border-border bg-card/50 p-6">
              <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary mb-4"><s.icon size={20} /></div>
              <div className="text-xs font-bold text-primary mb-1">STEP {i + 1}</div>
              <h3 className="text-lg font-bold mb-2">{s.t}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.b}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Why partner */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-3xl border border-border theme-aurora-bg">
          <div className="relative z-10 grid md:grid-cols-3 gap-8 p-10">
            {[
              { icon: DollarSign, t: "Paid shoots", b: "Earn from referred walkthrough jobs — a growing pipeline as more businesses list with 360° tours." },
              { icon: MapPin, t: "Own your region", b: "Be the go-to EXIT360 partner locally, discoverable in our find-a-partner directory." },
              { icon: Camera, t: "Do great work", b: "Immersive 360° storytelling with AI narration — the most impressive listings in the market." },
            ].map((c) => (
              <div key={c.t} className="text-center">
                <c.icon className="mx-auto text-primary mb-2" size={24} />
                <h3 className="font-bold mb-1">{c.t}</h3>
                <p className="text-sm text-muted-foreground">{c.b}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Apply form */}
      <section id="apply" className="max-w-2xl mx-auto px-6 py-20 scroll-mt-24">
        <motion.h2 {...fade} className="text-3xl font-extrabold tracking-tight mb-2 text-center">Apply to join</motion.h2>
        <motion.p {...fade} className="text-muted-foreground text-center mb-8">We'll be in touch about training listings and next steps.</motion.p>
        {sent ? (
          <div className="rounded-2xl border border-border bg-card/50 p-8 text-center">
            <CheckCircle2 className="mx-auto text-primary mb-3" size={40} />
            <h3 className="text-xl font-bold mb-2">Application received</h3>
            <p className="text-muted-foreground">Thanks {f.name.split(" ")[0]}! We'll reach out about your training listings and getting you approved.</p>
          </div>
        ) : (
          <motion.div {...fade} className="rounded-2xl border border-border bg-card/50 p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Full name *</label><input className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Mobile *</label><input className={field} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="0412 345 678" /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label><input className={field} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">City / suburb</label><input className={field} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="e.g. Canberra" /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">State / region</label><select className={field} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <label className="flex items-center gap-2 text-sm cursor-pointer mt-6"><input type="checkbox" checked={f.ownsCamera} onChange={(e) => setF({ ...f, ownsCamera: e.target.checked })} className="w-4 h-4 accent-[hsl(var(--primary))]" /> I own an Insta360 camera</label>
            </div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Experience / portfolio link</label><textarea className={field} rows={3} value={f.experience} onChange={(e) => setF({ ...f, experience: e.target.value })} placeholder="Tell us about your photography experience and share a portfolio link" /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={submit} disabled={saving} className="w-full h-12 theme-btn-gradient border-0">{saving ? "Submitting…" : "Submit application"}</Button>
          </motion.div>
        )}
      </section>

      <CtaBand
        heading="Looking for a walkthrough, not a job?"
        sub="Find an approved EXIT360 partner in your area to capture your business — or book our Canberra shoot service."
        primary={{ label: "Find a partner", href: "/find-a-partner" }}
        secondary={{ label: "About 360° tours", href: "/walkthroughs" }}
      />
    </SiteShell>
  );
}
