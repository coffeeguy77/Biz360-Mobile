import type { ReactNode } from "react";

// ─── Editable marketing copy registry ────────────────────────────────────────
// Each slot's `default` is the current live copy. Admin overrides (set in /manage)
// are injected by the server into window.__EXIT360_COPY__ and win over defaults.
// Markers inside text: ==word== → gradient span, **word** → bold foreground.

export interface Slot { key: string; label: string; type?: "text" | "textarea"; default: string; }
export interface PageContent { label: string; slots: Slot[]; }

// All marketing pages now use the rich section model (see content/model.tsx).
// PAGE_CONTENT is kept for the simple-slot fallback API but is currently empty.
export const PAGE_CONTENT: Record<string, PageContent> = {};

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
