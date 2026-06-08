import { useRoute, Link } from "wouter";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  ArrowLeft,
  MapPin,
  Users,
  Clock,
  Eye,
  ShieldCheck,
  Camera,
  DollarSign,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_LISTINGS, formatPrice, formatRevenue, type Listing } from "@/data/listings";

const BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  identity:        { label: "ID Verified",    color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  abn:             { label: "ABN Verified",   color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  financials:      { label: "Financials",     color: "bg-green-500/10 text-green-400 border-green-500/20" },
  lease:           { label: "Lease Docs",     color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  equipment:       { label: "Equipment List", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  tour:            { label: "360° Tour",      color: "bg-primary/10 text-primary border-primary/20" },
  accountant:      { label: "Accountant",     color: "bg-green-500/10 text-green-400 border-green-500/20" },
  broker:          { label: "Broker",         color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  seller_supplied: { label: "Seller Docs",    color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
};

interface TourPin {
  id: string;
  type: string;
  title: string;
  position: { x: number; y: number };
  targetSpaceId?: string;
  audioUrl?: string;
  audioName?: string;
}

interface TourSpace {
  id: string;
  name: string;
  panoramaUrl: string;
  isStartScene?: boolean;
  audioUrl?: string;
  audioName?: string;
  groundPitch?: number;
  panoramaStartYaw?: number;
  pins: TourPin[];
}

function buildMultiSceneSrcdoc(spaces: TourSpace[]): string {
  const spacesJson = JSON.stringify(spaces);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
<script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"><\/script>
<style>
  html,body,#pano { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#000; }
  .pnlm-container { background:#000; }

  /* Navigation hotspot */
  .pnlm-hotspot.pnlm-scene span.pnlm-tooltip {
    background: rgba(59,130,246,0.9);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 20px;
    white-space: nowrap;
    pointer-events: none;
  }
  .pnlm-hotspot.pnlm-scene::before {
    background: rgba(59,130,246,0.85);
    border: 2px solid rgba(255,255,255,0.7);
    box-shadow: 0 0 0 4px rgba(59,130,246,0.25);
    border-radius: 50%;
    animation: navPulse 2s infinite;
  }
  @keyframes navPulse {
    0%   { box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
    70%  { box-shadow: 0 0 0 12px rgba(59,130,246,0); }
    100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
  }

  /* Audio hotspot */
  .pnlm-audio-hs {
    width: 32px; height: 32px;
    background: rgba(16,163,74,0.85);
    border: 2px solid rgba(255,255,255,0.7);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; cursor: pointer;
    box-shadow: 0 0 0 4px rgba(16,163,74,0.2);
    transition: background 0.2s;
    user-select: none;
  }
  .pnlm-audio-hs:hover { background: rgba(16,163,74,1); }
  .pnlm-audio-hs.active { background: #ea580c; box-shadow: 0 0 0 6px rgba(234,88,12,0.3); }
  .pnlm-audio-hs-tooltip {
    position: absolute;
    bottom: 38px; left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    color: #fff; font-size: 11px; font-weight: 500;
    padding: 4px 8px; border-radius: 4px;
    white-space: nowrap; pointer-events: none;
    opacity: 0; transition: opacity 0.2s;
  }
  .pnlm-audio-hs:hover .pnlm-audio-hs-tooltip { opacity: 1; }

  /* Narration bar */
  #narration-bar {
    position: absolute;
    bottom: 56px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 100px;
    display: flex; align-items: center; gap: 10px;
    padding: 7px 14px 7px 10px;
    z-index: 100; font-family: system-ui, sans-serif;
    min-width: 200px; max-width: 360px;
  }
  #narration-bar .nar-icon {
    font-size: 16px; flex-shrink: 0;
  }
  #narration-name {
    font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.85);
    flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  #narration-play {
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(59,130,246,0.9); border: none; cursor: pointer;
    color: #fff; font-size: 12px; display: flex; align-items: center;
    justify-content: center; flex-shrink: 0;
    transition: background 0.15s;
  }
  #narration-play:hover { background: #3b82f6; }
  #narration-play.playing { background: #ea580c; }
</style>
</head>
<body>
<div id="pano"></div>
<div id="narration-bar" style="display:none">
  <span class="nar-icon">🎙</span>
  <span id="narration-name"></span>
  <button id="narration-play" title="Play narration">▶</button>
</div>
<script>
  var SPACES = ${spacesJson};

  function xToYaw(x) { return (x - 0.5) * 360; }
  function yToPitch(y) { return (0.5 - y) * 180; }

  // Audio hotspot factory
  function createAudioHotspot(div, args) {
    div.classList.add('pnlm-audio-hs');
    div.innerHTML = '🔊<span class="pnlm-audio-hs-tooltip">' + args.name + '</span>';
    var audio = null, playing = false;
    div.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!audio) audio = new Audio(args.url);
      if (playing) {
        audio.pause(); playing = false; div.classList.remove('active');
      } else {
        audio.play().catch(function(){});
        playing = true; div.classList.add('active');
        audio.onended = function() { playing = false; div.classList.remove('active'); };
      }
    });
  }

  // Filter valid spaces (skip file:// local photos)
  var validIds = new Set(SPACES.filter(function(s) {
    return s.panoramaUrl && s.panoramaUrl.indexOf('file://') !== 0;
  }).map(function(s) { return s.id; }));

  var firstScene = null;
  var scenesConfig = {};
  var sceneAudio = {};

  SPACES.forEach(function(s) {
    if (!validIds.has(s.id)) return;
    if (!firstScene) firstScene = s.id;
    if (s.isStartScene) firstScene = s.id;

    if (s.audioUrl) {
      sceneAudio[s.id] = { url: s.audioUrl, name: s.audioName || '' };
    }

    var hotSpots = [];
    (s.pins || []).forEach(function(pin) {
      if (pin.type === 'navigation' && validIds.has(pin.targetSpaceId)) {
        hotSpots.push({
          pitch: yToPitch(pin.position.y),
          yaw: xToYaw(pin.position.x),
          type: 'scene',
          text: pin.title,
          sceneId: pin.targetSpaceId,
          targetPitch: 0,
          targetYaw: 0,
          targetHfov: 100,
        });
      } else if (pin.type === 'audio' && pin.audioUrl) {
        hotSpots.push({
          pitch: yToPitch(pin.position.y),
          yaw: xToYaw(pin.position.x),
          type: 'custom',
          text: pin.title,
          cssClass: 'pnlm-audio-hs-wrap',
          createTooltipFunc: createAudioHotspot,
          createTooltipArgs: { url: pin.audioUrl, name: pin.audioName || pin.title },
        });
      }
    });

    var sceneConf = {
      type: 'equirectangular',
      panorama: s.panoramaUrl,
      title: s.name,
      hotSpots: hotSpots,
    };
    if (typeof s.groundPitch === 'number') {
      sceneConf.groundPitch = s.groundPitch;
    }
    if (s.panoramaStartYaw) {
      sceneConf.northOffset = s.panoramaStartYaw;
    }
    scenesConfig[s.id] = sceneConf;
  });

  var viewer = pannellum.viewer('pano', {
    default: {
      firstScene: firstScene,
      sceneFadeDuration: 800,
      autoLoad: true,
      showFullscreenCtrl: false,
      showZoomCtrl: true,
      compass: false,
      friction: 0.15,
      hfov: 100,
    },
    scenes: scenesConfig,
  });

  // Narration bar
  var narrationAudio = null, narrationPlaying = false;
  var bar = document.getElementById('narration-bar');
  var nameEl = document.getElementById('narration-name');
  var playBtn = document.getElementById('narration-play');

  function showNarration(sceneId) {
    var data = sceneAudio[sceneId];
    if (narrationAudio) {
      narrationAudio.pause();
      narrationAudio = null;
      narrationPlaying = false;
      playBtn.textContent = '▶';
      playBtn.classList.remove('playing');
    }
    if (data) {
      nameEl.textContent = data.name;
      bar.style.display = 'flex';
    } else {
      bar.style.display = 'none';
    }
  }

  playBtn.addEventListener('click', function() {
    var sceneId = viewer.getScene();
    var data = sceneAudio[sceneId];
    if (!data) return;
    if (!narrationAudio) narrationAudio = new Audio(data.url);
    if (narrationPlaying) {
      narrationAudio.pause();
      narrationPlaying = false;
      playBtn.textContent = '▶';
      playBtn.classList.remove('playing');
    } else {
      narrationAudio.play().catch(function(){});
      narrationPlaying = true;
      playBtn.textContent = '⏸';
      playBtn.classList.add('playing');
      narrationAudio.onended = function() {
        narrationPlaying = false;
        playBtn.textContent = '▶';
        playBtn.classList.remove('playing');
      };
    }
  });

  viewer.on('scenechange', function(sceneId) {
    showNarration(sceneId);
    try { window.parent.postMessage({ type: 'pano_sceneChange', sceneId: sceneId }, '*'); } catch(e) {}
  });

  // Accept thumbnail clicks from parent
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'pano_goto' && e.data.sceneId) {
      try { viewer.loadScene(e.data.sceneId, 0, 0, 100); } catch(e2) {}
    }
  });

  // Init narration for start scene
  showNarration(firstScene);
<\/script>
</body>
</html>`;
}

function TourViewer({ spaces }: { spaces: TourSpace[] }) {
  const valid = spaces.filter((s) => s.panoramaUrl && !s.panoramaUrl.startsWith("file://"));
  const startId = valid.find((s) => s.isStartScene)?.id ?? valid[0]?.id ?? null;

  const [activeId, setActiveId] = useState<string | null>(startId);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const srcdoc = valid.length > 0 ? buildMultiSceneSrcdoc(spaces) : "";

  const handleMessage = useCallback((e: MessageEvent) => {
    if (e.data?.type === "pano_sceneChange") {
      setActiveId(e.data.sceneId);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  function goToScene(id: string) {
    setActiveId(id);
    iframeRef.current?.contentWindow?.postMessage({ type: "pano_goto", sceneId: id }, "*");
  }

  if (!valid.length) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Panorama */}
      <div className="relative rounded-2xl overflow-hidden bg-black" style={{ height: 460 }}>
        <iframe
          ref={iframeRef}
          srcDoc={srcdoc}
          className="w-full h-full border-0"
          title="360° Tour"
          sandbox="allow-scripts allow-same-origin"
        />
        {/* Space count badge */}
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur text-white text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 z-10 pointer-events-none">
          <Camera size={11} className="text-primary" />
          {valid.length} spaces
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
        {valid.map((s) => (
          <button
            key={s.id}
            onClick={() => goToScene(s.id)}
            className={`relative flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
              s.id === activeId
                ? "border-primary shadow-[0_0_12px_rgba(59,130,246,0.45)] scale-[1.03]"
                : "border-transparent opacity-55 hover:opacity-85"
            }`}
            style={{ width: 88, height: 56 }}
            title={s.name}
          >
            <img src={s.panoramaUrl} alt={s.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-1">
              <span className="text-white text-[9px] font-medium leading-tight line-clamp-2">{s.name}</span>
            </div>
            {s.audioUrl && (
              <div className="absolute top-1 right-1 bg-green-500/80 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">
                🔊
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-primary/80" />
          Navigate to space
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500/80" />
          Audio narration
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-orange-500/80" />
          Playing
        </span>
      </div>
    </div>
  );
}

function DemoHero({ listing }: { listing: Listing }) {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden flex items-center justify-center"
      style={{ height: 320, background: listing.heroColor + "22" }}
    >
      {listing.imageUrl ? (
        <img src={listing.imageUrl} alt={listing.businessName} className="w-full h-full object-cover opacity-80" />
      ) : (
        <Eye size={48} className="text-muted-foreground opacity-30" />
      )}
    </div>
  );
}

export function ListingDetail() {
  const [, params] = useRoute("/listings/:id");
  const listing = DEMO_LISTINGS.find((l) => l.id === params?.id);

  const [spaces, setSpaces] = useState<TourSpace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);

  useEffect(() => {
    if (!listing?.isRealListing) return;
    setSpacesLoading(true);
    fetch(`/api/biz360/kv/biz360_tour_spaces_v2_${listing.id}`)
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
        setSpaces(
          arr.map((s: any) => ({
            id: s.id,
            name: s.name,
            panoramaUrl: s.panoramaUrl ?? "",
            isStartScene: !!s.isStartScene,
            audioUrl: s.audioUrl,
            audioName: s.audioName,
            groundPitch: s.groundPitch,
            panoramaStartYaw: s.panoramaStartYaw ?? 0,
            pins: Array.isArray(s.pins) ? s.pins : [],
          }))
        );
      })
      .catch(() => setSpaces([]))
      .finally(() => setSpacesLoading(false));
  }, [listing?.id]);

  if (!listing) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Listing not found.</p>
          <Link href="/listings">
            <Button variant="outline">Back to Listings</Button>
          </Link>
        </div>
      </div>
    );
  }

  const hasProfit = listing.adjustedProfit > 0;
  const multiple = hasProfit ? (listing.askingPrice / listing.adjustedProfit).toFixed(1) + "×" : "—";
  const annualRevenue = listing.weeklyRevenue * 52;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/listings">
              <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
                <ArrowLeft size={16} /> All Listings
              </button>
            </Link>
            <span className="text-border">|</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                <Eye className="text-primary-foreground" size={13} />
              </div>
              <span className="font-bold">EXIT360</span>
            </div>
          </div>
          <Button size="sm">Request Info</Button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 flex flex-col gap-8">
            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                {listing.isRealListing && (
                  <span className="bg-amber-500 text-black text-xs font-bold px-2.5 py-1 rounded-full">✦ Live Listing</span>
                )}
                {listing.hasTour && (
                  <span className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <Camera size={11} /> 360° Tour · {listing.tourStarts} starts
                  </span>
                )}
                {listing.verified && (
                  <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                    <ShieldCheck size={13} /> Verified Seller
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold mb-2">{listing.businessName}</h1>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <MapPin size={14} />
                <span>{listing.suburb}, {listing.state}</span>
                <span className="text-border mx-1">·</span>
                <span>{listing.subcategory}</span>
              </div>
            </div>

            {/* Tour or hero */}
            {listing.isRealListing ? (
              spacesLoading ? (
                <div className="rounded-2xl bg-card border border-border flex items-center justify-center" style={{ height: 320 }}>
                  <p className="text-muted-foreground text-sm animate-pulse">Loading 360° tour…</p>
                </div>
              ) : (
                <TourViewer spaces={spaces} />
              )
            ) : (
              <DemoHero listing={listing} />
            )}

            {/* Description */}
            <div>
              <h2 className="font-semibold text-lg mb-3">About This Business</h2>
              <p className="text-muted-foreground leading-relaxed">{listing.description}</p>
            </div>

            {/* Operations */}
            <div>
              <h2 className="font-semibold text-lg mb-4">Operations at a Glance</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <Users size={18} className="text-primary" />
                  <div>
                    <div className="font-semibold">{listing.staffCount} Staff Members</div>
                    <div className="text-xs text-muted-foreground">Current team size</div>
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <Clock size={18} className="text-primary" />
                  <div>
                    <div className="font-semibold">{listing.ownerHours} hrs/week</div>
                    <div className="text-xs text-muted-foreground">Owner time required</div>
                  </div>
                </div>
                {listing.leaseExpiry && (
                  <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                    <DollarSign size={18} className="text-primary" />
                    <div>
                      <div className="font-semibold">Lease expires {listing.leaseExpiry}</div>
                      <div className="text-xs text-muted-foreground">Lease term</div>
                    </div>
                  </div>
                )}
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <Eye size={18} className="text-primary" />
                  <div>
                    <div className="font-semibold">{listing.viewCount} views</div>
                    <div className="text-xs text-muted-foreground">Buyer interest so far</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div>
              <h2 className="font-semibold text-lg mb-3">Verified Documents</h2>
              <div className="flex flex-wrap gap-2">
                {listing.badges.map((b) => {
                  const cfg = BADGE_CONFIG[b];
                  if (!cfg) return null;
                  return (
                    <span key={b} className={`text-xs font-medium px-3 py-1.5 rounded-full border ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sticky price card */}
          <div className="flex flex-col gap-5">
            <div className="sticky top-24 flex flex-col gap-5">
              <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">{formatPrice(listing.askingPrice)}</div>
                  <div className="text-sm text-muted-foreground mt-1">Asking Price</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background rounded-xl p-3 text-center border border-border">
                    <div className="text-base font-bold text-green-400">{formatRevenue(listing.weeklyRevenue)}</div>
                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Weekly Revenue</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 text-center border border-border">
                    <div className="text-base font-bold text-green-400">
                      ${(annualRevenue / 1000).toFixed(0)}K
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Annual Revenue</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 text-center border border-border">
                    <div className={`text-base font-bold ${hasProfit ? "" : "text-muted-foreground"}`}>{multiple}</div>
                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Profit Multiple</div>
                  </div>
                  <div className="bg-background rounded-xl p-3 text-center border border-border">
                    <div className="text-base font-bold">{listing.tourStarts}</div>
                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Tour Starts</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <Button className="w-full gap-2"><Phone size={15} /> Request a Call</Button>
                  <Button variant="outline" className="w-full gap-2"><Mail size={15} /> Send Enquiry</Button>
                </div>
              </div>

              {listing.isRealListing && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-200/80 leading-relaxed">
                  Live listing submitted by a verified seller. All documents checked by EXIT360.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
