import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredEffect, effectKind, BG_CHANGE_EVENT } from "@/lib/bg";
import { GLBackground } from "@/components/GLBackground";

/** Read the active theme's gradient colours from the CSS variables. */
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  const from = v("--grad-from") || "213 94% 68%";
  const via = v("--grad-via") || "200 90% 60%";
  const to = v("--grad-to") || "142 72% 45%";
  const glow = v("--glow") || from;
  return {
    from: `hsl(${from})`, via: `hsl(${via})`, to: `hsl(${to})`, glow: `hsl(${glow})`,
    fromA: (a: number) => `hsl(${from} / ${a})`,
    toA: (a: number) => `hsl(${to} / ${a})`,
  };
}

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Site-wide interactive animated background (fixed, -z-10, click-through).
 * mesh-gradient / topo-lines → WebGL (GLBackground). dot-grid-wave / glow-orbs →
 * 2D canvas here (full viewport, cursor-reactive). halftone → CSS (mask follows
 * the cursor via --fx-mx/--fx-my written on <html>). All respect reduced-motion.
 */
export function AnimatedBackground() {
  const [effect, setEffect] = useState<string>(() =>
    typeof window !== "undefined" ? getStoredEffect() : "dot-grid-wave"
  );
  const [glFailed, setGlFailed] = useState(false);
  const onGlUnsupported = useCallback(() => setGlFailed(true), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = useRef({ tx: 0, ty: 0, x: 0, y: 0, active: false });

  useEffect(() => {
    setEffect(getStoredEffect());
    const onChange = (e: Event) => { setEffect(((e as CustomEvent).detail as string) || getStoredEffect()); setGlFailed(false); };
    window.addEventListener(BG_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(BG_CHANGE_EVENT, onChange);
  }, []);

  // Global pointer tracking → shared ref + (rAF-throttled) CSS custom props on
  // <html> for the CSS effects. Listens on window (background is click-through).
  useEffect(() => {
    const root = document.documentElement;
    const p = pointer.current;
    p.tx = window.innerWidth / 2; p.ty = window.innerHeight * 0.4;
    p.x = p.tx; p.y = p.ty;
    let pending = false;
    function flushVars() {
      pending = false;
      root.style.setProperty("--fx-mx", `${((p.tx / Math.max(1, window.innerWidth)) * 100).toFixed(2)}%`);
      root.style.setProperty("--fx-my", `${((p.ty / Math.max(1, window.innerHeight)) * 100).toFixed(2)}%`);
    }
    flushVars();
    function onMove(e: PointerEvent) {
      p.tx = e.clientX; p.ty = e.clientY; p.active = true;
      if (!pending) { pending = true; requestAnimationFrame(flushVars); }
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
    };
  }, []);

  // 2D canvas renderers (dot-grid-wave, glow-orbs).
  useEffect(() => {
    if (effectKind(effect) !== "canvas") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let colors = readColors();
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const p = pointer.current;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas!.width = Math.max(1, Math.floor(w * dpr));
      canvas!.height = Math.max(1, Math.floor(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const obs = new MutationObserver(() => {
      colors = readColors();
      if (orbs) orbs.forEach((o, i) => (o.color = orbColor(i)));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", resize);

    let raf = 0;
    const start = performance.now();

    type Orb = { x: number; y: number; vx: number; vy: number; r: number; color: string };
    let orbs: Orb[] | null = null;
    function orbColor(i: number) {
      const c = [colors.from, colors.via, colors.to, colors.glow];
      return c[i % c.length];
    }
    if (effect === "glow-orbs") {
      orbs = Array.from({ length: 5 }, (_, i) => ({
        x: (0.15 + 0.7 * ((i * 0.37) % 1)) * w,
        y: (0.15 + 0.7 * ((i * 0.61) % 1)) * h,
        vx: (i % 2 ? 1 : -1) * (10 + i * 3),
        vy: (i % 3 ? -1 : 1) * (9 + i * 3),
        r: Math.max(160, Math.min(w, h) * (0.22 + 0.05 * (i % 3))),
        color: orbColor(i),
      }));
    }

    function drawDots(t: number) {
      ctx!.clearRect(0, 0, w, h);
      p.x += (p.tx - p.x) * 0.12; p.y += (p.ty - p.y) * 0.12;
      const spacing = 30, cols = Math.ceil(w / spacing) + 1, rows = Math.ceil(h / spacing) + 1;
      const R = 170, R2 = R * R;
      for (let iy = 0; iy < rows; iy++) {
        for (let ix = 0; ix < cols; ix++) {
          const px = ix * spacing, py = iy * spacing;
          const phase = Math.sin(ix * 0.5 + iy * 0.5 - t * 1.6);
          const n01 = (phase + 1) / 2;
          let r = 0.8 + n01 * 2.1, a = 0.08 + n01 * 0.22;
          const dx = px - p.x, dy = py - p.y, d2 = dx * dx + dy * dy;
          let ox = 0, oy = 0;
          if (d2 < R2) {
            const f = 1 - Math.sqrt(d2) / R;
            r += f * 3.2; a = Math.min(0.9, a + f * 0.5);
            const inv = (f * 6) / (Math.sqrt(d2) || 1); ox = dx * inv; oy = dy * inv;
          }
          ctx!.fillStyle = ix / cols < 0.5 ? colors.fromA(a) : colors.toA(a);
          ctx!.beginPath(); ctx!.arc(px + ox, py + oy, r, 0, Math.PI * 2); ctx!.fill();
        }
      }
    }

    // Insert the alpha with the correct slash syntax for space-separated hsl()
    // (e.g. "hsl(213 94% 68%)" → "hsl(213 94% 68% / 0.42)"). A comma-appended
    // alpha is invalid here and made addColorStop throw, so orbs never drew.
    function stops(color: string, a: number) { return color.replace(/\)\s*$/, ` / ${a})`); }

    function drawOrbs() {
      ctx!.clearRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";
      for (const o of orbs!) {
        const g = ctx!.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, stops(o.color, 0.42));
        g.addColorStop(0.55, stops(o.color, 0.12));
        g.addColorStop(1, stops(o.color, 0));
        ctx!.fillStyle = g;
        ctx!.beginPath(); ctx!.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx!.fill();
      }
      // Brighter cursor-tracking orb.
      p.x += (p.tx - p.x) * 0.14; p.y += (p.ty - p.y) * 0.14;
      const cr = Math.max(180, Math.min(w, h) * 0.18);
      const cg = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, cr);
      cg.addColorStop(0, stops(colors.glow, 0.5));
      cg.addColorStop(0.55, stops(colors.glow, 0.12));
      cg.addColorStop(1, stops(colors.glow, 0));
      ctx!.fillStyle = cg;
      ctx!.beginPath(); ctx!.arc(p.x, p.y, cr, 0, Math.PI * 2); ctx!.fill();
      ctx!.globalCompositeOperation = "source-over";
    }

    function stepOrbs(dt: number) {
      for (const o of orbs!) {
        const dx = p.tx - o.x, dy = p.ty - o.y;
        o.vx = (o.vx + dx * 0.35 * dt) * 0.99;
        o.vy = (o.vy + dy * 0.35 * dt) * 0.99;
        const sp = Math.hypot(o.vx, o.vy), max = 70;
        if (sp > max) { o.vx = (o.vx / sp) * max; o.vy = (o.vy / sp) * max; }
        o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.x < -o.r) o.x = w + o.r; if (o.x > w + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = h + o.r; if (o.y > h + o.r) o.y = -o.r;
      }
    }

    let last = start;
    function frame(now: number) {
      if (document.hidden) { raf = requestAnimationFrame(frame); return; }
      const t = (now - start) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (effect === "dot-grid-wave") drawDots(t);
      else if (effect === "glow-orbs") { stepOrbs(dt); drawOrbs(); }
      raf = requestAnimationFrame(frame);
    }
    if (prefersReduced()) { if (effect === "dot-grid-wave") drawDots(0); else drawOrbs(); }
    else raf = requestAnimationFrame(frame);

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); obs.disconnect(); };
  }, [effect]);

  const kind = effectKind(effect);
  const showGL = kind === "webgl" && !glFailed;

  return (
    <div className="bg-fx-root" aria-hidden="true">
      {showGL ? (
        <GLBackground mode={effect === "topo-lines" ? "topo" : "mesh"} onUnsupported={onGlUnsupported} />
      ) : kind === "canvas" ? (
        <canvas ref={canvasRef} className="bg-fx-canvas" />
      ) : kind === "webgl" && glFailed ? (
        // CSS fallback if WebGL is unavailable.
        <div className={`bg-fx-layer bg-fx-${effect}`} />
      ) : effect !== "none" ? (
        <div className={`bg-fx-layer bg-fx-${effect}`} />
      ) : null}
    </div>
  );
}
