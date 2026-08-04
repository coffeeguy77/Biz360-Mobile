import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Camera, ShieldCheck, FileText, Users, LayoutDashboard, Smartphone,
  ArrowRight, CheckCircle2, Search, Lock, MapPin, Handshake, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { RichCopy } from "@/content/copy";
import { usePageContent } from "@/content/model";
import { SiteShell, CtaBand } from "@/components/SiteShell";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5 },
};
const pick = (arr: any[], i: number) => arr[i % arr.length];

export function Buying() {
  const pc = usePageContent("/buying");
  const whyI = [Camera, ShieldCheck, FileText, Users, LayoutDashboard, Smartphone];
  const cardI = [MapPin, ShieldCheck, Handshake, Clock];
  return (
    <SiteShell>
      <Seo
        title="Buy a Business in Australia with 360° Tours | EXIT360"
        description="Buy a business in Australia with confidence. Explore verified listings in immersive 360°, review financials under NDA and enquire in one tap — all in the EXIT360 buyer portal."
        keywords="buy a business, businesses for sale australia, business for sale, buy a cafe, buy a franchise, business acquisition, 360 virtual tour, due diligence, business buyer portal"
        path="/buying"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Buy a business on EXIT360",
          description: "Discover, tour and acquire Australian businesses for sale with immersive 360° virtual tours, NDA-gated financials and one-tap verified enquiries.",
          areaServed: "AU",
          provider: { "@type": "Organization", name: "EXIT360" },
        }}
      />

      {/* Hero */}
      <section className="theme-aurora-bg">
        <div className="relative z-10 max-w-[1440px] mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div {...fade}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5">
              <Search size={13} /> {pc.t("hero.eyebrow")}
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5"><RichCopy text={pc.t("hero.title")} /></h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8"><RichCopy text={pc.t("hero.subtitle")} /></p>
            <div className="flex flex-wrap gap-4">
              <Link href="/listings"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">{pc.t("hero.ctaPrimary")} <ArrowRight size={18} className="ml-1" /></Button></Link>
              <Link href="/how-it-works"><Button size="lg" variant="outline" className="h-13 px-8 text-base">{pc.t("hero.ctaSecondary")}</Button></Link>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-8 text-sm text-muted-foreground">
              {pc.list("hero.chips").map((chip, i) => (<span key={i} className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> {chip.text}</span>))}
            </div>
          </motion.div>
          <motion.div {...fade} className="relative">
            <div className="absolute inset-0 theme-glow rounded-3xl" />
            <div className="relative rounded-3xl border border-border bg-card/70 backdrop-blur p-2 shadow-2xl">
              <img src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&q=80&w=1000" alt="Buyer exploring a business for sale in a 360 degree virtual tour on EXIT360" className="rounded-2xl w-full h-[420px] object-cover" />
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-background/85 backdrop-blur border border-border p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl grid place-items-center theme-btn-gradient"><Camera className="text-primary-foreground" size={20} /></div>
                <div><p className="text-sm font-semibold">{pc.t("hero.cardTitle")}</p><p className="text-xs text-muted-foreground">{pc.t("hero.cardSub")}</p></div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <motion.div {...fade} className="max-w-3xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"><RichCopy text={pc.t("why.heading")} /></h2>
          <p className="text-lg text-muted-foreground leading-relaxed"><RichCopy text={pc.t("why.body")} /></p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {pc.list("why.cards").map((f, i) => { const Icon = pick(whyI, i); return (
            <motion.div key={i} {...fade} transition={{ duration: 0.5, delay: i * 0.05 }} className="rounded-2xl border border-border bg-card/50 p-6 hover:border-primary/40 transition-colors">
              <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary mb-4"><Icon size={20} /></div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed"><RichCopy text={f.body} /></p>
            </motion.div>); })}
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.div {...fade} className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"><RichCopy text={pc.t("steps.heading")} /></h2>
          <p className="text-lg text-muted-foreground"><RichCopy text={pc.t("steps.body")} /></p>
        </motion.div>
        <div className="grid md:grid-cols-4 gap-6">
          {pc.list("steps.items").map((s, i) => (
            <motion.div key={i} {...fade} transition={{ duration: 0.5, delay: i * 0.06 }} className="relative rounded-2xl border border-border bg-card/40 p-6">
              <div className="text-4xl font-extrabold theme-text-gradient mb-3">{s.n}</div>
              <h3 className="text-lg font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed"><RichCopy text={s.body} /></p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="max-w-[1440px] mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-3xl border border-border theme-aurora-bg overflow-hidden">
          <div className="relative z-10 grid lg:grid-cols-2 gap-10 p-10 sm:p-14 items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5"><Lock size={13} /> {pc.t("trust.eyebrow")}</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"><RichCopy text={pc.t("trust.heading")} /></h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6"><RichCopy text={pc.t("trust.body")} /></p>
              <div className="space-y-3">
                {pc.list("trust.checklist").map((t, i) => (
                  <div key={i} className="flex items-start gap-3"><CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0" /><p className="text-sm text-muted-foreground leading-relaxed">{t.text}</p></div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {pc.list("trust.cards").map((s, i) => { const Icon = pick(cardI, i); return (
                <div key={i} className="rounded-2xl border border-border bg-background/70 backdrop-blur p-5 text-center"><Icon className="mx-auto mb-2 text-primary" size={22} /><div className="text-base font-extrabold leading-tight">{s.value}</div><div className="text-xs text-muted-foreground mt-1">{s.label}</div></div>); })}
            </div>
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <motion.h2 {...fade} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-10 text-center">{pc.t("faq.heading")}</motion.h2>
        <div className="space-y-4">
          {pc.list("faq.items").map((f, i) => (
            <motion.details key={i} {...fade} transition={{ duration: 0.4, delay: i * 0.04 }} className="group rounded-2xl border border-border bg-card/50 p-5">
              <summary className="flex items-center justify-between cursor-pointer list-none"><span className="font-semibold pr-4">{f.q}</span><span className="text-primary transition-transform group-open:rotate-45 text-2xl leading-none">+</span></summary>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3"><RichCopy text={f.a} /></p>
            </motion.details>
          ))}
        </div>
      </section>

      <CtaBand heading={pc.t("cta.heading")} sub={pc.t("cta.sub")} primary={{ label: pc.t("cta.primary"), href: "/listings" }} secondary={{ label: pc.t("cta.secondary"), href: "/buyers" }} />
    </SiteShell>
  );
}
