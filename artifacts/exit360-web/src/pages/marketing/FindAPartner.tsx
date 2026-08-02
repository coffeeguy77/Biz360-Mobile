import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Search, MapPin, Phone, Mail, Camera, UserPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { SiteShell, CtaBand } from "@/components/SiteShell";

interface Partner { name: string; city: string; region: string; serviceAreas: string; phone: string | null; email: string | null; bio: string; avatarUrl: string | null; }
const fade = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.5 } };

export function FindAPartner() {
  const [region, setRegion] = useState("");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);

  async function load(q = "") {
    setLoading(true);
    try {
      const r = await fetch(`/api/public/partners${q ? `?region=${encodeURIComponent(q)}` : ""}`);
      const d = await r.json().catch(() => ({}));
      setPartners(Array.isArray(d.partners) ? d.partners : []);
    } catch { setPartners([]); } finally { setLoading(false); setSearched(true); }
  }
  useEffect(() => { load(); }, []);

  return (
    <SiteShell>
      <Seo
        title="Find a Local 360° Walkthrough Photographer | EXIT360 Partners"
        description="Find an approved EXIT360 walkthrough partner near you to capture your business for sale in immersive 360°. Search by region, or book our Canberra shoot service."
        keywords="360 tour photographer near me, virtual tour photographer australia, business walkthrough photographer, insta360 photographer canberra, find 360 photographer"
        path="/find-a-partner"
      />

      <section className="theme-aurora-bg">
        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-14 text-center">
          <motion.div {...fade}>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">Find a local <span className="theme-text-gradient">walkthrough partner.</span></h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Approved EXIT360 partners capture your business in immersive 360° so it sells faster. Search your area
              to find one — or book our own shoot service in Canberra.
            </p>
            <div className="flex gap-2 max-w-md mx-auto">
              <div className="flex-1 flex items-center bg-background border-2 border-border rounded-xl overflow-hidden focus-within:border-primary/60">
                <Search size={16} className="ml-3 text-muted-foreground" />
                <input value={region} onChange={(e) => setRegion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") load(region); }}
                  placeholder="City or state — e.g. Canberra, ACT" className="flex-1 px-3 py-3 bg-transparent text-foreground outline-none text-sm" />
              </div>
              <Button onClick={() => load(region)} className="h-auto theme-btn-gradient border-0 px-5">Search</Button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-14">
        {loading ? (
          <p className="text-center text-muted-foreground py-16">Searching partners…</p>
        ) : partners.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-5">
            {partners.map((p, i) => (
              <motion.div key={i} {...fade} className="rounded-2xl border border-border bg-card/50 p-6 flex gap-4">
                <div className="w-14 h-14 rounded-full grid place-items-center bg-primary/10 text-primary flex-shrink-0 overflow-hidden">
                  {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" /> : <Camera size={22} />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><MapPin size={11} /> {[p.city, p.region].filter(Boolean).join(", ") || p.serviceAreas}</p>
                  {p.bio && <p className="text-sm text-muted-foreground leading-relaxed mb-2">{p.bio}</p>}
                  <div className="flex flex-wrap gap-3 text-sm">
                    {p.phone && <a href={`tel:${p.phone}`} className="text-primary flex items-center gap-1.5"><Phone size={13} /> {p.phone}</a>}
                    {p.email && <a href={`mailto:${p.email}`} className="text-primary flex items-center gap-1.5"><Mail size={13} /> Email</a>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card/50 p-10 text-center max-w-xl mx-auto">
            <Sparkles className="mx-auto text-primary mb-3" size={30} />
            <h2 className="text-xl font-bold mb-2">{searched && region ? `No partner in "${region}" yet` : "No partners listed yet"}</h2>
            <p className="text-muted-foreground mb-2">
              We're growing our partner network across Australia. In the meantime we run walkthrough shoots directly
              in <strong className="text-foreground">Canberra</strong> — or you can capture your own with an Insta360.
            </p>
            <div className="rounded-xl border border-border bg-background/50 p-4 my-5 text-left">
              <p className="text-sm font-semibold mb-1">EXIT360 shoot service · Canberra</p>
              <p className="text-sm text-muted-foreground">A full professional 360° walkthrough shoot for <strong className="text-foreground">$990</strong>. Prefer to DIY? Rent an Insta360 from us for <strong className="text-foreground">$330</strong>.</p>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/list-your-business"><Button className="theme-btn-gradient border-0">Book / enquire</Button></Link>
              <Link href="/photographers"><Button variant="outline" className="gap-1.5"><UserPlus size={15} /> Become the partner here</Button></Link>
            </div>
          </div>
        )}
      </section>

      <CtaBand
        heading="Are you a photographer?"
        sub="Own an Insta360 and want paid walkthrough work in your area? Join the EXIT360 partner network."
        primary={{ label: "Become a partner", href: "/photographers" }}
        secondary={{ label: "About 360° tours", href: "/walkthroughs" }}
      />
    </SiteShell>
  );
}
