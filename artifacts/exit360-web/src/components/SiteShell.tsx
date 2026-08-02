import { useState, useEffect, type ReactNode } from "react";
import { Link } from "wouter";
import { Menu, X, User, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const NAV = [
  { label: "For Buyers",    href: "/buying" },
  { label: "For Sellers",   href: "/selling" },
  { label: "Brokers",       href: "/brokers" },
  { label: "360° Tours",    href: "/walkthroughs" },
  { label: "How It Works",  href: "/how-it-works" },
  { label: "Compare",       href: "/compare" },
];

/** Signed-in when a buyer-portal token is present. Re-checks on focus/nav so the
 *  header updates right after a buyer signs in on any page. */
function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const check = () => { try { setSignedIn(!!localStorage.getItem("exit360_buyer_token")); } catch { setSignedIn(false); } };
    check();
    window.addEventListener("focus", check);
    window.addEventListener("storage", check);
    const iv = setInterval(check, 2000);
    return () => { window.removeEventListener("focus", check); window.removeEventListener("storage", check); clearInterval(iv); };
  }, []);
  return signedIn;
}

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const signedIn = useSignedIn();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center cursor-pointer text-foreground">
            <Logo height={30} />
          </div>
        </Link>
        <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}><span className="hover:text-foreground transition-colors cursor-pointer">{n.label}</span></Link>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/listings"><Button variant="outline" className="hidden md:inline-flex">Browse Listings</Button></Link>
          {/* Persistent portal / sign-in — sign in once, message & reveal phones across every listing */}
          {signedIn ? (
            <Link href="/buyers/portal"><Button variant="outline" className="gap-1.5"><User size={15} /> <span className="hidden sm:inline">My Portal</span></Button></Link>
          ) : (
            <Link href="/buyers"><Button variant="outline" className="gap-1.5"><LogIn size={15} /> <span className="hidden sm:inline">Sign in</span></Button></Link>
          )}
          <Link href="/list-your-business"><Button className="theme-btn-gradient border-0 hidden sm:inline-flex">List a Business</Button></Link>
          <button className="lg:hidden w-9 h-9 grid place-items-center rounded-lg bg-muted flex-shrink-0" onClick={() => setOpen((o) => !o)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl px-6 py-4 flex flex-col gap-3">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}><span className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>{n.label}</span></Link>
          ))}
          <div className="border-t border-border pt-3 flex flex-col gap-3">
            <Link href="/listings"><span className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>Browse listings</span></Link>
            <Link href={signedIn ? "/buyers/portal" : "/buyers"}><span className="text-sm font-semibold text-primary" onClick={() => setOpen(false)}>{signedIn ? "My Portal" : "Sign in"}</span></Link>
            <Link href="/list-your-business"><span className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>List a Business</span></Link>
          </div>
        </div>
      )}
    </nav>
  );
}

export function SiteFooter() {
  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    { title: "Platform", links: [
      { label: "Browse Listings", href: "/listings" },
      { label: "360° Walkthroughs", href: "/walkthroughs" },
      { label: "Find a Partner", href: "/find-a-partner" },
      { label: "Become a Partner", href: "/photographers" },
      { label: "How It Works", href: "/how-it-works" },
    ]},
    { title: "For Sellers", links: [
      { label: "Sell Your Business", href: "/selling" },
      { label: "List a Business", href: "/list-your-business" },
      { label: "Broker Network", href: "/brokers" },
      { label: "Seller Dashboard", href: "/seller" },
    ]},
    { title: "For Buyers", links: [
      { label: "Buy a Business", href: "/buying" },
      { label: "Browse Listings", href: "/listings" },
      { label: "Buyer Portal", href: "/buyers" },
    ]},
  ];
  return (
    <footer className="border-t border-border bg-card/40 mt-24">
      <div className="max-w-[1440px] mx-auto px-6 py-14 grid gap-10 md:grid-cols-4">
        <div>
          <div className="flex items-center mb-3 text-foreground">
            <Logo height={30} />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Australia's 360° business-for-sale marketplace. Walk through before you sign.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-bold text-foreground mb-3">{c.title}</p>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}><span className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">{l.label}</span></Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="max-w-[1440px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} EXIT360. All rights reserved.</span>
          <span>Buy &amp; sell businesses with immersive 360° virtual tours.</span>
        </div>
      </div>
    </footer>
  );
}

/** Full page wrapper: themed nav + content + footer. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <SiteNav />
      <main className="pt-16">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** Shared CTA band used at the foot of marketing pages. */
export function CtaBand({ heading, sub, primary, secondary }: {
  heading: string; sub: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="max-w-6xl mx-auto px-6 my-24">
      <div className="theme-aurora-bg rounded-3xl border border-border p-10 sm:p-14 text-center">
        <div className="relative z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">{heading}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">{sub}</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href={primary.href}><Button size="lg" className="h-13 px-8 text-base theme-btn-gradient border-0">{primary.label}</Button></Link>
            {secondary && <Link href={secondary.href}><Button size="lg" variant="outline" className="h-13 px-8 text-base">{secondary.label}</Button></Link>}
          </div>
        </div>
      </div>
    </section>
  );
}
