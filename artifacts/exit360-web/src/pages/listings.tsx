import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye,
  MapPin,
  Users,
  TrendingUp,
  BookmarkIcon,
  Search,
  SlidersHorizontal,
  ArrowLeft,
  Camera,
  ShieldCheck,
  Clock,
  Loader2,
} from "lucide-react";
import { getPriceStat, getStatSlot, type Listing } from "@/data/listings";
import { fetchListings } from "@/lib/listingsApi";
import { SiteNav, SiteFooter } from "@/components/SiteShell";

const CATEGORIES = ["All", "Food & Beverage", "Health & Beauty", "Health & Fitness", "Services"];
const STATES = ["All States", "ACT", "VIC", "NSW", "QLD", "WA", "SA"];

const BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  identity:   { label: "ID Verified",    color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  abn:        { label: "ABN Verified",   color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  financials: { label: "Financials",     color: "bg-green-500/10 text-green-400 border-green-500/20" },
  lease:      { label: "Lease Docs",     color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  equipment:  { label: "Equipment List", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  tour:       { label: "360° Tour",      color: "bg-primary/10 text-primary border-primary/20" },
  accountant: { label: "Accountant",     color: "bg-green-500/10 text-green-400 border-green-500/20" },
};

function ListingCard({ listing }: { listing: Listing }) {
  // Mirror the mobile app's card: a headline price slot the seller configures,
  // plus two seller-chosen stat slots (default SDE p.a. + staff count).
  const priceStat = getPriceStat(listing);
  const slot2 = getStatSlot(listing.stat2Display ?? "sde", listing);
  const slot3 = getStatSlot(listing.stat3Display ?? "staffCount", listing);
  const stats = [priceStat, slot2, slot3].filter(Boolean) as { value: string; label: string; accent?: boolean }[];

  return (
    <Link href={`/listings/${listing.id}`}>
    <article
      data-testid={`card-listing-${listing.id}`}
      className={`group bg-card border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(59,130,246,0.08)] flex flex-col cursor-pointer ${
        listing.isRealListing
          ? "border-amber-500/40 hover:border-amber-400/60 shadow-[0_0_20px_rgba(217,119,6,0.07)]"
          : "border-border hover:border-primary/40"
      }`}
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden bg-muted">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.businessName}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: listing.heroColor + "33" }}>
            <Eye size={32} className="text-muted-foreground" />
          </div>
        )}
        {/* Overlay badges */}
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          {listing.isRealListing && (
            <span className="flex items-center gap-1 bg-amber-500 text-black text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
              ✦ Live Listing
            </span>
          )}
          {listing.hasTour && (
            <span className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full">
              <Camera size={11} /> 360° Tour
            </span>
          )}
          {listing.confidential && (
            <span className="flex items-center gap-1 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded-full">
              Confidential
            </span>
          )}
        </div>
        {/* Saved count */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
          <BookmarkIcon size={11} /> {listing.savedCount}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1 gap-4">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-lg leading-tight text-foreground">{listing.businessName}</h3>
            {listing.verified && <ShieldCheck size={16} className="text-green-400 flex-shrink-0 mt-1" />}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <MapPin size={13} />
            <span>{listing.suburb}, {listing.state}</span>
            <span className="mx-1 text-border">·</span>
            <span>{listing.subcategory}</span>
          </div>
        </div>

        {/* Key metrics — driven by the seller's app config (price + 2 stat slots) */}
        <div className={`grid gap-2 ${stats.length === 3 ? "grid-cols-3" : stats.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {stats.map((s, i) => (
            <div key={i} className="bg-background rounded-xl p-3 text-center border border-border">
              <div className={`text-lg font-bold ${s.accent ? "text-green-400" : "text-foreground"}`}>{s.value}</div>
              <div className="text-[11px] text-muted-foreground font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{listing.description}</p>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          {listing.badges.slice(0, 5).map((b) => {
            const cfg = BADGE_CONFIG[b];
            if (!cfg) return null;
            return (
              <span
                key={b}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}
              >
                {cfg.label}
              </span>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 mt-auto">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users size={12} /> {listing.staffCount} staff</span>
            <span className="flex items-center gap-1"><Clock size={12} /> {listing.ownerHours}h/wk owner</span>
            {listing.hasTour && listing.tourStarts > 0 && (
              <span className="flex items-center gap-1 text-primary"><TrendingUp size={12} /> {listing.tourStarts} tours</span>
            )}
          </div>
        </div>
      </div>
    </article>
    </Link>
  );
}

export function Listings() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [state, setState] = useState("All States");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchListings().then((l) => {
      if (cancelled) return;
      setListings(l);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = listings.filter((l) => {
    const matchSearch =
      !search ||
      l.businessName.toLowerCase().includes(search.toLowerCase()) ||
      l.suburb.toLowerCase().includes(search.toLowerCase()) ||
      l.subcategory.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || l.category === category;
    const matchState = state === "All States" || l.state === state;
    return matchSearch && matchCat && matchState;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-10">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Verified Businesses for Sale</h1>
          <p className="text-muted-foreground">
            {loading ? "…" : listings.length} listings · Browse, filter, and take 360° virtual tours before you commit.
          </p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              data-testid="input-search"
              type="search"
              placeholder="Search by name, suburb, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-10 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-muted-foreground" />
            <select
              data-testid="select-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select
              data-testid="select-state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-24 text-muted-foreground">
            <Loader2 size={40} className="mx-auto mb-4 animate-spin opacity-40" />
            <p className="text-lg font-medium">Loading listings…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Eye size={40} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No listings match your filters</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-16 text-center border-t border-border pt-12">
          <p className="text-muted-foreground mb-4">Want to sell your business on EXIT360?</p>
          <Button data-testid="button-list-cta">List Your Business</Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
