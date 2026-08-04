import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Compass, Camera, MousePointerClick, Smartphone, FileText, Clock,
  ArrowRight, CheckCircle2, Users, ShieldCheck, Eye, Layers, Globe, Sparkles, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { RichCopy } from "@/content/copy";
import { usePageContent } from "@/content/model";
import { SiteShell, CtaBand } from "@/components/SiteShell";
import { AudioNarrationShowcase } from "@/components/AudioNarrationShowcase";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5 },
};

const cardIcon = (arr: any[], i: number) => arr[i % arr.length];

export function Walkthroughs() {
  const pc = usePageContent("/walkthroughs");
  const whatisI = [Eye, Compass, MousePointerClick];
  const benefitsI = [Users, ShieldCheck, Clock, Globe, Sparkles, FileText];
  const howtoI = [Camera, Layers, Globe];
  const differentI = [Compass, MousePointerClick, Smartphone, FileText];
  const statsI = [Globe, Clock, Smartphone, FileText];
  const offersI = [Camera, Video];

  return (
    <SiteShell>
      <Seo
        title="360° Virtual Tours & Business Walkthroughs | EXIT360"
        description="Explore businesses for sale with EXIT360's immersive 360° virtual tours. Walk through room to room like Street View, qualify from anywhere, and buy with confidence."
        keywords="360 virtual tour, business walkthrough, virtual tour business for sale, immersive business tour, 360 property tour, virtual inspection"
        path="/walkthroughs"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: "360° Virtual Business Walkthroughs on EXIT360",
          description:
            "Immersive, navigable 360° virtual tours of businesses for sale. Buyers move room to room like Google Street View, qualify themselves and buy with confidence.",
          areaServed: "AU",
          provider: { "@type": "Organization", name: "EXIT360" },
        }}
      />

      {/* Hero */}
      <section className="theme-aurora-bg">
        <div className="relative z-10 max-w-[1440px] mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div {...fade}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5">
              <Compass size={13} /> {pc.t("hero.eyebrow")}
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
              <RichCopy text={pc.t("hero.title")} />
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
              <RichCopy text={pc.t("hero.subtitle")} />
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/listings"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">{pc.t("hero.ctaPrimary")} <ArrowRight size={18} className="ml-1" /></Button></Link>
              <Link href="/selling"><Button size="lg" variant="outline" className="h-13 px-8 text-base">{pc.t("hero.ctaSecondary")}</Button></Link>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-8 text-sm text-muted-foreground">
              {pc.list("hero.chips").map((chip, i) => (
                <span key={i} className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> {chip.text}</span>
              ))}
            </div>
          </motion.div>
          <motion.div {...fade} className="relative">
            <div className="absolute inset-0 theme-glow rounded-3xl" />
            <div className="relative rounded-3xl border border-border bg-card/70 backdrop-blur p-2 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1000"
                alt="Immersive 360 virtual walkthrough of a business premises for sale"
                className="rounded-2xl w-full h-[420px] object-cover"
              />
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-background/85 backdrop-blur border border-border p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl grid place-items-center theme-btn-gradient"><Compass className="text-primary-foreground" size={20} /></div>
                <div>
                  <p className="text-sm font-semibold">{pc.t("hero.cardTitle")}</p>
                  <p className="text-xs text-muted-foreground">{pc.t("hero.cardSub")}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What it is */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <motion.div {...fade} className="max-w-3xl mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"><RichCopy text={pc.t("whatis.heading")} /></h2>
          <p className="text-lg text-muted-foreground leading-relaxed"><RichCopy text={pc.t("whatis.body")} /></p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {pc.list("whatis.cards").map((f, i) => { const Icon = cardIcon(whatisI, i); return (
            <motion.div key={i} {...fade} transition={{ duration: 0.5, delay: i * 0.05 }} className="rounded-2xl border border-border bg-card/50 p-6 hover:border-primary/40 transition-colors">
              <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary mb-4"><Icon size={20} /></div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed"><RichCopy text={f.body} /></p>
            </motion.div>); })}
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.div {...fade} className="max-w-3xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"><RichCopy text={pc.t("benefits.heading")} /></h2>
          <p className="text-lg text-muted-foreground leading-relaxed"><RichCopy text={pc.t("benefits.body")} /></p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {pc.list("benefits.cards").map((f, i) => { const Icon = cardIcon(benefitsI, i); return (
            <motion.div key={i} {...fade} transition={{ duration: 0.5, delay: i * 0.05 }} className="rounded-2xl border border-border bg-card/50 p-6 hover:border-primary/40 transition-colors">
              <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary mb-4"><Icon size={20} /></div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed"><RichCopy text={f.body} /></p>
            </motion.div>); })}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.div {...fade} className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"><RichCopy text={pc.t("howto.heading")} /></h2>
          <p className="text-lg text-muted-foreground"><RichCopy text={pc.t("howto.body")} /></p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {pc.list("howto.steps").map((s, i) => { const Icon = cardIcon(howtoI, i); return (
            <motion.div key={i} {...fade} transition={{ duration: 0.5, delay: i * 0.06 }} className="relative rounded-2xl border border-border bg-card/40 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-4xl font-extrabold theme-text-gradient">{s.n}</div>
                <div className="w-10 h-10 rounded-xl grid place-items-center bg-primary/10 text-primary"><Icon size={18} /></div>
              </div>
              <h3 className="text-lg font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed"><RichCopy text={s.body} /></p>
            </motion.div>); })}
        </div>
      </section>

      {/* What makes it different */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.div {...fade} className="max-w-3xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"><RichCopy text={pc.t("different.heading")} /></h2>
          <p className="text-lg text-muted-foreground leading-relaxed"><RichCopy text={pc.t("different.body")} /></p>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-6">
          {pc.list("different.cards").map((f, i) => { const Icon = cardIcon(differentI, i); return (
            <motion.div key={i} {...fade} transition={{ duration: 0.5, delay: i * 0.05 }} className="flex gap-4 rounded-2xl border border-border bg-card/50 p-6 hover:border-primary/40 transition-colors">
              <div className="shrink-0 w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary"><Icon size={20} /></div>
              <div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed"><RichCopy text={f.body} /></p>
              </div>
            </motion.div>); })}
        </div>
      </section>

      {/* Stats band */}
      <section className="max-w-[1440px] mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-3xl border border-border theme-aurora-bg">
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8 p-10">
            {pc.list("stats.items").map((s, i) => { const Icon = cardIcon(statsI, i); return (
              <div key={i} className="text-center">
                <Icon className="mx-auto mb-2 text-primary" size={22} />
                <div className="text-xl font-extrabold">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>); })}
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <motion.h2 {...fade} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-10 text-center">{pc.t("faq.heading")}</motion.h2>
        <div className="space-y-4">
          {pc.list("faq.items").map((f, i) => (
            <motion.details key={i} {...fade} transition={{ duration: 0.4, delay: i * 0.04 }} className="group rounded-2xl border border-border bg-card/50 p-5">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="font-semibold pr-4">{f.q}</span>
                <span className="text-primary transition-transform group-open:rotate-45 text-2xl leading-none">+</span>
              </summary>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3"><RichCopy text={f.a} /></p>
            </motion.details>
          ))}
        </div>
      </section>

      {/* Recommended camera */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <motion.div {...fade}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5">
              <Camera size={13} /> {pc.t("camera.eyebrow")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"><RichCopy text={pc.t("camera.heading")} /></h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-5"><RichCopy text={pc.t("camera.body")} /></p>
            <ul className="space-y-2.5 mb-6">
              {pc.list("camera.checklist").map((t, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm"><CheckCircle2 size={16} className="text-primary flex-shrink-0 mt-0.5" /> <span className="text-muted-foreground">{t.text}</span></li>
              ))}
            </ul>
          </motion.div>

          <motion.div {...fade} className="space-y-4">
            {pc.list("camera.offers").map((o, i) => { const Icon = cardIcon(offersI, i); return (
              <div key={i} className="rounded-2xl border border-border bg-card/50 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary"><Icon size={20} /></div>
                  <div>
                    <h3 className="text-lg font-bold">{o.title}</h3>
                    <p className="text-xs text-muted-foreground">{o.meta}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed"><RichCopy text={o.body} /></p>
              </div>); })}
            <div className="rounded-2xl border border-border theme-aurora-bg overflow-hidden">
              <div className="relative z-10 p-6">
                <h3 className="text-lg font-bold mb-1">{pc.t("camera.partnerHeading")}</h3>
                <p className="text-sm text-muted-foreground mb-4">{pc.t("camera.partnerBody")}</p>
                <div className="flex gap-3 flex-wrap">
                  <Link href="/find-a-partner"><Button className="theme-btn-gradient border-0">Find a partner</Button></Link>
                  <Link href="/photographers"><Button variant="outline">Become a partner</Button></Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <AudioNarrationShowcase />

      <CtaBand
        heading={pc.t("cta.heading")}
        sub={pc.t("cta.sub")}
        primary={{ label: pc.t("cta.primary"), href: "/list-your-business" }}
        secondary={{ label: pc.t("cta.secondary"), href: "/how-it-works" }}
      />
    </SiteShell>
  );
}
