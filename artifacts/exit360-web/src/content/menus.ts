// Editable site menus (primary nav + footer). Defaults are the current menus;
// admin overrides are injected by the server into window.__EXIT360_MENUS__.

export interface MenuLink { label: string; href: string }
export interface FooterCol { title: string; links: MenuLink[] }

export const DEFAULT_PRIMARY: MenuLink[] = [
  { label: "For Buyers", href: "/buying" },
  { label: "For Sellers", href: "/selling" },
  { label: "Brokers", href: "/brokers" },
  { label: "360° Tours", href: "/walkthroughs" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Compare", href: "/compare" },
  { label: "Help", href: "/help" },
];

export const DEFAULT_FOOTER: FooterCol[] = [
  { title: "Platform", links: [
    { label: "Browse Listings", href: "/listings" },
    { label: "360° Walkthroughs", href: "/walkthroughs" },
    { label: "Find a Partner", href: "/find-a-partner" },
    { label: "Become a Partner", href: "/photographers" },
    { label: "How It Works", href: "/how-it-works" },
  ] },
  { title: "For Sellers", links: [
    { label: "Sell Your Business", href: "/selling" },
    { label: "List a Business", href: "/list-your-business" },
    { label: "Broker Network", href: "/brokers" },
    { label: "Seller Dashboard", href: "/seller" },
  ] },
  { title: "For Buyers", links: [
    { label: "Buy a Business", href: "/buying" },
    { label: "Browse Listings", href: "/listings" },
    { label: "Buyer Portal", href: "/buyers" },
    { label: "Help & Support", href: "/help" },
  ] },
];

export function useMenus() {
  const g: any = (() => { try { return (window as any).__EXIT360_MENUS__ ?? {}; } catch { return {}; } })();
  return {
    primary: (Array.isArray(g.primary) && g.primary.length ? g.primary : DEFAULT_PRIMARY) as MenuLink[],
    footer: (Array.isArray(g.footer) && g.footer.length ? g.footer : DEFAULT_FOOTER) as FooterCol[],
  };
}
