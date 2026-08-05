import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, RotateCcw, Plus, X, Check, Copy, Monitor, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { GLBackground, MESH_DEFAULTS, type MeshConfig } from "@/components/GLBackground";
import { setLocalMesh, clearLocalMesh, getMeshOverride } from "@/lib/mesh";

const TOKEN_KEY = "biz360_web_auth_token";

// ── HSL helpers to seed colours from the active theme ────────────────────────
function hslVarToHex(v: string): string {
  const m = (v || "").trim().match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return "#4576f0";
  let h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const r = s === 0 ? l : hue(p, q, h + 1 / 3), g = s === 0 ? l : hue(p, q, h), b = s === 0 ? l : hue(p, q, h - 1 / 3);
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function themeSeed(): { colors: string[]; bg: string } {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    colors: [v("--grad-from"), v("--grad-via"), v("--grad-to"), v("--glow")].map(hslVarToHex),
    bg: hslVarToHex(v("--background") || "222 47% 7%"),
  };
}

// Reference "living colour" palette (AIDesigner-style) as a one-click preset.
const PRESET_VIVID = { colors: ["#4576f0", "#ff4fa8", "#f4435e", "#fb7a37"], bg: "#15171c" };

function initialConfig(): MeshConfig {
  const ov = getMeshOverride();
  const seed = themeSeed();
  return {
    colors: ov.colors && ov.colors.length >= 2 ? ov.colors : seed.colors,
    bg: ov.bg ?? seed.bg,
    bgAlpha: ov.bgAlpha ?? MESH_DEFAULTS.bgAlpha,
    speed: ov.speed ?? MESH_DEFAULTS.speed,
    scale: ov.scale ?? MESH_DEFAULTS.scale,
    warp: ov.warp ?? MESH_DEFAULTS.warp,
    softness: ov.softness ?? MESH_DEFAULTS.softness,
    contrast: ov.contrast ?? MESH_DEFAULTS.contrast,
    grain: ov.grain ?? MESH_DEFAULTS.grain,
    mouse: ov.mouse ?? MESH_DEFAULTS.mouse,
  };
}

interface SliderDef { key: keyof MeshConfig; label: string; min: number; max: number; step: number; help: string; }
const SLIDERS: SliderDef[] = [
  { key: "bgAlpha", label: "bg-alpha", min: 0, max: 1, step: 0.01, help: "0 lets the page show through the valleys; 1 is a fully opaque field." },
  { key: "speed", label: "speed", min: 0.05, max: 2, step: 0.01, help: "Drift tempo. 0.2–0.5 looks expensive and calm; above 1 is energetic." },
  { key: "scale", label: "scale", min: 0.5, max: 3, step: 0.01, help: "Feature size; lower = broad sweeping pools, higher = finer texture." },
  { key: "warp", label: "warp", min: 0, max: 1.5, step: 0.01, help: "Organic distortion of colour boundaries; higher = more fluid edges." },
  { key: "softness", label: "softness", min: 0.2, max: 1, step: 0.01, help: "Blend width; low = punchy zones, high = dreamy diffuse transitions." },
  { key: "contrast", label: "contrast", min: 0.5, max: 2.5, step: 0.01, help: "Tonal punch around mid; raise for vivid, lower for muted backdrops." },
  { key: "grain", label: "grain", min: 0, max: 0.2, step: 0.005, help: "Film-grain overlay; a touch (0.04–0.08) kills banding." },
  { key: "mouse", label: "mouse", min: 0, max: 1, step: 0.01, help: "Cursor pigment-pull strength; drags the colour field toward the pointer." },
];

export function MeshRemix() {
  const [cfg, setCfg] = useState<MeshConfig>(initialConfig);
  const [, force] = useState(0);
  const [glFailed, setGlFailed] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const cfgRef = useRef(cfg); cfgRef.current = cfg;
  // Stable so GLBackground mounts the WebGL context ONCE (config updates live via ref).
  const onUnsupported = useCallback(() => setGlFailed(true), []);

  const token = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
  useEffect(() => {
    if (!token) return;
    fetch("/api/admin/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((m) => setIsAdmin(!!m?.isAdmin)).catch(() => setIsAdmin(false));
  }, [token]);

  function set<K extends keyof MeshConfig>(k: K, v: MeshConfig[K]) { setCfg((c) => ({ ...c, [k]: v })); }
  function setColor(i: number, hex: string) { setCfg((c) => ({ ...c, colors: c.colors.map((x, j) => (j === i ? hex : x)) })); }
  function addColor() { setCfg((c) => (c.colors.length >= 5 ? c : { ...c, colors: [...c.colors, "#ffffff"] })); }
  function removeColor(i: number) { setCfg((c) => (c.colors.length <= 2 ? c : { ...c, colors: c.colors.filter((_, j) => j !== i) })); }

  function reset() { setCfg({ ...initialConfig(), ...themeSeed() as any, ...MESH_DEFAULTS }); force((x) => x + 1); }
  function applyVivid() { setCfg((c) => ({ ...c, colors: [...PRESET_VIVID.colors], bg: PRESET_VIVID.bg })); }

  function flash(m: string) { setSavedMsg(m); setTimeout(() => setSavedMsg(null), 2500); }
  function applyDevice() { setLocalMesh(cfg); flash("Applied on this device — open any page to see it live."); }
  function clearDevice() { clearLocalMesh(); flash("Cleared your device override."); }
  async function applySite() {
    if (!token) return;
    try {
      await fetch("/api/admin/seo", { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ mesh: cfg }) });
      setLocalMesh(cfg);
      flash("Applied site-wide for all visitors.");
    } catch { flash("Could not save — try again."); }
  }
  function copyJson() {
    try { navigator.clipboard.writeText(JSON.stringify(cfg, null, 2)); flash("Settings copied to clipboard."); } catch { /* ignore */ }
  }

  const num = (k: keyof MeshConfig) => cfg[k] as number;
  const field = "h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/60";

  return (
    <div className="min-h-screen flex flex-col">
      <Seo title="Mesh Gradient Remix — Tune your background | EXIT360" description="Live playground to tune the EXIT360 animated mesh-gradient background: colours, drift speed, scale, warp, softness, contrast, grain and cursor pull." path="/effects/mesh-remix" noindex />
      {/* Top bar */}
      <header className="h-14 shrink-0 flex items-center justify-between gap-3 border-b border-border bg-background/80 backdrop-blur px-4 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/manage"><a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> <span className="hidden sm:inline">Manage</span></a></Link>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-semibold truncate">Mesh Gradient · Remix</span>
        </div>
        <div className="flex items-center gap-2">
          {savedMsg && <span className="hidden md:inline text-xs text-primary">{savedMsg}</span>}
          <Button size="sm" variant="outline" onClick={reset} className="gap-1.5"><RotateCcw size={14} /> Reset</Button>
          <Button size="sm" variant="outline" onClick={copyJson} className="gap-1.5"><Copy size={14} /> <span className="hidden sm:inline">Copy</span></Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Preview */}
        <div className="relative flex-1 min-h-[46vh] bg-[hsl(var(--background))]">
          <div className="absolute inset-0 p-4 sm:p-8">
            <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border shadow-2xl">
              {!glFailed ? <GLBackground mode="mesh" config={cfg} onUnsupported={onUnsupported} />
                : <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">WebGL isn’t available in this browser.</div>}
              <span className="pointer-events-none absolute bottom-5 right-5 z-10 hidden sm:flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur">Interactive — move your cursor</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <aside className="w-full lg:w-[340px] shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l border-border bg-background">
          <div className="p-4 space-y-6">
            <div>
              <h1 className="font-semibold">Mesh Gradient</h1>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">Silky animated multi-colour mesh that drifts across the screen like slow smoke. Tune every knob and apply it to your site.</p>
              <button onClick={applyVivid} className="mt-3 text-xs font-medium text-primary hover:underline">Load the “living colour” preset →</button>
            </div>

            {/* Colours */}
            <section className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-medium">colors</span>
                <button onClick={addColor} disabled={cfg.colors.length >= 5} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"><Plus size={13} /> add</button>
              </div>
              <div className="space-y-1.5">
                {cfg.colors.map((c, i) => (
                  <div key={i} className="flex h-8 items-center gap-2 rounded-md border border-border bg-background px-1.5">
                    <input type="color" value={c} onChange={(e) => setColor(i, e.target.value)} className="h-5 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={`colour ${i + 1}`} />
                    <input value={c.toUpperCase()} onChange={(e) => setColor(i, e.target.value)} spellCheck={false} className="h-full min-w-0 flex-1 bg-transparent text-[11px] font-medium uppercase tracking-wide outline-none" />
                    <button onClick={() => removeColor(i)} disabled={cfg.colors.length <= 2} title="Remove" className="px-1 text-muted-foreground/60 hover:text-foreground disabled:opacity-30"><X size={13} /></button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">2–5 hues; each colour owns a drifting region that migrates and morphs.</p>
            </section>

            {/* bg */}
            <section className="space-y-2">
              <span className="font-mono text-xs font-medium">bg</span>
              <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-background px-1.5">
                <input type="color" value={cfg.bg} onChange={(e) => set("bg", e.target.value)} className="h-5 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="background tint" />
                <input value={cfg.bg.toUpperCase()} onChange={(e) => set("bg", e.target.value)} spellCheck={false} className="h-full min-w-0 flex-1 bg-transparent text-[11px] font-medium uppercase tracking-wide outline-none" />
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">Shadow tint that pools into the valleys (deep navy/plum reads premium).</p>
            </section>

            {/* Numeric params */}
            {SLIDERS.map((s) => (
              <section key={s.key} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-medium">{s.label}</span>
                  <input type="text" inputMode="decimal" value={String(num(s.key))} onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v)) set(s.key, v as any); }} className="h-7 w-16 rounded-md border border-border bg-background px-2 text-right text-[11px] outline-none focus:border-primary/60" />
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={num(s.key)} onChange={(e) => set(s.key, parseFloat(e.target.value) as any)} className="w-full cursor-pointer accent-[hsl(var(--primary))]" />
                <p className="text-[11px] leading-snug text-muted-foreground">{s.help}</p>
              </section>
            ))}

            {/* Apply */}
            <section className="space-y-2 border-t border-border pt-4">
              <Button onClick={applyDevice} className="w-full gap-1.5 theme-btn-gradient border-0"><Monitor size={15} /> Apply on this device</Button>
              {isAdmin
                ? <Button onClick={applySite} variant="outline" className="w-full gap-1.5"><Globe size={15} /> Apply site-wide (all visitors)</Button>
                : <p className="text-[11px] text-muted-foreground">Sign in as an admin to apply this for all visitors. “On this device” previews it for you only.</p>}
              <button onClick={clearDevice} className="w-full text-center text-xs text-muted-foreground hover:text-foreground pt-1">Clear my device override</button>
              {savedMsg && <p className="md:hidden text-xs text-primary flex items-center gap-1 pt-1"><Check size={13} /> {savedMsg}</p>}
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
