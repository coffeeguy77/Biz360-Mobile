import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PinSheet } from "@/components/PinSheet";
import { TourViewer } from "@/components/TourViewer";
import { DEMO_LISTINGS, TourPin, TourSpace } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { trackEvent } from "@/lib/analyticsStore";
import { useAuth } from "@/context/AuthContext";
import { getTourSpaces, getTourSettings, addTourRequest, REQUEST_CATEGORIES } from "@/lib/tourStore";
import { DEFAULT_TOUR_SETTINGS, TourSettings } from "@/data/listings";

const PIN_LEGEND: Record<string, { feather: string; color: string; label: string; desc: string }> = {
  navigation:   { feather: "arrow-right-circle", color: "#2563EB", label: "Navigate",   desc: "Move to another room or area of the business" },
  audio:        { feather: "volume-2",           color: "#EC4899", label: "Audio",      desc: "Tap to play the seller's narration for this spot" },
  look:         { feather: "eye",                color: "#0EA5E9", label: "Look",        desc: "Zoom in to this area for a closer view" },
  equipment:    { feather: "tool",               color: "#F59E0B", label: "Equipment",  desc: "Details about machinery, fixtures, or tools here" },
  revenue:      { feather: "trending-up",        color: "#16A34A", label: "Revenue",    desc: "Revenue streams or income generated from this area" },
  cogs:         { feather: "package",            color: "#EF4444", label: "COGS",       desc: "Cost of goods, supplies, or raw materials" },
  workflow:     { feather: "git-branch",         color: "#8B5CF6", label: "Workflow",   desc: "How work flows through this part of the business" },
  staffing:     { feather: "users",              color: "#3B82F6", label: "Staffing",   desc: "Staff roles, headcount, or responsibilities here" },
  lease:        { feather: "home",               color: "#F97316", label: "Lease",      desc: "Lease terms, rent, or property information" },
  risk:         { feather: "alert-triangle",     color: "#EF4444", label: "Risk",       desc: "Potential risk or issue to be aware of" },
  opportunity:  { feather: "star",               color: "#16A34A", label: "Opportunity",desc: "Growth opportunity or underutilised potential" },
  highlight:    { feather: "zap",                color: "#F59E0B", label: "Highlight",  desc: "Key selling point or standout feature" },
  document:     { feather: "file-text",          color: "#6366F1", label: "Document",   desc: "View a document, report, or certification" },
  inspection:   { feather: "clipboard",          color: "#06B6D4", label: "Inspection", desc: "Inspection record or compliance note" },
  external_link:{ feather: "external-link",      color: "#0891B2", label: "Link",       desc: "Opens an external website or resource" },
  narration:    { feather: "mic",                color: "#EC4899", label: "Narration",  desc: "Seller voice note about this area" },
};

const PIN_DISPLAY: Record<string, { color: string; label: string }> = {
  navigation:   { color: "#2563EB", label: "Navigate"   },
  look:         { color: "#0EA5E9", label: "Look"       },
  equipment:    { color: "#F59E0B", label: "Equipment"  },
  revenue:      { color: "#16A34A", label: "Revenue"    },
  cogs:         { color: "#EF4444", label: "COGS"       },
  workflow:     { color: "#8B5CF6", label: "Workflow"   },
  staffing:     { color: "#3B82F6", label: "Staffing"   },
  lease:        { color: "#F97316", label: "Lease"      },
  risk:         { color: "#EF4444", label: "Risk"       },
  opportunity:  { color: "#16A34A", label: "Opportunity"},
  narration:    { color: "#EC4899", label: "Narration"  },
  inspection:   { color: "#06B6D4", label: "Inspection" },
  highlight:    { color: "#F59E0B", label: "Highlight"  },
  document:     { color: "#6366F1", label: "Document"   },
  external_link:{ color: "#0891B2", label: "Link"       },
  audio:        { color: "#EC4899", label: "Audio"      },
};

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Pulsing animated navigation arrow ────────────────────────────────────────
// Three chevrons wave sequentially (like a scroll-indicator) to gently invite
// the user to navigate, without the visual weight of a pill button.
function AnimatedNavArrow({
  direction, label, onPress, bottom,
}: {
  direction: "left" | "right";
  label: string;
  onPress: () => void;
  bottom: number;
}) {
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const a3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const FADE = 280;
    const STEP = 170;
    const PAUSE = 700;
    const TOTAL = STEP * 2 + FADE * 2 + PAUSE;

    function wave(anim: Animated.Value, delay: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: FADE, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.08, duration: FADE, useNativeDriver: true }),
          Animated.delay(TOTAL - delay - FADE * 2),
        ]),
      );
    }

    // For "right": leftmost chevron leads (a1→a2→a3)
    // For "left": rightmost chevron leads (a3→a2→a1)
    const [first, second, third] =
      direction === "right" ? [a1, a2, a3] : [a3, a2, a1];

    const anim = Animated.parallel([
      wave(first,  0),
      wave(second, STEP),
      wave(third,  STEP * 2),
    ]);
    anim.start();
    return () => anim.stop();
  }, [direction]);

  const icon = direction === "left" ? "chevron-left" : "chevron-right";
  const side = direction === "left" ? { left: 14 } : { right: 14 };

  return (
    <TouchableOpacity
      style={[{ position: "absolute", zIndex: 10, bottom, alignItems: "center" }, side]}
      onPress={onPress}
      activeOpacity={0.6}
      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {[a1, a2, a3].map((anim, i) => (
          <Animated.View key={i} style={{ opacity: anim }}>
            <Feather name={icon} size={26} color="#fff" style={{ textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }} />
          </Animated.View>
        ))}
      </View>
      <Text style={{
        color: "rgba(255,255,255,0.75)", fontSize: 10,
        fontFamily: "Inter_600SemiBold", marginTop: 3,
        textShadowColor: "rgba(0,0,0,0.9)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
        maxWidth: 90, textAlign: "center",
      }} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function TourScreen() {
  const { id, startSpace } = useLocalSearchParams<{ id: string; startSpace?: string }>();
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();
  const buyerId  = user?.id ?? "guest";

  const listing     = DEMO_LISTINGS.find((l) => l.id === id);
  const [kvSpaces,  setKvSpaces]  = useState<TourSpace[]>([]);
  const [kvFetched, setKvFetched] = useState(false);
  const [kvLoading, setKvLoading] = useState(true);
  const tourTrackedRef = useRef(false);

  // ── Audio state ─────────────────────────────────────────────────────────────
  const soundRef           = useRef<Audio.Sound | null>(null);
  const [audioPlaying,     setAudioPlaying]     = useState(false);
  const [audioPosMs,       setAudioPosMs]       = useState(0);
  const [audioDurMs,       setAudioDurMs]       = useState(0);
  const [audioLoading,     setAudioLoading]     = useState(false);
  const [showTranscript,   setShowTranscript]   = useState(false);
  const currentAudioUrlRef = useRef<string | null>(null);

  // ── Request More Info state ──────────────────────────────────────────────────
  const [showRequestSheet, setShowRequestSheet] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [reqMessage,       setReqMessage]       = useState("");
  const [reqSending,       setReqSending]       = useState(false);

  // ── Combine demo + KV spaces (KV takes precedence once fetched) ─────────────
  // kvFetched=true means the KV key was read; even an empty array is authoritative
  const allSpaces: TourSpace[] = useMemo(() => {
    if (kvFetched) return kvSpaces;
    return listing?.tourSpaces ?? [];
  }, [listing, kvSpaces, kvFetched]);

  const resolvedStartIdx = useMemo(() => {
    if (startSpace) return Math.max(0, parseInt(startSpace, 10));
    const idx = allSpaces.findIndex((s) => s.isStartScene);
    return idx >= 0 ? idx : 0;
  }, [startSpace, allSpaces]);

  const [activeSpaceIdx, setActiveSpaceIdx] = useState(resolvedStartIdx);
  const [activePin,      setActivePin]      = useState<TourPin | null>(null);
  const [focusPin,       setFocusPin]       = useState<TourPin | null>(null);
  const [showRoomNav,       setShowRoomNav]       = useState(false);
  const [showAudioOnboarding, setShowAudioOnboarding] = useState(false);
  const [showTourGuide,     setShowTourGuide]     = useState(false);
  const arrowAnim = useRef(new Animated.Value(0)).current;

  // ── Tour settings ────────────────────────────────────────────────────────────
  const [tourSettings, setTourSettings] = useState<TourSettings>(DEFAULT_TOUR_SETTINGS);

  // ── Load KV spaces + settings ────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    getTourSpaces(id).then((spaces) => {
      setKvSpaces(spaces);   // always apply — empty [] is authoritative v2 state
      setKvFetched(true);
      setKvLoading(false);
    });
    getTourSettings(id).then((s) => setTourSettings(s));
  }, [id]);

  // Apply start scene once KV spaces load
  useEffect(() => {
    if (!startSpace && allSpaces.length > 0) {
      const idx = allSpaces.findIndex((s) => s.isStartScene);
      if (idx >= 0) setActiveSpaceIdx(idx);
    }
  }, [allSpaces.length, startSpace]);

  // Track tour start
  useEffect(() => {
    if (kvLoading || tourTrackedRef.current || !id || allSpaces.length === 0) return;
    tourTrackedRef.current = true;
    trackEvent(id, "tour_start", buyerId);
  }, [id, kvLoading, allSpaces.length, buyerId]);

  // ── Audio cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  // ── Stop audio when scene changes ────────────────────────────────────────────
  const prevSpaceIdxRef = useRef(activeSpaceIdx);
  useEffect(() => {
    if (prevSpaceIdxRef.current === activeSpaceIdx) return;
    prevSpaceIdxRef.current = activeSpaceIdx;
    (async () => {
      if (!soundRef.current) return;
      try { await soundRef.current.stopAsync(); } catch { /* ignore */ }
      try { await soundRef.current.unloadAsync(); } catch { /* ignore */ }
      soundRef.current = null;
      currentAudioUrlRef.current = null;
    })();
    setAudioPlaying(false);
    setAudioPosMs(0);
    setAudioDurMs(0);
    setAudioLoading(false);
    setShowTranscript(false);
  }, [activeSpaceIdx]);

  const safeIdx     = Math.min(activeSpaceIdx, Math.max(0, allSpaces.length - 1));
  const activeSpace = allSpaces[safeIdx];

  // ── One-time audio onboarding ────────────────────────────────────────────────
  useEffect(() => {
    const spaceHasAudio =
      !!(activeSpace?.audioUrl) ||
      (activeSpace?.pins ?? []).some((p) => p.type === "audio");
    if (!spaceHasAudio) return;
    AsyncStorage.getItem("biz360_audio_onboarding_seen").then((val) => {
      if (!val) setShowAudioOnboarding(true);
    });
  }, [activeSpaceIdx]);

  // ── Bouncing arrow animation ─────────────────────────────────────────────────
  useEffect(() => {
    if (!showAudioOnboarding) return;
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 10, duration: 500, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 0,  duration: 500, useNativeDriver: true }),
      ])
    );
    bounce.start();
    return () => bounce.stop();
  }, [showAudioOnboarding]);

  // ── Audio playback ───────────────────────────────────────────────────────────
  const playAudio = async (url: string) => {
    // Toggle pause/resume if same URL loaded
    if (soundRef.current && currentAudioUrlRef.current === url) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await soundRef.current.pauseAsync();
            setAudioPlaying(false);
          } else {
            await soundRef.current.playAsync();
            setAudioPlaying(true);
          }
          return;
        }
      } catch { /* fall through to reload */ }
    }

    // Unload any previous sound
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch { /* ignore */ }
      soundRef.current = null;
    }

    setAudioLoading(true);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setAudioPlaying(status.isPlaying ?? false);
          setAudioPosMs(status.positionMillis ?? 0);
          setAudioDurMs(status.durationMillis ?? 0);
          if (status.didJustFinish) {
            setAudioPlaying(false);
            setAudioPosMs(0);
          }
        },
      );
      soundRef.current = sound;
      currentAudioUrlRef.current = url;
      setAudioPlaying(true);
    } catch {
      if (/^https?:\/\//i.test(url)) Linking.openURL(url).catch(() => {});
    } finally {
      setAudioLoading(false);
    }
  };

  // ── Pin press handler ────────────────────────────────────────────────────────
  const handlePinPress = (pin: TourPin) => {
    if (pin.type === "navigation" && pin.targetSpaceId) {
      const targetIdx = allSpaces.findIndex((s) => s.id === pin.targetSpaceId);
      if (targetIdx >= 0) { setActiveSpaceIdx(targetIdx); setFocusPin(null); return; }
    }
    if (pin.type === "external_link" && pin.externalUrl) {
      if (/^https?:\/\//i.test(pin.externalUrl)) Linking.openURL(pin.externalUrl).catch(() => {});
      return;
    }
    if (pin.type === "document" && pin.documentUrl) {
      if (/^https?:\/\//i.test(pin.documentUrl)) Linking.openURL(pin.documentUrl).catch(() => {});
      return;
    }
    if (pin.type === "audio" && pin.audioUrl) {
      playAudio(pin.audioUrl);
      return;
    }
    setActivePin(pin);
  };

  // ── Request More Info ────────────────────────────────────────────────────────
  const handleSubmitRequest = async () => {
    if (!selectedCategory) {
      Alert.alert("Select a category", "Please select what you'd like to know more about.");
      return;
    }
    setReqSending(true);
    try {
      await addTourRequest({
        id:        `req-${Date.now()}`,
        listingId: id ?? "",
        buyerId,
        buyerName: user?.name ?? "Buyer",
        category:  selectedCategory,
        message:   reqMessage.trim(),
        timestamp: Date.now(),
        status:    "new",
      });
      setShowRequestSheet(false);
      setSelectedCategory("");
      setReqMessage("");
      Alert.alert("Request sent!", "The seller will be notified and respond via messages.");
    } catch {
      Alert.alert("Error", "Could not send request. Please try again.");
    } finally { setReqSending(false); }
  };

  // ── Derived view data (must be above early returns to keep hook order stable) ─
  const hasAudio        = !!(activeSpace?.audioUrl) && activeSpace.audioTrigger !== "hotspot";
  const hasAudioHotspot = !!(activeSpace?.audioUrl) && activeSpace.audioTrigger === "hotspot";
  const showAudioBar    = tourSettings.showNarrationBar &&
    (hasAudio || (hasAudioHotspot && (audioPlaying || audioLoading || audioDurMs > 0)));
  const hasTranscript   = !!(activeSpace?.audioTranscript?.trim());
  const audioPct        = audioDurMs > 0 ? audioPosMs / audioDurMs : 0;

  const infoTypes = useMemo(() => {
    const seen  = new Set<string>();
    const types: string[] = [];
    for (const p of (activeSpace?.pins ?? [])) {
      if (p.type === "navigation" || p.type === "external_link" || p.type === "audio" || p.type === "look") continue;
      if (!seen.has(p.type)) { seen.add(p.type); types.push(p.type); }
    }
    return types;
  }, [activeSpace?.pins]);

  const tourLegend = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ type: string; feather: string; color: string; label: string; desc: string }> = [];
    for (const space of allSpaces) {
      for (const pin of (space.pins ?? [])) {
        if (!seen.has(pin.type)) {
          seen.add(pin.type);
          const cfg = PIN_LEGEND[pin.type];
          if (cfg) items.push({ type: pin.type, ...cfg });
        }
      }
    }
    return items;
  }, [allSpaces]);

  // ── Loading / empty states ───────────────────────────────────────────────────
  if (kvLoading && !listing) {
    return (
      <View style={[styles.center, { backgroundColor: "#071221" }]}>
        <Feather name="rotate-ccw" size={28} color="#3B82F6" />
        <Text style={styles.noTourText}>Loading tour…</Text>
      </View>
    );
  }

  if (allSpaces.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: "#071221" }]}>
        <Feather name="camera-off" size={40} color="#3B82F6" />
        <Text style={styles.noTourText}>No tour spaces yet</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const shownTypes  = infoTypes.slice(0, 3);
  const shownCount  = shownTypes.reduce((s, t) => s + (activeSpace?.pins ?? []).filter((p) => p.type === t).length, 0);
  const extraCount  = (activeSpace?.pins.length ?? 0) - shownCount;
  const navPinCount = (activeSpace?.pins ?? []).filter((p) => p.type === "navigation").length;
  const bottomBase  = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={styles.container}>
      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Feather name="x" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.tourInfo}>
          <Text style={styles.tourTitle} numberOfLines={1}>{listing?.businessName ?? "Tour"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.tourSpace}>{activeSpace?.name}</Text>
            {activeSpace?.isStartScene && (
              <View style={styles.startBadge}>
                <Feather name="home" size={9} color="#fff" />
              </View>
            )}
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {allSpaces.length > 1 && (
            <TouchableOpacity
              style={[styles.navPill, { backgroundColor: showRoomNav ? "rgba(59,130,246,0.85)" : "rgba(0,0,0,0.45)" }]}
              onPress={() => setShowRoomNav((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="map" size={13} color={showRoomNav ? "#fff" : "rgba(255,255,255,0.5)"} />
              <Text style={[styles.navPillText, { color: showRoomNav ? "#fff" : "rgba(255,255,255,0.5)" }]}>NAV</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowTourGuide(true)}>
            <Feather name="help-circle" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Animated room nav arrows ── */}
      {showRoomNav && allSpaces.length > 1 && safeIdx > 0 && (
        <AnimatedNavArrow
          direction="left"
          label={allSpaces[safeIdx - 1].name}
          bottom={bottomBase + 140}
          onPress={() => { setActiveSpaceIdx(safeIdx - 1); setFocusPin(null); }}
        />
      )}
      {showRoomNav && allSpaces.length > 1 && safeIdx < allSpaces.length - 1 && (
        <AnimatedNavArrow
          direction="right"
          label={allSpaces[safeIdx + 1].name}
          bottom={bottomBase + 140}
          onPress={() => { setActiveSpaceIdx(safeIdx + 1); setFocusPin(null); }}
        />
      )}

      <TourViewer
        key={activeSpace?.id}
        space={activeSpace}
        onPinPress={handlePinPress}
        focusPin={focusPin}
        onFocusPinHandled={() => setFocusPin(null)}
        tourSettings={tourSettings}
      />

      {/* ── Audio hotspot pin (hotspot trigger) ── */}
      {hasAudioHotspot && (
        <TouchableOpacity
          style={[styles.audioHotspot, { bottom: bottomBase + 140 }]}
          onPress={() => playAudio(activeSpace!.audioUrl!)}
          disabled={audioLoading}
          activeOpacity={0.8}
        >
          <View style={[styles.audioHotspotInner, audioPlaying && { backgroundColor: "#BE185D" }]}>
            <Feather
              name={audioLoading ? "loader" : audioPlaying ? "pause" : "volume-2"}
              size={22}
              color="#fff"
            />
          </View>
          <Text style={styles.audioHotspotLabel}>
            {audioLoading ? "Loading…" : audioPlaying ? "Pause" : "Narration"}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Audio bar — floats above bottom overlay, clears the nav hint ── */}
      {showAudioBar && (
        <View style={[styles.audioBarWrap, { bottom: bottomBase + 72 }]}>
          <View style={[styles.audioBarInner, { borderColor: audioPlaying ? "#EC4899" : "#EC489940" }]}>
            <Feather name="volume-2" size={14} color="#EC4899" />
            <View style={{ flex: 1 }}>
              <Text style={styles.audioBarText}>
                {audioLoading
                  ? "Loading narration…"
                  : audioPlaying && audioDurMs > 0
                  ? `${fmtMs(audioPosMs)} / ${fmtMs(audioDurMs)}`
                  : "Seller narration"}
              </Text>
              {audioDurMs > 0 && (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(audioPct * 100)}%` as any }]} />
                </View>
              )}
            </View>
            {hasTranscript && (
              <TouchableOpacity
                onPress={() => setShowTranscript((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Feather name={showTranscript ? "eye-off" : "file-text"} size={14} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.audioPlayBtn, audioLoading && { opacity: 0.6 }]}
              onPress={() => playAudio(currentAudioUrlRef.current ?? activeSpace!.audioUrl!)}
              disabled={audioLoading}
            >
              <Feather name={audioLoading ? "loader" : audioPlaying ? "pause" : "play"} size={11} color="#fff" />
              <Text style={styles.audioPlayBtnText}>
                {audioLoading ? "…" : audioPlaying ? "Pause" : "Play"}
              </Text>
            </TouchableOpacity>
          </View>
          {showTranscript && hasTranscript && (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptText}>{activeSpace!.audioTranscript}</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Bottom overlay ── */}
      <View style={[styles.bottomOverlay, { paddingBottom: bottomBase + 8 }]}>
        <View style={styles.legendRow}>
          {shownTypes.length > 0 && (
            <View style={styles.pinLegend}>
              {shownTypes.map((type) => {
                const cfg      = PIN_DISPLAY[type] ?? { color: "#3B82F6", label: type };
                const firstPin = activeSpace.pins.find((p) => p.type === type)!;
                return (
                  <TouchableOpacity
                    key={type}
                    style={styles.legendItem}
                    onPress={() => setFocusPin(firstPin)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <View style={[styles.legendDot, { backgroundColor: cfg.color }]} />
                    <Text style={styles.legendText}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {extraCount > 0 && (
                <Text style={styles.legendMore}>+{extraCount}</Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* ── One-time audio onboarding overlay ── */}
      {showAudioOnboarding && (
        <View style={styles.onboardingOverlay}>
          <View style={styles.onboardingCard}>
            <View style={styles.onboardingIconRow}>
              <View style={styles.onboardingIconBubble}>
                <Feather name="mic" size={20} color="#EC4899" />
              </View>
              <Text style={styles.onboardingTitle}>Audio-narrated business</Text>
            </View>
            <Text style={styles.onboardingBody}>
              This listing is optimised with narration. Whenever you see the pulsing{" "}
              <Text style={{ color: "#EC4899" }}>🎙</Text>
              {" "}icon in the tour, or the player bar — tap it to hear the seller's message directly.
            </Text>
            <Animated.View style={{ alignItems: "center", marginVertical: 12, transform: [{ translateY: arrowAnim }] }}>
              <Feather name="arrow-down" size={26} color="#EC4899" />
            </Animated.View>
            <TouchableOpacity
              style={styles.onboardingBtn}
              onPress={async () => {
                await AsyncStorage.setItem("biz360_audio_onboarding_seen", "1");
                setShowAudioOnboarding(false);
              }}
            >
              <Text style={styles.onboardingBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <PinSheet pin={activePin} onClose={() => setActivePin(null)} />

      {/* ── Tour Guide sheet ── */}
      <Modal
        visible={showTourGuide}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTourGuide(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowTourGuide(false)} />
          <View style={[styles.guideSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Tour Guide</Text>
              <TouchableOpacity onPress={() => setShowTourGuide(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* ── How to navigate ── */}
              <Text style={[styles.guideSectionTitle, { color: colors.foreground }]}>How to navigate</Text>
              {[
                { icon: "move",             hint: "Drag or swipe to look around in 360°" },
                { icon: "mouse-pointer",    hint: "Tap any coloured pin to view its details" },
                ...(allSpaces.length > 1 ? [
                  { icon: "chevrons-right", hint: "Use the ← → arrows to walk between rooms" },
                  { icon: "map",            hint: "Tap NAV (top right) to see all rooms at once" },
                ] : []),
              ].map(({ icon, hint }) => (
                <View key={hint} style={styles.guideNavRow}>
                  <View style={[styles.guideNavIcon, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
                    <Feather name={icon as any} size={15} color={colors.primary} />
                  </View>
                  <Text style={[styles.guideNavHint, { color: colors.foreground }]}>{hint}</Text>
                </View>
              ))}

              {/* ── Icon legend ── */}
              {tourLegend.length > 0 && (
                <>
                  <View style={[styles.guideDivider, { backgroundColor: colors.border }]} />
                  <Text style={[styles.guideSectionTitle, { color: colors.foreground }]}>
                    Icons in this tour
                  </Text>
                  <Text style={[styles.guideSectionHint, { color: colors.mutedForeground }]}>
                    Tap any coloured circle in the tour to open it
                  </Text>
                  {tourLegend.map(({ type, feather, color, label, desc }) => (
                    <View key={type} style={[styles.guideLegendRow, { borderBottomColor: colors.border }]}>
                      <View style={[styles.guideLegendIcon, { backgroundColor: color + "20", borderColor: color + "50" }]}>
                        <Feather name={feather as any} size={16} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.guideLegendLabel, { color: colors.foreground }]}>{label}</Text>
                        <Text style={[styles.guideLegendDesc, { color: colors.mutedForeground }]}>{desc}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* ── Request more info ── */}
              <View style={[styles.guideDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={[styles.guideRequestBtn, { backgroundColor: colors.primary }]}
                onPress={() => { setShowTourGuide(false); setTimeout(() => setShowRequestSheet(true), 300); }}
              >
                <Feather name="send" size={15} color="#fff" />
                <Text style={styles.guideRequestBtnText}>Request Info from Seller</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Request More Info modal ── */}
      <Modal
        visible={showRequestSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRequestSheet(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowRequestSheet(false)} />
          <View style={[styles.requestSheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Request More Info</Text>
              <TouchableOpacity onPress={() => setShowRequestSheet(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.sheetHint, { color: colors.mutedForeground }]}>
              What would you like the seller to show or explain?
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.categoryGrid}>
                {REQUEST_CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catBtn, {
                        backgroundColor: active ? "#3B82F618" : colors.background,
                        borderColor:     active ? "#3B82F6"   : colors.border,
                      }]}
                      onPress={() => setSelectedCategory(active ? "" : cat.id)}
                    >
                      <Feather name={cat.icon as any} size={20} color={active ? "#3B82F6" : colors.mutedForeground} />
                      <Text style={[styles.catBtnText, { color: active ? "#3B82F6" : colors.foreground }]}>{cat.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.noteLabel, { color: colors.mutedForeground }]}>ADD A NOTE (OPTIONAL)</Text>
              <TextInput
                style={[styles.msgInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="e.g. I'd love to see the back storage room and the EFTPOS setup…"
                placeholderTextColor={colors.mutedForeground}
                value={reqMessage}
                onChangeText={setReqMessage}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: reqSending || !selectedCategory ? colors.mutedForeground : "#3B82F6" }]}
                onPress={handleSubmitRequest}
                disabled={reqSending || !selectedCategory}
              >
                <Feather name="send" size={16} color="#fff" />
                <Text style={styles.sendBtnText}>{reqSending ? "Sending…" : "Send Request"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#071221" },
  center:          { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  noTourText:      { color: "#fff", fontSize: 16, fontFamily: "Inter_500Medium" },
  backText:        { color: "#3B82F6", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  topBar:          { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, backgroundColor: "rgba(7,18,33,0.7)" },
  iconBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  navPill:         { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  navPillText:     { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  tourInfo:        { flex: 1, alignItems: "center", gap: 2 },
  tourTitle:       { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  tourSpace:       { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  startBadge:      { backgroundColor: "#16A34A", width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  audioBarWrap:    { position: "absolute", left: 0, right: 0, paddingHorizontal: 16, zIndex: 10 },
  audioBarInner:   { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(7,18,33,0.92)", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  audioBarText:    { color: "#EC4899", fontSize: 12, fontFamily: "Inter_500Medium" },
  progressTrack:   { height: 2, backgroundColor: "rgba(236,72,153,0.2)", borderRadius: 1, marginTop: 4, overflow: "hidden" },
  progressFill:    { height: 2, backgroundColor: "#EC4899", borderRadius: 1 },
  audioPlayBtn:    { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EC4899", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  audioPlayBtnText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  audioHotspot:     { position: "absolute", right: 20, zIndex: 10, alignItems: "center", gap: 5 },
  audioHotspotInner:{ width: 54, height: 54, borderRadius: 27, backgroundColor: "#EC4899", alignItems: "center", justifyContent: "center", shadowColor: "#EC4899", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 12, elevation: 8 },
  audioHotspotLabel:{ color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  transcriptBox:   { backgroundColor: "rgba(7,18,33,0.92)", borderRadius: 12, padding: 12, marginTop: 6, borderWidth: 1, borderColor: "#EC489940" },
  transcriptText:  { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  onboardingOverlay:  { position: "absolute", inset: 0, zIndex: 50, justifyContent: "flex-end", paddingHorizontal: 20, paddingBottom: 160, backgroundColor: "rgba(0,0,0,0.55)" },
  onboardingCard:     { backgroundColor: "#0F2040", borderRadius: 20, padding: 22, borderWidth: 1, borderColor: "#1E3A5C" },
  onboardingIconRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  onboardingIconBubble:{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(236,72,153,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#EC489960" },
  onboardingTitle:    { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold", flex: 1 },
  onboardingBody:     { color: "rgba(255,255,255,0.72)", fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  onboardingBtn:      { backgroundColor: "#EC4899", borderRadius: 14, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  onboardingBtnText:  { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  bottomOverlay:   { position: "absolute", bottom: 60, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16, gap: 8 },
  legendRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  pinLegend:       { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  legendItem:      { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot:       { width: 8, height: 8, borderRadius: 4 },
  legendText:      { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_500Medium" },
  legendMore:      { color: "#3B82F6", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  requestBtn:      { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(59,130,246,0.9)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  requestBtnText:  { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  navHint:         { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, alignSelf: "flex-start" },
  navHintText:     { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Inter_400Regular" },
  modalOverlay:    { flex: 1, justifyContent: "flex-end" },
  guideSheet:      { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 0, maxHeight: "88%" },
  guideSectionTitle:  { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.4, marginBottom: 10, marginTop: 4 },
  guideSectionHint:   { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12, marginTop: -6, lineHeight: 17 },
  guideDivider:       { height: 1, marginVertical: 18 },
  guideNavRow:        { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  guideNavIcon:       { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  guideNavHint:       { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 19 },
  guideLegendRow:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  guideLegendIcon:    { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  guideLegendLabel:   { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  guideLegendDesc:    { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  guideRequestBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, marginTop: 4 },
  guideRequestBtnText:{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  requestSheet:    { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: "82%" },
  sheetHandle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 16 },
  sheetTitleRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sheetTitle:      { fontSize: 20, fontFamily: "Inter_700Bold" },
  sheetHint:       { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginBottom: 18 },
  categoryGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  catBtn:          { width: "47%", alignItems: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1 },
  catBtnText:      { fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  noteLabel:       { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5, marginBottom: 8 },
  msgInput:        { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, marginBottom: 16 },
  sendBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 15, borderRadius: 14 },
  sendBtnText:     { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
