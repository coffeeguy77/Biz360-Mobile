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
    toA: (a: number) => `hsl(${to} / ${a})`,
  };
}

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Site-wide interactive animated background. Fixed behind all content (-z-10),
 * pointer transparent. It reacts to the cursor: canvas effects (dots swell &
 * brighten under the pointer, orbs drift toward it) read a shared pointer ref;
 * CSS effects (halftone/mesh/topo) follow the cursor via the --fx-mx/--fx-my
 * custom properties written on <html>. All respect reduced-motion.
 */
export function AnimatedBackground() {
  const [effect, setEffect] = useState<string>(() =>
    typeof window !== "undefined" ? getStoredEffect() : "dot-grid-wave"
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Shared pointer state (viewport px). target = latest; smooth = eased.
  const pointer = useRef({ tx: 0, ty: 0, x: 0, y: 0, active: false });

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

  // Global pointer tracking → updates the shared ref and, throttled by rAF, the
  // CSS custom properties that the CSS effects follow. Listens on window because
  // the background itself is pointer-events:none.
  useEffect(() => {
    const root = document.documentElement;
    const p = pointer.current;
    p.tx = window.innerWidth / 2; p.ty = window.innerHeight * 0.4;
    p.x = p.tx; p.y = p.ty;
    let pending = false;
    function flushVars() {
      pending = false;
      const mx = (p.tx / Math.max(1, window.innerWidth)) * 100;
      const my = (p.ty / Math.max(1, window.innerHeight)) * 100;
      root.style.setProperty("--fx-mx", `${mx.toFixed(2)}%`);
      root.style.setProperty("--fx-my", `${my.toFixed(2)}%`);
    }
    flushVars();
    function onMove(e: PointerEvent) {
      p.tx = e.clientX; p.ty = e.clientY; p.active = true;
      if (!pending) { pending = true; requestAnimationFrame(flushVars); }
    }
    function onLeave() { p.active = false; }
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerout", onLeave, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerout", onLeave);
    };
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
    const p = pointer.current;

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
    const obs = new MutationObserver(() => {
      colors = readColors();
      if (orbs) orbs.forEach((o, i) => (o.color = orbColor(i)));
    });
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
      // Ease the interaction point toward the pointer for a smooth trail.
      p.x += (p.tx - p.x) * 0.12;
      p.y += (p.ty - p.y) * 0.12;
      const spacing = 30;
      const cols = Math.ceil(w / spacing) + 1;
      const rows = Math.ceil(h / spacing) + 1;
      const R = 170;          // cursor influence radius
      const R2 = R * R;
      for (let iy = 0; iy < rows; iy++) {
        for (let ix = 0; ix < cols; ix++) {
          const px = ix * spacing;
          const py = iy * spacing;
          const phase = Math.sin(ix * 0.5 + iy * 0.5 - t * 1.6);
          const n01 = (phase + 1) / 2; // 0..1
          let r = 0.8 + n01 * 2.1;
          let a = 0.08 + n01 * 0.22;
          // Cursor interaction: dots near the pointer swell and brighten, and
          // nudge slightly outward from it (a soft ripple/spotlight).
          const dx = px - p.x, dy = py - p.y;
          const d2 = dx * dx + dy * dy;
          let ox = 0, oy = 0;
          if (d2 < R2) {
            const f = 1 - Math.sqrt(d2) / R; // 0..1
            r += f * 3.2;
            a = Math.min(0.9, a + f * 0.5);
            const push = f * 6;
            const inv = 1 / (Math.sqrt(d2) || 1);
            ox = dx * inv * push;
            oy = dy * inv * push;
          }
          const frac = ix / cols;
          ctx!.fillStyle = frac < 0.5 ? colors.fromA(a) : colors.toA(a);
          ctx!.beginPath();
          ctx!.arc(px + ox, py + oy, r, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
    }

    function toRgbaStops(color: string) {
      return {
        a30: color.replace("hsl(", "hsla(").replace(")", ", 0.30)"),
        a08: color.replace("hsl(", "hsla(").replace(")", ", 0.08)"),
        a00: color.replace("hsl(", "hsla(").replace(")", ", 0)"),
      };
    }

    function drawOrbs() {
      ctx!.clearRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";
      for (const o of orbs!) {
        const s = toRgbaStops(o.color);
        const g = ctx!.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, s.a30);
        g.addColorStop(0.6, s.a08);
        g.addColorStop(1, s.a00);
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      // A brighter orb that tracks the cursor.
      p.x += (p.tx - p.x) * 0.14;
      p.y += (p.ty - p.y) * 0.14;
      const cs = toRgbaStops(colors.glow);
      const cr = Math.min(w, h) * 0.16;
      const cg = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, cr);
      cg.addColorStop(0, colors.glow.replace("hsl(", "hsla(").replace(")", ", 0.34)"));
      cg.addColorStop(0.55, cs.a08);
      cg.addColorStop(1, cs.a00);
      ctx!.fillStyle = cg;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, cr, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalCompositeOperation = "source-over";
    }

    function stepOrbs(dt: number) {
      for (const o of orbs!) {
        // Gentle, capped attraction toward the cursor layered on the base drift.
        const dx = p.tx - o.x, dy = p.ty - o.y;
        o.vx = (o.vx + dx * 0.35 * dt) * 0.99;
        o.vy = (o.vy + dy * 0.35 * dt) * 0.99;
        const sp = Math.hypot(o.vx, o.vy), max = 60;
        if (sp > max) { o.vx = (o.vx / sp) * max; o.vy = (o.vy / sp) * max; }
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
        <>
          <div className={`bg-fx-layer bg-fx-${effect}`} />
          {(effect === "mesh-gradient" || effect === "topo-lines") && (
            <div className={`bg-fx-cursor bg-fx-${effect}-cursor`} />
          )}
        </>
      ) : null}
    </div>
  );
}
