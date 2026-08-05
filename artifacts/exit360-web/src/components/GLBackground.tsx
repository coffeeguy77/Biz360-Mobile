import { useEffect, useRef } from "react";

/** Parse an "H S% L%" CSS value into linear-ish [r,g,b] 0..1. */
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

function readGLColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    c0: hslStrToRgb(v("--grad-from") || "213 94% 68%"),
    c1: hslStrToRgb(v("--grad-via") || "200 90% 60%"),
    c2: hslStrToRgb(v("--grad-to") || "142 72% 45%"),
    c3: hslStrToRgb(v("--glow") || v("--grad-from") || "213 94% 68%"),
    bg: hslStrToRgb(v("--background") || "222 47% 7%"),
  };
}

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform float u_mouseOn;
uniform vec3 u_c0, u_c1, u_c2, u_c3, u_bg; uniform int u_mode;

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
    // ── Silky broad mesh gradient (soft sweeping colour pools, Stripe-grade) ──
    // Low frequency + gentle single-level domain warp = big dreamy colour pools
    // with soft organic boundaries — NOT marbled turbulence.
    vec2 p = uv * asp * 1.15;
    float t = u_time * 0.05;
    vec2 q = vec2(sfbm(p + vec2(0.0, t)), sfbm(p + vec2(3.3, -t)));
    vec2 pw = p + (q - 0.5) * 1.1;
    float pull = 0.0;
    if(u_mouseOn > 0.5){ float d = distance(uv, m); pull = exp(-d * d * 7.0) * 0.5; pw += (m - uv) * pull * 0.8; }
    float a = sfbm(pw + vec2(1.7, 9.2));
    float b = sfbm(pw * 1.12 + vec2(7.4, 2.1) + 0.25 * t);
    float c = sfbm(pw * 0.92 + vec2(2.8, 5.5) - 0.20 * t);
    // Wide, dreamy blends between big colour pools (high softness).
    vec3 col = mix(u_c0, u_c1, smoothstep(0.26, 0.74, a));
    col = mix(col, u_c2, smoothstep(0.28, 0.74, b));
    col = mix(col, u_c3, smoothstep(0.30, 0.76, c));
    // Gentle enrich — silky, luminous, not neon.
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = clamp(mix(vec3(lum), col, 1.4), 0.0, 1.0);
    col = clamp((col - 0.5) * 1.08 + 0.5, 0.0, 1.0);
    // Soft shadow tint pools into the low valleys (one smoky dark region); bright
    // elsewhere. Cursor eases the field toward it and brightens local pigment.
    float depth = smoothstep(0.20, 0.80, c * 0.5 + b * 0.5);
    float bright = mix(0.47, 1.0, depth) + pull * 0.4;
    col = mix(u_bg, col, clamp(bright, 0.0, 1.0));
    // Soft luminous lift on the brightest pools (broad glow, not filaments).
    float lift = smoothstep(0.56, 0.92, max(a, max(b, c)));
    col += lift * 0.10 * col;
    float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + u_time) * 43758.5453);
    col += (g - 0.5) * 0.025;
    gl_FragColor = vec4(col, 1.0);
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
    // Heavier index contour every 5th line.
    float idx = step(mod(floor(hv), 5.0), 0.5);
    float ink = line * (0.5 + 0.5 * idx);
    // Subtle hypsometric tint bands between contours.
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
 * domain-warped and mouse-reactive, themed from the CSS colour variables.
 * Falls back to a CSS class (rendered by the parent) if WebGL is unavailable.
 */
export function GLBackground({ mode, onUnsupported }: { mode: "mesh" | "topo"; onUnsupported: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = (canvas.getContext("webgl", { antialias: true, premultipliedAlpha: false }) ||
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
      bg: gl.getUniformLocation(prog, "u_bg"), mode: gl.getUniformLocation(prog, "u_mode"),
    };
    gl.uniform1i(U.mode, mode === "mesh" ? 0 : 1);

    let colors = readGLColors();
    function pushColors() {
      gl!.uniform3fv(U.c0, colors.c0); gl!.uniform3fv(U.c1, colors.c1);
      gl!.uniform3fv(U.c2, colors.c2); gl!.uniform3fv(U.c3, colors.c3);
      gl!.uniform3fv(U.bg, colors.bg);
    }
    pushColors();

    const obs = new MutationObserver(() => { colors = readGLColors(); pushColors(); });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas!.width = Math.floor(w * dpr); canvas!.height = Math.floor(h * dpr);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.uniform2f(U.res, canvas!.width, canvas!.height);
    }
    resize();
    window.addEventListener("resize", resize);

    const mouse = { x: w / 2, y: h * 0.4, on: 0, tx: w / 2, ty: h * 0.4 };
    function onMove(e: PointerEvent) { mouse.tx = e.clientX * dpr; mouse.ty = e.clientY * dpr; mouse.on = 1; }
    window.addEventListener("pointermove", onMove, { passive: true });

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    function frame(now: number) {
      if (document.hidden) { raf = requestAnimationFrame(frame); return; }
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      gl!.uniform1f(U.time, (now - start) / 1000);
      gl!.uniform2f(U.mouse, mouse.x, mouse.y);
      gl!.uniform1f(U.mouseOn, mouse.on);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      if (!reduced) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    if (reduced) { /* draw one frame then stop */ }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      obs.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [mode, onUnsupported]);

  return <canvas ref={canvasRef} className="bg-fx-canvas" />;
}
