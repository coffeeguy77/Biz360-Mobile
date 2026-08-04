import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Briefcase, LayoutGrid, Share2, Camera, FileText, ShieldCheck,
  BarChart3, Users, Smartphone, ArrowRight, CheckCircle2, Eye,
  FileSignature, PhoneCall, MapPin, Sparkles, Award,
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

export function Brokers() {
  const c = useCopy("/brokers");
  return (
    <SiteShell>
      <Seo
        title="Software for Business Brokers | EXIT360 Broker Network"
        description="EXIT360 gives business brokers one login to manage every client listing — 360° tours, NDA-gated IM reports and a shareable analytics page your clients can view themselves."
        keywords="business broker software, business broker platform, sell client businesses, broker listings management, 360 tours for brokers, business broker australia, client reporting"
        path="/brokers"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: "EXIT360 for business brokers",
          description: "A broker platform to manage multiple business-for-sale listings with 360° virtual tours, NDA-gated information memorandums and shareable client analytics.",
          areaServed: "AU",
          serviceType: "Business broker software",
          provider: { "@type": "Organization", name: "EXIT360" },
          audience: { "@type": "Audience", audienceType: "Business brokers" },
        }}
      />

      {/* Hero */}
      <section className="theme-aurora-bg">
        <div className="relative z-10 max-w-[1440px] mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div {...fade}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5">
              <Briefcase size={13} /> {c("heroEyebrow")}
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
              <RichCopy text={c("heroTitle")} />
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
              <RichCopy text={c("heroSubtitle")} />
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/list-your-business"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">Start as a broker <ArrowRight size={18} className="ml-1" /></Button></Link>
              <Link href="/how-it-works"><Button size="lg" variant="outline" className="h-13 px-8 text-base">See how it works</Button></Link>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> Unlimited listings, one dashboard</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> Build on app &amp; web</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> White-glove reporting</span>
            </div>
          </motion.div>
          <motion.div {...fade} className="relative">
            <div className="absolute inset-0 theme-glow rounded-3xl" />
            <div className="relative rounded-3xl border border-border bg-card/70 backdrop-blur p-2 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80&w=1000"
                alt="Business broker managing multiple client listings on the EXIT360 platform"
                className="rounded-2xl w-full h-[420px] object-cover"
              />
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-background/85 backdrop-blur border border-border p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl grid place-items-center theme-btn-gradient"><LayoutGrid className="text-primary-foreground" size={20} /></div>
                <div>
                  <p className="text-sm font-semibold">12 active listings</p>
                  <p className="text-xs text-muted-foreground">Managed under one broker account</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why brokers win */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <motion.div {...fade} className="max-w-3xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Why brokers win with EXIT360</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            You're not selling one business — you're running a portfolio. EXIT360 is built for the way
            brokers actually work: many listings, many clients, and the constant demand for updates.
            Everything sits in one place, presents like a premium advisory firm, and keeps your clients
            informed automatically.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: LayoutGrid, title: "Every listing, one login", body: "Manage your entire book from a single broker account. Add a new client business, switch between listings and update details without juggling logins, spreadsheets or duplicate profiles." },
            { icon: Smartphone, title: "Build on app or web, always synced", body: "Capture a listing on-site with the mobile app, then finish the write-up on your desktop. Every listing is keyed to a phone number, so your work stays in sync across every device." },
            { icon: Camera, title: "A 360° tour for each business", body: "Give every client a standout listing. Capture panoramic scenes on location and link them into a guided walkthrough buyers can explore like Street View — before they ever request an inspection." },
            { icon: FileText, title: "Data-room-grade IM reports", body: "Each listing generates a polished, NDA-gated information memorandum — financials, add-backs, divisions and equipment — that presents your client's business with the professionalism it deserves." },
            { icon: ShieldCheck, title: "You manage buyer access", body: "Gate financials behind NDAs and turn access on or off per buyer. Only phone-verified, genuinely interested buyers reach your clients — no anonymous tyre-kickers wasting your time." },
            { icon: Award, title: "White-glove positioning", body: "Present as the premium advisor you are. Immersive tours, professional reports and live analytics make every mandate look like a well-run process, helping you win and retain listings." },
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

      {/* Highlighted feature: shareable client analytics */}
      <section className="max-w-[1440px] mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-3xl border border-border theme-aurora-bg overflow-hidden">
          <div className="relative z-10 grid lg:grid-cols-2 gap-10 p-8 sm:p-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5">
                <Sparkles size={13} /> The broker's secret weapon
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
                A shareable analytics page <span className="theme-text-gradient">your client can check themselves.</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Every broker knows the routine: the client rings to ask how their sale is tracking, and you
                stop what you're doing to pull numbers together. EXIT360 ends that. Send your client a private
                link, they log in, and they see their own listing's performance in real time — no chasing,
                no status emails, no interruptions to the rest of your book.
              </p>
              <p className="text-base text-muted-foreground leading-relaxed mb-6">
                Your client sees exactly what matters and nothing they shouldn't: live view counts, NDAs signed
                and buyer requests broken down by type — requests for information, calls and site visits. They
                get the transparency they crave, you get your time back, and every listing feels like a
                first-class, professionally managed campaign.
              </p>
              <Link href="/list-your-business"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">Give clients their own view <ArrowRight size={18} className="ml-1" /></Button></Link>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 backdrop-blur p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl grid place-items-center theme-btn-gradient"><Share2 className="text-primary-foreground" size={18} /></div>
                <div>
                  <p className="text-sm font-semibold">Client analytics — Cafe &amp; Roastery</p>
                  <p className="text-xs text-muted-foreground">Shared by your broker · live now</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="rounded-xl border border-border bg-card/50 p-4">
                  <Eye className="text-primary mb-2" size={18} />
                  <div className="text-2xl font-extrabold">1,284</div>
                  <div className="text-xs text-muted-foreground">Listing views</div>
                </div>
                <div className="rounded-xl border border-border bg-card/50 p-4">
                  <FileSignature className="text-primary mb-2" size={18} />
                  <div className="text-2xl font-extrabold">37</div>
                  <div className="text-xs text-muted-foreground">NDAs signed</div>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: FileText, l: "Requests for information", v: "24" },
                  { icon: PhoneCall, l: "Call requests", v: "11" },
                  { icon: MapPin, l: "Site-visit requests", v: "8" },
                ].map((r) => (
                  <div key={r.l} className="flex items-center justify-between rounded-xl border border-border bg-card/40 px-4 py-3">
                    <span className="flex items-center gap-3 text-sm"><r.icon size={16} className="text-primary" /> {r.l}</span>
                    <span className="text-sm font-bold">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* How brokers work */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <motion.div {...fade} className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">How brokers work on EXIT360</h2>
          <p className="text-lg text-muted-foreground">From onboarding a new mandate to keeping your client in the loop — a four-step process built for a busy book.</p>
        </motion.div>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { n: "01", t: "Open your broker account", b: "Sign up once and get a dashboard built to hold many listings. Every business you take on lives under the same login, keyed to your verified number." },
            { n: "02", t: "Build each client listing", b: "Capture the 360° tour and details on-site with the app, or write it up on the web. Add financials, divisions and the equipment register — it all syncs automatically." },
            { n: "03", t: "Publish with NDA gating", b: "Set the NDA and per-buyer access, then go live. Verified buyers explore the tour, sign to unlock financials, and lodge requests for info, calls or site visits." },
            { n: "04", t: "Share the client link", b: "Send each client their private analytics page. They log in and track views, NDAs and requests themselves — while you focus on progressing the deals." },
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

      {/* Trust / stats band */}
      <section className="max-w-[1440px] mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-3xl border border-border theme-aurora-bg">
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8 p-10">
            {[
              { icon: LayoutGrid, v: "Unlimited", l: "Listings per broker account" },
              { icon: BarChart3, v: "Live reporting", l: "Shared straight to clients" },
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
        <motion.h2 {...fade} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-10 text-center">Broker questions, answered</motion.h2>
        <div className="space-y-4">
          {[
            { q: "Can I manage multiple client listings under one account?", a: "Yes — that's exactly what a broker account is built for. Every business you take on lives under a single login, so you can add, switch between and update as many listings as you're managing without ever creating separate profiles." },
            { q: "How does the shareable client analytics page work?", a: "Each listing has its own analytics view you can share with the client. You send them a private link, they log in, and they see their own listing's performance — views, NDAs signed and requests by type — in real time. They stay informed without having to ring you for an update." },
            { q: "What exactly can my client see?", a: "Only their own listing's numbers: live view counts, how many buyers have signed an NDA, and buyer requests broken down into information requests, call requests and site-visit requests. They never see other clients' data, and sensitive buyer details stay with you." },
            { q: "Can I build a listing on the app and finish it on my computer?", a: "Absolutely. Capture the 360° tour and details on-site with the mobile app, then finish the write-up on the web. Because everything is keyed to your phone number, your listings stay in sync across every device." },
            { q: "Do I control which buyers see financials?", a: "Yes. Financials sit behind an NDA gate by default, and you can turn per-buyer access on or off. Only phone-verified buyers can enquire, and you decide who progresses to your client's numbers." },
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
        heading="Bring your whole book to EXIT360"
        sub="One login for every listing, a 360° tour and IM report for each client, and a shareable analytics page that keeps them informed for you. Start managing your listings the modern way."
        primary={{ label: "Start as a broker", href: "/list-your-business" }}
        secondary={{ label: "For sellers", href: "/selling" }}
      />
    </SiteShell>
  );
}
