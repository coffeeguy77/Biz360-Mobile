import { useEffect, useRef, useState } from "react";
import { getStoredEffect, effectKind, BG_CHANGE_EVENT } from "@/lib/bg";

/** Read the active theme's gradient colours from the CSS variables. */
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  const from = v("--grad-from") || "213 94% 68%";
  const via = v("--grad-via") || "200 90% 60%";
  const to = v("--grad-to") || "142 72% 45%";
  const glow = v("--glow") || from;
  return {
    from: `hsl(${from})`,
    via: `hsl(${via})`,
    to: `hsl(${to})`,
    glow: `hsl(${glow})`,
    fromA: (a: number) => `hsl(${from} / ${a})`,
    viaA: (a: number) => `hsl(${via} / ${a})`,
    toA: (a: number) => `hsl(${to} / ${a})`,
    glowA: (a: number) => `hsl(${glow} / ${a})`,
  };
}

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Site-wide animated background. Fixed behind all content (-z-10), pointer
 * transparent. CSS effects are handled by classes in index.css; canvas effects
 * (dot-grid-wave, glow-orbs) are drawn here, crisp on retina and theme-aware.
 */
export function AnimatedBackground() {
  const [effect, setEffect] = useState<string>(() =>
    typeof window !== "undefined" ? getStoredEffect() : "dot-grid-wave"
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Track the chosen effect (initial + live changes from the picker).
  useEffect(() => {
    setEffect(getStoredEffect());
    const onChange = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      setEffect(id || getStoredEffect());
    };
    window.addEventListener(BG_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(BG_CHANGE_EVENT, onChange);
  }, []);

  // Canvas renderers for the two motion effects.
  useEffect(() => {
    const kind = effectKind(effect);
    if (kind !== "canvas") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let colors = readColors();
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = Math.max(1, Math.floor(w * dpr));
      canvas!.height = Math.max(1, Math.floor(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    // Refresh colours when the colour theme (html class) changes.
    const obs = new MutationObserver(() => { colors = readColors(); if (orbs) orbs.forEach((o, i) => (o.color = orbColor(i))); });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", resize);

    let raf = 0;
    const start = performance.now();

    // ── glow-orbs setup ──
    type Orb = { x: number; y: number; vx: number; vy: number; r: number; color: string };
    let orbs: Orb[] | null = null;
    function orbColor(i: number) {
      const c = [colors.from, colors.via, colors.to, colors.glow];
      return c[i % c.length];
    }
    if (effect === "glow-orbs") {
      const n = 5;
      orbs = Array.from({ length: n }, (_, i) => ({
        x: (0.15 + 0.7 * ((i * 0.37) % 1)) * w,
        y: (0.15 + 0.7 * ((i * 0.61) % 1)) * h,
        vx: (i % 2 ? 1 : -1) * (6 + i * 2),
        vy: (i % 3 ? -1 : 1) * (5 + i * 2),
        r: Math.min(w, h) * (0.18 + 0.05 * (i % 3)),
        color: orbColor(i),
      }));
    }

    function drawDots(t: number) {
      ctx!.clearRect(0, 0, w, h);
      const spacing = 30;
      const cols = Math.ceil(w / spacing) + 1;
      const rows = Math.ceil(h / spacing) + 1;
      for (let iy = 0; iy < rows; iy++) {
        for (let ix = 0; ix < cols; ix++) {
          const px = ix * spacing;
          const py = iy * spacing;
          const phase = Math.sin(ix * 0.5 + iy * 0.5 - t * 1.6);
          const n01 = (phase + 1) / 2; // 0..1
          const r = 0.8 + n01 * 2.1;
          const a = 0.08 + n01 * 0.22;
          // colour shifts left→right across the grid
          const frac = ix / cols;
          ctx!.fillStyle = frac < 0.5 ? colors.fromA(a) : colors.toA(a);
          ctx!.beginPath();
          ctx!.arc(px, py, r, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
    }

    function drawOrbs() {
      ctx!.clearRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";
      for (const o of orbs!) {
        const g = ctx!.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, o.color.replace("hsl(", "hsla(").replace(")", ", 0.30)"));
        g.addColorStop(0.6, o.color.replace("hsl(", "hsla(").replace(")", ", 0.08)"));
        g.addColorStop(1, o.color.replace("hsl(", "hsla(").replace(")", ", 0)"));
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalCompositeOperation = "source-over";
    }

    function stepOrbs(dt: number) {
      for (const o of orbs!) {
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        if (o.x < -o.r) o.x = w + o.r;
        if (o.x > w + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = h + o.r;
        if (o.y > h + o.r) o.y = -o.r;
      }
    }

    let last = start;
    function frame(now: number) {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (effect === "dot-grid-wave") drawDots(t);
      else if (effect === "glow-orbs") { stepOrbs(dt); drawOrbs(); }
      raf = requestAnimationFrame(frame);
    }

    if (prefersReduced()) {
      // Draw a single static frame, no animation loop.
      if (effect === "dot-grid-wave") drawDots(0);
      else if (effect === "glow-orbs") drawOrbs();
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      obs.disconnect();
    };
  }, [effect]);

  const kind = effectKind(effect);

  return (
    <div className="bg-fx-root" aria-hidden="true">
      {kind === "canvas" ? (
        <canvas ref={canvasRef} className="bg-fx-layer" />
      ) : effect !== "none" ? (
        <div className={`bg-fx-layer bg-fx-${effect}`} />
      ) : null}
    </div>
  );
}
