import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Check, Minus, Camera, ShieldCheck, BarChart3, Smartphone,
  ArrowRight, Scale, MessageSquare,
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

export function Compare() {
  const pc = usePageContent("/compare");
  const deepI = [Camera, ShieldCheck, BarChart3, Smartphone];
  const rows = pc.list("table.rows");
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
              <Scale size={13} /> {pc.t("hero.eyebrow")}
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
              <RichCopy text={pc.t("hero.title")} />
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
              <RichCopy text={pc.t("hero.subtitle")} />
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/list-your-business"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">{pc.t("hero.ctaPrimary")} <ArrowRight size={18} className="ml-1" /></Button></Link>
              <Link href="/how-it-works"><Button size="lg" variant="outline" className="h-13 px-8 text-base">{pc.t("hero.ctaSecondary")}</Button></Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Intro copy */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <motion.div {...fade} className="space-y-5 text-lg text-muted-foreground leading-relaxed">
          {pc.list("intro.paras").map((p, i) => (
            <p key={i}><RichCopy text={p.text} /></p>
          ))}
        </motion.div>
      </section>

      {/* Comparison table */}
      <section className="max-w-5xl mx-auto px-6 pb-8">
        <motion.div {...fade} className="rounded-3xl border border-border bg-card/50 overflow-hidden">
          <div className="grid grid-cols-12 border-b border-border bg-primary/5">
            <div className="col-span-6 sm:col-span-8 px-5 sm:px-7 py-5 text-sm font-bold">Capability</div>
            <div className="col-span-3 sm:col-span-2 px-2 py-5 text-center text-sm font-bold theme-text-gradient">{pc.t("table.colA")}</div>
            <div className="col-span-3 sm:col-span-2 px-2 py-5 text-center text-sm font-bold text-muted-foreground">{pc.t("table.colB")}</div>
          </div>
          {rows.map((r, i) => (
            <motion.div
              key={i}
              {...fade}
              transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.3) }}
              className="grid grid-cols-12 items-center border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
            >
              <div className="col-span-6 sm:col-span-8 px-5 sm:px-7 py-5">
                <p className="text-sm font-semibold">{r.feature}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.detail}</p>
              </div>
              <div className="col-span-3 sm:col-span-2 flex justify-center py-5">
                <span className="w-9 h-9 rounded-full grid place-items-center bg-primary/10 text-primary" aria-label={`${pc.t("table.colA")}: yes`}>
                  <Check size={18} strokeWidth={3} />
                </span>
              </div>
              <div className="col-span-3 sm:col-span-2 flex justify-center py-5">
                <span className="w-9 h-9 rounded-full grid place-items-center bg-muted text-muted-foreground" aria-label={`${pc.t("table.colB")}: no`}>
                  <Minus size={18} strokeWidth={3} />
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
        <motion.p {...fade} className="text-xs text-muted-foreground mt-4 text-center max-w-2xl mx-auto">
          {pc.t("table.footnote")}
        </motion.p>
      </section>

      {/* Category deep-dives */}
      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <motion.div {...fade} className="max-w-3xl mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4"><RichCopy text={pc.t("deepdive.heading")} /></h2>
          <p className="text-lg text-muted-foreground leading-relaxed"><RichCopy text={pc.t("deepdive.body")} /></p>
        </motion.div>

        <div className="space-y-6">
          {pc.list("deepdive.items").map((c, i) => { const Icon = pick(deepI, i); return (
            <motion.div
              key={i}
              {...fade}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card/50 p-7 sm:p-8 flex flex-col sm:flex-row gap-6 hover:border-primary/40 transition-colors"
            >
              <div className="w-12 h-12 shrink-0 rounded-xl grid place-items-center bg-primary/10 text-primary"><Icon size={22} /></div>
              <div>
                <h3 className="text-xl font-bold mb-2">{c.title}</h3>
                <p className="text-muted-foreground leading-relaxed"><RichCopy text={c.body} /></p>
              </div>
            </motion.div>); })}
        </div>
      </section>

      {/* Honest "when traditional is enough" */}
      <section className="max-w-3xl mx-auto px-6 py-8">
        <motion.div {...fade} className="rounded-2xl border border-border bg-muted/30 p-7 sm:p-8">
          <div className="flex items-center gap-3 mb-3">
            <MessageSquare size={20} className="text-primary" />
            <h2 className="text-2xl font-bold tracking-tight">{pc.t("honest.heading")}</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed"><RichCopy text={pc.t("honest.body")} /></p>
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
        secondary={{ label: pc.t("cta.secondary"), href: "/how-it-works" }}
      />
    </SiteShell>
  );
}
