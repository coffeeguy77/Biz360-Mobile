import { useRoute, Link, useLocation } from "wouter";
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
  Play,
  Pause,
  Volume2,
  Mic,
  SkipForward,
  ListMusic,
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

interface AudioTrack {
  id: string;
  spaceId: string;
  spaceName: string;
  name: string;
  url: string;
  isSpaceNarration: boolean;
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
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000}
  #pano{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;touch-action:none;user-select:none;-webkit-user-select:none}
  @keyframes kfPinBounce{0%,100%{transform:translateY(0)}35%{transform:translateY(-13px)}60%{transform:translateY(-6px)}}
  @keyframes kfPinShadow{0%,100%{transform:scaleX(1);opacity:0.28}35%{transform:scaleX(0.55);opacity:0.10}60%{transform:scaleX(0.78);opacity:0.18}}
  .nav-pin-label{position:absolute;top:-30px;left:50%;transform:translateX(-50%);background:rgba(37,99,235,0.92);color:#fff;font-size:11px;font-weight:600;padding:3px 8px;border-radius:10px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .18s}
  .pnlm-nav-pin-wrap:hover .nav-pin-label,.pnlm-nav-pin-wrap:active .nav-pin-label{opacity:1!important}
  .pnlm-hotspot.pnlm-nav-pin-wrap{background:transparent!important;border:none!important;box-shadow:none!important;width:0!important;height:0!important;overflow:visible!important}
  .pnlm-hotspot.pnlm-nav-pin-wrap::before{display:none!important}
  .pnlm-audio-hs{width:32px;height:32px;background:rgba(16,163,74,0.85);border:2px solid rgba(255,255,255,0.7);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer;box-shadow:0 0 0 4px rgba(16,163,74,0.2);transition:background .2s;user-select:none}
  .pnlm-audio-hs:hover{background:rgba(16,163,74,1)}
  .pnlm-audio-hs.active{background:#ea580c;box-shadow:0 0 0 6px rgba(234,88,12,0.3)}
  .pnlm-audio-hs-tooltip{position:absolute;bottom:38px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;font-size:11px;font-weight:500;padding:4px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .2s}
  .pnlm-audio-hs:hover .pnlm-audio-hs-tooltip{opacity:1}
</style>
</head>
<body>
<div id="pano"></div>
<script>
var SPACES=${spacesJson};
function xToYaw(x){return(x-0.5)*360}
function yToPitch(y){return(0.5-y)*180}
function createNavPin(container,args){
  /* 0×0 anchor at the exact hotspot coordinate — children overflow freely */
  container.style.cssText='width:0;height:0;overflow:visible;cursor:pointer;position:relative';
  container.innerHTML=
    /* SVG pin: scaled 1.6× with tip anchored at bottom-center → stays at hotspot coordinate */
    '<div style="position:absolute;top:-44px;left:-17px;pointer-events:none;transform:scale(1.6);transform-origin:bottom center;animation:kfPinBounce 1.35s cubic-bezier(.4,0,.2,1) infinite">'+
      '<svg width="34" height="44" viewBox="0 0 34 44" fill="none">'+
        '<path d="M17 2C9.82 2 4 7.82 4 15c0 8.12 11.6 23.5 12.35 24.5a.85.85 0 001.3 0C18.4 38.5 30 23.12 30 15 30 7.82 24.18 2 17 2z" fill="#2563EB" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>'+
        '<circle cx="17" cy="15" r="6.5" fill="white" opacity="0.95"/>'+
      '</svg>'+
    '</div>'+
    /* Shadow: just below the anchor */
    '<div style="position:absolute;top:2px;left:-8px;width:16px;height:6px;background:rgba(0,0,0,0.28);border-radius:50%;pointer-events:none;animation:kfPinShadow 1.35s cubic-bezier(.4,0,.2,1) infinite"></div>'+
    /* Label: above the pin, shown on hover */
    '<span class="nav-pin-label" style="bottom:50px">'+args.label+'</span>';
  container.addEventListener('click',function(e){
    e.stopPropagation();
    try{viewer.loadScene(args.sceneId,0,0,100)}catch(err){}
  });
}
function createAudioHotspot(div,args){
  div.classList.add('pnlm-audio-hs');
  div.innerHTML='🔊<span class="pnlm-audio-hs-tooltip">'+args.name+'</span>';
  var audio=null,playing=false;
  div.addEventListener('click',function(e){
    e.stopPropagation();
    if(!audio)audio=new Audio(args.url);
    if(playing){audio.pause();playing=false;div.classList.remove('active')}
    else{audio.play().catch(function(){});playing=true;div.classList.add('active');audio.onended=function(){playing=false;div.classList.remove('active')}}
  });
}
var validIds=new Set(SPACES.filter(function(s){return s.panoramaUrl&&s.panoramaUrl.indexOf('file://')!==0}).map(function(s){return s.id}));
var firstScene=null,scenesConfig={};
SPACES.forEach(function(s){
  if(!validIds.has(s.id))return;
  if(!firstScene)firstScene=s.id;
  if(s.isStartScene)firstScene=s.id;
  var hotSpots=[];
  (s.pins||[]).forEach(function(pin){
    if(pin.type==='navigation'&&validIds.has(pin.targetSpaceId)){
      hotSpots.push({pitch:0,yaw:xToYaw(pin.position.x),type:'custom',cssClass:'pnlm-nav-pin-wrap',createTooltipFunc:createNavPin,createTooltipArgs:{sceneId:pin.targetSpaceId,label:pin.title}});
    } else if(pin.type==='audio'&&pin.audioUrl){
      hotSpots.push({pitch:yToPitch(pin.position.y),yaw:xToYaw(pin.position.x),type:'custom',text:pin.title,cssClass:'pnlm-audio-hs-wrap',createTooltipFunc:createAudioHotspot,createTooltipArgs:{url:pin.audioUrl,name:pin.audioName||pin.title}});
    }
  });
  var sc={type:'equirectangular',panorama:s.panoramaUrl,title:s.name,hotSpots:hotSpots};
  if(typeof s.groundPitch==='number')sc.groundPitch=s.groundPitch;
  scenesConfig[s.id]=sc;
});
var viewer=pannellum.viewer('pano',{default:{firstScene:firstScene,sceneFadeDuration:800,autoLoad:true,showFullscreenCtrl:false,showZoomCtrl:true,compass:false,friction:0.15,hfov:100,pitch:0,yaw:0,minHfov:50,maxHfov:150},scenes:scenesConfig});
viewer.on('scenechange',function(id){try{window.parent.postMessage({type:'pano_sceneChange',sceneId:id},'*')}catch(e){}});
window.addEventListener('message',function(e){if(e.data&&e.data.type==='pano_goto'&&e.data.sceneId)try{viewer.loadScene(e.data.sceneId,0,0,100)}catch(e2){}});
<\/script>
</body>
</html>`;
}

function TourViewer({
  spaces,
  iframeRef,
  activeId,
  onSceneChange,
}: {
  spaces: TourSpace[];
  iframeRef: React.RefObject<HTMLIFrameElement>;
  activeId: string | null;
  onSceneChange: (id: string) => void;
}) {
  const valid = spaces.filter((s) => s.panoramaUrl && !s.panoramaUrl.startsWith("file://"));
  const srcdoc = valid.length > 0 ? buildMultiSceneSrcdoc(spaces) : "";

  if (!valid.length) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-2xl overflow-hidden bg-black" style={{ height: "clamp(260px, 50vw, 460px)" }}>
        <iframe
          ref={iframeRef}
          srcDoc={srcdoc}
          className="w-full h-full border-0"
          title="360° Tour"
          sandbox="allow-scripts allow-same-origin"
        />
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
            onClick={() => {
              onSceneChange(s.id);
              iframeRef.current?.contentWindow?.postMessage({ type: "pano_goto", sceneId: s.id }, "*");
            }}
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
              <div className="absolute top-1 right-1 bg-green-500/80 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">🔊</div>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-primary/80" />Navigate to space</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-green-500/80" />Audio narration</span>
      </div>
    </div>
  );
}

function AudioDirectory({
  spaces,
  iframeRef,
  playingId,
  pausedId,
  onPlay,
  onNavigate,
  playAllActive,
  onPlayAll,
  onStopAll,
}: {
  spaces: TourSpace[];
  iframeRef: React.RefObject<HTMLIFrameElement>;
  playingId: string | null;
  pausedId: string | null;
  onPlay: (track: AudioTrack) => void;
  onNavigate: (spaceId: string) => void;
  playAllActive: boolean;
  onPlayAll: () => void;
  onStopAll: () => void;
}) {
  // Build grouped track list
  const groups: { space: TourSpace; tracks: AudioTrack[] }[] = [];
  spaces
    .filter((s) => s.panoramaUrl && !s.panoramaUrl.startsWith("file://"))
    .forEach((s) => {
      const tracks: AudioTrack[] = [];
      if (s.audioUrl) {
        tracks.push({ id: `space-${s.id}`, spaceId: s.id, spaceName: s.name, name: s.audioName || "Narration", url: s.audioUrl, isSpaceNarration: true });
      }
      (s.pins || [])
        .filter((p) => p.type === "audio" && p.audioUrl)
        .forEach((p) => {
          tracks.push({ id: `pin-${p.id}`, spaceId: s.id, spaceName: s.name, name: p.audioName || p.title, url: p.audioUrl!, isSpaceNarration: false });
        });
      if (tracks.length > 0) groups.push({ space: s, tracks });
    });

  if (!groups.length) return null;
  const totalTracks = groups.reduce((n, g) => n + g.tracks.length, 0);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ListMusic size={14} className="text-primary" />
            <span className="text-sm font-semibold">Audio Tour</span>
            <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{totalTracks}</span>
          </div>
        </div>
        {/* Play All button */}
        <button
          onClick={playAllActive ? onStopAll : onPlayAll}
          className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
            playAllActive
              ? "bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20"
              : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
          }`}
        >
          {playAllActive ? (
            <><Pause size={14} /> Stop Playback</>
          ) : (
            <><Play size={14} /> Play All Narrations</>
          )}
        </button>
      </div>

      {/* Groups */}
      <div className="divide-y divide-border max-h-80 overflow-y-auto">
        {groups.map(({ space, tracks }) => (
          <div key={space.id}>
            {/* Space header — click to navigate */}
            <button
              onClick={() => onNavigate(space.id)}
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.03] transition-colors text-left group"
            >
              <MapPin size={12} className="text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-semibold text-foreground/80 group-hover:text-foreground transition-colors flex-1">{space.name}</span>
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Go →</span>
            </button>

            {/* Tracks */}
            {tracks.map((track) => {
              const isPlaying = playingId === track.id;
              const isPaused  = pausedId  === track.id;
              const isActive  = isPlaying || isPaused;
              return (
                <button
                  key={track.id}
                  onClick={() => onPlay(track)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 pl-8 transition-all hover:bg-white/[0.04] ${
                    isPlaying ? "bg-primary/5" : isPaused ? "bg-amber-500/5" : ""
                  }`}
                >
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    isPlaying ? "bg-primary text-primary-foreground"
                    : isPaused ? "bg-amber-500/20 text-amber-400"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    {isPlaying ? <Pause size={10} />
                     : isPaused ? <Play size={10} />
                     : track.isSpaceNarration ? <Mic size={10} /> : <Volume2 size={10} />}
                  </div>
                  <span className={`text-xs flex-1 text-left leading-snug line-clamp-2 ${
                    isPlaying ? "text-primary font-medium"
                    : isPaused ? "text-amber-400 font-medium"
                    : "text-muted-foreground"
                  }`}>
                    {track.name}
                  </span>
                  {isPlaying && (
                    <span className="flex-shrink-0 flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="w-0.5 bg-primary rounded-full animate-pulse" style={{ height: 10 + i * 4, animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </span>
                  )}
                  {isPaused && (
                    <span className="flex-shrink-0 text-[9px] text-amber-400 font-medium">paused</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DemoHero({ listing }: { listing: Listing }) {
  return (
    <div className="w-full rounded-2xl overflow-hidden flex items-center justify-center" style={{ height: 320, background: listing.heroColor + "22" }}>
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
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);

  // Audio state — lives here so it persists during navigation
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [pausedId,  setPausedId]  = useState<string | null>(null);
  const [playAllActive, setPlayAllActive] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playAllQueueRef = useRef<AudioTrack[]>([]);
  const playAllIndexRef = useRef(0);

  // Listen for scene changes from the Pannellum iframe
  const handleMessage = useCallback((e: MessageEvent) => {
    if (e.data?.type === "pano_sceneChange") setActiveSceneId(e.data.sceneId);
  }, []);
  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    if (!listing?.isRealListing) return;
    setSpacesLoading(true);
    fetch(`/api/biz360/kv/biz360_tour_spaces_v2_${listing.id}`)
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.value) ? data.value : []);
        const mapped: TourSpace[] = arr.map((s: any) => ({
          id: s.id,
          name: s.name,
          panoramaUrl: s.panoramaUrl ?? "",
          isStartScene: !!s.isStartScene,
          audioUrl: s.audioUrl,
          audioName: s.audioName,
          groundPitch: s.groundPitch,
          panoramaStartYaw: s.panoramaStartYaw ?? 0,
          pins: Array.isArray(s.pins) ? s.pins : [],
        }));
        setSpaces(mapped);
        const start = mapped.find((s) => s.isStartScene) ?? mapped[0];
        if (start) setActiveSceneId(start.id);
      })
      .catch(() => setSpaces([]))
      .finally(() => setSpacesLoading(false));
  }, [listing?.id]);

  // Stop all audio on unmount
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  function stopCurrentAudio() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current = null; }
    setPlayingId(null);
    setPausedId(null);
  }

  function pauseCurrentAudio() {
    if (audioRef.current) audioRef.current.pause();
    setPausedId(playingId);
    setPlayingId(null);
  }

  function navigateToSpace(spaceId: string) {
    setActiveSceneId(spaceId);
    iframeRef.current?.contentWindow?.postMessage({ type: "pano_goto", sceneId: spaceId }, "*");
  }

  function playTrack(track: AudioTrack, onEnded?: () => void) {
    stopCurrentAudio();
    navigateToSpace(track.spaceId);
    const audio = new Audio(track.url);
    audioRef.current = audio;
    setPlayingId(track.id);
    audio.play().catch(() => {});
    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
      if (onEnded) onEnded();
    };
  }

  function handlePlay(track: AudioTrack) {
    if (playingId === track.id) {
      // Same track playing → pause it (keep position)
      pauseCurrentAudio();
      setPlayAllActive(false);
      return;
    }
    if (pausedId === track.id) {
      // Same track paused → resume from where it left off
      audioRef.current?.play().catch(() => {});
      setPlayingId(track.id);
      setPausedId(null);
      return;
    }
    // Different track → stop current and play new
    setPlayAllActive(false);
    playTrack(track);
  }

  // Build flat audio queue from all spaces
  function buildQueue(): AudioTrack[] {
    const queue: AudioTrack[] = [];
    spaces
      .filter((s) => s.panoramaUrl && !s.panoramaUrl.startsWith("file://"))
      .forEach((s) => {
        if (s.audioUrl) queue.push({ id: `space-${s.id}`, spaceId: s.id, spaceName: s.name, name: s.audioName || "Narration", url: s.audioUrl, isSpaceNarration: true });
        (s.pins || []).filter((p) => p.type === "audio" && p.audioUrl).forEach((p) => {
          queue.push({ id: `pin-${p.id}`, spaceId: s.id, spaceName: s.name, name: p.audioName || p.title, url: p.audioUrl!, isSpaceNarration: false });
        });
      });
    return queue;
  }

  function playAllNext(queue: AudioTrack[], index: number) {
    if (index >= queue.length) {
      setPlayAllActive(false);
      setPlayingId(null);
      return;
    }
    playAllIndexRef.current = index;
    playTrack(queue[index], () => playAllNext(queue, index + 1));
  }

  function handlePlayAll() {
    const queue = buildQueue();
    if (!queue.length) return;
    playAllQueueRef.current = queue;
    setPlayAllActive(true);
    playAllNext(queue, 0);
  }

  function handleStopAll() {
    stopCurrentAudio();
    setPlayAllActive(false);
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Listing not found.</p>
          <Link href="/listings"><Button variant="outline">Back to Listings</Button></Link>
        </div>
      </div>
    );
  }

  const hasProfit = listing.adjustedProfit > 0;
  const multiple = hasProfit ? (listing.askingPrice / listing.adjustedProfit).toFixed(1) + "×" : "—";
  const annualRevenue = listing.weeklyRevenue * 52;

  const audioGroups = spaces
    .filter((s) => s.panoramaUrl && !s.panoramaUrl.startsWith("file://"))
    .filter((s) => s.audioUrl || (s.pins || []).some((p) => p.type === "audio" && p.audioUrl));

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
          {/* Left: main content */}
          <div className="lg:col-span-2 flex flex-col gap-8">
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

            {listing.isRealListing ? (
              spacesLoading ? (
                <div className="rounded-2xl bg-card border border-border flex items-center justify-center" style={{ height: 320 }}>
                  <p className="text-muted-foreground text-sm animate-pulse">Loading 360° tour…</p>
                </div>
              ) : (
                <TourViewer
                  spaces={spaces}
                  iframeRef={iframeRef}
                  activeId={activeSceneId}
                  onSceneChange={setActiveSceneId}
                />
              )
            ) : (
              <DemoHero listing={listing} />
            )}

            <div>
              <h2 className="font-semibold text-lg mb-3">About This Business</h2>
              <p className="text-muted-foreground leading-relaxed">{listing.description}</p>
            </div>

            <div>
              <h2 className="font-semibold text-lg mb-4">Operations at a Glance</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <Users size={18} className="text-primary" />
                  <div><div className="font-semibold">{listing.staffCount} Staff Members</div><div className="text-xs text-muted-foreground">Current team size</div></div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <Clock size={18} className="text-primary" />
                  <div><div className="font-semibold">{listing.ownerHours} hrs/week</div><div className="text-xs text-muted-foreground">Owner time required</div></div>
                </div>
                {listing.leaseExpiry && (
                  <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                    <DollarSign size={18} className="text-primary" />
                    <div><div className="font-semibold">Lease expires {listing.leaseExpiry}</div><div className="text-xs text-muted-foreground">Lease term</div></div>
                  </div>
                )}
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                  <Eye size={18} className="text-primary" />
                  <div><div className="font-semibold">{listing.viewCount} views</div><div className="text-xs text-muted-foreground">Buyer interest so far</div></div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-lg mb-3">Verified Documents</h2>
              <div className="flex flex-wrap gap-2">
                {listing.badges.map((b) => {
                  const cfg = BADGE_CONFIG[b];
                  if (!cfg) return null;
                  return <span key={b} className={`text-xs font-medium px-3 py-1.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>;
                })}
              </div>
            </div>
          </div>

          {/* Right: sticky sidebar */}
          <div className="flex flex-col gap-5">
            <div className="sticky top-24 flex flex-col gap-4">
              {/* Price card */}
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
                    <div className="text-base font-bold text-green-400">${(annualRevenue / 1000).toFixed(0)}K</div>
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
                  <Link href={`/sign-in?intent=call&listingId=${listing?.id ?? ""}&listingName=${encodeURIComponent(listing?.name ?? "")}&return=/listings/${listing?.id ?? ""}`}>
                    <Button className="w-full gap-2"><Phone size={15} /> Request a Call</Button>
                  </Link>
                  <Link href={`/sign-in?intent=enquiry&listingId=${listing?.id ?? ""}&listingName=${encodeURIComponent(listing?.name ?? "")}&return=/listings/${listing?.id ?? ""}`}>
                    <Button variant="outline" className="w-full gap-2"><Mail size={15} /> Send Enquiry</Button>
                  </Link>
                </div>
              </div>

              {/* Audio directory */}
              {listing.isRealListing && audioGroups.length > 0 && !spacesLoading && (
                <AudioDirectory
                  spaces={spaces}
                  iframeRef={iframeRef}
                  playingId={playingId}
                  pausedId={pausedId}
                  onPlay={handlePlay}
                  onNavigate={navigateToSpace}
                  playAllActive={playAllActive}
                  onPlayAll={handlePlayAll}
                  onStopAll={handleStopAll}
                />
              )}

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
