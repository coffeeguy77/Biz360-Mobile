import { Link } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Building, ShieldCheck, ArrowRight, Eye, Play, TrendingUp, Clock, Users, MapPin } from "lucide-react";
import { getPriceStat, getStatSlot, BADGE_LABELS, type Listing } from "@/data/listings";
import { fetchListings } from "@/lib/listingsApi";
import { SiteNav, SiteFooter } from "@/components/SiteShell";
import { useCopy, RichCopy } from "@/content/copy";

export function Home() {
  const c = useCopy("/");
  const [listings, setListings] = useState<Listing[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchListings().then((l) => { if (!cancelled) setListings(l); });
    return () => { cancelled = true; };
  }, []);

  // Feature the first approved listing (prefer one with a 360° tour) — fully live from the API.
  const bc = listings.find((l) => l.hasTour) ?? listings[0] ?? null;

  // Mirror the app/card: seller-configured price (with From/To range) + stat slots.
  const priceStat = bc ? getPriceStat(bc) : null;
  const slot2 = bc ? getStatSlot(bc.stat2Display ?? "sde", bc) : null;
  const slot3 = bc ? getStatSlot(bc.stat3Display ?? "staffCount", bc) : null;

  return (
    <div className="min-h-screen text-foreground selection:bg-primary/30">
      
      {/* Unified site navigation (same on every page) */}
      <SiteNav />

      {/* Hero Section */}
      <section id="main" tabIndex={-1} className="pt-32 pb-20 px-6 max-w-[1440px] mx-auto flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 space-y-6">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
            {c("heroEyebrow")}
          </Badge>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
            <RichCopy text={c("heroTitle")} />
          </h1>
          <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
            <RichCopy text={c("heroSubtitle")} />
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <Link href="/listings">
              <Button size="lg" className="h-14 px-8 text-base" data-testid="button-browse-listings">
                {c("ctaPrimary")}
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-14 px-8 text-base">
              <Play className="mr-2" size={18} /> {c("ctaSecondary")}
            </Button>
          </div>
        </div>
        <div className="flex-1 w-full relative">
          <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full"></div>
          <div className="relative bg-card border border-border rounded-2xl p-2 shadow-2xl">
            <img 
              src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000" 
              alt="Cafe Interior" 
              className="rounded-xl w-full h-[400px] object-cover opacity-80"
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-16 h-16 bg-primary/90 text-primary-foreground rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-transform">
                <Play fill="currentColor" size={24} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border bg-card/50">
        <div className="max-w-[1440px] mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="text-3xl font-bold text-foreground mb-1">{listings.length || "—"}</div>
            <div className="text-sm text-muted-foreground font-medium">Verified Listings</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground mb-1">{c("stat1Value")}</div>
            <div className="text-sm text-muted-foreground font-medium">{c("stat1Label")}</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground mb-1">{c("stat2Value")}</div>
            <div className="text-sm text-muted-foreground font-medium">{c("stat2Label")}</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground mb-1">89</div>
            <div className="text-sm text-muted-foreground font-medium">Avg Tours per Listing</div>
          </div>
        </div>
      </section>

      {/* Featured Listing — live from the API */}
      {bc && (
      <section className="py-24 px-6 max-w-[1440px] mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 px-3 py-1 mb-4">
            Featured Listing
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-5">{bc.businessName}</h2>
          <p className="text-lg text-muted-foreground">
            {bc.description}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-stretch">
          {/* Image + tour overlay */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl group min-h-[420px]" style={{ background: bc.heroColor + "22" }}>
            {bc.imageUrl && (
              <img
                src={bc.imageUrl}
                alt={bc.businessName}
                className="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-700"
                style={{ objectPosition: "center center" }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {bc.hasTour && (
            <div className="absolute top-4 left-4">
              <Badge className="bg-amber-500 text-black font-semibold px-3 py-1 text-xs">
                360° Tour
              </Badge>
            </div>
            )}
            <Link href={`/listings/${bc.id}`}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[72px] h-[72px] bg-white/20 backdrop-blur-sm border border-white/30 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/30 hover:scale-110 transition-all duration-200">
                  <Play fill="white" className="text-white ml-1" size={28} />
                </div>
              </div>
            </Link>
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="text-white text-xl font-bold mb-1">{bc.businessName}</div>
              <div className="flex items-center gap-1 text-white/70 text-sm">
                <MapPin size={12} />
                {bc.suburb}, {bc.state} &nbsp;·&nbsp; {bc.subcategory || bc.category}
              </div>
            </div>
          </div>

          {/* Details card */}
          <div className="flex flex-col gap-4">
            <Card className="p-6 border-border bg-card">
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Key Metrics</div>
              <div className="grid grid-cols-2 gap-4">
                {priceStat && (
                  <div className="col-span-2">
                    <div className="text-2xl font-bold text-foreground">{priceStat.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{priceStat.label}</div>
                  </div>
                )}
                {slot2 && (
                  <div>
                    <div className={`text-2xl font-bold ${slot2.accent ? "text-green-400" : "text-foreground"}`}>{slot2.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{slot2.label}</div>
                  </div>
                )}
                {slot3 && (
                  <div>
                    <div className={`text-2xl font-bold ${slot3.accent ? "text-green-400" : "text-foreground"}`}>{slot3.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{slot3.label}</div>
                  </div>
                )}
                <div className="col-span-2">
                  <div className="text-2xl font-bold text-foreground">{bc.staffCount} staff · {bc.ownerHours}h/wk</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Operations</div>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-border bg-card">
              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Verified & Documented</div>
              <div className="flex flex-wrap gap-2">
                {bc.badges.map((b) => BADGE_LABELS[b]).filter(Boolean).map((label) => (
                  <span key={label} className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 text-xs font-medium px-2.5 py-1 rounded-full">
                    <CheckCircle2 size={10} />
                    {label}
                  </span>
                ))}
              </div>
            </Card>

            <Card className="p-6 border-border bg-card flex-1 flex flex-col justify-between gap-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{bc.description}</p>
              <div className="flex gap-3 items-center">
                <Link href={`/listings/${bc.id}`} className="flex-1">
                  <Button className="w-full gap-2">
                    View Listing <ArrowRight size={16} />
                  </Button>
                </Link>
                {bc.hasTour && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                  <TrendingUp size={12} className="text-amber-400" />
                  360° tour
                </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </section>
      )}

      {/* Value Props */}
      <section className="py-24 px-6 bg-card border-t border-border">
        <div className="max-w-[1440px] mx-auto grid md:grid-cols-2 gap-16">
          <div className="space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold">For Serious Buyers</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="mt-1 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Eye className="text-primary" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Eliminate Wasted Trips</h3>
                  <p className="text-muted-foreground leading-relaxed">Tour the premises and inspect the equipment before committing to an in-person site visit.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="mt-1 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="text-primary" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Verified Financials</h3>
                  <p className="text-muted-foreground leading-relaxed">Listings require ABN and identity verification. Key financial metrics are tied directly to the physical space.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold">For Premium Sellers</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="mt-1 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="text-accent" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Filter Tire-Kickers</h3>
                  <p className="text-muted-foreground leading-relaxed">Let buyers experience the business digitally. Only engage with highly qualified leads who already understand your operation.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="mt-1 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Building className="text-accent" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Defend Your Valuation</h3>
                  <p className="text-muted-foreground leading-relaxed">Justify your asking price by showcasing your premium fit-out, high-value equipment, and operational efficiency in 360°.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-card to-background border border-border rounded-3xl p-12 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <h2 className="text-4xl font-bold mb-6">Ready to acquire your next asset?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join 12,000+ buyers already using EXIT360 to find premium businesses.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/sign-in?intent=signup">
                <Button size="lg" className="h-14 px-8 text-base">Create Buyer Profile</Button>
              </Link>
              <Button size="lg" variant="outline" className="h-14 px-8 text-base">List a Business</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
