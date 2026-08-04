import { Link } from "wouter";
import { motion } from "framer-motion";
import { Camera, FileText, ShieldCheck, BarChart3, Smartphone, Monitor, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { RichCopy } from "@/content/copy";
import { usePageContent } from "@/content/model";
import { SiteShell, CtaBand } from "@/components/SiteShell";

const fade = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.5 } };
const pick = (arr: any[], i: number) => arr[i % arr.length];

export function ListYourBusiness() {
  const pc = usePageContent("/list-your-business");
  const featI = [Camera, FileText, ShieldCheck, BarChart3];
  return (
    <SiteShell>
      <Seo
        title="List a Business for Sale with 360° Tours | EXIT360"
        description="List your business for sale on EXIT360 in minutes. Build an immersive 360° walkthrough, a data-room-grade report, gate financials behind NDAs and reach verified buyers — on app and web."
        keywords="list a business for sale, list my business, advertise business for sale australia, sell business online, create business listing, 360 tour listing"
        path="/list-your-business"
        jsonLd={{ "@context": "https://schema.org", "@type": "WebPage", name: "List a business for sale on EXIT360" }}
      />

      <section className="theme-aurora-bg">
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <motion.div {...fade}>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-5">
              <RichCopy text={pc.t("hero.title")} />
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
              <RichCopy text={pc.t("hero.subtitle")} />
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/seller"><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">{pc.t("hero.ctaPrimary")} <ArrowRight size={18} className="ml-1" /></Button></Link>
              <Link href="/how-it-works"><Button size="lg" variant="outline" className="h-13 px-8 text-base">{pc.t("hero.ctaSecondary")}</Button></Link>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-8 justify-center text-sm text-muted-foreground">
              {pc.list("hero.chips").map((chip, i) => (<span key={i} className="flex items-center gap-2"><CheckCircle2 size={15} className="text-primary" /> {chip.text}</span>))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-5">
          {pc.list("features.cards").map((f, i) => { const Icon = pick(featI, i); return (
            <motion.div key={i} {...fade} transition={{ duration: 0.5, delay: i * 0.05 }} className="rounded-2xl border border-border bg-card/50 p-6 flex gap-4">
              <div className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary flex-shrink-0"><Icon size={20} /></div>
              <div>
                <h3 className="text-lg font-bold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed"><RichCopy text={f.body} /></p>
              </div>
            </motion.div>); })}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-10">
        <motion.div {...fade} className="rounded-3xl border border-border theme-aurora-bg">
          <div className="relative z-10 grid md:grid-cols-2 gap-8 p-10 items-center">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight mb-3"><RichCopy text={pc.t("sync.heading")} /></h2>
              <p className="text-muted-foreground leading-relaxed mb-5">
                <RichCopy text={pc.t("sync.body")} />
              </p>
              <div className="flex gap-6">
                <div className="flex items-center gap-2 text-sm"><Smartphone size={18} className="text-primary" /> Native app</div>
                <div className="flex items-center gap-2 text-sm"><Monitor size={18} className="text-primary" /> Full web dashboard</div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card/60 p-6">
              <ol className="space-y-4">
                {pc.list("sync.steps").map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full theme-btn-gradient text-primary-foreground grid place-items-center text-sm font-bold flex-shrink-0">{i + 1}</span>
                    <span className="text-sm text-foreground pt-1">{s.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </motion.div>
      </section>

      <CtaBand
        heading={pc.t("cta.heading")}
        sub={pc.t("cta.sub")}
        primary={{ label: pc.t("cta.primary"), href: "/seller" }}
        secondary={{ label: pc.t("cta.secondary"), href: "/brokers" }}
      />
    </SiteShell>
  );
}
