import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Compass, Camera, MousePointerClick, Smartphone, FileText, Clock,
  ArrowRight, CheckCircle2, Users, ShieldCheck, Eye, Layers, Globe, Sparkles, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { useCopy, RichCopy } from "@/content/copy";
import { SiteShell, CtaBand } from "@/components/SiteShell";
import { AudioNarrationShowcase } from "@/components/AudioNarrationShowcase";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5 },
};

export function Walkthroughs() {
  const c = useCopy("/walkthroughs");
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
              <Compass size={13} /> {c("heroEyebrow")}
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
              <RichCopy text={c("heroTitle")} />
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8">
              <RichCopy text={c("heroSubtitle")} />
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/listings"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">Explore live tours <ArrowRight size={18} className="ml-1" /></Button></Link>
              <Link href="/selling"><Button size="lg" variant="outline" className="h-13 px-8 text-base">Build a tour to sell</Button></Link>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> Explore 24/7</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> App &amp; web</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> No download</span>
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
                  <p className="text-sm font-semibold">Guided walkthrough active</p>
                  <p className="text-xs text-muted-foreground">Tap a doorway to move to the next room</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* What it is */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <motion.div {...fade} className="max-w-3xl mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Not photos. An actual walkthrough.</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            A gallery of flat photos tells a buyer almost nothing about how a
            business really feels — its size, its flow, the condition of the fit-out,
            how the space works. The EXIT360 walkthrough is different. Each location
            is captured as a full <strong className="text-foreground">panoramic 360° scene</strong> you can
            look around in every direction. Those scenes are then linked together into a
            single guided tour, so a buyer can step through a doorway, turn a corner and
            keep moving — exactly the way they would on a real inspection, but from their
            couch. It runs right in the browser and in the EXIT360 app, with nothing to
            install and no special headset required.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Eye, title: "Panoramic scenes", body: "Every room is a full 360° panorama. Look up at the ceiling height, down at the flooring, and all the way around — the same view you'd get standing in the middle of the space." },
            { icon: Compass, title: "Linked navigation", body: "Scenes are joined into a guided path. Buyers click a doorway or a marker on the floor to glide into the next room, building a true mental map of the premises." },
            { icon: MousePointerClick, title: "Interactive hotspots", body: "Tap a hotspot to read about a piece of equipment, a division of the business, or a recent upgrade — context delivered exactly where it matters, in the space itself." },
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

      {/* Benefits grid: buyers + sellers */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.div {...fade} className="max-w-3xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Why a walkthrough sells businesses faster</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            The tours do real work for both sides of the deal. Buyers qualify
            themselves before they ever make contact, and sellers stop losing
            weekends to inspections that were never going to end in an offer.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Users, title: "Buyers qualify themselves", body: "By the time someone enquires, they've already walked the whole premises and decided it fits. Every conversation you have starts with a genuinely interested buyer." },
            { icon: ShieldCheck, title: "Buy with confidence", body: "Seeing the real condition and layout — not a flattering wide-angle photo — removes doubt. Buyers move forward knowing what they're actually purchasing." },
            { icon: Clock, title: "Fewer wasted inspections", body: "A tour filters out the tyre-kickers before they book a visit. Sellers reclaim their time and only meet buyers who've already fallen for the space." },
            { icon: Globe, title: "Explore 24/7 from anywhere", body: "Interstate and overseas buyers can inspect at midnight in their own time zone. Your market is no longer limited to who can drive across town on a Tuesday." },
            { icon: Sparkles, title: "Listings that stand out", body: "An immersive tour reads as a serious, well-run business. It signals transparency and lifts engagement far above a listing with photos alone." },
            { icon: FileText, title: "One tour, everywhere", body: "The same walkthrough powers your public listing and your information memorandum, so buyers get a consistent, professional experience end to end." },
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

      {/* How the walkthrough works */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.div {...fade} className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">How sellers build a walkthrough</h2>
          <p className="text-lg text-muted-foreground">Capturing a full tour takes an afternoon, not a production crew. Three simple steps, all on the app or the web.</p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { n: "01", icon: Camera, t: "Capture your panoramas", b: "Stand in the centre of each room and capture a 360° panorama using a compatible camera or your phone. Grab every space a buyer would want to see — front of house, back of house and everything between." },
            { n: "02", icon: Layers, t: "Link the scenes together", b: "Drop navigation markers so each scene connects to the next, building a guided path through the premises. Add hotspots to call out equipment, upgrades and key selling points where they sit." },
            { n: "03", icon: Globe, t: "Publish and share", b: "Publish the walkthrough to your listing with one tap. It goes live on the web and the app instantly, and embeds straight into your information memorandum for verified buyers." },
          ].map((s, i) => (
            <motion.div key={s.n} {...fade} transition={{ duration: 0.5, delay: i * 0.06 }}
              className="relative rounded-2xl border border-border bg-card/40 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-4xl font-extrabold theme-text-gradient">{s.n}</div>
                <div className="w-10 h-10 rounded-xl grid place-items-center bg-primary/10 text-primary"><s.icon size={18} /></div>
              </div>
              <h3 className="text-lg font-bold mb-2">{s.t}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.b}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* What makes it different */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.div {...fade} className="max-w-3xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">What makes the EXIT360 tour different</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Plenty of listings bolt on a single spinning photo and call it a virtual
            tour. Ours is a proper navigable system, built specifically for selling a
            business rather than a house.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { icon: Compass, title: "Genuinely guided navigation", body: "Buyers don't just spin on the spot. They travel a deliberate route through the business, room to room, so they understand how the operation actually flows and fits together." },
            { icon: MousePointerClick, title: "Contextual hotspots", body: "Interactive markers layer the business story into the space — highlighting plant and equipment, recent fit-outs, seating capacity or storage — so the tour informs as well as impresses." },
            { icon: Smartphone, title: "Works on app and web", body: "The exact same immersive experience runs in the EXIT360 mobile app and any modern browser. No headset, no plugin, no download — buyers just tap and explore." },
            { icon: FileText, title: "Embedded in reports and listings", body: "The walkthrough lives inside both your public listing and your data-room-grade information memorandum, giving serious buyers one seamless, trustworthy view of the business." },
          ].map((f, i) => (
            <motion.div key={f.title} {...fade} transition={{ duration: 0.5, delay: i * 0.05 }}
              className="flex gap-4 rounded-2xl border border-border bg-card/50 p-6 hover:border-primary/40 transition-colors">
              <div className="shrink-0 w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary"><f.icon size={20} /></div>
              <div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats band */}
      <section className="max-w-[1440px] mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-3xl border border-border theme-aurora-bg">
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8 p-10">
            {[
              { icon: Globe, v: "24/7", l: "Explore from anywhere" },
              { icon: Clock, v: "Live in an afternoon", l: "Typical time to publish a tour" },
              { icon: Smartphone, v: "App & web", l: "No headset, no download" },
              { icon: FileText, v: "In every report", l: "Embedded in the IM & listing" },
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
        <motion.h2 {...fade} className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-10 text-center">360° walkthrough questions, answered</motion.h2>
        <div className="space-y-4">
          {[
            { q: "What exactly is a 360° virtual walkthrough?", a: "It's an immersive, navigable tour of a business built from panoramic 360° scenes that are linked together. Buyers explore room to room like Google Street View, looking in every direction and moving through the premises at their own pace." },
            { q: "Do I need a special camera or headset to view a tour?", a: "No. Tours run in any modern web browser and in the EXIT360 app with nothing to install. There's no VR headset required — you simply drag, tap and swipe to look around and move between rooms." },
            { q: "How does a walkthrough help me sell faster?", a: "Buyers qualify themselves before they enquire, so you waste far fewer weekends on inspections that were never going to convert. The ones who do reach out have already walked the space and are ready to move with confidence." },
            { q: "What do I need to capture my own tour?", a: "A compatible 360° camera or a phone will capture the panoramas. Stand in the middle of each space, capture a scene, then link the scenes and add hotspots in the app or on the web. Most sellers have a full tour live within an afternoon." },
            { q: "Where does the walkthrough appear once it's published?", a: "It goes live instantly on your public listing across the app and website, and it embeds directly into your information memorandum, so verified buyers get the immersive tour alongside your financials and equipment register." },
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

      {/* Recommended camera + capture options */}
      <section className="max-w-[1440px] mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <motion.div {...fade}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary mb-5">
              <Camera size={13} /> Recommended camera
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Shot on the <span className="theme-text-gradient">Insta360</span>.
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-5">
              We build EXIT360 walkthroughs around the Insta360 — and for good reason. It captures a full,
              razor-sharp 360° sphere of a room in a single tap, so a whole business can be shot in well under
              an hour. It's pocket-sized, quick to move between scenes, and its high resolution means buyers can
              look closely at fit-out, equipment and finishes without the image falling apart. One walkthrough,
              stitched and scene-linked, and your business is explorable like Street View.
            </p>
            <ul className="space-y-2.5 mb-6">
              {["One-tap full 360° capture — a room in seconds", "High resolution buyers can zoom into", "Compact and fast to move scene to scene", "Feeds straight into our scene-linking + AI narration workflow"].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm"><CheckCircle2 size={16} className="text-primary flex-shrink-0 mt-0.5" /> <span className="text-muted-foreground">{t}</span></li>
              ))}
            </ul>
          </motion.div>

          <motion.div {...fade} className="space-y-4">
            <div className="rounded-2xl border border-border bg-card/50 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary"><Camera size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold">Rent a camera — $330</h3>
                  <p className="text-xs text-muted-foreground">Prefer to shoot it yourself</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">Don't want to buy one? Rent an Insta360 from us for <strong className="text-foreground">$330</strong> and capture your own walkthrough with our step-by-step guide.</p>
            </div>
            <div className="rounded-2xl border border-border bg-card/50 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary"><Video size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold">We shoot it for you — $990</h3>
                  <p className="text-xs text-muted-foreground">Canberra only (for now)</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">Want it done professionally? Our team captures a full 360° walkthrough of your business for <strong className="text-foreground">$990</strong> — currently available in <strong className="text-foreground">Canberra</strong>, with more regions coming as our partner network grows.</p>
            </div>
            <div className="rounded-2xl border border-border theme-aurora-bg overflow-hidden">
              <div className="relative z-10 p-6">
                <h3 className="text-lg font-bold mb-1">Find a local partner</h3>
                <p className="text-sm text-muted-foreground mb-4">Outside Canberra? Find an approved EXIT360 walkthrough partner near you — or become one.</p>
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
        heading="Bring your business to life in 360°"
        sub="Build an immersive walkthrough that lets serious buyers explore every corner — and sell faster with fewer wasted inspections."
        primary={{ label: "List your business", href: "/list-your-business" }}
        secondary={{ label: "See how it works", href: "/how-it-works" }}
      />
    </SiteShell>
  );
}
