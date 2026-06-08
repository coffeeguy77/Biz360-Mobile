import { Link } from "wouter";
import { PanoramaViewer } from "@/components/PanoramaViewer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Building, ShieldCheck, FileText, ArrowRight, Eye, Play } from "lucide-react";

export function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <Eye className="text-primary-foreground" size={18} />
            </div>
            <span className="text-xl font-bold tracking-tight">EXIT360</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">For Buyers</a>
              <a href="#" className="hover:text-foreground transition-colors">For Sellers</a>
              <a href="#" className="hover:text-foreground transition-colors">Broker Network</a>
            </div>
            <Button>List a Business</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 space-y-6">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
            Now live in Australia
          </Badge>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1]">
            Walk through before you sign.
          </h1>
          <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
            The premium marketplace for verified businesses. Experience immersive 360° tours enriched with financial data, equipment specs, and lease details. Due diligence starts here.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <Link href="/listings">
              <Button size="lg" className="h-14 px-8 text-base" data-testid="button-browse-listings">
                Browse Listings
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-14 px-8 text-base">
              <Play className="mr-2" size={18} /> Watch Video
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
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="text-3xl font-bold text-foreground mb-1">320+</div>
            <div className="text-sm text-muted-foreground font-medium">Verified Listings</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground mb-1">$4.2B+</div>
            <div className="text-sm text-muted-foreground font-medium">Listed Value</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground mb-1">12,000+</div>
            <div className="text-sm text-muted-foreground font-medium">Qualified Buyers</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-foreground mb-1">89</div>
            <div className="text-sm text-muted-foreground font-medium">Avg Tours per Listing</div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Due diligence, spatialized.</h2>
          <p className="text-lg text-muted-foreground">
            Click the pins below to explore revenue data, equipment valuation, and operational details directly inside the venue.
          </p>
        </div>
        
        <PanoramaViewer />
      </section>

      {/* Value Props */}
      <section className="py-24 px-6 bg-card border-t border-border">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16">
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
              <Button size="lg" className="h-14 px-8 text-base">Create Buyer Profile</Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-base">List a Business</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border pt-16 pb-8 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                <Eye className="text-primary-foreground" size={14} />
              </div>
              <span className="text-lg font-bold">EXIT360</span>
            </div>
            <p className="text-sm text-muted-foreground">The premium marketplace for verified businesses.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/listings" className="hover:text-foreground">Browse Listings</Link></li>
              <li><a href="#" className="hover:text-foreground">Sell a Business</a></li>
              <li><a href="#" className="hover:text-foreground">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">About Us</a></li>
              <li><a href="#" className="hover:text-foreground">Contact</a></li>
              <li><a href="#" className="hover:text-foreground">Careers</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">Terms of Service</a></li>
              <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-8 border-t border-border text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} EXIT360. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
