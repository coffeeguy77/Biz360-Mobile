import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Check, Minus, Camera, ShieldCheck, BarChart3, Smartphone,
  ArrowRight, Sparkles, Scale, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { SiteShell, CtaBand } from "@/components/SiteShell";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5 },
};

const ROWS: { feature: string; detail: string; exit360: boolean; traditional: boolean }[] = [
  {
    feature: "Immersive 360° guided walkthroughs",
    detail: "Navigable, room-to-room virtual tours of the actual premises.",
    exit360: true, traditional: false,
  },
  {
    feature: "Verified (phone-checked) buyers",
    detail: "Every enquiry comes from a buyer who verified their mobile number.",
    exit360: true, traditional: false,
  },
  {
    feature: "NDA-gated financials with per-buyer control",
    detail: "Numbers stay hidden until a buyer signs your NDA — and you can revoke access.",
    exit360: true, traditional: false,
  },
  {
    feature: "Data-room-grade IM report builder",
    detail: "Your listing becomes a polished information memorandum automatically.",
    exit360: true, traditional: false,
  },
  {
    feature: "Live analytics (views, NDAs, requests by type)",
    detail: "Real-time engagement data, not a monthly view count.",
    exit360: true, traditional: false,
  },
  {
    feature: "Native app AND web, synced by phone number",
    detail: "Build and manage a listing on either — everything stays in sync.",
    exit360: true, traditional: false,
  },
  {
    feature: "In-platform secure messaging",
    detail: "Talk to buyers without handing out your personal contact details.",
    exit360: true, traditional: false,
  },
  {
    feature: "Broker multi-listing management + shareable client analytics",
    detail: "One dashboard for every mandate, with reports you can send to vendors.",
    exit360: true, traditional: false,
  },
  {
    feature: "One-tap enquiries (info / call / site visit)",
    detail: "Buyers signal exactly what they want, so you triage in seconds.",
    exit360: true, traditional: false,
  },
  {
    feature: "Anonymous / confidential selling",
    detail: "Run a discreet sale and reveal your identity only when you choose.",
    exit360: true, traditional: false,
  },
];

export function Compare() {
  return (
    <SiteShell>
      <Seo
        title="EXIT360 vs Traditional Business-for-Sale Sites | Compare"
        description="Compare EXIT360 with traditional business-for-sale listing sites: 360° virtual tours, verified buyers, NDA-gated financials and live analytics in one platform."
        keywords="best business for sale website, business for sale platform comparison, seek business alternative, bsale alternative, business marketplace with virtual tours"
        path="/compare"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "EXIT360 vs traditional business-for-sale listing sites",
            description:
              "A feature-by-feature comparison of EXIT360 against traditional business-for-sale listing sites in Australia.",
            about: { "@type": "Organization", name: "EXIT360" },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "How is EXIT360 different from a traditional business-for-sale website?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Traditional listing sites are classified-style directories: photos, a price and a contact form. EXIT360 adds immersive 360° walkthroughs, phone-verified buyers, NDA-gated financials, a built-in information memorandum and live analytics — all in one app-and-web platform.",
                },
              },
              {
                "@type": "Question",
                name: "Is EXIT360 an alternative to Seek Business or Bsale?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. Australia's main channels are classified-style listing portals such as Seek Business, Bsale and commercial listing sites. EXIT360 is a modern alternative that treats a business sale like the high-value transaction it is, with virtual tours, verified buyers and a secure data room.",
                },
              },
              {
                "@type": "Question",
                name: "Do buyers really use 360° virtual tours?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "They do. A navigable walkthrough lets buyers understand the premises, layout and fit-out before they ever enquire, which cuts wasted inspections and brings more committed buyers to the table.",
                },
              },
              {
                "@type": "Question",
                name: "Can brokers manage multiple listings on EXIT360?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. Brokers get a single dashboard to manage every mandate, plus shareable analytics reports they can send straight to their vendor clients.",
                },
              },
              {
                "@type": "Question",
                name: "Is my financial information protected?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Financials sit behind an NDA gate with per-buyer access control. A buyer must verify their phone and sign your NDA before any figures are revealed, and you can see exactly who signed and revoke access at any time.",
                },
              },
            ],
          },
        ]}
      />

      {/* Hero */}
      <section className="theme-aurora-bg">
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-20 text-center">
          <motion.div {...fade}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5">
              <Scale size={13} /> EXIT360 vs traditional listing sites
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
              The best way to buy and sell a business, <span className="theme-text-gradient">side by side.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
              Most Australian businesses are still advertised on classified-style listing
              portals — the same channels people use to sell a car or rent a shopfront.
              EXIT360 was built specifically for business sales, so here's an honest,
              feature-by-feature look at everything we do that a traditional listing site can't.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/list-your-business"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">List your business <ArrowRight size={18} className="ml-1" /></Button></Link>
              <Link href="/how-it-works"><Button size="lg" variant="outline" className="h-13 px-8 text-base">See how it works</Button></Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Intro copy */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <motion.div {...fade} className="space-y-5 text-lg text-muted-foreground leading-relaxed">
          <p>
            Selling a business is one of the biggest financial decisions an owner will ever
            make, yet most listings still get the same treatment as a used-car ad: a handful of
            photos, an asking price and a contact form. Buyers are left guessing, sellers are
            buried in unqualified enquiries, and good deals stall because there's no easy way to
            build trust before a meeting.
          </p>
          <p>
            Australia's main selling channels are classified-style listing sites — think
            <strong className="text-foreground"> Seek Business, Bsale and the commercial
            listing portals</strong>. They're great at putting a listing in front of a large
            audience, and for a small, simple sale that can be enough. But they were designed
            as directories, not as a place to actually run a confidential, high-value
            transaction. That's the gap EXIT360 closes.
          </p>
          <p>
            The table below compares <strong className="text-foreground">EXIT360</strong>
            {" "}against a generic <strong className="text-foreground">traditional listing
            site</strong>. We're not naming names or claiming any single competitor lacks a
            particular tick — these are the structural differences between a classified
            directory and a purpose-built business-sale platform.
          </p>
        </motion.div>
      </section>

      {/* Comparison table */}
      <section className="max-w-5xl mx-auto px-6 pb-8">
        <motion.div {...fade} className="rounded-3xl border border-border bg-card/50 overflow-hidden">
          <div className="grid grid-cols-12 border-b border-border bg-primary/5">
            <div className="col-span-6 sm:col-span-8 px-5 sm:px-7 py-5 text-sm font-bold">Capability</div>
            <div className="col-span-3 sm:col-span-2 px-2 py-5 text-center text-sm font-bold theme-text-gradient">EXIT360</div>
            <div className="col-span-3 sm:col-span-2 px-2 py-5 text-center text-sm font-bold text-muted-foreground">Traditional listing sites</div>
          </div>
          {ROWS.map((r, i) => (
            <motion.div
              key={r.feature}
              {...fade}
              transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.3) }}
              className="grid grid-cols-12 items-center border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
            >
              <div className="col-span-6 sm:col-span-8 px-5 sm:px-7 py-5">
                <p className="text-sm font-semibold">{r.feature}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.detail}</p>
              </div>
              <div className="col-span-3 sm:col-span-2 flex justify-center py-5">
                <span className="w-9 h-9 rounded-full grid place-items-center bg-primary/10 text-primary" aria-label="EXIT360: yes">
                  <Check size={18} strokeWidth={3} />
                </span>
              </div>
              <div className="col-span-3 sm:col-span-2 flex justify-center py-5">
                <span className="w-9 h-9 rounded-full grid place-items-center bg-muted text-muted-foreground" aria-label="Traditional listing sites: no">
                  <Minus size={18} strokeWidth={3} />
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
        <motion.p {...fade} className="text-xs text-muted-foreground mt-4 text-center max-w-2xl mx-auto">
          Comparison reflects the typical feature set of classified-style business-for-sale
          listing portals. Individual sites vary; EXIT360 combines all of the above in one
          platform.
        </motion.p>
      </section>

      {/* Category deep-dives */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.div {...fade} className="max-w-3xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Where the biggest differences show up</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            A tick in a table is one thing — knowing why it changes your sale is another. These
            are the four capabilities that most reliably separate a fast, clean sale from a
            listing that drifts.
          </p>
        </motion.div>

        <div className="space-y-6">
          {[
            {
              icon: Camera,
              title: "360° guided walkthroughs vs a photo gallery",
              body: "A traditional listing gives buyers a few staged photos and a floor-area figure, then asks them to book an inspection to fill in the blanks. Most won't — they self-select out, or they turn up unconvinced. An EXIT360 walkthrough lets a buyer move through the premises room by room, understand the layout, condition and fit-out, and arrive at inspection already sold on the space. Fewer wasted visits, more committed buyers.",
            },
            {
              icon: ShieldCheck,
              title: "Verified buyers and NDA-gated financials vs an open contact form",
              body: "On a classified site, anyone can fire off an enquiry, and your financials are either public or emailed out on trust. EXIT360 flips that: every enquiry comes from a phone-verified buyer, and your P&L, add-backs and equipment register sit behind an NDA gate you control per buyer. You see exactly who signed and when — and you can switch access off. That's the difference between advertising a business and running a data room.",
            },
            {
              icon: BarChart3,
              title: "Live analytics vs a monthly view count",
              body: "Traditional portals might tell you how many times a listing was viewed last month. EXIT360 shows you engagement as it happens: tour views, NDAs signed, and enquiries broken down by type — request for information, phone call or site visit. You know which buyers are hot before you spend a minute on the phone, and brokers can share those reports straight with their vendors.",
            },
            {
              icon: Smartphone,
              title: "App-and-web, synced by phone number vs a single web form",
              body: "Most listing sites are a web form and nothing more. EXIT360 is a native app and a full website that share one account keyed to your phone number. Start a listing on your phone at the premises, finish it on your laptop, and manage enquiries from whichever is closest — everything stays in sync, so nothing lives on a single device or in one inbox.",
            },
          ].map((c, i) => (
            <motion.div
              key={c.title}
              {...fade}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card/50 p-7 sm:p-8 flex flex-col sm:flex-row gap-6 hover:border-primary/40 transition-colors"
            >
              <div className="w-12 h-12 shrink-0 rounded-xl grid place-items-center bg-primary/10 text-primary"><c.icon size={22} /></div>
              <div>
                <h3 className="text-xl font-bold mb-2">{c.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Honest "when traditional is enough" */}
      <section className="max-w-3xl mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-2xl border border-border bg-muted/30 p-7 sm:p-8">
          <div className="flex items-center gap-3 mb-3">
            <MessageSquare size={20} className="text-primary" />
            <h2 className="text-2xl font-bold tracking-tight">When a traditional listing site might be enough</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            We'll be straight with you: EXIT360 isn't the only sensible choice for every sale.
            If you're selling a very small, low-value business — a home-based side venture, a
            simple online store with nothing physical to inspect, or an asset sale where the
            premises don't matter — a classified-style listing on a high-traffic portal may do
            the job at low cost, and there's no shame in that. Where EXIT360 earns its place is
            the moment your sale involves a real location worth walking through, financials
            worth protecting, or enough buyer interest that you need to qualify and track it.
            That's most genuine business sales — but not quite all of them.
          </p>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <motion.h2 {...fade} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-10 text-center">Comparison questions, answered</motion.h2>
        <div className="space-y-4">
          {[
            { q: "How is EXIT360 different from a traditional business-for-sale website?", a: "Traditional listing sites are classified-style directories: photos, a price and a contact form. EXIT360 adds immersive 360° walkthroughs, phone-verified buyers, NDA-gated financials, a built-in information memorandum and live analytics — all in one app-and-web platform built specifically for business sales." },
            { q: "Is EXIT360 an alternative to Seek Business or Bsale?", a: "Yes. Australia's main channels are classified-style listing portals such as Seek Business, Bsale and the commercial listing sites. EXIT360 is a modern alternative that treats a business sale like the high-value, confidential transaction it is — with virtual tours, verified buyers and a secure data room rather than a directory ad." },
            { q: "Do 360° virtual tours actually help sell a business?", a: "They do. A navigable walkthrough lets buyers understand the premises, layout and fit-out before they enquire, which filters out tyre-kickers, cuts wasted inspections and brings more committed buyers to the table. It's the closest thing to being there without booking a visit." },
            { q: "Can brokers manage multiple listings and share reports?", a: "Yes. Brokers get one dashboard to manage every mandate, plus shareable analytics — views, tour engagement, NDAs and enquiry types — that they can send straight to their vendor clients as a professional progress report." },
            { q: "Does switching to EXIT360 mean giving up reach?", a: "No. You can run EXIT360 as your primary, purpose-built sale platform while still advertising elsewhere. The difference is that every EXIT360 enquiry lands from a verified buyer into a controlled data room, so the reach you do get converts far better." },
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
        heading="See the difference for your own sale"
        sub="List on the platform built for business sales — 360° tours, verified buyers and a secure data room, with no lock-in and full control."
        primary={{ label: "List your business", href: "/list-your-business" }}
        secondary={{ label: "See how it works", href: "/how-it-works" }}
      />
    </SiteShell>
  );
}
