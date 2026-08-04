import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Camera, ShieldCheck, BarChart3, Users, FileText, Sparkles,
  ArrowRight, CheckCircle2, Clock, Lock, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { useCopy, RichCopy } from "@/content/copy";
import { SiteShell, CtaBand } from "@/components/SiteShell";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5 },
};

export function Selling() {
  const c = useCopy("/selling");
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
              <Sparkles size={13} /> {c("heroEyebrow")}
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
              <RichCopy text={c("heroTitle")} />
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
              <RichCopy text={c("heroSubtitle")} />
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/list-your-business"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">List your business <ArrowRight size={18} className="ml-1" /></Button></Link>
              <Link href="/how-it-works"><Button size="lg" variant="outline" className="h-13 px-8 text-base">See how it works</Button></Link>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> No lock-in contracts</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> You control who sees financials</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> App &amp; web</span>
            </div>
          </motion.div>
          <motion.div {...fade} className="relative">
            <div className="absolute inset-0 theme-glow rounded-3xl" />
            <div className="relative rounded-3xl border border-border bg-card/70 backdrop-blur p-2 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&q=80&w=1000"
                alt="Business owner presenting a business for sale with a 360 virtual tour"
                className="rounded-2xl w-full h-[420px] object-cover"
              />
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-background/85 backdrop-blur border border-border p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl grid place-items-center theme-btn-gradient"><Camera className="text-primary-foreground" size={20} /></div>
                <div>
                  <p className="text-sm font-semibold">360° walkthrough live</p>
                  <p className="text-xs text-muted-foreground">Buyers explored 43 times this week</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why it sells for more */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <motion.div {...fade} className="max-w-3xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Why EXIT360 sellers get better outcomes</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            The businesses that sell fastest are the ones buyers can understand and trust before
            they ever pick up the phone. EXIT360 is built to remove doubt at every step — the two
            things that kill deals. Here's how we do it.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Camera, title: "Immersive 360° tours", body: "Buyers walk your floor, kitchen, plant room and storefront from anywhere. They arrive at inspection already sold on the space — not deciding whether it's worth the drive." },
            { icon: ShieldCheck, title: "Verified financials, gated by NDA", body: "Upload your P&L, add-backs and equipment register. Buyers must sign an NDA before a single figure is revealed, and you see exactly who signed and when." },
            { icon: BarChart3, title: "Live buyer analytics", body: "See views, tour engagement, NDAs signed and enquiry types in real time. Know which buyers are hot before you spend a minute on the phone." },
            { icon: Users, title: "Only verified buyers", body: "Every enquiry comes from a phone-verified buyer. No anonymous time-wasters — just real people who've raised their hand for your business." },
            { icon: FileText, title: "Automatic information memorandum", body: "Your listing becomes a polished, data-room-grade IM report — financials, divisions, equipment and tour in one professional document buyers can trust." },
            { icon: Lock, title: "You stay in control", body: "Stay anonymous, message-only, or reveal your number after a buyer verifies theirs. Turn financial access on and off per buyer. It's your sale, your rules." },
          ].map((f, i) => (
            <motion.div key={f.title} {...fade} transition={{ duration: 0.5, delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card/50 p-6 hover:border-primary/40 transition-colors">
              <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary mb-4"><f.icon size={20} /></div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.div {...fade} className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">From listing to sold in four steps</h2>
          <p className="text-lg text-muted-foreground">Most sellers are live within an afternoon. Build it on the app or on the web — your listing syncs across both.</p>
        </motion.div>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { n: "01", t: "Create your listing", b: "Add your business details, asking price and divisions on the app or website. Everything is saved to your phone-verified account and stays in sync." },
            { n: "02", t: "Capture the 360° tour", b: "Add panoramic scenes and link them into a guided walkthrough. Buyers move through your business like Street View." },
            { n: "03", t: "Add financials & set NDA", b: "Upload your numbers and equipment register, then require an NDA so only serious, committed buyers can see them." },
            { n: "04", t: "Field verified enquiries", b: "Requests for info, calls and site visits land in one inbox. Track engagement and reveal your number only when you're ready." },
          ].map((s, i) => (
            <motion.div key={s.n} {...fade} transition={{ duration: 0.5, delay: i * 0.06 }}
              className="relative rounded-2xl border border-border bg-card/40 p-6">
              <div className="text-4xl font-extrabold theme-text-gradient mb-3">{s.n}</div>
              <h3 className="text-lg font-bold mb-2">{s.t}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.b}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats band */}
      <section className="max-w-[1440px] mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-3xl border border-border theme-aurora-bg">
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8 p-10">
            {[
              { icon: Clock, v: "Live in an afternoon", l: "Typical time to publish" },
              { icon: TrendingUp, v: "Higher engagement", l: "Tours vs. photos-only listings" },
              { icon: Users, v: "100% verified", l: "Every buyer, phone-checked" },
              { icon: ShieldCheck, v: "NDA-gated", l: "Financials protected by default" },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <s.icon className="mx-auto mb-2 text-primary" size={22} />
                <div className="text-xl font-extrabold">{s.v}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <motion.h2 {...fade} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-10 text-center">Selling questions, answered</motion.h2>
        <div className="space-y-4">
          {[
            { q: "How much does it cost to list?", a: "You can build your listing and 360° tour with no lock-in contract. Talk to us about a plan that suits a private sale or a broker managing multiple listings." },
            { q: "Do I have to show my financials to everyone?", a: "No. Financials sit behind an NDA gate and per-buyer access controls. A buyer must verify their phone and sign your NDA before any numbers are revealed — and you can see exactly who has." },
            { q: "Can I stay anonymous?", a: "Yes. You can run a fully confidential sale where buyers only reach you through secure in-platform messages, and reveal your phone number only once a buyer has verified theirs." },
            { q: "Can I build my listing on my computer and my phone?", a: "Absolutely. Your account is keyed to your phone number, so you can start on the app, keep going on the website, and edit either — everything stays in sync." },
            { q: "What is the 360° walkthrough?", a: "It's an immersive, navigable tour of your premises built from panoramic scenes. Buyers explore room to room like Google Street View, which dramatically reduces wasted inspections." },
          ].map((f, i) => (
            <motion.details key={i} {...fade} transition={{ duration: 0.4, delay: i * 0.04 }}
              className="group rounded-2xl border border-border bg-card/50 p-5">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="font-semibold pr-4">{f.q}</span>
                <span className="text-primary transition-transform group-open:rotate-45 text-2xl leading-none">+</span>
              </summary>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">{f.a}</p>
            </motion.details>
          ))}
        </div>
      </section>

      <CtaBand
        heading="Ready to sell your business?"
        sub="Create your 360° listing today. No lock-in, full control, and buyers who've already proven they're serious."
        primary={{ label: "List your business", href: "/list-your-business" }}
        secondary={{ label: "Talk to our team", href: "/brokers" }}
      />
    </SiteShell>
  );
}
