import { useRoute, Link, useLocation } from "wouter";
import { sendEnquiry, enquiryLabel } from "@/lib/enquiry";
// Shared 360° tour builder — same Street-View navigation (turn-to-enter reticle,
// edge arrows, scene chips, click-to-walk) used by the report tour, so the public
// listing viewer gets the identical movement system instead of at-feet pins.
import { buildMultiSceneSrcdoc, useImmersive, immersiveWrapStyle } from "@/components/InteractiveTour";
import { SiteNav } from "@/components/SiteShell";
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
  Calendar,
  Maximize2,
  Minimize2,
  LayoutGrid,
  EyeOff,
  Play,
  Pause,
  Volume2,
  Mic,
  SkipForward,
  ListMusic,
  Lock,
  KeyRound,
  Loader2,
  FileText,
  ExternalLink,
  User,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, getPriceStat, getStatSlot, type Listing } from "@/data/listings";
import { mapApiListing } from "@/lib/listingsApi";
import { NdaDocument } from "@/components/NdaDocument";

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
  targetYaw?: number;
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
  defaultYaw?: number;
  enabled?: boolean;
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

function TourViewer({
  spaces,
  iframeRef,
  activeId,
  onSceneChange,
  autoPanAll = false,
}: {
  spaces: TourSpace[];
  iframeRef: React.RefObject<HTMLIFrameElement>;
  activeId: string | null;
  onSceneChange: (id: string) => void;
  autoPanAll?: boolean;
}) {
  const valid = spaces.filter((s) => s.panoramaUrl && !s.panoramaUrl.startsWith("file://") && s.enabled !== false);
  const srcdoc = valid.length > 0 ? buildMultiSceneSrcdoc(spaces, autoPanAll) : "";
  const [showPresets, setShowPresets] = useState(true);
  const { isFs, toggle: toggleFullscreen } = useImmersive();
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "pano_fullscreen", on: isFs, presets: showPresets }, "*");
  }, [isFs, showPresets, iframeRef]);

  if (!valid.length) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-2xl overflow-hidden bg-black" style={immersiveWrapStyle(isFs, "clamp(220px, 50vw, 460px)")}>
        <iframe
          ref={iframeRef}
          srcDoc={srcdoc}
          className="w-full h-full border-0"
          title="360° Tour"
          allow="fullscreen"
        />
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur text-white text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 z-10 pointer-events-none">
          <Camera size={11} className="text-primary" />
          {valid.length} spaces
        </div>
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <button onClick={() => setShowPresets((s) => !s)} title={showPresets ? "Hide scene presets" : "Show scene presets"}
            className="bg-black/60 hover:bg-black/80 backdrop-blur text-white w-9 h-9 rounded-full grid place-items-center transition-colors">
            {showPresets ? <EyeOff size={16} /> : <LayoutGrid size={16} />}
          </button>
          <button onClick={toggleFullscreen} title={isFs ? "Exit fullscreen" : "Fullscreen immersive"}
            className="bg-black/60 hover:bg-black/80 backdrop-blur text-white w-9 h-9 rounded-full grid place-items-center transition-colors">
            {isFs ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
        {isFs && showPresets && (
          <div className="absolute bottom-5 left-0 right-0 px-4 z-10">
            <div className="flex gap-2.5 overflow-x-auto themed-scroll pb-1 max-w-5xl mx-auto justify-center">
              {valid.map((s) => (
                <button key={s.id} onClick={() => { onSceneChange(s.id); iframeRef.current?.contentWindow?.postMessage({ type: "pano_goto", sceneId: s.id }, "*"); }}
                  className={`group relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${s.id === activeId ? "border-primary shadow-[0_0_14px_rgba(59,130,246,0.5)]" : "border-white/25 opacity-75 hover:opacity-100"}`}
                  style={{ width: 128, height: 78 }} title={s.name}>
                  <img src={s.panoramaUrl} alt={s.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent flex items-end p-1.5">
                    <span className="text-white text-[10px] font-medium leading-tight line-clamp-2">{s.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail strip (toggle via presets button) */}
      {showPresets && !isFs && (
      <div className="flex gap-2 overflow-x-auto themed-scroll pb-1">
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
      )}

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

// Record a buyer action against a listing (Request Info / Call / phone reveal, …)
// so the seller can see engagement in their dashboard.
function recordAccessLog(listingId: string, eventType: string, extra?: Record<string, string>) {
  fetch("/api/report-access-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listingId, eventType, ...extra, userAgent: navigator.userAgent }),
  }).catch(() => {});
}

// The signed-in buyer's canonical id ("u-<digits>"), read from their auth JWT.
function currentBuyerId(): string | null {
  try {
    const t = localStorage.getItem("biz360_web_auth_token");
    if (!t) return null;
    const payload = JSON.parse(atob(t.split(".")[1] || ""));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch { return null; }
}

export function ListingDetail() {
  const [, params] = useRoute("/listings/:id");
  const listingId = params?.id ?? "";
  const [listing, setListing] = useState<Listing | null>(null);
  const [listingLoading, setListingLoading] = useState(true);
  const [buyerSignedIn, setBuyerSignedIn] = useState(false);
  useEffect(() => {
    try { setBuyerSignedIn(!!localStorage.getItem("exit360_buyer_token")); } catch { /* ignore */ }
  }, []);
  const [, navigate] = useLocation();
  const [enquirySent, setEnquirySent] = useState<string | null>(null);
  const [enquirySending, setEnquirySending] = useState<string | null>(null);

  // Request Info / Call / Site Visit. Already-verified buyers send straight to
  // the seller (no sign-in screen) and see an inline confirmation; unverified
  // buyers go through the sign-in (OTP) flow, which sends the same enquiry.
  async function handleRequest(intent: "info" | "call" | "visit") {
    recordAccessLog(listingId, intent === "call" ? "request_call" : intent === "visit" ? "request_visit" : "request_info");
    const signInUrl =
      `/sign-in?intent=${intent}&listingId=${listingId}` +
      `&listingName=${encodeURIComponent(listing?.businessName ?? "")}&return=/listings/${listingId}`;
    let profile: { userId?: string; name?: string; phone?: string } | null = null;
    try {
      const token = localStorage.getItem("exit360_buyer_token");
      const raw = localStorage.getItem("biz360_web_user");
      if (token && raw) profile = JSON.parse(raw);
    } catch { profile = null; }
    if (profile?.userId && profile?.phone && (profile?.name?.trim?.().length ?? 0) >= 2) {
      setEnquirySending(intent); setEnquirySent(null);
      try {
        await sendEnquiry({
          userId: profile.userId,
          name: profile.name!.trim(),
          phone: profile.phone!,
          listingId,
          listingName: listing?.businessName ?? "this listing",
          intent,
        });
        setEnquirySent(intent);
      } catch {
        navigate(signInUrl);
      } finally {
        setEnquirySending(null);
      }
      return;
    }
    navigate(signInUrl);
  }

  // Buyer engagement: has this buyer already started a conversation on this
  // listing, and do they have unread replies? Drives the sidebar CTAs.
  const [hasEngaged, setHasEngaged] = useState(false);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  useEffect(() => {
    const myId = currentBuyerId();
    if (!myId || !listingId) { setHasEngaged(false); setUnreadMsgs(0); return; }
    let active = true;
    const load = () =>
      fetch("/api/biz360/kv/biz360_threads_v3")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!active) return;
          const all = (j?.value ?? {}) as Record<string, any>;
          const mine = Object.values(all).find(
            (t: any) => t?.listingId === listingId && t?.buyerId === myId,
          ) as any;
          setHasEngaged(!!mine);
          setUnreadMsgs(mine?.unreadBuyer ?? 0);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 5000);
    return () => { active = false; clearInterval(iv); };
  }, [listingId]);

  // Seller card (name/company/bio + whether a phone can be revealed).
  const [sellerCard, setSellerCard] = useState<{ displayName: string; company?: string | null; bio?: string | null; anonymous?: boolean; phoneAvailable?: boolean } | null>(null);
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  const [revealMsg, setRevealMsg] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  useEffect(() => {
    if (!listingId) return;
    fetch(`/api/public/listing/${listingId}/seller`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setSellerCard(d); })
      .catch(() => {});
  }, [listingId]);

  async function revealSellerPhone() {
    setRevealing(true); setRevealMsg(null);
    try {
      const token = localStorage.getItem("biz360_web_auth_token");
      const r = await fetch(`/api/public/listing/${listingId}/seller/reveal-phone`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.phone) { setRevealedPhone(d.phone); }
      else if (d.error === "verify_phone") { setRevealMsg("Verify your phone number first (tap Request Info or Request a Call), then you can see the seller's number."); }
      else { setRevealMsg(d.message ?? "The seller's number isn't available."); }
    } catch { setRevealMsg("Something went wrong — please try again."); }
    finally { setRevealing(false); }
  }

  const [spaces, setSpaces] = useState<TourSpace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [tourAutoPanAll, setTourAutoPanAll] = useState(false);
  const [liveData, setLiveData] = useState<{ listing: any; snapshot: any } | null>(null);
  const [publicDocs, setPublicDocs] = useState<{ id: string; title: string; docType: string; url: string; mimeType: string | null }[]>([]);

  // Report access gate state
  const [accessInfo, setAccessInfo] = useState<{ mode: string; hasAccess: boolean; smsUnlockEnabled?: boolean } | null>(null);
  const [accessChecking, setAccessChecking] = useState(false);
  const [pwdInput, setPwdInput] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdChecking, setPwdChecking] = useState(false);
  // Identity OTP (for users / users_and_password modes)
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState<"phone" | "code" | "not_granted" | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  // SMS OTP unlock (for password / users_and_password modes with smsUnlockEnabled)
  const [smsOtpPhone, setSmsOtpPhone] = useState("");
  const [smsOtpCode, setSmsOtpCode] = useState("");
  const [smsOtpStep, setSmsOtpStep] = useState<"phone" | "code" | null>(null);
  const [smsOtpLoading, setSmsOtpLoading] = useState(false);
  const [smsOtpError, setSmsOtpError] = useState<string | null>(null);
  const [viewLogged, setViewLogged] = useState(false);
  // NDA signing state
  const [ndaName, setNdaName] = useState("");
  const [ndaPhone, setNdaPhone] = useState("");
  const [ndaCode, setNdaCode] = useState("");
  const [ndaStep, setNdaStep] = useState<"phone" | "code" | null>(null);
  const [ndaLoading, setNdaLoading] = useState(false);
  const [ndaError, setNdaError] = useState<string | null>(null);
  const [ndaSigned, setNdaSigned] = useState(false);
  const [ndaAgreed, setNdaAgreed] = useState(false);

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

  const fetchLiveData = useCallback(async (lid: string) => {
    const headers: Record<string, string> = {};
    const webAuth = localStorage.getItem("biz360_web_auth_token");
    if (webAuth) headers["Authorization"] = `Bearer ${webAuth}`;
    const reportToken = localStorage.getItem(`report_token_${lid}`);
    if (reportToken) headers["X-Report-Token"] = reportToken;
    const ndaToken = sessionStorage.getItem(`nda_token_${lid}`);
    if (ndaToken) headers["X-Nda-Token"] = ndaToken;
    const data = await fetch(`/api/public/listing/${lid}`, { headers }).then((r) => r.json()).catch(() => null);
    if (data) setLiveData(data);
  }, []);

  // Load the base listing from the API (data-driven — no hardcoded list).
  useEffect(() => {
    let cancelled = false;
    if (!listingId) { setListingLoading(false); return; }
    setListingLoading(true);
    fetch(`/api/public/listing/${encodeURIComponent(listingId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.listing) { setListing(mapApiListing(d.listing)); setLiveData(d); }
        else setListing(null);
        setListingLoading(false);
      })
      .catch(() => { if (!cancelled) { setListing(null); setListingLoading(false); } });
    return () => { cancelled = true; };
  }, [listingId]);

  // Re-fetch with auth headers once we know the listing (unlocks gated snapshot).
  useEffect(() => {
    if (!listing?.isRealListing) return;
    fetchLiveData(listing.id);
  }, [listing?.id, fetchLiveData]);

  // Fetch public documents for this listing
  useEffect(() => {
    if (!listing?.isRealListing) return;
    fetch(`/api/public/listing-documents/${listing.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.docs) setPublicDocs(d.docs); })
      .catch(() => {});
  }, [listing?.id]);

  const checkAccess = useCallback(async (lid: string) => {
    setAccessChecking(true);
    try {
      const headers: Record<string, string> = {};
      const webAuth = localStorage.getItem("biz360_web_auth_token");
      if (webAuth) headers["Authorization"] = `Bearer ${webAuth}`;
      const reportToken = localStorage.getItem(`report_token_${lid}`);
      if (reportToken) headers["X-Report-Token"] = reportToken;
      const res = await fetch(`/api/public/listing/${lid}/access-check`, { headers });
      if (res.ok) {
        const info = await res.json();
        // Re-fetch live data FIRST so snapshot is ready when we show financials
        if (info.hasAccess) await fetchLiveData(lid);
        setAccessInfo(info);
      } else {
        // Fail closed on error — lock the gate
        setAccessInfo({ mode: "locked", hasAccess: false });
      }
    } catch {
      setAccessInfo({ mode: "locked", hasAccess: false });
    } finally {
      setAccessChecking(false);
    }
  }, [fetchLiveData]);

  // Run access check once per listing ID (not on every liveData change — would loop)
  useEffect(() => {
    if (!listing?.isRealListing) return;
    checkAccess(listing.id);
  }, [listing?.id, checkAccess]);

  // Reset access + NDA state when listing changes
  useEffect(() => {
    setAccessInfo(null);
    setViewLogged(false);
    setNdaName("");
    setNdaPhone("");
    setNdaCode("");
    setNdaStep(null);
    setNdaError(null);
    setNdaAgreed(false);
    setNdaSigned(!!sessionStorage.getItem(`nda_token_${listing?.id ?? ""}`));
  }, [listing?.id]);

  // Reconcile local ndaSigned with server truth — clears stale/expired tokens
  useEffect(() => {
    if (!liveData || !listing?.id) return;
    const ndaMode = (liveData as any)?.ndaMode ?? "none";
    if (ndaMode !== "required") return;
    const serverSigned = !!(liveData as any)?.ndaSigned;
    setNdaSigned(serverSigned);
    if (!serverSigned) {
      sessionStorage.removeItem(`nda_token_${listing.id}`);
    }
  }, [liveData, listing?.id]);

  // Log view when access becomes visible — in effect, not in render
  useEffect(() => {
    if (!accessInfo?.hasAccess || !listing?.id || viewLogged) return;
    setViewLogged(true);
    const lid = listing.id;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const webAuth = localStorage.getItem("biz360_web_auth_token");
    if (webAuth) headers["Authorization"] = `Bearer ${webAuth}`;
    fetch(`/api/public/listing/${lid}/log-view`, {
      method: "POST", headers,
      body: JSON.stringify({ documentType: "financials" }),
    }).catch(() => {});
  }, [accessInfo?.hasAccess, listing?.id, viewLogged]);

  async function handlePasswordUnlock(lid: string) {
    if (!pwdInput) return;
    setPwdChecking(true);
    setPwdError(null);
    try {
      const res = await fetch(`/api/public/listing/${lid}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwdInput }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem(`report_token_${lid}`, data.token);
        setPwdInput("");
        await checkAccess(lid);
      } else {
        setPwdError(data.error ?? "Incorrect password");
      }
    } finally {
      setPwdChecking(false);
    }
  }

  async function handleOtpSend(lid: string) {
    if (!otpPhone.trim()) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch("/api/biz360/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: otpPhone.trim() }),
      });
      if (res.ok) {
        setOtpStep("code");
      } else {
        const d = await res.json();
        setOtpError(d.error ?? "Failed to send code");
      }
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleOtpVerify(lid: string) {
    if (!otpCode.trim()) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch("/api/biz360/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: otpPhone.trim(), code: otpCode.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem("biz360_web_auth_token", data.token);
        setOtpStep(null);
        setOtpCode("");
        const newAccess = await fetch(`/api/public/listing/${lid}/access-check`, {
          headers: { Authorization: `Bearer ${data.token}` },
        }).then((r) => r.json()).catch(() => null);
        if (newAccess) {
          setAccessInfo(newAccess);
          if (!newAccess.hasAccess) setOtpStep("not_granted");
        }
      } else {
        setOtpError(data.error ?? "Incorrect code");
      }
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleSmsUnlockSend(lid: string) {
    if (!smsOtpPhone.trim()) return;
    setSmsOtpLoading(true);
    setSmsOtpError(null);
    try {
      const res = await fetch(`/api/public/listing/${lid}/sms-unlock/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: smsOtpPhone.trim() }),
      });
      if (res.ok) {
        setSmsOtpStep("code");
      } else {
        const d = await res.json();
        setSmsOtpError(d.error ?? "Failed to send code");
      }
    } finally {
      setSmsOtpLoading(false);
    }
  }

  async function handleSmsUnlockVerify(lid: string) {
    if (!smsOtpCode.trim()) return;
    setSmsOtpLoading(true);
    setSmsOtpError(null);
    try {
      const res = await fetch(`/api/public/listing/${lid}/sms-unlock/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: smsOtpPhone.trim(), code: smsOtpCode.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem(`report_token_${lid}`, data.token);
        setSmsOtpStep(null);
        setSmsOtpCode("");
        setSmsOtpPhone("");
        await checkAccess(lid);
      } else {
        setSmsOtpError(data.error ?? "Incorrect code");
      }
    } finally {
      setSmsOtpLoading(false);
    }
  }

  async function handleNdaSend(lid: string) {
    if (!ndaPhone.trim()) return;
    setNdaLoading(true);
    setNdaError(null);
    try {
      const res = await fetch(`/api/public/listing/${lid}/nda/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: ndaPhone.trim() }),
      });
      if (res.ok) {
        setNdaStep("code");
      } else {
        const d = await res.json();
        setNdaError(d.error ?? "Failed to send code");
      }
    } finally {
      setNdaLoading(false);
    }
  }

  async function handleNdaVerify(lid: string) {
    if (!ndaCode.trim()) return;
    setNdaLoading(true);
    setNdaError(null);
    try {
      const res = await fetch(`/api/public/listing/${lid}/nda/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: ndaPhone.trim(), code: ndaCode.trim(), name: ndaName.trim() }),
      });
      if (res.ok) {
        const signed = await res.json();
        sessionStorage.setItem(`nda_token_${lid}`, signed.ndaToken ?? "");
        setNdaSigned(true);
        setNdaStep(null);
        setNdaCode("");
        await fetchLiveData(lid);
        await checkAccess(lid);
      } else {
        const d = await res.json();
        setNdaError(d.error ?? "Incorrect code");
      }
    } finally {
      setNdaLoading(false);
    }
  }

  useEffect(() => {
    if (!listing?.isRealListing) return;
    setSpacesLoading(true);
    Promise.all([
      fetch(`/api/biz360/kv/biz360_tour_spaces_v2_${listing.id}`).then((r) => r.json()),
      fetch(`/api/biz360/kv/biz360_tour_settings_v1_${listing.id}`).then((r) => r.json()).catch(() => null),
    ])
      .then(([spacesData, settingsData]) => {
        const arr = Array.isArray(spacesData) ? spacesData : (Array.isArray(spacesData?.value) ? spacesData.value : []);
        const mapped: TourSpace[] = arr.map((s: any) => ({
          id: s.id,
          name: s.name,
          panoramaUrl: s.panoramaUrl ?? "",
          isStartScene: !!s.isStartScene,
          autoPan: !!s.autoPan,
          audioUrl: s.audioUrl,
          audioName: s.audioName,
          groundPitch: s.groundPitch,
          panoramaStartYaw: s.panoramaStartYaw ?? 0,
          defaultYaw: typeof s.defaultYaw === "number" ? s.defaultYaw : undefined,
          enabled: s.enabled,
          pins: Array.isArray(s.pins) ? s.pins : [],
        }));
        setSpaces(mapped);
        const start = mapped.find((s) => s.isStartScene) ?? mapped[0];
        if (start) setActiveSceneId(start.id);
        const settingsVal = settingsData?.value ?? settingsData;
        setTourAutoPanAll(!!(settingsVal?.autoPanAll));
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

  if (listingLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-muted-foreground" />
      </div>
    );
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

  const liveAskingPrice: number = liveData?.listing?.askingPrice ?? listing.askingPrice;
  const liveWeeklyRevenue: number = liveData?.listing?.weeklyRevenue ?? listing.weeklyRevenue;
  const snap = liveData?.snapshot ?? null;
  const snapshotGated = liveData?.snapshotGated ?? false;
  const liveAdjustedProfit: number =
    snap?.adjustedEbitda != null && parseFloat(snap.adjustedEbitda) > 0
      ? parseFloat(snap.adjustedEbitda)
      : listing.adjustedProfit;
  const hasProfit = liveAdjustedProfit > 0;
  const multiple = hasProfit ? (liveAskingPrice / liveAdjustedProfit).toFixed(1) + "×" : "—";
  // Use fixedAnnualRevenue override when set (bypasses stale API weeklyRevenue)
  const annualRevenue = listing.fixedAnnualRevenue ?? (liveWeeklyRevenue * 52);

  // Headline price + seller stat slots — identical logic to the /listings card
  // and homepage, so every surface shows the same price (incl. From/To range)
  // and the same seller-configured metrics.
  const priceStat = getPriceStat(listing);
  const slot2 = getStatSlot(listing.stat2Display ?? "sde", listing);
  const slot3 = getStatSlot(listing.stat3Display ?? "staffCount", listing);
  const equipStat = getStatSlot("equipmentValue", listing);
  const sidebarStats = [slot2, slot3, equipStat]
    .filter(Boolean) as { value: string; label: string; accent?: boolean }[];

  const audioGroups = spaces
    .filter((s) => s.panoramaUrl && !s.panoramaUrl.startsWith("file://"))
    .filter((s) => s.audioUrl || (s.pins || []).some((p) => p.type === "audio" && p.audioUrl));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      {/* Contextual sub-bar: back to listings + portal shortcut */}
      <div className="border-b border-border bg-background/60">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <Link href="/listings">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
              <ArrowLeft size={16} /> All Listings
            </button>
          </Link>
          {buyerSignedIn && (
            <Link href="/buyers/portal">
              <Button size="sm" variant="outline" className="gap-2"><User size={14} /> My Portal</Button>
            </Link>
          )}
        </div>
      </div>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-6 sm:pb-10 overflow-x-hidden">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 lg:gap-10">
          {/* Left: main content */}
          <div className="lg:col-span-2 flex flex-col gap-6 sm:gap-8 min-w-0">
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
                  autoPanAll={tourAutoPanAll}
                />
              )
            ) : (
              <DemoHero listing={listing} />
            )}

            {/* Audio tour — mobile only, shown right after panorama */}
            {listing.isRealListing && audioGroups.length > 0 && !spacesLoading && (
              <div className="lg:hidden">
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
              </div>
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

            {/* Attached documents — only shown when seller has uploaded any */}
            {publicDocs.length > 0 && (
              <div>
                <h2 className="font-semibold text-lg mb-3">Attached Documents</h2>
                <div className="flex flex-col gap-2">
                  {publicDocs.map((doc) => {
                    const iconMap: Record<string, string> = {
                      valuation: "📊",
                      equipment: "🔧",
                      financials: "📈",
                      other: "📄",
                    };
                    const labelMap: Record<string, string> = {
                      valuation: "Valuation Report",
                      equipment: "Equipment List",
                      financials: "Financial Report",
                      other: "Document",
                    };
                    return (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-card/80 hover:border-primary/40 transition-all group"
                      >
                        <span className="text-xl">{iconMap[doc.docType] ?? "📄"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{doc.title}</div>
                          <div className="text-xs text-muted-foreground">{labelMap[doc.docType] ?? "Document"}</div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          <ExternalLink size={12} /> View
                        </div>
                        <ExternalLink size={14} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: sidebar */}
          <div className="flex flex-col gap-5 min-w-0">
            <div className="lg:sticky lg:top-24 flex flex-col gap-4">
              {/* Price card */}
              <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">{priceStat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{priceStat.label}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {sidebarStats.map((s, i) => (
                    <div key={i} className="bg-background rounded-xl p-3 text-center border border-border">
                      <div className={`text-base font-bold ${s.accent ? "text-green-400" : "text-foreground"}`}>{s.value}</div>
                      <div className="text-[10px] text-muted-foreground font-medium mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  {/* Granted access → View Report; engaged → Messages; else the two CTAs */}
                  {accessInfo?.hasAccess && (
                    <Link href={`/reports/${listing?.id ?? ""}`}>
                      <Button className="w-full gap-2"><FileText size={15} /> View Report</Button>
                    </Link>
                  )}
                  {(hasEngaged || accessInfo?.hasAccess) && (
                    <Link href="/buyers/portal">
                      <Button variant={accessInfo?.hasAccess ? "outline" : "default"} className="w-full gap-2 relative">
                        <MessageSquare size={15} /> Messages
                        {unreadMsgs > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                            {unreadMsgs > 9 ? "9+" : unreadMsgs}
                          </span>
                        )}
                      </Button>
                    </Link>
                  )}
                  {!accessInfo?.hasAccess && (
                    enquirySent ? (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
                        <ShieldCheck size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="text-foreground font-medium">Your {enquiryLabel(enquirySent)} request has been sent.</p>
                          <p className="text-muted-foreground text-xs mt-0.5">The seller has been notified and will be in touch.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Button className="w-full gap-2" disabled={!!enquirySending} onClick={() => handleRequest("info")}>
                          <Mail size={15} /> {enquirySending === "info" ? "Sending…" : "Request Info"}
                        </Button>
                        <Button variant="outline" className="w-full gap-2" disabled={!!enquirySending} onClick={() => handleRequest("call")}>
                          <Phone size={15} /> {enquirySending === "call" ? "Sending…" : "Request a Call"}
                        </Button>
                        <Button variant="outline" className="w-full gap-2" disabled={!!enquirySending} onClick={() => handleRequest("visit")}>
                          <Calendar size={15} /> {enquirySending === "visit" ? "Sending…" : "Request a Site Visit"}
                        </Button>
                      </>
                    )
                  )}
                </div>
              </div>

              {/* About the seller */}
              {sellerCard && (
                <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">About the Seller</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{sellerCard.displayName}</div>
                    {sellerCard.company && <div className="text-xs text-muted-foreground mt-0.5">{sellerCard.company}</div>}
                  </div>
                  {sellerCard.bio && <p className="text-xs text-muted-foreground leading-relaxed">{sellerCard.bio}</p>}
                  {sellerCard.anonymous ? (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Lock size={11} /> This seller is contactable via secure messages only.
                    </p>
                  ) : revealedPhone ? (
                    <a href={`tel:${revealedPhone}`} className="inline-flex items-center gap-2 text-sm font-semibold text-green-400">
                      <Phone size={14} /> {revealedPhone}
                    </a>
                  ) : sellerCard.phoneAvailable ? (
                    <>
                      <Button variant="outline" className="w-full gap-2" onClick={revealSellerPhone} disabled={revealing}>
                        <Phone size={14} /> {revealing ? "Revealing…" : "Show phone number"}
                      </Button>
                      {revealMsg && <p className="text-[11px] text-muted-foreground">{revealMsg}</p>}
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Contact this seller through the message system.</p>
                  )}
                </div>
              )}

              {/* Valuation report — access-gated */}
              {listing.isRealListing && (() => {
                const lid = listing.id;
                const ndaMode = (liveData as any)?.ndaMode ?? "none";
                const ndaThirdPartyUrl = (liveData as any)?.ndaThirdPartyUrl ?? null;

                if (ndaMode === "required" && !ndaSigned) {
                  return (
                    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-blue-400" />
                        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Confidentiality Agreement</span>
                      </div>
                      <p className="text-sm text-foreground font-medium">Sign NDA to view financials</p>
                      <p className="text-[11px] text-muted-foreground">This listing requires a Non-Disclosure Agreement before viewing verified financial data.</p>
                      <NdaDocument
                        listingName={listing.businessName}
                        buyerName={ndaName}
                        buyerPhone={ndaPhone}
                        agreed={ndaAgreed}
                        onAgreeChange={setNdaAgreed}
                      />
                      {ndaStep === null && (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            autoComplete="name"
                            placeholder="Your full name"
                            value={ndaName}
                            onChange={(e) => { setNdaName(e.target.value); setNdaError(null); }}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                          />
                          <input
                            type="tel"
                            placeholder="+61 400 000 000"
                            value={ndaPhone}
                            onChange={(e) => { setNdaPhone(e.target.value); setNdaError(null); }}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                          />
                          {ndaError && <p className="text-xs text-red-400">{ndaError}</p>}
                          <button
                            onClick={() => handleNdaSend(lid)}
                            disabled={ndaLoading || ndaName.trim().length < 2 || !ndaPhone.trim() || !ndaAgreed}
                            className="w-full bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {ndaLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                            I Agree — Verify via SMS
                          </button>
                        </div>
                      )}
                      {ndaStep === "code" && (
                        <div className="flex flex-col gap-2">
                          <p className="text-[11px] text-muted-foreground text-center">Code sent to {ndaPhone}</p>
                          <input
                            type="text"
                            placeholder="Enter 6-digit code"
                            value={ndaCode}
                            maxLength={6}
                            onChange={(e) => { setNdaCode(e.target.value); setNdaError(null); }}
                            onKeyDown={(e) => e.key === "Enter" && handleNdaVerify(lid)}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-center tracking-widest"
                          />
                          {ndaError && <p className="text-xs text-red-400">{ndaError}</p>}
                          <button
                            onClick={() => handleNdaVerify(lid)}
                            disabled={ndaLoading || ndaCode.length < 4}
                            className="w-full bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {ndaLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                            Confirm Signature
                          </button>
                          <button onClick={() => { setNdaStep(null); setNdaCode(""); setNdaError(null); }} className="text-[11px] text-muted-foreground underline text-center">
                            Change phone number
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }

                if (ndaMode === "third_party") {
                  return (
                    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-blue-400" />
                        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">NDA Required</span>
                      </div>
                      <p className="text-sm text-foreground font-medium">Sign the seller's NDA first</p>
                      <p className="text-[11px] text-muted-foreground">The seller requires a Non-Disclosure Agreement before accessing the verified financials.</p>
                      {ndaThirdPartyUrl && (
                        <a
                          href={ndaThirdPartyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2"
                        >
                          <ExternalLink size={14} /> Open NDA Document
                        </a>
                      )}
                      <p className="text-[11px] text-muted-foreground text-center border border-border rounded-xl p-3">
                        Once you've signed the NDA, contact the seller directly to request access to the verified financials.
                      </p>
                    </div>
                  );
                }

                if (!snap && !snapshotGated) return null;
                const mode = accessInfo?.mode ?? "locked";
                const hasAccess = accessInfo?.hasAccess ?? false;
                const smsUnlock = (accessInfo as any)?.smsUnlockEnabled ?? false;
                const needsPassword = (mode === "password" || mode === "users_and_password") && !hasAccess;
                const needsUser = (mode === "users") && !hasAccess;

                const FinancialsContent = () => {
                  if (!snap) return (
                    <div className="bg-card border border-green-500/20 rounded-2xl p-5 flex items-center gap-3">
                      <Loader2 size={16} className="animate-spin text-green-400" />
                      <span className="text-xs text-muted-foreground">Loading financials…</span>
                    </div>
                  );
                  return (
                  <div className="bg-card border border-green-500/20 rounded-2xl p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Verified Financials</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {snap.valuationMidpoint != null && parseFloat(snap.valuationMidpoint) > 0 && (
                        <div className="bg-background rounded-xl p-3 text-center border border-border col-span-2">
                          <div className="text-lg font-bold text-amber-400">{formatPrice(parseFloat(snap.valuationMidpoint))}</div>
                          <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Calculated Valuation</div>
                        </div>
                      )}
                      {snap.adjustedEbitda != null && parseFloat(snap.adjustedEbitda) > 0 && (
                        <div className="bg-background rounded-xl p-3 text-center border border-border">
                          <div className="text-sm font-bold text-green-400">${(parseFloat(snap.adjustedEbitda) / 1000).toFixed(0)}K</div>
                          <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Adj. EBITDA p.a.</div>
                        </div>
                      )}
                      {snap.grossRevenue != null && parseFloat(snap.grossRevenue) > 0 && (
                        <div className="bg-background rounded-xl p-3 text-center border border-border">
                          <div className="text-sm font-bold">${(parseFloat(snap.grossRevenue) / 1000).toFixed(0)}K</div>
                          <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Gross Revenue</div>
                        </div>
                      )}
                      {snap.periodMonths != null && (
                        <div className="bg-background rounded-xl p-3 text-center border border-border col-span-2">
                          <div className="text-sm font-bold">{snap.periodMonths} months</div>
                          <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Financial period analysed</div>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Financials verified by EXIT360 via connected accounting & POS integrations.
                    </p>
                  </div>
                  );
                };

                if (accessChecking && !accessInfo) {
                  return (
                    <div className="bg-card border border-green-500/20 rounded-2xl p-5 flex items-center gap-3">
                      <Loader2 size={16} className="animate-spin text-green-400" />
                      <span className="text-xs text-muted-foreground">Checking access…</span>
                    </div>
                  );
                }

                if (hasAccess || mode === "public") return <FinancialsContent />;

                if (needsPassword) return (
                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <Lock size={14} className="text-amber-400" />
                      <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Verified Financials</span>
                    </div>
                    <div className="text-center py-2">
                      <KeyRound size={28} className="mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-foreground font-medium">Password required</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Enter the password provided by the seller to view the financials.</p>
                    </div>
                    {smsOtpStep === null && (
                      <div className="flex flex-col gap-2">
                        <input
                          type="password"
                          placeholder="Enter password"
                          value={pwdInput}
                          onChange={(e) => { setPwdInput(e.target.value); setPwdError(null); }}
                          onKeyDown={(e) => e.key === "Enter" && handlePasswordUnlock(lid)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        />
                        {pwdError && <p className="text-xs text-red-400">{pwdError}</p>}
                        <button
                          onClick={() => handlePasswordUnlock(lid)}
                          disabled={pwdChecking || !pwdInput}
                          className="w-full bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {pwdChecking ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                          Unlock Financials
                        </button>
                        {smsUnlock && (
                          <button
                            onClick={() => setSmsOtpStep("phone")}
                            className="text-[11px] text-primary underline text-center mt-1"
                          >
                            Don't have the password? Get it via SMS →
                          </button>
                        )}
                      </div>
                    )}
                    {smsOtpStep === "phone" && (
                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] text-muted-foreground text-center">Enter your mobile number to receive a one-time code</p>
                        <input
                          type="tel"
                          placeholder="+61 400 000 000"
                          value={smsOtpPhone}
                          onChange={(e) => { setSmsOtpPhone(e.target.value); setSmsOtpError(null); }}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        />
                        {smsOtpError && <p className="text-xs text-red-400">{smsOtpError}</p>}
                        <button
                          onClick={() => handleSmsUnlockSend(lid)}
                          disabled={smsOtpLoading || !smsOtpPhone.trim()}
                          className="w-full bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {smsOtpLoading ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
                          Send code via SMS
                        </button>
                        <button onClick={() => { setSmsOtpStep(null); setSmsOtpError(null); }} className="text-[11px] text-muted-foreground underline text-center">
                          Back to password
                        </button>
                      </div>
                    )}
                    {smsOtpStep === "code" && (
                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] text-muted-foreground text-center">Code sent to {smsOtpPhone}</p>
                        <input
                          type="text"
                          placeholder="Enter 6-digit code"
                          value={smsOtpCode}
                          maxLength={6}
                          onChange={(e) => { setSmsOtpCode(e.target.value); setSmsOtpError(null); }}
                          onKeyDown={(e) => e.key === "Enter" && handleSmsUnlockVerify(lid)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-center tracking-widest"
                        />
                        {smsOtpError && <p className="text-xs text-red-400">{smsOtpError}</p>}
                        <button
                          onClick={() => handleSmsUnlockVerify(lid)}
                          disabled={smsOtpLoading || smsOtpCode.length < 4}
                          className="w-full bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {smsOtpLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                          Verify & Unlock
                        </button>
                        <button onClick={() => { setSmsOtpStep("phone"); setSmsOtpCode(""); setSmsOtpError(null); }} className="text-[11px] text-muted-foreground underline text-center">
                          Change phone number
                        </button>
                      </div>
                    )}
                  </div>
                );

                if (needsUser || (mode === "users_and_password" && !hasAccess)) return (
                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <Lock size={14} className="text-amber-400" />
                      <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Verified Financials</span>
                    </div>
                    {otpStep === "not_granted" ? (
                      <div className="text-center py-4 flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <Lock size={18} className="text-amber-400" />
                        </div>
                        <p className="text-sm text-foreground font-medium">Access not yet granted</p>
                        <p className="text-[11px] text-muted-foreground max-w-[240px] text-center leading-relaxed">
                          Your phone number ({otpPhone}) hasn't been added to the approved buyers list. Contact the seller to request access.
                        </p>
                        <button
                          onClick={() => { setOtpStep(null); setOtpPhone(""); setOtpCode(""); }}
                          className="text-[11px] text-primary underline"
                        >
                          Try a different number
                        </button>
                      </div>
                    ) : (
                    <>
                    <div className="text-center py-2">
                      <Lock size={28} className="mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-foreground font-medium">Verify your identity</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {mode === "users" ? "Verify your phone to check if you have access." : "Sign in with your phone to unlock."}
                      </p>
                    </div>
                    {otpStep === null && (
                      <div className="flex flex-col gap-2">
                        <input
                          type="tel"
                          placeholder="+61 400 000 000"
                          value={otpPhone}
                          onChange={(e) => { setOtpPhone(e.target.value); setOtpError(null); }}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        />
                        {otpError && <p className="text-xs text-red-400">{otpError}</p>}
                        <button
                          onClick={() => handleOtpSend(lid)}
                          disabled={otpLoading || !otpPhone.trim()}
                          className="w-full bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {otpLoading ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
                          Send verification code
                        </button>
                      </div>
                    )}
                    {otpStep === "code" && (
                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] text-muted-foreground text-center">Code sent to {otpPhone}</p>
                        <input
                          type="text"
                          placeholder="Enter 6-digit code"
                          value={otpCode}
                          maxLength={6}
                          onChange={(e) => { setOtpCode(e.target.value); setOtpError(null); }}
                          onKeyDown={(e) => e.key === "Enter" && handleOtpVerify(lid)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-center tracking-widest"
                        />
                        {otpError && <p className="text-xs text-red-400">{otpError}</p>}
                        <button
                          onClick={() => handleOtpVerify(lid)}
                          disabled={otpLoading || otpCode.length < 4}
                          className="w-full bg-primary text-primary-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {otpLoading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                          Verify & Unlock
                        </button>
                        <button onClick={() => { setOtpStep(null); setOtpCode(""); setOtpError(null); }} className="text-[11px] text-muted-foreground underline text-center">Change phone number</button>
                      </div>
                    )}
                    </>
                    )}
                  </div>
                );

                return <FinancialsContent />;
              })()}

              {/* Audio directory — desktop only (mobile version is above the panorama) */}
              {listing.isRealListing && audioGroups.length > 0 && !spacesLoading && (
                <div className="hidden lg:block"><AudioDirectory
                  spaces={spaces}
                  iframeRef={iframeRef}
                  playingId={playingId}
                  pausedId={pausedId}
                  onPlay={handlePlay}
                  onNavigate={navigateToSpace}
                  playAllActive={playAllActive}
                  onPlayAll={handlePlayAll}
                  onStopAll={handleStopAll}
                /></div>
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
