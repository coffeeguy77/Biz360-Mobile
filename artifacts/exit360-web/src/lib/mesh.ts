// Mesh-gradient background config shared by the live site background and the
// remix playground. Precedence: per-device localStorage override → server
// injected window.__EXIT360_MESH__ (site-wide, set by an admin) → theme/defaults.

import type { MeshConfig } from "@/components/GLBackground";
import { MESH_DEFAULTS } from "@/components/GLBackground";

export type MeshOverride = Partial<MeshConfig>;

const LS_KEY = "exit360_mesh_v1";
export const MESH_CHANGE_EVENT = "exit360-mesh-change";

function injected(): MeshOverride {
  try { return ((window as any).__EXIT360_MESH__ as MeshOverride) ?? {}; } catch { return {}; }
}
function local(): MeshOverride | null {
  try { const v = localStorage.getItem(LS_KEY); return v ? (JSON.parse(v) as MeshOverride) : null; } catch { return null; }
}

/** Merged override (local wins over server-injected). null-ish if nothing set. */
export function getMeshOverride(): MeshOverride {
  return { ...injected(), ...(local() ?? {}) };
}

/** Numeric params merged with defaults — always a full param set. */
export function getMeshParams(): Omit<MeshConfig, "colors" | "bg"> {
  const o = getMeshOverride();
  return {
    bgAlpha: n(o.bgAlpha, MESH_DEFAULTS.bgAlpha),
    speed: n(o.speed, MESH_DEFAULTS.speed),
    scale: n(o.scale, MESH_DEFAULTS.scale),
    warp: n(o.warp, MESH_DEFAULTS.warp),
    softness: n(o.softness, MESH_DEFAULTS.softness),
    contrast: n(o.contrast, MESH_DEFAULTS.contrast),
    grain: n(o.grain, MESH_DEFAULTS.grain),
    mouse: n(o.mouse, MESH_DEFAULTS.mouse),
  };
}
const n = (x: any, d: number) => (typeof x === "number" && isFinite(x) ? x : d);

/** Save a per-device preview override and notify the live background. */
export function setLocalMesh(cfg: MeshOverride): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
  fire();
}
export function clearLocalMesh(): void {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  fire();
}
function fire() {
  try { window.dispatchEvent(new CustomEvent(MESH_CHANGE_EVENT)); } catch { /* ignore */ }
}
