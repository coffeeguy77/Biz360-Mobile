import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Camera, ShieldCheck, FileText, Users, LayoutDashboard, Smartphone,
  ArrowRight, CheckCircle2, Search, Lock, MapPin, Handshake, Clock,
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

export function Buying() {
  const c = useCopy("/buying");
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
              <Search size={13} /> {c("heroEyebrow")}
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
              <RichCopy text={c("heroTitle")} />
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
              <RichCopy text={c("heroSubtitle")} />
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/listings"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">Browse listings <ArrowRight size={18} className="ml-1" /></Button></Link>
              <Link href="/how-it-works"><Button size="lg" variant="outline" className="h-13 px-8 text-base">See how it works</Button></Link>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> Free to browse</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> Verified sellers</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> App &amp; web</span>
            </div>
          </motion.div>
          <motion.div {...fade} className="relative">
            <div className="absolute inset-0 theme-glow rounded-3xl" />
            <div className="relative rounded-3xl border border-border bg-card/70 backdrop-blur p-2 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&q=80&w=1000"
                alt="Buyer exploring a business for sale in a 360 degree virtual tour on EXIT360"
                className="rounded-2xl w-full h-[420px] object-cover"
              />
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-background/85 backdrop-blur border border-border p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl grid place-items-center theme-btn-gradient"><Camera className="text-primary-foreground" size={20} /></div>
                <div>
                  <p className="text-sm font-semibold">Touring: Fitzroy café + roastery</p>
                  <p className="text-xs text-muted-foreground">Walk the floor before you enquire</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why buy through EXIT360 */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <motion.div {...fade} className="max-w-3xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Why buyers start their search on EXIT360</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Buying a business is one of the biggest decisions you'll make — yet most marketplaces still
            ask you to judge it from a handful of photos and a vague teaser. EXIT360 gives you the
            context, the numbers and the direct line you actually need to move with confidence.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Camera, title: "Walk through in 360° first", body: "Explore the shopfront, kitchen, workshop or plant room from your couch. You'll know whether a business is worth a trip before you ever book one — and arrive at inspection already knowing the space." },
            { icon: ShieldCheck, title: "Verified listings & sellers", body: "Every seller is phone-verified and every listing is reviewed, so you spend your time on genuine opportunities instead of chasing dead ends and anonymous ghost ads." },
            { icon: FileText, title: "Financials under NDA", body: "Request access, sign the seller's NDA in-app, and unlock the P&L, add-backs and equipment register. Do real due diligence on real numbers — not a rounded 'from' figure." },
            { icon: Users, title: "One-tap verified enquiries", body: "Send an enquiry, request more information or book an inspection in a single tap. Sellers see you're a verified buyer, so your message goes to the top of the pile." },
            { icon: LayoutDashboard, title: "Your buyer portal", body: "Save listings, track NDAs, follow your enquiries and revisit every tour from one dashboard. Never lose the thread on a business you're seriously considering." },
            { icon: Smartphone, title: "Seamless app & web", body: "Start a search on your laptop at work, keep exploring tours on your phone on the train. Your account is keyed to your number, so everything stays perfectly in sync." },
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

      {/* How buying works */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.div {...fade} className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">How buying works, in four steps</h2>
          <p className="text-lg text-muted-foreground">From first browse to booked inspection — a clearer, faster path to the right business.</p>
        </motion.div>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { n: "01", t: "Browse & shortlist", b: "Filter businesses for sale by industry, location, price and cash flow. Save the ones that fit to your buyer portal to compare side by side." },
            { n: "02", t: "Take the 360° walkthrough", b: "Move through the premises room to room like Google Street View. Get a real feel for size, layout, fit-out and foot traffic before you commit any time." },
            { n: "03", t: "Request info & sign the NDA", b: "Ask the seller for the detail that matters, sign their NDA in-app, and unlock verified financials and the full information memorandum." },
            { n: "04", t: "Enquire & inspect", b: "Send a one-tap verified enquiry, message the seller directly, and book your on-site inspection knowing the numbers already stack up." },
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

      {/* Trust / reassurance */}
      <section className="max-w-[1440px] mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-3xl border border-border theme-aurora-bg overflow-hidden">
          <div className="relative z-10 grid lg:grid-cols-2 gap-10 p-10 sm:p-14 items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5">
                <Lock size={13} /> Buy with confidence
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Serious buyers deserve real information</h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                A business is only worth what its numbers and its premises can prove. EXIT360 is built so
                you can verify both — privately, respectfully and on your terms. You stay in control of
                your details until you decide a business is worth pursuing.
              </p>
              <div className="space-y-3">
                {[
                  "Financials stay confidential until you request access and sign the NDA",
                  "Your contact details are only shared with sellers you choose to enquire with",
                  "Every enquiry is logged in your buyer portal so nothing slips through the cracks",
                  "Message sellers securely in-app before revealing your phone number",
                ].map((t) => (
                  <div key={t} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground leading-relaxed">{t}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {[
                { icon: MapPin, v: "Tour before you travel", l: "See it in 360° from anywhere" },
                { icon: ShieldCheck, v: "100% verified sellers", l: "Every listing phone-checked" },
                { icon: Handshake, v: "Direct to the owner", l: "No broker gatekeeping" },
                { icon: Clock, v: "Shortlist in minutes", l: "Not weeks of phone tag" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl border border-border bg-background/70 backdrop-blur p-5 text-center">
                  <s.icon className="mx-auto mb-2 text-primary" size={22} />
                  <div className="text-base font-extrabold leading-tight">{s.v}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <motion.h2 {...fade} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-10 text-center">Buyer questions, answered</motion.h2>
        <div className="space-y-4">
          {[
            { q: "Does it cost anything to browse and enquire?", a: "No. Browsing listings, exploring 360° walkthroughs and sending verified enquiries is free for buyers. You only ever deal directly with sellers — there's no buyer's fee to use EXIT360." },
            { q: "How do I see a business's financials?", a: "Open the listing, request financial access and sign the seller's NDA in-app. Once you're verified and the NDA is signed, the P&L, add-backs, equipment register and full information memorandum unlock for you." },
            { q: "What exactly is the 360° walkthrough?", a: "It's an immersive, navigable tour of the premises built from panoramic scenes. You move from room to room like Google Street View, so you can judge the space, layout and fit-out properly before spending a day travelling to inspect." },
            { q: "Are the listings and sellers verified?", a: "Yes. Every seller is phone-verified and each listing is reviewed before it goes live, so you're dealing with genuine businesses and real owners — not anonymous or duplicate ads." },
            { q: "Can I keep track of everything I'm interested in?", a: "Your buyer portal saves shortlisted listings, tracks the NDAs you've signed and follows every enquiry you've sent. Start on the web, continue on the app — your account and history stay in sync across both." },
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
        heading="Find the business that's right for you"
        sub="Browse verified listings, walk through in 360° and enquire in one tap. It's free to start your search on EXIT360."
        primary={{ label: "Browse listings", href: "/listings" }}
        secondary={{ label: "Open your buyer portal", href: "/buyers" }}
      />
    </SiteShell>
  );
}
