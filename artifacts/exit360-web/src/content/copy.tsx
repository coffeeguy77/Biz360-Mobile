import type { ReactNode } from "react";

// ─── Editable marketing copy registry ────────────────────────────────────────
// Each slot's `default` is the current live copy. Admin overrides (set in /manage)
// are injected by the server into window.__EXIT360_COPY__ and win over defaults.
// Markers inside text: ==word== → gradient span, **word** → bold foreground.

export interface Slot { key: string; label: string; type?: "text" | "textarea"; default: string; }
export interface PageContent { label: string; slots: Slot[]; }

export const PAGE_CONTENT: Record<string, PageContent> = {
  "/brokers": {
    label: "Brokers",
    slots: [
      { key: "heroEyebrow", label: "Hero eyebrow", default: "For business brokers & advisory firms" },
      { key: "heroTitle", label: "Hero title", type: "textarea", default: "Run your whole book of listings from ==one broker login.==" },
      { key: "heroSubtitle", label: "Hero subtitle", type: "textarea", default: "EXIT360 gives brokers a single account to build, manage and market every client's business for sale — each with its own **immersive 360° tour, NDA-gated IM report and live buyer analytics**. Then send each client a private link so they can watch their own listing's performance without ever having to ask you for an update." },
    ],
  },
  "/how-it-works": {
    label: "How it works",
    slots: [
      { key: "heroEyebrow", label: "Hero eyebrow", default: "The complete platform guide" },
      { key: "heroTitle", label: "Hero title", type: "textarea", default: "How EXIT360 works — and ==everything it can do.==" },
      { key: "heroSubtitle", label: "Hero subtitle", type: "textarea", default: "EXIT360 is Australia's 360° business-for-sale marketplace. It's far more than a classified ad: it's a **tour builder, an information memorandum generator, an NDA-gated data room and a live analytics dashboard** — all synced across app and web from one phone-verified account. This guide walks you through the whole platform, whether you're buying, selling or broking." },
    ],
  },
  "/compare": {
    label: "Compare",
    slots: [
      { key: "heroEyebrow", label: "Hero eyebrow", default: "EXIT360 vs traditional listing sites" },
      { key: "heroTitle", label: "Hero title", type: "textarea", default: "The best way to buy and sell a business, ==side by side.==" },
      { key: "heroSubtitle", label: "Hero subtitle", type: "textarea", default: "Most Australian businesses are still advertised on classified-style listing portals — the same channels people use to sell a car or rent a shopfront. EXIT360 was built specifically for business sales, so here's an honest, feature-by-feature look at everything we do that a traditional listing site can't." },
    ],
  },
  "/list-your-business": {
    label: "List your business",
    slots: [
      { key: "heroTitle", label: "Hero title", type: "textarea", default: "List your business ==where buyers can walk through it.==" },
      { key: "heroSubtitle", label: "Hero subtitle", type: "textarea", default: "Publish a listing that does the selling for you: an immersive 360° walkthrough, a professional information memorandum, NDA-gated financials and live buyer analytics — all keyed to your phone number so you can build on the app or the web and edit either." },
    ],
  },
  "/photographers": {
    label: "Photographers",
    slots: [
      { key: "heroEyebrow", label: "Hero eyebrow", default: "Partner program" },
      { key: "heroTitle", label: "Hero title", type: "textarea", default: "Get paid to capture businesses in ==immersive 360°.==" },
      { key: "heroSubtitle", label: "Hero subtitle", type: "textarea", default: "EXIT360 needs skilled local photographers to build stunning 360° walkthroughs for businesses going to market. Own an Insta360, pass our short training, and get referred paid shoots in your area — with the tools, templates and support to make every listing look world-class." },
    ],
  },
  "/find-a-partner": {
    label: "Find a partner",
    slots: [
      { key: "heroTitle", label: "Hero title", type: "textarea", default: "Find a local ==walkthrough partner.==" },
      { key: "heroSubtitle", label: "Hero subtitle", type: "textarea", default: "Approved EXIT360 partners capture your business in immersive 360° so it sells faster. Search your area to find one — or book our own shoot service in Canberra." },
    ],
  },
};

function overridesFor(path: string): Record<string, string> {
  try { return (window as any).__EXIT360_COPY__?.[path] ?? {}; } catch { return {}; }
}

/** Returns a getter c(key) → override ?? registry default for the given page. */
export function useCopy(path: string) {
  const ov = overridesFor(path);
  const defs: Record<string, string> = {};
  for (const s of PAGE_CONTENT[path]?.slots ?? []) defs[s.key] = s.default;
  return (key: string, fallback = "") => ov[key] ?? defs[key] ?? fallback;
}

/** Render copy text, expanding ==gradient== and **bold** markers. */
export function RichCopy({ text, className }: { text: string; className?: string }): ReactNode {
  const nodes: ReactNode[] = [];
  const re = /(==[^=]+==|\*\*[^*]+\*\*)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("==")) nodes.push(<span key={i++} className="theme-text-gradient">{tok.slice(2, -2)}</span>);
    else nodes.push(<strong key={i++} className="text-foreground">{tok.slice(2, -2)}</strong>);
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return className ? <span className={className}>{nodes}</span> : <>{nodes}</>;
}
