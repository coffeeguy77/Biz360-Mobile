import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Camera, ShieldCheck, BarChart3, Users, FileText, Sparkles,
  ArrowRight, CheckCircle2, Lock, Phone, MessageSquare, Building2,
  Share2, Smartphone, MapPin, Route, LayoutDashboard, KeyRound,
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

export function HowItWorks() {
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
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div {...fade}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5">
              <Sparkles size={13} /> The complete platform guide
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
              How EXIT360 works — and <span className="theme-text-gradient">everything it can do.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
              EXIT360 is Australia's 360° business-for-sale marketplace. It's far more than a
              classified ad: it's a <strong className="text-foreground">tour builder, an information
              memorandum generator, an NDA-gated data room and a live analytics dashboard</strong> —
              all synced across app and web from one phone-verified account. This guide walks you
              through the whole platform, whether you're buying, selling or broking.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/list-your-business"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">Start a listing <ArrowRight size={18} className="ml-1" /></Button></Link>
              <Link href="/listings"><Button size="lg" variant="outline" className="h-13 px-8 text-base">Browse businesses</Button></Link>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> App &amp; web, always in sync</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> Verified buyers only</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> You control the financials</span>
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
                  <p className="text-sm font-semibold">One platform, end to end</p>
                  <p className="text-xs text-muted-foreground">Tour → IM report → NDA → enquiry → sold</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Three ways to use EXIT360 */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <motion.div {...fade} className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Three ways to use EXIT360</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            The same platform works three ways. Buyers explore and enquire, sellers build and
            control the sale, and brokers run entire portfolios for their clients. Here's the
            short version of each track.
          </p>
        </motion.div>
        <div className="grid lg:grid-cols-3 gap-6">
          {[
            {
              icon: Users,
              title: "For Buyers",
              tag: "Explore, verify, enquire",
              steps: [
                "Create a free account with your mobile number — one verified profile across app and web.",
                "Browse listings and take the immersive 360° walkthrough of each business, room by room.",
                "Sign the seller's NDA to unlock verified financials, divisions and the equipment register.",
                "Send a one-tap enquiry — request info, a call or a site visit — and message the seller securely.",
                "Track everything you've unlocked and every conversation in your buyer portal.",
              ],
              href: "/buying",
              cta: "Explore for buyers",
            },
            {
              icon: Building2,
              title: "For Sellers",
              tag: "Build, gate, sell",
              steps: [
                "Create your listing with details, asking price and business divisions on app or web.",
                "Capture panoramic scenes and link them into a guided 360° walkthrough of your premises.",
                "Generate your information memorandum from your financials, equipment and tour in a few taps.",
                "Switch on the NDA gate and set per-buyer financial access so only serious buyers see the numbers.",
                "Field verified enquiries, watch live analytics and reveal your details only when you're ready.",
              ],
              href: "/selling",
              cta: "Explore for sellers",
            },
            {
              icon: Share2,
              title: "For Brokers",
              tag: "Manage, share, scale",
              steps: [
                "Set up your broker profile and add every client business under one dashboard.",
                "Build 360° tours and IM reports for each listing, or invite clients to help capture scenes.",
                "Share a polished, NDA-gated listing link with your buyer database in a single click.",
                "Manage NDAs, enquiries and messages across your whole portfolio from one inbox.",
                "Report back to each vendor with live analytics — views, NDAs signed and requests by type.",
              ],
              href: "/brokers",
              cta: "Explore for brokers",
            },
          ].map((track, i) => (
            <motion.div key={track.title} {...fade} transition={{ duration: 0.5, delay: i * 0.06 }}
              className="rounded-2xl border border-border bg-card/50 p-7 hover:border-primary/40 transition-colors flex flex-col">
              <div className="w-11 h-11 rounded-xl grid place-items-center theme-btn-gradient mb-4"><track.icon className="text-primary-foreground" size={20} /></div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">{track.tag}</p>
              <h3 className="text-xl font-bold mb-4">{track.title}</h3>
              <ol className="space-y-3 mb-6 flex-1">
                {track.steps.map((s, j) => (
                  <li key={j} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">{j + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <Link href={track.href}><Button variant="outline" className="w-full">{track.cta} <ArrowRight size={16} className="ml-1" /></Button></Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Feature deep-dives */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <motion.div {...fade} className="max-w-3xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">A closer look at what the platform does</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Every EXIT360 listing is built from four connected tools. Together they turn a business
            for sale into something a buyer can genuinely understand and trust before they ever pick
            up the phone.
          </p>
        </motion.div>

        <div className="space-y-6">
          {[
            {
              icon: Camera,
              kicker: "The walkthrough builder",
              title: "Capture a Street-View-style 360° tour of your business",
              body: "Shoot panoramic scenes of your storefront, floor, kitchen, plant room, workshop or warehouse straight from the app. Link scenes together with navigation hotspots so buyers move naturally from space to space, exactly like Google Street View. Add captions to highlight equipment, fit-out or capacity. The finished walkthrough embeds directly in your listing and your IM report — so buyers arrive at inspection already sold on the space instead of deciding whether it's worth the drive.",
              points: ["Panoramic scene capture", "Linked, guided navigation", "Scene captions & hotspots"],
            },
            {
              icon: FileText,
              kicker: "The report builder",
              title: "Generate a data-room-grade information memorandum",
              body: "Turn your financials, business divisions, equipment register and 360° tour into a professional information memorandum in minutes — no accountant's template or design software required. The builder structures your P&L, add-backs, revenue by division and asset list into a clean, credible document buyers and their advisers can rely on. It's the difference between a one-page teaser and a genuine data room, and it's generated automatically as you complete your listing.",
              points: ["Financials & add-backs", "Divisions & equipment register", "Tour embedded in the IM"],
            },
            {
              icon: ShieldCheck,
              kicker: "The NDA gate",
              title: "Protect your numbers with NDAs and per-buyer access",
              body: "Sensitive information stays hidden until a buyer earns it. Buyers must verify their mobile number and electronically sign your NDA before a single financial figure, division breakdown or IM report is revealed. You see exactly who signed and when, and you can grant or revoke financial access per buyer at any time. Run the whole sale confidentially — message-only, with your identity and phone number hidden until you choose to share them.",
              points: ["e-Signed NDA required", "Per-buyer access toggles", "Fully confidential mode"],
            },
            {
              icon: BarChart3,
              kicker: "Live analytics & sharing",
              title: "Know exactly how your sale is tracking",
              body: "Your dashboard shows listing views, tour engagement, NDAs signed and enquiries broken down by type — request for information, call-back or site visit — updating in real time. You'll know which buyers are hot before you spend a minute on the phone, and which parts of the tour draw the most attention. Brokers can share these same live analytics with each vendor client, so every party sees genuine, verifiable progress rather than a monthly guess.",
              points: ["Views & tour engagement", "NDAs & requests by type", "Broker client-sharing"],
            },
          ].map((f, i) => (
            <motion.div key={f.title} {...fade} transition={{ duration: 0.5, delay: i * 0.04 }}
              className={`rounded-3xl border border-border bg-card/50 p-8 grid md:grid-cols-2 gap-8 items-center ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">{f.kicker}</p>
                <h3 className="text-2xl font-bold mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed mb-5">{f.body}</p>
                <ul className="flex flex-wrap gap-x-6 gap-y-2">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-foreground"><CheckCircle2 size={15} className="text-primary" /> {p}</li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="absolute inset-0 theme-glow rounded-3xl" />
                <div className="relative rounded-2xl border border-border theme-aurora-bg aspect-[4/3] grid place-items-center">
                  <div className="relative z-10 w-20 h-20 rounded-2xl grid place-items-center theme-btn-gradient shadow-2xl">
                    <f.icon className="text-primary-foreground" size={34} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Enquiries, messaging & sync */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <motion.div {...fade} className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Verified buyers, one-tap enquiries and secure messaging</h2>
          <p className="text-lg text-muted-foreground">
            Once a buyer is verified and past the NDA gate, everything runs through the platform —
            no anonymous time-wasters, no lost email threads, no leaked numbers.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: MessageSquare, title: "Request information", body: "One tap sends a request for the full information memorandum. You approve it, and the buyer gets access — with a record of who has what." },
            { icon: Phone, title: "Request a call", body: "Buyers can ask for a call-back without ever seeing your number. Reveal your phone only once you're comfortable and they've verified theirs." },
            { icon: MapPin, title: "Request a site visit", body: "Serious buyers who've explored the 360° tour can request an in-person inspection, so every visit is qualified rather than exploratory." },
          ].map((f, i) => (
            <motion.div key={f.title} {...fade} transition={{ duration: 0.5, delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card/50 p-6">
              <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary mb-4"><f.icon size={20} /></div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>

        <motion.div {...fade} className="mt-6 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border bg-card/50 p-6 flex items-start gap-4">
            <div className="shrink-0 w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary"><LayoutDashboard size={20} /></div>
            <div>
              <h3 className="text-lg font-bold mb-2">Buyer portal &amp; seller dashboard</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Buyers track saved listings, signed NDAs and open conversations in the buyer portal.
                Sellers manage listings, financial access, enquiries and analytics from the seller
                dashboard. Each side sees exactly what it needs — and nothing it shouldn't.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card/50 p-6 flex items-start gap-4">
            <div className="shrink-0 w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary"><Smartphone size={20} /></div>
            <div>
              <h3 className="text-lg font-bold mb-2">One account, app and web</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your account is keyed to your phone number, so everything syncs instantly between the
                EXIT360 app and the website. Start a listing on your phone at the premises, finish the
                IM on your laptop, and reply to a buyer from whichever is closest.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Powerful because... highlights strip */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-3xl border border-border theme-aurora-bg">
          <div className="relative z-10 p-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center mb-10">Powerful because it does the whole job</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { icon: Route, v: "Guided 360° tours", l: "Street-View-style walkthroughs" },
                { icon: FileText, v: "Auto IM reports", l: "Data-room-grade documents" },
                { icon: KeyRound, v: "NDA + access control", l: "Per-buyer financial gating" },
                { icon: BarChart3, v: "Live analytics", l: "Views, NDAs, requests by type" },
              ].map((s) => (
                <div key={s.l} className="text-center">
                  <s.icon className="mx-auto mb-2 text-primary" size={22} />
                  <div className="text-lg font-extrabold">{s.v}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Control callout */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <motion.div {...fade} className="rounded-3xl border border-border bg-card/50 p-8 sm:p-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl grid place-items-center bg-primary/10 text-primary mb-5"><Lock size={22} /></div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">You stay in control the whole way</h2>
          <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Stay anonymous, run message-only, or reveal your number once a buyer verifies theirs.
            Turn financial access on and off per buyer, and pause or edit your listing whenever you
            like. There are no lock-in contracts — it's your sale, run on your terms, across app and web.
          </p>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <motion.h2 {...fade} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-10 text-center">How EXIT360 works — your questions</motion.h2>
        <div className="space-y-4">
          {[
            { q: "Do I need special equipment to build a 360° walkthrough?", a: "No. You can capture panoramic scenes with the EXIT360 app on your phone, then link them into a guided tour. If you already have professional 360° imagery, you can use that too — the builder handles both." },
            { q: "What exactly goes into the information memorandum?", a: "Your IM report pulls together your financials and add-backs, business divisions, the equipment register and your 360° walkthrough into one professional, data-room-grade document. It's generated automatically as you complete your listing, so buyers and their advisers get a credible package from day one." },
            { q: "How are buyers stopped from seeing my financials?", a: "Financials sit behind an NDA gate. A buyer must verify their mobile number and electronically sign your NDA before any numbers are revealed, and you can grant or revoke access per buyer at any time. You always see who signed and when." },
            { q: "Can I use EXIT360 on both my phone and my computer?", a: "Yes. Your account is keyed to your phone number, so the app and the website stay in sync automatically. Start a listing at the premises on your phone and finish it on your laptop — it's all one account." },
            { q: "How does it work for brokers with multiple listings?", a: "Brokers manage every client business from one dashboard, build tours and IM reports for each, share NDA-gated listing links with their buyer database, and report live analytics — views, NDAs signed and requests by type — back to each vendor." },
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
        heading="See the whole platform in action"
        sub="Build your 360° listing and information memorandum today, or browse verified businesses for sale across Australia. No lock-in, full control."
        primary={{ label: "List your business", href: "/list-your-business" }}
        secondary={{ label: "Browse listings", href: "/listings" }}
      />
    </SiteShell>
  );
}
