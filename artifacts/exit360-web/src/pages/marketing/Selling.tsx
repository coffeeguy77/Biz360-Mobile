import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Camera, ShieldCheck, BarChart3, Users, FileText, Sparkles,
  ArrowRight, CheckCircle2, Clock, Lock, TrendingUp,
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

export function Selling() {
  const pc = usePageContent("/selling");
  const whyI = [Camera, ShieldCheck, BarChart3, Users, FileText, Lock];
  const statsI = [Clock, TrendingUp, Users, ShieldCheck];
  return (
    <SiteShell>
      <Seo
        title="Sell Your Business Online with 360° Virtual Tours | EXIT360"
        description="Sell your business faster and for more with EXIT360. Immersive 360° virtual tours, verified financials, buyer NDAs and live analytics. List your business for sale in Australia today."
        keywords="sell my business, business for sale, sell a business online, 360 virtual tour business, business broker alternative, list a business for sale australia, confidential business sale"
        path="/selling"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Sell a business on EXIT360",
          description: "List and sell your business with immersive 360° virtual tours, verified financials and buyer analytics.",
          areaServed: "AU",
          provider: { "@type": "Organization", name: "EXIT360" },
        }}
      />

      {/* Hero */}
      <section className="theme-aurora-bg">
        <div className="relative z-10 max-w-[1440px] mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div {...fade}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5">
              <Sparkles size={13} /> {pc.t("hero.eyebrow")}
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5"><RichCopy text={pc.t("hero.title")} /></h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8"><RichCopy text={pc.t("hero.subtitle")} /></p>
            <div className="flex flex-wrap gap-4">
              <Link href="/list-your-business"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">{pc.t("hero.ctaPrimary")} <ArrowRight size={18} className="ml-1" /></Button></Link>
              <Link href="/how-it-works"><Button size="lg" variant="outline" className="h-13 px-8 text-base">{pc.t("hero.ctaSecondary")}</Button></Link>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-8 text-sm text-muted-foreground">
              {pc.list("hero.chips").map((chip, i) => (<span key={i} className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> {chip.text}</span>))}
            </div>
          </motion.div>
          <motion.div {...fade} className="relative">
            <div className="absolute inset-0 theme-glow rounded-3xl" />
            <div className="relative rounded-3xl border border-border bg-card/70 backdrop-blur p-2 shadow-2xl">
              <img src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&q=80&w=1000" alt="Business owner presenting a business for sale with a 360 virtual tour" className="rounded-2xl w-full h-[420px] object-cover" />
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

      {/* Stats band */}
      <section className="max-w-[1440px] mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-3xl border border-border theme-aurora-bg">
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8 p-10">
            {pc.list("stats.items").map((s, i) => { const Icon = pick(statsI, i); return (
              <div key={i} className="text-center"><Icon className="mx-auto mb-2 text-primary" size={22} /><div className="text-xl font-extrabold">{s.value}</div><div className="text-xs text-muted-foreground mt-1">{s.label}</div></div>); })}
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

      <CtaBand heading={pc.t("cta.heading")} sub={pc.t("cta.sub")} primary={{ label: pc.t("cta.primary"), href: "/list-your-business" }} secondary={{ label: pc.t("cta.secondary"), href: "/brokers" }} />
    </SiteShell>
  );
}
