import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Camera, CheckCircle2, GraduationCap, MapPin, DollarSign, Award, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { RichCopy } from "@/content/copy";
import { usePageContent } from "@/content/model";
import { SiteShell, CtaBand } from "@/components/SiteShell";

const fade = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.5 } };
const pick = (arr: any[], i: number) => arr[i % arr.length];
const STATES = ["ACT", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT"];

export function Photographers() {
  const pc = usePageContent("/photographers");
  const stepI = [Camera, GraduationCap, Award, MapPin];
  const whyI = [DollarSign, MapPin, Camera];
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
              <Sparkles size={13} /> {pc.t("hero.eyebrow")}
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
              <RichCopy text={pc.t("hero.title")} />
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
              <RichCopy text={pc.t("hero.subtitle")} />
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a href="#apply"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">{pc.t("hero.ctaPrimary")} <ArrowRight size={18} className="ml-1" /></Button></a>
              <Link href="/find-a-partner"><Button size="lg" variant="outline" className="h-13 px-8 text-base">{pc.t("hero.ctaSecondary")}</Button></Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How to qualify */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.h2 {...fade} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3 text-center"><RichCopy text={pc.t("qualify.heading")} /></motion.h2>
        <motion.p {...fade} className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12"><RichCopy text={pc.t("qualify.body")} /></motion.p>
        <div className="grid md:grid-cols-4 gap-6">
          {pc.list("qualify.steps").map((s, i) => { const Icon = pick(stepI, i); return (
            <motion.div key={i} {...fade} transition={{ duration: 0.5, delay: i * 0.06 }} className="rounded-2xl border border-border bg-card/50 p-6">
              <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary mb-4"><Icon size={20} /></div>
              <div className="text-xs font-bold text-primary mb-1">STEP {i + 1}</div>
              <h3 className="text-lg font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed"><RichCopy text={s.body} /></p>
            </motion.div>); })}
        </div>
      </section>

      {/* Why partner */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-3xl border border-border theme-aurora-bg">
          <div className="relative z-10 grid md:grid-cols-3 gap-8 p-10">
            {pc.list("why.cards").map((c, i) => { const Icon = pick(whyI, i); return (
              <div key={i} className="text-center">
                <Icon className="mx-auto text-primary mb-2" size={24} />
                <h3 className="font-bold mb-1">{c.title}</h3>
                <p className="text-sm text-muted-foreground"><RichCopy text={c.body} /></p>
              </div>); })}
          </div>
        </motion.div>
      </section>

      {/* Apply form */}
      <section id="apply" className="max-w-2xl mx-auto px-6 py-20 scroll-mt-24">
        <motion.h2 {...fade} className="text-3xl font-extrabold tracking-tight mb-2 text-center"><RichCopy text={pc.t("apply.heading")} /></motion.h2>
        <motion.p {...fade} className="text-muted-foreground text-center mb-8"><RichCopy text={pc.t("apply.sub")} /></motion.p>
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
        heading={pc.t("cta.heading")}
        sub={pc.t("cta.sub")}
        primary={{ label: pc.t("cta.primary"), href: "/find-a-partner" }}
        secondary={{ label: pc.t("cta.secondary"), href: "/walkthroughs" }}
      />
    </SiteShell>
  );
}
