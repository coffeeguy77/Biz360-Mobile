import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Camera, ShieldCheck, BarChart3, Users, FileText, Sparkles,
  ArrowRight, CheckCircle2, Lock, Phone, MessageSquare, Building2,
  Share2, Smartphone, MapPin, Route, LayoutDashboard, KeyRound,
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
const lines = (s: string) => (s || "").split("\n").map((x) => x.trim()).filter(Boolean);

export function HowItWorks() {
  const pc = usePageContent("/how-it-works");
  const trackI = [Users, Building2, Share2];
  const trackHref = ["/buying", "/selling", "/brokers"];
  const featI = [Camera, FileText, ShieldCheck, BarChart3];
  const enqI = [MessageSquare, Phone, MapPin];
  const hlI = [Route, FileText, KeyRound, BarChart3];
  return (
    <SiteShell>
      <Seo
        title="How It Works — The Complete EXIT360 Platform Guide | EXIT360"
        description="How EXIT360 works: build a 360° walkthrough, generate a data-room-grade information memorandum, gate financials behind NDAs and track live buyer analytics. A guide for buyers, sellers and brokers."
        keywords="how to sell a business, how to buy a business, business for sale platform, 360 tour builder, information memorandum builder, business sale process"
        path="/how-it-works"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to sell a business on EXIT360",
          description: "Build an immersive 360° virtual tour, generate a data-room-grade information memorandum, gate financials behind an NDA and field verified buyer enquiries.",
          totalTime: "PT1H",
          step: [
            { "@type": "HowToStep", position: 1, name: "Create your listing", text: "Add your business details, asking price and divisions on the app or website. Everything saves to your phone-verified account and stays in sync." },
            { "@type": "HowToStep", position: 2, name: "Capture the 360° walkthrough", text: "Shoot panoramic scenes of each space and link them into a guided, Street-View-style tour buyers can explore room to room." },
            { "@type": "HowToStep", position: 3, name: "Build the information memorandum", text: "Turn your financials, business divisions, equipment register and tour into a professional, data-room-grade IM report." },
            { "@type": "HowToStep", position: 4, name: "Set the NDA gate and access controls", text: "Require buyers to verify their phone and sign an NDA before any financials are revealed, and toggle access per buyer." },
            { "@type": "HowToStep", position: 5, name: "Field verified enquiries", text: "Receive one-tap requests for info, calls and site visits, message securely and track live analytics until you accept an offer." },
          ],
        }}
      />

      {/* Hero */}
      <section className="theme-aurora-bg">
        <div className="relative z-10 max-w-[1440px] mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div {...fade}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5">
              <Sparkles size={13} /> {pc.t("hero.eyebrow")}
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
              <RichCopy text={pc.t("hero.title")} />
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
              <RichCopy text={pc.t("hero.subtitle")} />
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/list-your-business"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">{pc.t("hero.ctaPrimary")} <ArrowRight size={18} className="ml-1" /></Button></Link>
              <Link href="/listings"><Button size="lg" variant="outline" className="h-13 px-8 text-base">{pc.t("hero.ctaSecondary")}</Button></Link>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-8 text-sm text-muted-foreground">
              {pc.list("hero.chips").map((chip, i) => (<span key={i} className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> {chip.text}</span>))}
            </div>
          </motion.div>
          <motion.div {...fade} className="relative">
            <div className="absolute inset-0 theme-glow rounded-3xl" />
            <div className="relative rounded-3xl border border-border bg-card/70 backdrop-blur p-2 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80&w=1000"
                alt="Buyers and sellers using the EXIT360 platform to explore a business for sale"
                className="rounded-2xl w-full h-[420px] object-cover"
              />
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-background/85 backdrop-blur border border-border p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl grid place-items-center theme-btn-gradient"><Route className="text-primary-foreground" size={20} /></div>
                <div>
                  <p className="text-sm font-semibold">{pc.t("hero.cardTitle")}</p>
                  <p className="text-xs text-muted-foreground">{pc.t("hero.cardSub")}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Three ways to use EXIT360 */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <motion.div {...fade} className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"><RichCopy text={pc.t("tracks.heading")} /></h2>
          <p className="text-lg text-muted-foreground leading-relaxed"><RichCopy text={pc.t("tracks.body")} /></p>
        </motion.div>
        <div className="grid lg:grid-cols-3 gap-6">
          {pc.list("tracks.items").map((track, i) => { const Icon = pick(trackI, i); return (
            <motion.div key={i} {...fade} transition={{ duration: 0.5, delay: i * 0.06 }}
              className="rounded-2xl border border-border bg-card/50 p-7 hover:border-primary/40 transition-colors flex flex-col">
              <div className="w-11 h-11 rounded-xl grid place-items-center theme-btn-gradient mb-4"><Icon className="text-primary-foreground" size={20} /></div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">{track.tag}</p>
              <h3 className="text-xl font-bold mb-4">{track.title}</h3>
              <ol className="space-y-3 mb-6 flex-1">
                {lines(track.steps).map((s, j) => (
                  <li key={j} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">{j + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <Link href={pick(trackHref, i)}><Button variant="outline" className="w-full">{track.cta} <ArrowRight size={16} className="ml-1" /></Button></Link>
            </motion.div>); })}
        </div>
      </section>

      {/* Feature deep-dives */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.div {...fade} className="max-w-3xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"><RichCopy text={pc.t("features.heading")} /></h2>
          <p className="text-lg text-muted-foreground leading-relaxed"><RichCopy text={pc.t("features.body")} /></p>
        </motion.div>

        <div className="space-y-6">
          {pc.list("features.items").map((f, i) => { const Icon = pick(featI, i); return (
            <motion.div key={i} {...fade} transition={{ duration: 0.5, delay: i * 0.04 }}
              className={`rounded-3xl border border-border bg-card/50 p-8 grid md:grid-cols-2 gap-8 items-center ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">{f.kicker}</p>
                <h3 className="text-2xl font-bold mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed mb-5"><RichCopy text={f.body} /></p>
                <ul className="flex flex-wrap gap-x-6 gap-y-2">
                  {lines(f.points).map((p, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-foreground"><CheckCircle2 size={15} className="text-primary" /> {p}</li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="absolute inset-0 theme-glow rounded-3xl" />
                <div className="relative rounded-2xl border border-border theme-aurora-bg aspect-[4/3] grid place-items-center">
                  <div className="relative z-10 w-20 h-20 rounded-2xl grid place-items-center theme-btn-gradient shadow-2xl">
                    <Icon className="text-primary-foreground" size={34} />
                  </div>
                </div>
              </div>
            </motion.div>); })}
        </div>
      </section>

      {/* Enquiries, messaging & sync */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.div {...fade} className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"><RichCopy text={pc.t("enquiries.heading")} /></h2>
          <p className="text-lg text-muted-foreground"><RichCopy text={pc.t("enquiries.body")} /></p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {pc.list("enquiries.cards").map((f, i) => { const Icon = pick(enqI, i); return (
            <motion.div key={i} {...fade} transition={{ duration: 0.5, delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card/50 p-6">
              <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary mb-4"><Icon size={20} /></div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed"><RichCopy text={f.body} /></p>
            </motion.div>); })}
        </div>

        <motion.div {...fade} className="mt-6 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border bg-card/50 p-6 flex items-start gap-4">
            <div className="shrink-0 w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary"><LayoutDashboard size={20} /></div>
            <div>
              <h3 className="text-lg font-bold mb-2">{pc.t("enquiries.info1Title")}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed"><RichCopy text={pc.t("enquiries.info1Body")} /></p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card/50 p-6 flex items-start gap-4">
            <div className="shrink-0 w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary"><Smartphone size={20} /></div>
            <div>
              <h3 className="text-lg font-bold mb-2">{pc.t("enquiries.info2Title")}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed"><RichCopy text={pc.t("enquiries.info2Body")} /></p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Powerful because... highlights strip */}
      <section className="max-w-[1440px] mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-3xl border border-border theme-aurora-bg">
          <div className="relative z-10 p-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center mb-10"><RichCopy text={pc.t("highlights.heading")} /></h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {pc.list("highlights.stats").map((s, i) => { const Icon = pick(hlI, i); return (
                <div key={i} className="text-center">
                  <Icon className="mx-auto mb-2 text-primary" size={22} />
                  <div className="text-lg font-extrabold">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </div>); })}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Control callout */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <motion.div {...fade} className="rounded-3xl border border-border bg-card/50 p-8 sm:p-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl grid place-items-center bg-primary/10 text-primary mb-5"><Lock size={22} /></div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3"><RichCopy text={pc.t("control.heading")} /></h2>
          <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto"><RichCopy text={pc.t("control.body")} /></p>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <motion.h2 {...fade} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-10 text-center">{pc.t("faq.heading")}</motion.h2>
        <div className="space-y-4">
          {pc.list("faq.items").map((f, i) => (
            <motion.details key={i} {...fade} transition={{ duration: 0.4, delay: i * 0.04 }}
              className="group rounded-2xl border border-border bg-card/50 p-5">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="font-semibold pr-4">{f.q}</span>
                <span className="text-primary transition-transform group-open:rotate-45 text-2xl leading-none">+</span>
              </summary>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3"><RichCopy text={f.a} /></p>
            </motion.details>
          ))}
        </div>
      </section>

      <CtaBand
        heading={pc.t("cta.heading")}
        sub={pc.t("cta.sub")}
        primary={{ label: pc.t("cta.primary"), href: "/list-your-business" }}
        secondary={{ label: pc.t("cta.secondary"), href: "/listings" }}
      />
    </SiteShell>
  );
}
