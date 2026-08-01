// Theme engine — 8 "wow" palettes + the default blue. A theme is applied by
// toggling a `theme-<id>` class on <html>; the CSS in index.css does the rest,
// so every semantic token (bg-background, bg-primary, …) restyles instantly.

export interface ThemeDef {
  id: string;
  name: string;
  tagline: string;
  /** Preview swatch — the theme's signature gradient (CSS gradient string). */
  swatch: string;
  /** Accent dot for the picker. */
  dot: string;
}

export const DEFAULT_THEME = "default";

export const THEMES: ThemeDef[] = [
  { id: "default",     name: "Ocean Blue",     tagline: "The signature EXIT360 look",  swatch: "linear-gradient(135deg,#3b82f6,#22d3ee,#22c55e)", dot: "#3b82f6" },
  { id: "sunset",      name: "Sunset Ember",   tagline: "Warm orange into magenta",     swatch: "linear-gradient(135deg,#f97316,#ec4899,#a855f7)", dot: "#f97316" },
  { id: "amethyst",    name: "Royal Amethyst", tagline: "Deep violet & fuchsia",        swatch: "linear-gradient(135deg,#8b5cf6,#c026d3,#ec4899)", dot: "#8b5cf6" },
  { id: "magenta",     name: "Cyber Magenta",  tagline: "Neon magenta meets cyan",      swatch: "linear-gradient(135deg,#ec2f8b,#a855f7,#22d3ee)", dot: "#ec2f8b" },
  { id: "crimson",     name: "Crimson Luxe",   tagline: "Bold crimson & gold",          swatch: "linear-gradient(135deg,#e11d48,#f97316,#f59e0b)", dot: "#e11d48" },
  { id: "rose",        name: "Rose Quartz",    tagline: "Soft rose & warm gold",        swatch: "linear-gradient(135deg,#f472b6,#fb7185,#fbbf24)", dot: "#f472b6" },
  { id: "gold",        name: "Golden Onyx",    tagline: "Black onyx & liquid gold",     swatch: "linear-gradient(135deg,#fbbf24,#d97706,#b45309)", dot: "#fbbf24" },
  { id: "teal",        name: "Teal Lagoon",    tagline: "Turquoise & coral",            swatch: "linear-gradient(135deg,#14b8a6,#06b6d4,#fb7185)", dot: "#14b8a6" },
  { id: "ultraviolet", name: "Ultraviolet",    tagline: "Electric indigo & hot pink",   swatch: "linear-gradient(135deg,#7c6cf7,#a855f7,#ec4899)", dot: "#7c6cf7" },
];

const STORAGE_KEY = "exit360_theme";
const CLASSES = THEMES.filter((t) => t.id !== DEFAULT_THEME).map((t) => `theme-${t.id}`);

export function getStoredTheme(): string {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t && THEMES.some((x) => x.id === t)) return t;
  } catch { /* ignore */ }
  return DEFAULT_THEME;
}

export function applyTheme(id: string, persist = true): void {
  const root = document.documentElement;
  root.classList.remove(...CLASSES);
  if (id && id !== DEFAULT_THEME) root.classList.add(`theme-${id}`);
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  }
}

/** Apply the stored theme as early as possible (called from main + inline). */
export function initTheme(): void {
  applyTheme(getStoredTheme(), false);
}
