// Site background effects. A crisp, themed animated backdrop replaces the old
// blurry radial aurora. The choice is stored in localStorage and applied by
// <AnimatedBackground/> (mounted once at the app root). Effects are drawn either
// with pure CSS (mesh/halftone/topo) or a canvas loop (dots/orbs).

export type BgKind = "css" | "canvas" | "webgl";

export interface BgEffectDef {
  id: string;
  name: string;
  tagline: string;
  kind: BgKind;
}

export const BG_EFFECTS: BgEffectDef[] = [
  { id: "dot-grid-wave", name: "Dot Grid Wave", tagline: "Rippling grid of dots",   kind: "canvas" },
  { id: "halftone",      name: "Halftone",      tagline: "Crisp fading dot field",  kind: "css" },
  { id: "mesh-gradient", name: "Mesh Gradient", tagline: "Silky WebGL colour mesh", kind: "webgl" },
  { id: "glow-orbs",     name: "Glow Orbs",     tagline: "Floating light orbs",     kind: "canvas" },
  { id: "topo-lines",    name: "Topographic",   tagline: "Morphing contour lines",  kind: "webgl" },
  { id: "none",          name: "None",          tagline: "Solid background",        kind: "css" },
];

export const DEFAULT_EFFECT = "dot-grid-wave";
const STORAGE_KEY = "exit360_bg_effect";
export const BG_CHANGE_EVENT = "exit360-bg-change";

export function getStoredEffect(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && BG_EFFECTS.some((e) => e.id === v)) return v;
  } catch { /* ignore */ }
  return DEFAULT_EFFECT;
}

export function setStoredEffect(id: string): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(BG_CHANGE_EVENT, { detail: id })); } catch { /* ignore */ }
}

export function effectKind(id: string): BgKind {
  return BG_EFFECTS.find((e) => e.id === id)?.kind ?? "css";
}
