import { useEffect, useRef } from "react";
import { getMeshOverride, getMeshParams, MESH_CHANGE_EVENT } from "@/lib/mesh";

/** Parse an "H S% L%" CSS value into [r,g,b] 0..1. */
function hslStrToRgb(s: string): [number, number, number] {
  const m = (s || "").trim().match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return [0.2, 0.4, 0.9];
  const h = +m[1] / 360, sat = +m[2] / 100, l = +m[3] / 100;
  if (sat === 0) return [l, l, l];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

/** "#rrggbb" → [r,g,b] 0..1. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || "").replace("#", "").trim();
  if (h.length < 6) return [0.2, 0.4, 0.9];
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

/** Live-tunable mesh parameters (mirrors the remix playground controls). */
export interface MeshConfig {
  colors: string[];      // 2–5 hex hues
  bg: string;            // hex shadow tint
  bgAlpha: number;       // 0–1
  speed: number;         // 0.05–2
  scale: number;         // 0.5–3
  warp: number;          // 0–1.5
  softness: number;      // 0.2–1
  contrast: number;      // 0.5–2.5
  grain: number;         // 0–0.2
  mouse: number;         // 0–1
}

export const MESH_DEFAULTS: Omit<MeshConfig, "colors" | "bg"> = {
  bgAlpha: 1, speed: 0.5, scale: 1.2, warp: 0.8, softness: 0.8, contrast: 1.1, grain: 0.05, mouse: 0.7,
};

/** Read the active theme's gradient colours from CSS variables (global default). */
function themeColors(): { colors: [number, number, number][]; bg: [number, number, number] } {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    colors: [
      hslStrToRgb(v("--grad-from") || "213 94% 68%"),
      hslStrToRgb(v("--grad-via") || "200 90% 60%"),
      hslStrToRgb(v("--grad-to") || "142 72% 45%"),
      hslStrToRgb(v("--glow") || v("--grad-from") || "213 94% 68%"),
    ],
    bg: hslStrToRgb(v("--background") || "222 47% 7%"),
  };
}


const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform float u_mouseOn;
uniform vec3 u_c0, u_c1, u_c2, u_c3, u_c4, u_bg; uniform int u_mode;
uniform float u_ncolors, u_bgAlpha, u_speed, u_scale, u_warp, u_softness, u_contrast, u_grain, u_mouseAmt;

float hash(vec2 i){ return fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 x){
  vec2 i = floor(x); vec2 f = fract(x);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 5; i++){ v += a * vnoise(p); p *= 2.02; a *= 0.5; } return v; }
// Smooth, low-octave fbm → broad sweeping colour pools (no fine filaments).
float sfbm(vec2 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 3; i++){ v += a * vnoise(p); p *= 1.9; a *= 0.5; } return v; }

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 asp = vec2(u_res.x / u_res.y, 1.0);
  vec2 m = u_mouse / u_res; m.y = 1.0 - m.y;

  if(u_mode == 0){
    // ── Silky broad mesh gradient — big soft colour pools that MIGRATE across
    // the screen like slow smoke (drift), with new hues morphing in. ──
    float sp = u_speed;
    float freq = u_scale * 0.96;
    float warpAmt = u_warp * 1.375;
    float hw = 0.06 + u_softness * 0.225;           // smoothstep half-width (softness)
    vec2 p = uv * asp * freq;
    float t = u_time * 0.10 * sp;
    vec2 dr = vec2(0.056, 0.032) * sp * u_time;      // slow global advection
    vec2 q = vec2(sfbm(p + dr + vec2(0.0, t)), sfbm(p + dr * 0.8 + vec2(3.3, -t)));
    vec2 pw = p + (q - 0.5) * warpAmt;
    float pull = 0.0;
    if(u_mouseOn > 0.5){ float d = distance(uv, m); pull = exp(-d * d * 7.0) * u_mouseAmt; pw += (m - uv) * pull * 1.1; }
    // Each colour pool rides its own slow current → hues drift in and dissolve.
    float a  = sfbm(pw + dr * 1.15 + vec2(1.7, 9.2));
    float b  = sfbm(pw * 1.12 + vec2(-dr.y, dr.x) * 1.5 + vec2(7.4, 2.1) + 0.25 * t);
    float c  = sfbm(pw * 0.92 - dr * 0.7 + vec2(2.8, 5.5) - 0.20 * t);
    float d2 = sfbm(pw * 1.05 + dr * 0.5 + vec2(4.9, 1.2) + 0.15 * t);
    vec3 col = u_c0;
    col = mix(col, u_c1, smoothstep(0.5 - hw, 0.5 + hw, a));
    if(u_ncolors > 2.5) col = mix(col, u_c2, smoothstep(0.5 - hw, 0.5 + hw, b));
    if(u_ncolors > 3.5) col = mix(col, u_c3, smoothstep(0.5 - hw, 0.5 + hw, c));
    if(u_ncolors > 4.5) col = mix(col, u_c4, smoothstep(0.5 - hw, 0.5 + hw, d2));
    // Gentle enrich — silky, luminous, not neon.
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = clamp(mix(vec3(lum), col, 1.4), 0.0, 1.0);
    col = clamp((col - 0.5) * u_contrast + 0.5, 0.0, 1.0);
    // Soft shadow tint pools into the low valleys (smoky dark region); bright
    // elsewhere. Cursor eases the field toward it and brightens local pigment.
    float depth = smoothstep(0.20, 0.80, c * 0.5 + b * 0.5);
    float bright = mix(0.47, 1.0, depth) + pull * 0.5;
    col = mix(u_bg, col, clamp(bright, 0.0, 1.0));
    float lift = smoothstep(0.56, 0.92, max(a, max(b, c)));
    col += lift * 0.10 * col;
    float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
    col += (g - 0.5) * u_grain;
    float alpha = mix(u_bgAlpha, 1.0, clamp(bright, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
  } else {
    // ── Morphing topographic contour lines ──
    vec2 p = uv * asp * 3.0;
    float t = u_time * 0.025;
    vec2 q = vec2(fbm(p + t), fbm(p + vec2(3.1, -t)));
    float h = fbm(p + 1.5 * q);
    if(u_mouseOn > 0.5){ vec2 mp = m * asp * 3.0; float d = distance(p, mp); h += exp(-d * d * 1.1) * 0.55; }
    float dens = 15.0;
    float hv = h * dens;
    float fw = fwidth(hv);
    float fpart = fract(hv);
    float dist = min(fpart, 1.0 - fpart);
    float line = 1.0 - smoothstep(0.0, fw * 1.6, dist);
    float idx = step(mod(floor(hv), 5.0), 0.5);
    float ink = line * (0.5 + 0.5 * idx);
    vec3 tint = mix(u_bg, mix(u_c2, u_c0, clamp(h, 0.0, 1.0)), 0.14);
    vec3 inkCol = mix(u_c0, u_c3, 0.4);
    vec3 col = mix(tint, inkCol, clamp(ink * 0.75, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("[GLBackground] shader error", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/**
 * WebGL background for the mesh-gradient and topo-lines effects — silky,
 * drifting and mouse-reactive, themed from CSS colour variables OR fully driven
 * by a `config` prop (used by the remix playground). Sizes to its parent, so it
 * works both full-viewport (site background) and inside a bounded preview box.
 */
export function GLBackground({
  mode, onUnsupported, config,
}: {
  mode: "mesh" | "topo";
  onUnsupported: () => void;
  config?: MeshConfig | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cfgRef = useRef<MeshConfig | null | undefined>(config);
  cfgRef.current = config;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = (canvas.getContext("webgl", { antialias: true, premultipliedAlpha: false, alpha: true }) ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) { onUnsupported(); return; }
    gl.getExtension("OES_standard_derivatives");

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { onUnsupported(); return; }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { onUnsupported(); return; }
    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = {
      res: gl.getUniformLocation(prog, "u_res"),
      time: gl.getUniformLocation(prog, "u_time"),
      mouse: gl.getUniformLocation(prog, "u_mouse"),
      mouseOn: gl.getUniformLocation(prog, "u_mouseOn"),
      c0: gl.getUniformLocation(prog, "u_c0"), c1: gl.getUniformLocation(prog, "u_c1"),
      c2: gl.getUniformLocation(prog, "u_c2"), c3: gl.getUniformLocation(prog, "u_c3"),
      c4: gl.getUniformLocation(prog, "u_c4"),
      bg: gl.getUniformLocation(prog, "u_bg"), mode: gl.getUniformLocation(prog, "u_mode"),
      ncolors: gl.getUniformLocation(prog, "u_ncolors"), bgAlpha: gl.getUniformLocation(prog, "u_bgAlpha"),
      speed: gl.getUniformLocation(prog, "u_speed"), scale: gl.getUniformLocation(prog, "u_scale"),
      warp: gl.getUniformLocation(prog, "u_warp"), softness: gl.getUniformLocation(prog, "u_softness"),
      contrast: gl.getUniformLocation(prog, "u_contrast"), grain: gl.getUniformLocation(prog, "u_grain"),
      mouseAmt: gl.getUniformLocation(prog, "u_mouseAmt"),
    };
    gl.uniform1i(U.mode, mode === "mesh" ? 0 : 1);

    // Resolve colours + numeric params from config (playground) or theme + saved
    // override (global). The override is cached and refreshed on a change event.
    let override = getMeshOverride();
    function resolve() {
      const cfg = cfgRef.current;
      if (cfg && Array.isArray(cfg.colors) && cfg.colors.length >= 2) {
        const cols = cfg.colors.slice(0, 5).map(hexToRgb);
        return { cols, bg: hexToRgb(cfg.bg), n: cols.length, p: cfg as Omit<MeshConfig, "colors" | "bg"> };
      }
      const p = getMeshParams();
      if (override.colors && override.colors.length >= 2) {
        const cols = override.colors.slice(0, 5).map(hexToRgb);
        const bg = override.bg ? hexToRgb(override.bg) : themeColors().bg;
        return { cols, bg, n: cols.length, p };
      }
      const tc = themeColors();
      return { cols: tc.colors, bg: tc.bg, n: 4, p };
    }

    function pushUniforms() {
      const { cols, bg, n, p } = resolve();
      const c = (i: number) => cols[Math.min(i, cols.length - 1)];
      gl!.uniform3fv(U.c0, c(0)); gl!.uniform3fv(U.c1, c(1));
      gl!.uniform3fv(U.c2, c(2)); gl!.uniform3fv(U.c3, c(3)); gl!.uniform3fv(U.c4, c(4));
      gl!.uniform3fv(U.bg, bg);
      gl!.uniform1f(U.ncolors, n);
      gl!.uniform1f(U.bgAlpha, p.bgAlpha);
      gl!.uniform1f(U.speed, p.speed);
      gl!.uniform1f(U.scale, p.scale);
      gl!.uniform1f(U.warp, p.warp);
      gl!.uniform1f(U.softness, p.softness);
      gl!.uniform1f(U.contrast, p.contrast);
      gl!.uniform1f(U.grain, p.grain);
      gl!.uniform1f(U.mouseAmt, p.mouse);
    }
    pushUniforms();

    const obs = new MutationObserver(pushUniforms);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const onMeshChange = () => { override = getMeshOverride(); pushUniforms(); };
    window.addEventListener(MESH_CHANGE_EVENT, onMeshChange);

    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function sizeBox() {
      const parent = canvas!.parentElement;
      const rect = parent ? parent.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
      return { bw: Math.max(1, rect.width), bh: Math.max(1, rect.height) };
    }
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { bw, bh } = sizeBox();
      w = bw; h = bh;
      canvas!.width = Math.floor(w * dpr); canvas!.height = Math.floor(h * dpr);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.uniform2f(U.res, canvas!.width, canvas!.height);
    }
    resize();
    window.addEventListener("resize", resize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement);

    const mouse = { x: w / 2, y: h * 0.4, on: 0, tx: w / 2, ty: h * 0.4 };
    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse.tx = (e.clientX - rect.left) * dpr; mouse.ty = (e.clientY - rect.top) * dpr; mouse.on = 1;
    }
    window.addEventListener("pointermove", onMove, { passive: true });

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    function frame(now: number) {
      if (document.hidden) { raf = requestAnimationFrame(frame); return; }
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      pushUniforms(); // cheap; lets playground sliders update live
      gl!.uniform1f(U.time, (now - start) / 1000);
      gl!.uniform2f(U.mouse, mouse.x, mouse.y);
      gl!.uniform1f(U.mouseOn, mouse.on);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      if (!reduced) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener(MESH_CHANGE_EVENT, onMeshChange);
      obs.disconnect();
      ro?.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [mode, onUnsupported]);

  return <canvas ref={canvasRef} className="bg-fx-canvas" />;
}
