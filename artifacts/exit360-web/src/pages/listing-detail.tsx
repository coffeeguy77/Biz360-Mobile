import { useRoute, Link } from "wouter";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Users,
  Clock,
  Eye,
  ShieldCheck,
  Camera,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_LISTINGS, formatPrice, formatRevenue, type Listing } from "@/data/listings";

const BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  identity:        { label: "ID Verified",    color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  abn:             { label: "ABN Verified",   color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  financials:      { label: "Financials",     color: "bg-green-500/10 text-green-400 border-green-500/20" },
  lease:           { label: "Lease Docs",     color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  equipment:       { label: "Equipment List", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  tour:            { label: "360° Tour",      color: "bg-primary/10 text-primary border-primary/20" },
  accountant:      { label: "Accountant",     color: "bg-green-500/10 text-green-400 border-green-500/20" },
  broker:          { label: "Broker",         color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  seller_supplied: { label: "Seller Docs",    color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
};

interface TourSpace {
  id: string;
  name: string;
  panoramaUrl: string;
  isStartScene?: boolean;
}

function buildPanoSrcdoc(panoramaUrl: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
<script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"><\/script>
<style>
  html,body,#pano{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000}
  .pnlm-container{background:#000}
</style>
</head>
<body>
<div id="pano"></div>
<script>
  pannellum.viewer('pano',{
    type:'equirectangular',
    panorama:${JSON.stringify(panoramaUrl)},
    title:${JSON.stringify(title)},
    autoLoad:true,
    showFullscreenCtrl:false,
    showZoomCtrl:true,
    compass:false,
    mouseZoom:true,
    friction:0.15,
  });
<\/script>
</body>
</html>`;
}

function TourViewer({ spaces }: { spaces: TourSpace[] }) {
  const valid = spaces.filter((s) => s.panoramaUrl && !s.panoramaUrl.startsWith("file://"));
  const startIdx = valid.findIndex((s) => s.isStartScene);
  const [current, setCurrent] = useState(startIdx >= 0 ? startIdx : 0);
  const [key, setKey] = useState(0);

  function goTo(idx: number) {
    setCurrent(idx);
    setKey((k) => k + 1);
  }

  if (!valid.length) return null;
  const space = valid[current];

  return (
    <div className="flex flex-col gap-3">
      {/* Main panorama */}
      <div className="relative rounded-2xl overflow-hidden bg-black" style={{ height: 460 }}>
        <iframe
          key={key}
          srcDoc={buildPanoSrcdoc(space.panoramaUrl, space.name)}
          className="w-full h-full border-0"
          title={space.name}
          sandbox="allow-scripts allow-same-origin"
        />
        {/* Prev/Next arrows */}
        {valid.length > 1 && (
          <>
            <button
              onClick={() => goTo((current - 1 + valid.length) % valid.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors z-10"
              aria-label="Previous space"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => goTo((current + 1) % valid.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors z-10"
              aria-label="Next space"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
        {/* Space label */}
        <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm text-white text-sm font-medium px-3 py-1.5 rounded-full flex items-center gap-2 z-10">
          <Camera size={13} className="text-primary" />
          {space.name}
          <span className="text-white/50">·</span>
          <span className="text-white/60 text-xs">{current + 1} / {valid.length}</span>
        </div>
      </div>

      {/* Space thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {valid.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            className={`relative flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
              i === current ? "border-primary shadow-[0_0_12px_rgba(59,130,246,0.4)]" : "border-transparent opacity-60 hover:opacity-90"
            }`}
            style={{ width: 96, height: 60 }}
          >
            <img src={s.panoramaUrl} alt={s.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/30 flex items-end p-1">
              <span className="text-white text-[9px] font-medium leading-tight line-clamp-2">{s.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DemoHero({ listing }: { listing: Listing }) {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden flex items-center justify-center"
      style={{ height: 320, background: listing.heroColor + "22" }}
    >
      {listing.imageUrl ? (
        <img src={listing.imageUrl} alt={listing.businessName} className="w-full h-full object-cover opacity-80" />
      ) : (
        <Eye size={48} className="text-muted-foreground opacity-30" />
      )}
    </div>
  );
}

export function ListingDetail() {
  const [, params] = useRoute("/listings/:id");
  const listing = DEMO_LISTINGS.find((l) => l.id === params?.id);

  const [spaces, setSpaces] = useState<TourSpace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);

  useEffect(() => {
    if (!listing?.isRealListing) return;
    setSpacesLoading(true);
    fetch(`/api/biz360/kv/biz360_tour_spaces_v2_${listing.id}`)
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
        setSpaces(arr.map((s: any) => ({
          id: s.id,
          name: s.name,
          panoramaUrl: s.panoramaUrl ?? "",
          isStartScene: !!s.isStartScene,
        })));
      })
      .catch(() => setSpaces([]))
      .finally(() => setSpacesLoading(false));
  }, [listing?.id]);

  if (!listing) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Listing not found.</p>
          <Link href="/listings">
            <Button variant="outline">Back to Listings</Button>
          </Link>
        </div>
      </div>
    );
  }

  const hasProfit = listing.adjustedProfit > 0;
  const multiple = hasProfit ? (listing.askingPrice / listing.adjustedProfit).toFixed(1) + "×" : "—";
  const annualRevenue = listing.weeklyRevenue * 52;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/listings">
              <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
                <ArrowLeft size={16} /> All Listings
              </button>
            </Link>
            <span className="text-border">|</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                <Eye className="text-primary-foreground" size={13} />
              </div>
              <span className="font-bold">EXIT360</span>
            </div>
          </div>
          <Button size="sm">Request Info</Button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Left: main content */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                {listing.isRealListing && (
                  <span className="bg-amber-500 text-black text-xs font-bold px-2.5 py-1 rounded-full">✦ Live Listing</span>
                )}
                {listing.hasTour && (
                  <span className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <Camera size={11} /> 360° Tour · {listing.tourStarts} starts
                  </span>
                )}
                {listing.verified && (
                  <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                    <ShieldCheck size={13} /> Verified Seller
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold mb-2">{listing.businessName}</h1>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <MapPin size={14} />
                <span>{listing.suburb}, {listing.state}</span>
                <span className="text-border mx-1">·</span>
                <span>{listing.subcategory}</span>
              </div>
            </div>

            {/* Tour / Hero */}
            {listing.isRealListing ? (
              spacesLoading ? (
                <div className="rounded-2xl bg-card border border-border flex items-center justify-center" style={{ height: 320 }}>
                  <p className="text-muted-foreground text-sm">Loading 360° tour…</p>
                </div>
              ) : (
                <TourViewer spaces={spaces} />
              )
            ) : (
              <DemoHero listing={listing} />
            )}

            {/* Description */}
            <div>
              <h2 className="font-semibold text-lg mb-3">About This Business</h2>
              <p className="text-muted-foreground leading-relaxed">{listing.description}</p>
            </div>

            {/* Operations */}
            <div>
              <h2 className="font-semibold text-lg mb-4">Operations at a Glance</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <Users size={18} className="text-primary" />
                  <div>
                    <div className="font-semibold">{listing.staffCount} Staff Members</div>
                    <div className="text-xs text-muted-foreground">Current team size</div>
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <Clock size={18} className="text-primary" />
                  <div>
                    <div className="font-semibold">{listing.ownerHours} hrs/week</div>
                    <div className="text-xs text-muted-foreground">Owner time required</div>
                  </div>
                </div>
                {listing.leaseExpiry && (
                  <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                    <DollarSign size={18} className="text-primary" />
                    <div>
                      <div className="font-semibold">Lease expires {listing.leaseExpiry}</div>
                      <div className="text-xs text-muted-foreground">Lease term</div>
                    </div>
                  </div>
                )}
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <Eye size={18} className="text-primary" />
                  <div>
                    <div className="font-semibold">{listing.viewCount} views</div>
                    <div className="text-xs text-muted-foreground">Buyer interest so far</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Verification badges */}
            <div>
              <h2 className="font-semibold text-lg mb-3">Verified Documents</h2>
              <div className="flex flex-wrap gap-2">
                {listing.badges.map((b) => {
                  const cfg = BADGE_CONFIG[b];
                  if (!cfg) return null;
                  return (
                    <span key={b} className={`text-xs font-medium px-3 py-1.5 rounded-full border ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: sticky metrics + CTA */}
          <div className="flex flex-col gap-5">
            <div className="sticky top-24 flex flex-col gap-5">
              {/* Price card */}
              <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">{formatPrice(listing.askingPrice)}</div>
                  <div className="text-sm text-muted-foreground mt-1">Asking Price</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background rounded-xl p-3 text-center border border-border">
                    <div className="text-base font-bold text-green-400">{formatRevenue(listing.weeklyRevenue)}</div>
                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Weekly Revenue</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 text-center border border-border">
                    <div className="text-base font-bold text-green-400">
                      ${(annualRevenue / 1000).toFixed(0)}K
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Annual Revenue</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 text-center border border-border">
                    <div className={`text-base font-bold ${hasProfit ? "" : "text-muted-foreground"}`}>{multiple}</div>
                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Profit Multiple</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 text-center border border-border">
                    <div className="text-base font-bold">{listing.tourStarts}</div>
                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Tour Starts</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button className="w-full gap-2">
                    <Phone size={15} /> Request a Call
                  </Button>
                  <Button variant="outline" className="w-full gap-2">
                    <Mail size={15} /> Send Enquiry
                  </Button>
                </div>
              </div>

              {listing.isRealListing && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-200/80 leading-relaxed">
                  This is a live listing submitted by a verified seller on EXIT360. All documents have been checked by the platform.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
