import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, Plus, Trash2, Star, Eye, EyeOff, Loader2, Save, Settings2, Upload,
  MapPin, Navigation, Mic, Image as ImageIcon, FileText, ExternalLink, Move, X,
  ChevronUp, ChevronDown, Compass, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";

const TOKEN_KEY = "biz360_web_auth_token";
const DIRS_4 = ["Front", "Right", "Back", "Left"];
const DIRS_8 = ["Front", "Front-Right", "Right", "Back-Right", "Back", "Back-Left", "Left", "Front-Left"];

// Full pin catalogue (mirrors the app).
const PIN_TYPES: { type: string; label: string; color: string; group: "primary" | "info" | "link" }[] = [
  { type: "navigation", label: "Navigation", color: "#2563EB", group: "primary" },
  { type: "look", label: "Look", color: "#0EA5E9", group: "primary" },
  { type: "audio", label: "Listen", color: "#EC4899", group: "primary" },
  { type: "equipment", label: "Equipment", color: "#F59E0B", group: "info" },
  { type: "revenue", label: "Revenue", color: "#16A34A", group: "info" },
  { type: "cogs", label: "COGS", color: "#EF4444", group: "info" },
  { type: "workflow", label: "Workflow", color: "#8B5CF6", group: "info" },
  { type: "staffing", label: "Staffing", color: "#3B82F6", group: "info" },
  { type: "lease", label: "Lease", color: "#F97316", group: "info" },
  { type: "risk", label: "Risk", color: "#EF4444", group: "info" },
  { type: "opportunity", label: "Opportunity", color: "#16A34A", group: "info" },
  { type: "inspection", label: "Inspection", color: "#06B6D4", group: "info" },
  { type: "highlight", label: "Highlight", color: "#F59E0B", group: "info" },
  { type: "document", label: "Document", color: "#6366F1", group: "link" },
  { type: "external_link", label: "External Link", color: "#0891B2", group: "link" },
];
const PIN_ANIMATIONS = ["none", "pulse", "glow", "bounce", "ripple", "breathing"];
const AUDIO_TRIGGERS = [
  { val: "auto_prompt", label: "Auto-prompt" },
  { val: "button", label: "Play button" },
  { val: "hotspot", label: "Hotspot" },
];
const VISIBILITY = [
  { val: "public", label: "Public" },
  { val: "nda_only", label: "NDA required" },
  { val: "approved_only", label: "Approved only" },
];
function pinColor(type: string) { return PIN_TYPES.find((p) => p.type === type)?.color ?? "#2563EB"; }
function pinLabel(type: string) { return PIN_TYPES.find((p) => p.type === type)?.label ?? type; }

interface Pin {
  id: string; type: string; title: string; description: string; position: { x: number; y: number };
  requiresNDA?: boolean; visibility?: string;
  targetSpaceId?: string; targetYaw?: number; imageUrl?: string;
  documentUrl?: string; externalUrl?: string; heightMetres?: number;
  pinAnimation?: string; pinSize?: number; pinOpacity?: number; pinColor?: string; pinIconKey?: string;
  audioName?: string; audioUrl?: string; audioTrigger?: string;
  popupContent?: { heading?: string; body?: string; sections?: { label: string; value: string }[]; images?: string[]; docLinks?: { label: string; url: string }[] };
}
interface Space {
  id: string; name: string; panoramaUrl?: string; photos?: string[]; photosByDir?: Record<string, string>;
  panoramaStartYaw?: number; defaultYaw?: number; groundPitch?: number; trueNorthYaw?: number;
  dirMode?: 4 | 8 | "panorama" | "single"; isStartScene?: boolean; autoPan?: boolean; enabled?: boolean;
  audioName?: string; audioUrl?: string; audioTrigger?: string; audioTranscript?: string;
  pins: Pin[];
}
interface Settings {
  defaultAnimation: string; defaultPinSize: number; defaultPinOpacity: number;
  showNarrationBar: boolean; defaultHeightMetres: number; defaultHotspotBehaviour: "tap" | "always"; autoPanAll?: boolean;
}
const DEFAULT_SETTINGS: Settings = { defaultAnimation: "pulse", defaultPinSize: 1, defaultPinOpacity: 1, showNarrationBar: true, defaultHeightMetres: 1.6, defaultHotspotBehaviour: "tap" };

// ── Pannellum loader ──
let pnlmPromise: Promise<any> | null = null;
function loadPannellum(): Promise<any> {
  if ((window as any).pannellum) return Promise.resolve((window as any).pannellum);
  if (pnlmPromise) return pnlmPromise;
  pnlmPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js";
    js.onload = () => resolve((window as any).pannellum);
    js.onerror = reject;
    document.head.appendChild(js);
  });
  return pnlmPromise;
}

// x,y (0..1) <-> pannellum yaw/pitch, matching the viewer's buildMultiSceneSrcdoc.
const xToYaw = (x: number) => (x - 0.5) * 360;
const yToPitch = (y: number) => (0.5 - y) * 180;
const yawToX = (yaw: number) => yaw / 360 + 0.5;
const pitchToY = (pitch: number) => 0.5 - pitch / 180;

async function fileToB64(file: File): Promise<{ data: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); resolve({ data: s.split(",")[1] ?? "", mime: (s.match(/^data:(.*?);/) ?? [])[1] ?? file.type }); };
    r.onerror = reject; r.readAsDataURL(file);
  });
}

export function TourEditor() {
  const params = useParams();
  const listingId = params.listingId as string;
  const token = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
  const auth = { Authorization: `Bearer ${token}` };

  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [selSpace, setSelSpace] = useState<string | null>(null);
  const [selPin, setSelPin] = useState<string | null>(null);
  const [placeType, setPlaceType] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState<string>("");

  const viewerRef = useRef<any>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const placeRef = useRef<{ type: string | null }>({ type: null });
  useEffect(() => { placeRef.current = { type: placeType }; }, [placeType]);
  const selPinRef = useRef<string | null>(null);
  useEffect(() => { selPinRef.current = selPin; }, [selPin]);

  // ── Load ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [sp, st] = await Promise.all([
          fetch(`/api/biz360/kv/biz360_tour_spaces_v2_${listingId}`).then((r) => r.json()).catch(() => ({})),
          fetch(`/api/biz360/kv/biz360_tour_settings_v1_${listingId}`).then((r) => r.json()).catch(() => ({})),
        ]);
        if (cancelled) return;
        const arr = Array.isArray(sp?.value) ? sp.value : (Array.isArray(sp) ? sp : []);
        const norm: Space[] = arr.map((s: any) => ({
          id: s.id, name: s.name ?? "Untitled", panoramaUrl: s.panoramaUrl ?? "",
          photos: Array.isArray(s.photos) ? s.photos : [], photosByDir: s.photosByDir ?? {},
          panoramaStartYaw: s.panoramaStartYaw ?? 0, defaultYaw: s.defaultYaw, groundPitch: s.groundPitch,
          trueNorthYaw: s.trueNorthYaw, dirMode: s.dirMode ?? "panorama", isStartScene: !!s.isStartScene,
          autoPan: !!s.autoPan, enabled: s.enabled, audioName: s.audioName, audioUrl: s.audioUrl,
          audioTrigger: s.audioTrigger, audioTranscript: s.audioTranscript,
          pins: Array.isArray(s.pins) ? s.pins.map((p: any) => ({ ...p, position: p.position ?? { x: 0.5, y: 0.5 } })) : [],
        }));
        setSpaces(norm);
        setSelSpace(norm.find((s) => s.isStartScene)?.id ?? norm[0]?.id ?? null);
        const sv = st?.value ?? st;
        if (sv && typeof sv === "object" && "defaultAnimation" in sv) setSettings({ ...DEFAULT_SETTINGS, ...sv });
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [listingId]);

  const space = spaces.find((s) => s.id === selSpace) ?? null;
  const pin = space?.pins.find((p) => p.id === selPin) ?? null;

  // ── Mutators ──
  const touch = () => setDirty(true);
  function updSpace(id: string, patch: Partial<Space>) { setSpaces((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s))); touch(); }
  function updPin(spaceId: string, pinId: string, patch: Partial<Pin>) {
    setSpaces((ss) => ss.map((s) => (s.id === spaceId ? { ...s, pins: s.pins.map((p) => (p.id === pinId ? { ...p, ...patch } : p)) } : s))); touch();
  }
  function addPinAt(type: string, x: number, y: number) {
    if (!space) return;
    const id = `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const np: Pin = { id, type, title: pinLabel(type), description: "", position: { x, y }, visibility: "public", requiresNDA: false, heightMetres: settings.defaultHeightMetres };
    setSpaces((ss) => ss.map((s) => (s.id === space.id ? { ...s, pins: [...s.pins, np] } : s)));
    setSelPin(id); setPlaceType(null); touch();
  }
  function delPin(pinId: string) { if (!space) return; setSpaces((ss) => ss.map((s) => (s.id === space.id ? { ...s, pins: s.pins.filter((p) => p.id !== pinId) } : s))); setSelPin(null); touch(); }

  function addSpace() {
    const id = `space-${Date.now()}`;
    const s: Space = { id, name: `Space ${spaces.length + 1}`, panoramaUrl: "", dirMode: "panorama", pins: [], isStartScene: spaces.length === 0, enabled: true };
    setSpaces((ss) => [...ss, s]); setSelSpace(id); touch();
  }
  function delSpace(id: string) { setSpaces((ss) => ss.filter((s) => s.id !== id)); if (selSpace === id) setSelSpace(spaces[0]?.id ?? null); touch(); }
  function moveSpace(i: number, dir: -1 | 1) { const j = i + dir; if (j < 0 || j >= spaces.length) return; setSpaces((ss) => { const a = [...ss]; [a[i], a[j]] = [a[j], a[i]]; return a; }); touch(); }
  function setStart(id: string) { setSpaces((ss) => ss.map((s) => ({ ...s, isStartScene: s.id === id }))); touch(); }

  // ── Save ──
  const save = useCallback(async () => {
    setBusy("Saving…");
    try {
      await fetch(`/api/buyer-portal/seller/tour-spaces/${listingId}`, { method: "PUT", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ spaces }) });
      await fetch(`/api/biz360/kv/biz360_tour_settings_v1_${listingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: settings }) });
      setDirty(false); setSavedAt(Date.now());
    } finally { setBusy(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaces, settings, listingId]);

  // Debounced autosave.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { save(); }, 1500);
    return () => clearTimeout(t);
  }, [dirty, save]);

  // ── Uploads ──
  async function uploadImage(file: File, prefix: string): Promise<string | null> {
    const { data, mime } = await fileToB64(file);
    const r = await fetch("/api/biz360/img", { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ key: `${prefix}_${Date.now()}`, data, mimeType: mime, listingId }) });
    const d = await r.json(); return d.url ?? null;
  }
  async function uploadAudio(file: File, prefix: string): Promise<string | null> {
    const { data } = await fileToB64(file);
    const r = await fetch("/api/biz360/audio", { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: JSON.stringify({ key: `${prefix}_${Date.now()}`, data, listingId }) });
    const d = await r.json(); return d.url ?? null;
  }

  // ── Pannellum viewer ──
  useEffect(() => {
    if (!space || !space.panoramaUrl || space.panoramaUrl.startsWith("file://")) { if (viewerRef.current) { try { viewerRef.current.destroy(); } catch {} viewerRef.current = null; } return; }
    let disposed = false;
    loadPannellum().then((pnlm) => {
      if (disposed || !stageRef.current) return;
      if (viewerRef.current) { try { viewerRef.current.destroy(); } catch {} viewerRef.current = null; }
      const v = pnlm.viewer(stageRef.current, {
        type: "equirectangular", panorama: space.panoramaUrl, autoLoad: true, showZoomCtrl: true,
        showFullscreenCtrl: false, compass: false, hfov: 100, yaw: space.panoramaStartYaw ?? 0,
        hotSpots: space.pins.map((p) => hotspotConfig(p)),
      });
      viewerRef.current = v;
      const el = stageRef.current;
      const onClick = (e: MouseEvent) => {
        const st = placeRef.current;
        if (!st.type) return; // only place a NEW pin when a type is armed
        try {
          const [pitch, yaw] = v.mouseEventToCoords(e);
          const x = ((yawToX(yaw) % 1) + 1) % 1, y = Math.min(1, Math.max(0, pitchToY(pitch)));
          addPinAt(st.type, x, y);
        } catch {}
      };
      el.addEventListener("click", onClick);
      (v as any).__onClick = onClick;
    });
    return () => { disposed = true; if (viewerRef.current) { const el = stageRef.current; if (el && (viewerRef.current as any).__onClick) el.removeEventListener("click", (viewerRef.current as any).__onClick); try { viewerRef.current.destroy(); } catch {} viewerRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selSpace, space?.panoramaUrl]);

  // Re-sync hotspots when pins change (without rebuilding the viewer).
  useEffect(() => {
    const v = viewerRef.current; if (!v || !space) return;
    try {
      (v.getConfig().hotSpots ?? []).slice().forEach((h: any) => { try { v.removeHotSpot(h.id); } catch {} });
      space.pins.forEach((p) => { try { v.addHotSpot(hotspotConfig(p)); } catch {} });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space?.pins, selPin]);

  // Auto-pan the panorama to face the selected pin so it comes into view.
  useEffect(() => {
    const v = viewerRef.current; if (!v || !selPin) return;
    const p = spaces.find((s) => s.id === selSpace)?.pins.find((x) => x.id === selPin);
    if (!p) return;
    try { v.lookAt(yToPitch(p.position.y), xToYaw(p.position.x), v.getHfov(), 700); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selPin]);

  function hotspotConfig(p: Pin) {
    const col = p.pinColor || pinColor(p.type);
    const isSel = p.id === selPinRef.current;
    const sid = space?.id;
    return {
      id: p.id, pitch: yToPitch(p.position.y), yaw: xToYaw(p.position.x), cssClass: "edit-hotspot",
      draggable: true,
      // Drag the pin directly on the panorama to reposition it (no separate mode).
      dragHandlerFunc: (e: MouseEvent) => {
        try {
          const v = viewerRef.current; if (!v || !sid) return;
          const [pitch, yaw] = v.mouseEventToCoords(e);
          const x = ((yawToX(yaw) % 1) + 1) % 1, y = Math.min(1, Math.max(0, pitchToY(pitch)));
          updPin(sid, p.id, { position: { x, y } });
        } catch {}
      },
      createTooltipFunc: (div: HTMLElement) => {
        div.style.cssText = "cursor:grab;transform:translate(-50%,-50%)";
        div.innerHTML = `<div style="width:26px;height:26px;border-radius:50%;background:${col};border:3px solid ${isSel ? "#fff" : "rgba(255,255,255,0.85)"};box-shadow:0 0 0 ${isSel ? 4 : 0}px rgba(255,255,255,0.4),0 2px 8px rgba(0,0,0,0.55)"></div>`;
        // Select on click; dragging is handled by pannellum's draggable.
        div.addEventListener("mousedown", () => { setSelPin(p.id); setPlaceType(null); });
        div.addEventListener("click", (ev) => { ev.stopPropagation(); setSelPin(p.id); setPlaceType(null); });
      },
    };
  }

  if (!token) return (
    <div className="min-h-screen grid place-items-center text-foreground p-8 text-center">
      <div><p className="mb-3">Please sign in to edit this tour.</p><Link href="/seller"><Button className="theme-btn-gradient border-0">Go to seller dashboard</Button></Link></div>
    </div>
  );
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin mr-2" /> Loading tour editor…</div>;

  const isPano = (space?.dirMode ?? "panorama") === "panorama";
  const dirs = space?.dirMode === 8 ? DIRS_8 : space?.dirMode === 4 ? DIRS_4 : space?.dirMode === "single" ? ["Photo"] : [];

  return (
    <div className="min-h-screen text-foreground">
      <Seo title="Tour Editor | EXIT360" description="Build and edit your 360° tour." path={`/seller/tour/${listingId}`} />
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur">
        <Link href="/seller" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Dashboard</Link>
        <span className="font-bold">Tour Editor</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{busy ? busy : dirty ? "Unsaved changes" : savedAt ? "All changes saved" : ""}</span>
          <button onClick={() => setShowSettings(true)} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:border-primary/50"><Settings2 size={14} /> Tour settings</button>
          <Button size="sm" onClick={save} disabled={!!busy} className="theme-btn-gradient border-0"><Save size={14} className="mr-1" /> Save</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] min-h-[calc(100vh-57px)]">
        {/* Spaces sidebar */}
        <div className="border-r border-border p-3 overflow-y-auto themed-scroll lg:sticky lg:top-[57px]" style={{ maxHeight: "calc(100vh - 57px)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-muted-foreground">Spaces</span>
            <button onClick={addSpace} className="text-primary" title="Add space"><Plus size={16} /></button>
          </div>
          <div className="flex flex-col gap-1.5">
            {spaces.map((s, i) => (
              <div key={s.id} className={`rounded-lg border p-2 cursor-pointer ${s.id === selSpace ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`} onClick={() => { setSelSpace(s.id); setSelPin(null); setPlaceType(null); }}>
                <div className="flex items-center gap-2">
                  {s.panoramaUrl ? <img src={s.panoramaUrl} className="w-10 h-7 object-cover rounded" /> : <div className="w-10 h-7 rounded bg-muted grid place-items-center"><MapPin size={12} /></div>}
                  <span className={`text-sm flex-1 truncate ${s.enabled === false ? "line-through text-muted-foreground" : ""}`}>{s.name}</span>
                  {s.isStartScene && <Star size={12} className="text-primary" />}
                </div>
                <div className="flex items-center gap-1 mt-1.5 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setStart(s.id)} title="Start scene" className={s.isStartScene ? "text-primary" : ""}><Star size={12} /></button>
                  <button onClick={() => updSpace(s.id, { enabled: s.enabled === false ? true : false })} title="Show/hide">{s.enabled === false ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                  <button onClick={() => moveSpace(i, -1)} disabled={i === 0} className="disabled:opacity-30"><ChevronUp size={12} /></button>
                  <button onClick={() => moveSpace(i, 1)} disabled={i === spaces.length - 1} className="disabled:opacity-30"><ChevronDown size={12} /></button>
                  <button onClick={() => delSpace(s.id)} className="ml-auto text-red-400"><Trash2 size={12} /></button>
                  <span className="text-[10px]">{s.pins.length} pins</span>
                </div>
              </div>
            ))}
            {spaces.length === 0 && <p className="text-xs text-muted-foreground">No spaces yet. Add one to begin.</p>}
          </div>
        </div>

        {/* Main: stage on top, editor spread beneath */}
        <div className="p-4 min-w-0 flex flex-col gap-4">
          {!space ? (
            <div className="grid place-items-center text-muted-foreground py-32">Select or add a space.</div>
          ) : (
            <>
              {isPano ? (
                space.panoramaUrl ? (
                  <div className="relative">
                    <div ref={stageRef} className="w-full rounded-2xl overflow-hidden border border-border" style={{ height: "min(56vh, 520px)", background: "#000" }} />
                    {placeType && <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-full">Click on the panorama to place: {pinLabel(placeType)} <button className="ml-2 underline" onClick={() => setPlaceType(null)}>cancel</button></div>}
                    <p className="text-[11px] text-muted-foreground mt-1.5">Drag any pin on the panorama to reposition it. Click a pin to edit it below.</p>
                  </div>
                ) : (
                  <label className="h-64 rounded-2xl border-2 border-dashed border-border grid place-items-center cursor-pointer hover:border-primary/50">
                    <div className="text-center text-muted-foreground"><Upload className="mx-auto mb-2" /> {busy === "pano" ? "Uploading…" : "Upload a 360° panorama for this space"}</div>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy("pano"); const url = await uploadImage(f, "pano"); if (url) updSpace(space.id, { panoramaUrl: url }); setBusy(""); e.currentTarget.value = ""; }} />
                  </label>
                )
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Directional photos ({space.dirMode === "single" ? "single" : `${space.dirMode}-way`}). Upload a photo for each direction.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {dirs.map((d) => (
                      <label key={d} className="rounded-xl border border-border overflow-hidden cursor-pointer hover:border-primary/50">
                        {space.photosByDir?.[d] ? <img src={space.photosByDir[d]} className="w-full h-24 object-cover" /> : <div className="h-24 grid place-items-center text-muted-foreground"><Upload size={16} /></div>}
                        <div className="text-xs text-center py-1.5 bg-card/50">{d}</div>
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy("dir"); const url = await uploadImage(f, "dir"); if (url) updSpace(space.id, { photosByDir: { ...(space.photosByDir ?? {}), [d]: url } }); setBusy(""); e.currentTarget.value = ""; }} />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Active pins (top) — select one to edit ── */}
              {isPano && space.panoramaUrl && (
                <div className="rounded-xl border border-border bg-card/30 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <h4 className="text-sm font-bold inline-flex items-center gap-1.5"><MapPin size={14} className="text-primary" /> Pins in this space <span className="text-muted-foreground font-normal">({space.pins.length})</span></h4>
                    <span className="text-[11px] text-muted-foreground">👉 Click a pin to edit it · drag it on the panorama to move it</span>
                  </div>
                  {space.pins.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {space.pins.map((p) => (
                        <button key={p.id} onClick={() => { setSelPin(p.id); setPlaceType(null); }} className={`text-xs px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1.5 transition-colors ${p.id === selPin ? "border-primary bg-primary/15 ring-1 ring-primary/40 font-semibold" : "border-border hover:border-primary/40"}`}>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.pinColor || pinColor(p.type) }} />{p.title || pinLabel(p.type)}
                          {p.id === selPin && <span className="text-[10px] text-primary">· editing</span>}
                        </button>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">No pins here yet — add one from the <span className="font-semibold">Add a pin</span> section below.</p>}
                </div>
              )}

              {/* ── Editor — fills the width under the pano (multi-column) ── */}
              <div className="border-t border-border pt-4">
                {!pin
                  ? <SpacePanel space={space} spaces={spaces} onChange={(patch) => updSpace(space.id, patch)} uploadAudio={uploadAudio} busy={busy} setBusy={setBusy} />
                  : <PinPanel key={pin.id} pin={pin} spaces={spaces} onChange={(patch) => updPin(space.id, pin.id, patch)} onDelete={() => delPin(pin.id)} onClose={() => setSelPin(null)} uploadImage={uploadImage} uploadAudio={uploadAudio} />}
              </div>

              {/* ── Add a pin (bottom) ── */}
              {isPano && space.panoramaUrl && (
                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-bold mb-0.5 inline-flex items-center gap-1.5"><Plus size={14} className="text-primary" /> Add a pin</h4>
                  <p className="text-[11px] text-muted-foreground mb-2">Pick a type below, then click the spot on the panorama where it should sit.{placeType ? ` — placing a ${pinLabel(placeType)} pin, click the panorama…` : ""}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PIN_TYPES.map((pt) => (
                      <button key={pt.type} onClick={() => setPlaceType(placeType === pt.type ? null : pt.type)} className={`text-xs px-2.5 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${placeType === pt.type ? "border-primary bg-primary/15 ring-1 ring-primary/40" : "border-border hover:border-primary/40"}`}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: pt.color }} /> {pt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showSettings && <SettingsModal settings={settings} onChange={(s) => { setSettings(s); touch(); }} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ── Space settings panel ──
function SpacePanel({ space, spaces, onChange, uploadAudio, busy, setBusy }: { space: Space; spaces: Space[]; onChange: (p: Partial<Space>) => void; uploadAudio: (f: File, p: string) => Promise<string | null>; busy: string; setBusy: (s: string) => void }) {
  return (
    <div className="grid gap-x-6 gap-y-3 items-start" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
      <h3 className="font-bold text-sm col-span-full">Space settings</h3>
      <Field label="Name"><input value={space.name} onChange={(e) => onChange({ name: e.target.value })} className={inp} /></Field>
      <Field label="Type">
        <select value={String(space.dirMode ?? "panorama")} onChange={(e) => onChange({ dirMode: (e.target.value === "4" ? 4 : e.target.value === "8" ? 8 : e.target.value) as any })} className={inp}>
          <option value="panorama">360° Panorama</option>
          <option value="single">Single photo</option>
          <option value="4">4-way directional</option>
          <option value="8">8-way directional</option>
        </select>
      </Field>
      {(space.dirMode ?? "panorama") === "panorama" && (
        <>
          <div><span className="text-xs font-semibold text-muted-foreground block mb-1">Facing on load</span><CompassDial value={space.panoramaStartYaw ?? 0} onChange={(d) => onChange({ panoramaStartYaw: d })} /></div>
          <div><span className="text-xs font-semibold text-muted-foreground block mb-1">Default facing (entering via a nav pin)</span><CompassDial value={space.defaultYaw ?? 0} onChange={(d) => onChange({ defaultYaw: d })} /></div>
          <div><span className="text-xs font-semibold text-muted-foreground block mb-1">True-north calibration</span><CompassDial value={space.trueNorthYaw ?? 0} onChange={(d) => onChange({ trueNorthYaw: d })} /></div>
          <Field label={`Ground pitch (floor tilt): ${space.groundPitch ?? -50}°`}><input type="range" min={-80} max={-20} value={space.groundPitch ?? -50} onChange={(e) => onChange({ groundPitch: +e.target.value })} className="w-full" /></Field>
          <Toggle label="Auto-pan on load" on={!!space.autoPan} onToggle={() => onChange({ autoPan: !space.autoPan })} />
        </>
      )}
      <div className="col-span-full"><Toggle label="Start scene" on={!!space.isStartScene} onToggle={() => onChange({ isStartScene: !space.isStartScene })} /></div>
      <div className="col-span-full border-t border-border pt-3">
        <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5"><Mic size={14} /> Scene narration</h4>
        <div className="grid gap-x-6 gap-y-3 items-start" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
          <Field label="Audio name"><input value={space.audioName ?? ""} onChange={(e) => onChange({ audioName: e.target.value })} placeholder="e.g. Welcome to the roastery" className={inp} /></Field>
          <Field label="Trigger"><select value={space.audioTrigger ?? "button"} onChange={(e) => onChange({ audioTrigger: e.target.value })} className={inp}>{AUDIO_TRIGGERS.map((t) => <option key={t.val} value={t.val}>{t.label}</option>)}</select></Field>
          <div><span className="text-xs font-semibold text-muted-foreground block mb-1">Audio file</span><label className={btnOutline}>{busy === "sceneAudio" ? "Uploading…" : space.audioUrl ? "Replace audio" : "Upload audio"}<input type="file" accept="audio/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy("sceneAudio"); const url = await uploadAudio(f, "sceneaudio"); if (url) onChange({ audioUrl: url }); setBusy(""); e.currentTarget.value = ""; }} /></label>{space.audioUrl && <audio src={space.audioUrl} controls className="w-full h-8 mt-2" />}</div>
          <Field label="Transcript"><textarea value={space.audioTranscript ?? ""} onChange={(e) => onChange({ audioTranscript: e.target.value })} rows={2} className={inp} /></Field>
        </div>
      </div>
      <p className="col-span-full text-[11px] text-muted-foreground">Tip: pick a pin type above, then click the panorama to drop it. Drag pins to reposition; click one to edit it here.</p>
    </div>
  );
}

// ── Pin editor panel ──
function PinPanel({ pin, spaces, onChange, onDelete, onClose, uploadImage, uploadAudio }: {
  pin: Pin; spaces: Space[]; onChange: (p: Partial<Pin>) => void; onDelete: () => void; onClose: () => void;
  uploadImage: (f: File, p: string) => Promise<string | null>; uploadAudio: (f: File, p: string) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState("");
  const isInfo = PIN_TYPES.find((p) => p.type === pin.type)?.group === "info";
  const pc = pin.popupContent ?? {};
  const setPC = (patch: any) => onChange({ popupContent: { ...pc, ...patch } });

  return (
    <div className="grid gap-x-6 gap-y-3 items-start" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
      <div className="col-span-full flex items-center justify-between">
        <h3 className="font-bold text-sm inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: pin.pinColor || pinColor(pin.type) }} />{pinLabel(pin.type)} pin — drag it on the panorama to move</h3>
        <div className="flex items-center gap-2">
          <button onClick={onDelete} className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 text-sm inline-flex items-center gap-1.5"><Trash2 size={13} /> Delete</button>
          <button onClick={onClose} className="text-muted-foreground"><X size={16} /></button>
        </div>
      </div>
      <Field label="Type"><select value={pin.type} onChange={(e) => onChange({ type: e.target.value })} className={inp}>{PIN_TYPES.map((p) => <option key={p.type} value={p.type}>{p.label}</option>)}</select></Field>
      <Field label="Title"><input value={pin.title} onChange={(e) => onChange({ title: e.target.value })} className={inp} /></Field>
      <Field label="Description"><textarea value={pin.description} onChange={(e) => onChange({ description: e.target.value })} rows={2} className={inp} /></Field>

      {pin.type === "navigation" && (
        <>
          <Field label="Target space"><select value={pin.targetSpaceId ?? ""} onChange={(e) => onChange({ targetSpaceId: e.target.value })} className={inp}><option value="">— choose —</option>{spaces.filter((s) => s.id !== undefined).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <div><span className="text-xs font-semibold text-muted-foreground block mb-1">Arrival facing — which way the buyer looks on arrival</span><CompassDial value={pin.targetYaw ?? 0} onChange={(d) => onChange({ targetYaw: d })} /></div>
        </>
      )}
      {pin.type === "look" && (
        <Field label="Feature photo">
          {pin.imageUrl && <img src={pin.imageUrl} className="w-full h-28 object-cover rounded mb-2" />}
          <label className={btnOutline}>{busy === "look" ? "Uploading…" : pin.imageUrl ? "Replace photo" : "Upload photo"}<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy("look"); const url = await uploadImage(f, "look"); if (url) onChange({ imageUrl: url }); setBusy(""); e.currentTarget.value = ""; }} /></label>
        </Field>
      )}
      {pin.type === "audio" && (
        <>
          <Field label="Audio name"><input value={pin.audioName ?? ""} onChange={(e) => onChange({ audioName: e.target.value })} className={inp} /></Field>
          <label className={btnOutline}>{busy === "audio" ? "Uploading…" : pin.audioUrl ? "Replace audio" : "Upload audio"}<input type="file" accept="audio/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setBusy("audio"); const url = await uploadAudio(f, "pinaudio"); if (url) onChange({ audioUrl: url }); setBusy(""); e.currentTarget.value = ""; }} /></label>
          {pin.audioUrl && <audio src={pin.audioUrl} controls className="w-full h-8" />}
          <Field label="Trigger"><select value={pin.audioTrigger ?? "hotspot"} onChange={(e) => onChange({ audioTrigger: e.target.value })} className={inp}>{AUDIO_TRIGGERS.map((t) => <option key={t.val} value={t.val}>{t.label}</option>)}</select></Field>
        </>
      )}
      {pin.type === "document" && <Field label="Document URL"><input value={pin.documentUrl ?? ""} onChange={(e) => onChange({ documentUrl: e.target.value })} className={inp} placeholder="https://…" /></Field>}
      {pin.type === "external_link" && <Field label="External URL"><input value={pin.externalUrl ?? ""} onChange={(e) => onChange({ externalUrl: e.target.value })} className={inp} placeholder="https://…" /></Field>}

      {isInfo && (
        <div className="col-span-full border border-border rounded-lg p-3">
          <h4 className="font-semibold text-xs mb-2">Rich popup</h4>
          <Field label="Heading"><input value={pc.heading ?? ""} onChange={(e) => setPC({ heading: e.target.value })} className={inp} /></Field>
          <Field label="Body"><textarea value={pc.body ?? ""} onChange={(e) => setPC({ body: e.target.value })} rows={3} className={inp} /></Field>
          <div className="mt-2">
            <span className="text-[11px] font-semibold">Detail rows</span>
            {(pc.sections ?? []).map((s: any, i: number) => (
              <div key={i} className="flex gap-1.5 mt-1">
                <input value={s.label} onChange={(e) => { const arr = [...(pc.sections ?? [])]; arr[i] = { ...arr[i], label: e.target.value }; setPC({ sections: arr }); }} placeholder="Label" className={inp} />
                <input value={s.value} onChange={(e) => { const arr = [...(pc.sections ?? [])]; arr[i] = { ...arr[i], value: e.target.value }; setPC({ sections: arr }); }} placeholder="Value" className={inp} />
                <button onClick={() => { const arr = [...(pc.sections ?? [])]; arr.splice(i, 1); setPC({ sections: arr }); }} className="text-red-400"><X size={14} /></button>
              </div>
            ))}
            <button onClick={() => setPC({ sections: [...(pc.sections ?? []), { label: "", value: "" }] })} className="text-primary text-xs mt-1.5"><Plus size={12} className="inline" /> Add row</button>
          </div>
        </div>
      )}

      <Field label="Visibility"><select value={pin.visibility ?? "public"} onChange={(e) => onChange({ visibility: e.target.value, requiresNDA: e.target.value !== "public" })} className={inp}>{VISIBILITY.map((v) => <option key={v.val} value={v.val}>{v.label}</option>)}</select></Field>

      <details className="col-span-full border-t border-border pt-2" open>
        <summary className="text-xs font-semibold cursor-pointer text-muted-foreground">Appearance</summary>
        <div className="mt-2 grid gap-x-6 gap-y-3 items-start" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          <Field label="Animation"><select value={pin.pinAnimation ?? ""} onChange={(e) => onChange({ pinAnimation: e.target.value || undefined })} className={inp}><option value="">Default</option>{PIN_ANIMATIONS.map((a) => <option key={a} value={a}>{a}</option>)}</select></Field>
          <Field label={`Size: ${(pin.pinSize ?? 1).toFixed(1)}×`}><input type="range" min={0.5} max={2} step={0.1} value={pin.pinSize ?? 1} onChange={(e) => onChange({ pinSize: +e.target.value })} className="w-full" /></Field>
          <Field label={`Opacity: ${Math.round((pin.pinOpacity ?? 1) * 100)}%`}><input type="range" min={0.3} max={1} step={0.05} value={pin.pinOpacity ?? 1} onChange={(e) => onChange({ pinOpacity: +e.target.value })} className="w-full" /></Field>
          <Field label="Colour"><input type="color" value={pin.pinColor || pinColor(pin.type)} onChange={(e) => onChange({ pinColor: e.target.value })} className="w-full h-8 rounded" /></Field>
          <Field label={`Height off ground: ${(pin.heightMetres ?? 1.6).toFixed(2)}m`}><input type="range" min={0} max={2.8} step={0.05} value={pin.heightMetres ?? 1.6} onChange={(e) => onChange({ heightMetres: +e.target.value })} className="w-full" /></Field>
        </div>
      </details>
    </div>
  );
}

function SettingsModal({ settings, onChange, onClose }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void }) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold">Tour settings</h3><button onClick={onClose}><X size={18} /></button></div>
        <div className="flex flex-col gap-3">
          <Field label="Default pin animation"><select value={settings.defaultAnimation} onChange={(e) => set({ defaultAnimation: e.target.value })} className={inp}>{PIN_ANIMATIONS.map((a) => <option key={a} value={a}>{a}</option>)}</select></Field>
          <Field label={`Default pin size: ${settings.defaultPinSize.toFixed(1)}×`}><input type="range" min={0.5} max={2} step={0.1} value={settings.defaultPinSize} onChange={(e) => set({ defaultPinSize: +e.target.value })} className="w-full" /></Field>
          <Field label={`Default pin opacity: ${Math.round(settings.defaultPinOpacity * 100)}%`}><input type="range" min={0.3} max={1} step={0.05} value={settings.defaultPinOpacity} onChange={(e) => set({ defaultPinOpacity: +e.target.value })} className="w-full" /></Field>
          <Field label={`Default pin height: ${settings.defaultHeightMetres.toFixed(2)}m`}><input type="range" min={0} max={2.8} step={0.05} value={settings.defaultHeightMetres} onChange={(e) => set({ defaultHeightMetres: +e.target.value })} className="w-full" /></Field>
          <Toggle label="Show narration bar" on={settings.showNarrationBar} onToggle={() => set({ showNarrationBar: !settings.showNarrationBar })} />
          <Toggle label="Auto-pan all panoramas" on={!!settings.autoPanAll} onToggle={() => set({ autoPanAll: !settings.autoPanAll })} />
          <Field label="Hotspot behaviour"><select value={settings.defaultHotspotBehaviour} onChange={(e) => set({ defaultHotspotBehaviour: e.target.value as any })} className={inp}><option value="tap">Tap to open</option><option value="always">Always visible</option></select></Field>
        </div>
      </div>
    </div>
  );
}

// Draggable compass dial for setting a facing angle (0°=front/N, clockwise).
function CompassDial({ value, onChange, size = 92 }: { value: number; onChange: (deg: number) => void; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const deg = Math.round(((value % 360) + 360) % 360);
  const rad = size / 2;
  const setFromEvent = (clientX: number, clientY: number) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2), dy = clientY - (r.top + r.height / 2);
    const a = Math.round(((Math.atan2(dx, -dy) * 180 / Math.PI) % 360 + 360) % 360);
    onChange(a);
  };
  const onDown = (e: React.PointerEvent) => {
    setFromEvent(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => setFromEvent(ev.clientX, ev.clientY);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  return (
    <div className="flex items-center gap-3">
      <div ref={ref} onPointerDown={onDown} style={{ width: size, height: size, touchAction: "none" }} className="relative rounded-full border-2 border-border bg-background cursor-grab active:cursor-grabbing select-none flex-shrink-0">
        {["N", "E", "S", "W"].map((d, i) => (
          <span key={d} className="absolute text-[9px] font-bold text-muted-foreground" style={{ left: "50%", top: "50%", transform: `translate(-50%,-50%) rotate(${i * 90}deg) translateY(-${rad - 9}px) rotate(-${i * 90}deg)` }}>{d}</span>
        ))}
        <div className="absolute left-1/2 top-1/2" style={{ width: 3, height: rad - 12, background: "hsl(var(--primary))", borderRadius: 3, transformOrigin: "50% 100%", transform: `translate(-50%,-100%) rotate(${deg}deg)` }} />
        <div className="absolute left-1/2 top-1/2 rounded-full bg-primary" style={{ width: 8, height: 8, transform: "translate(-50%,-50%)" }} />
      </div>
      <div className="flex items-center gap-1">
        <input type="number" value={deg} onChange={(e) => onChange((((+e.target.value || 0) % 360) + 360) % 360)} className="w-16 px-2 py-1 rounded border border-border bg-background text-sm" />
        <span className="text-xs text-muted-foreground">°</span>
      </div>
    </div>
  );
}

const inp = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/60";
const btnOutline = "inline-flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border cursor-pointer hover:border-primary/50 w-full";
function Field({ label, children }: { label: string; children: any }) { return <label className="text-xs font-semibold text-muted-foreground block">{label}<div className="mt-1 font-normal text-foreground">{children}</div></label>; }
function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return <div className="flex items-center justify-between"><span className="text-sm">{label}</span><button onClick={onToggle} className={`relative inline-flex h-6 w-11 items-center rounded-full ${on ? "theme-btn-gradient" : "bg-muted"}`}><span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} /></button></div>;
}
