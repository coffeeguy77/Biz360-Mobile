import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PanoramaViewer } from "@/components/PanoramaViewer";
import { TourPin, TourSpace } from "@/data/listings";

const { width: SW, height: SH } = Dimensions.get("window");

const DIRECTION_LABELS_8 = ["Front", "Front-Right", "Right", "Back-Right", "Back", "Back-Left", "Left", "Front-Left"];
const DIRECTION_LABELS_4 = ["Front", "Right", "Back", "Left"];
const COMPASS_LABELS_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const COMPASS_LABELS_4 = ["N", "E", "S", "W"];
const PLACEHOLDER_COLORS = ["#1A3A5C", "#142E4A", "#0F2238", "#0A1628", "#142E4A", "#1A3A5C", "#0F2238", "#0A1628"];

const PIN_CFG: Record<string, { icon: string; color: string }> = {
  equipment:    { icon: "tool",                color: "#F59E0B" },
  revenue:      { icon: "trending-up",         color: "#16A34A" },
  cogs:         { icon: "package",             color: "#EF4444" },
  workflow:     { icon: "git-branch",          color: "#8B5CF6" },
  staffing:     { icon: "users",               color: "#3B82F6" },
  lease:        { icon: "home",                color: "#F97316" },
  risk:         { icon: "alert-triangle",      color: "#EF4444" },
  opportunity:  { icon: "star",                color: "#16A34A" },
  narration:    { icon: "mic",                 color: "#EC4899" },
  inspection:   { icon: "clipboard",           color: "#06B6D4" },
  highlight:    { icon: "zap",                 color: "#F59E0B" },
  document:     { icon: "file-text",           color: "#6366F1" },
  navigation:   { icon: "arrow-right-circle",  color: "#2563EB" },
  external_link:{ icon: "external-link",       color: "#0891B2" },
  audio:        { icon: "volume-2",            color: "#EC4899" },
};

function isUri(s: string) {
  return (
    s.startsWith("file://") || s.startsWith("content://") ||
    s.startsWith("http://") || s.startsWith("https://") ||
    s.startsWith("data:") || s.startsWith("ph://")
  );
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

interface Props {
  space: TourSpace;
  onPinPress: (pin: TourPin) => void;
  focusPin?: TourPin | null;
  onFocusPinHandled?: () => void;
}

export function TourViewer({ space, onPinPress, focusPin, onFocusPinHandled }: Props) {
  if (space.dirMode === "single" && space.panoramaUrl) {
    return <SinglePhotoViewer space={space} onPinPress={onPinPress} focusPin={focusPin} onFocusPinHandled={onFocusPinHandled} />;
  }
  if (Platform.OS !== "web" && (space.panoramaUrl || space.photos.length > 0)) {
    return (
      <PanoramaViewer
        space={space}
        onPinPress={onPinPress}
        focusPin={focusPin}
        onFocusPinHandled={onFocusPinHandled}
      />
    );
  }
  return <DirectionalStrip space={space} onPinPress={onPinPress} focusPin={focusPin} onFocusPinHandled={onFocusPinHandled} />;
}

// ── Single flat-photo viewer with pin overlays ──────────────────────────────
function SinglePhotoViewer({ space, onPinPress }: Props) {
  const [imgSize, setImgSize] = useState({ width: SW, height: SH * 0.6 });

  return (
    <View style={{ flex: 1, backgroundColor: "#071221" }}>
      <Image
        source={{ uri: space.panoramaUrl }}
        style={{ width: imgSize.width, height: imgSize.height, alignSelf: "center" }}
        resizeMode="contain"
        onLayout={(e) => setImgSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      />
      {space.pins.filter((p) => p.position.x != null).map((pin) => {
        const cfg = PIN_CFG[pin.type] ?? { icon: "info", color: "#3B82F6" };
        const left = (pin.position.x ?? 0.5) * imgSize.width - 19;
        const top  = (pin.position.y ?? 0.5) * imgSize.height - 19;
        return (
          <TouchableOpacity
            key={pin.id}
            style={[svStyles.pin, { left, top, backgroundColor: cfg.color }]}
            onPress={() => onPinPress(pin)}
          >
            <Feather name={cfg.icon as any} size={16} color="#fff" />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const svStyles = StyleSheet.create({
  pin: {
    position: "absolute", width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55, shadowRadius: 6, elevation: 8,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
  },
});

const PHOTO_W = SW;

function DirectionalStrip({ space, onPinPress, focusPin, onFocusPinHandled }: Props) {
  const N = Math.max(space.photos.length, 1);
  const dirLabels     = N >= 8 ? DIRECTION_LABELS_8 : DIRECTION_LABELS_4;
  const compassLabels = N >= 8 ? COMPASS_LABELS_8   : COMPASS_LABELS_4;

  const STRIP_W = N * PHOTO_W;
  const startX  = -STRIP_W;

  const xRef    = useRef(startX);
  const panX    = useRef(new Animated.Value(startX)).current;
  const isGesture = useRef(false);

  const [photoIdx,   setPhotoIdx]   = useState(0);
  const [interacted, setInteracted] = useState(false);

  const xToIdx = (x: number) =>
    mod(Math.round((-x - STRIP_W) / PHOTO_W), N);

  const normalize = (x: number) => {
    let n = x;
    while (n > -STRIP_W + PHOTO_W) n -= STRIP_W;
    while (n < -2 * STRIP_W + PHOTO_W) n += STRIP_W;
    return n;
  };

  const settle = (x: number) => {
    const nx = normalize(x);
    if (nx !== x) panX.setValue(nx);
    xRef.current = nx;
    setPhotoIdx(xToIdx(nx));
  };

  const snapToIdx = (targetIdx: number, fromX: number, vx = 0) => {
    const candidateX = -STRIP_W - targetIdx * PHOTO_W;
    const candidates = [candidateX - STRIP_W, candidateX, candidateX + STRIP_W];
    const best = candidates.reduce((a, b) =>
      Math.abs(b - fromX) < Math.abs(a - fromX) ? b : a
    );
    Animated.spring(panX, {
      toValue: best,
      velocity: vx * SW,
      tension: 140,
      friction: 22,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !isGesture.current) settle(best);
    });
  };

  // ── Pan to focusPin then open it ──────────────────────────────────────────
  const snapToIdxRef = useRef(snapToIdx);
  useEffect(() => { snapToIdxRef.current = snapToIdx; });

  useEffect(() => {
    if (!focusPin) return;
    const targetIdx = Math.min(Math.floor(focusPin.position.x * N), N - 1);
    snapToIdxRef.current(targetIdx, xRef.current);
    const t = setTimeout(() => {
      onPinPress(focusPin);
      onFocusPinHandled?.();
    }, 480);
    return () => clearTimeout(t);
  }, [focusPin?.id]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 5 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.2,
      onPanResponderGrant: () => {
        setInteracted(true);
        isGesture.current = true;
        panX.stopAnimation((val) => {
          xRef.current = val;
          panX.setValue(val);
        });
      },
      onPanResponderMove: (_, gs) => {
        panX.setValue(xRef.current + gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        isGesture.current = false;
        const rawX = xRef.current + gs.dx;
        xRef.current = rawX;

        const currentI = xToIdx(rawX);
        const goNext   = gs.dx < -PHOTO_W * 0.18 || gs.vx < -0.6;
        const goPrev   = gs.dx >  PHOTO_W * 0.18 || gs.vx >  0.6;
        const targetI  = goNext
          ? mod(currentI + 1, N)
          : goPrev
          ? mod(currentI - 1, N)
          : currentI;

        snapToIdx(targetI, rawX, gs.vx);
      },
    })
  ).current;

  const stepBy = (delta: number) => {
    const targetI = mod(photoIdx + delta, N);
    snapToIdx(targetI, xRef.current);
  };

  const pinsForCurrent = space.pins.filter(
    (p) => Math.floor(p.position.x * N) === photoIdx
  );
  const currentAngleDeg = Math.round((photoIdx / N) * 360);

  const tripled = [...space.photos, ...space.photos, ...space.photos];

  const renderPhoto = (photo: string, key: number, originalIdx: number) => {
    const uri     = isUri(photo) ? photo : null;
    const bgColor = PLACEHOLDER_COLORS[originalIdx % PLACEHOLDER_COLORS.length];
    const label   = dirLabels[originalIdx % dirLabels.length];
    return (
      <View key={key} style={{ width: PHOTO_W, height: "100%", backgroundColor: bgColor, overflow: "hidden" }}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={`h${i}`} style={[styles.gridH, { top: `${(i + 1) * 14}%` as any }]} />
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <View key={`v${i}`} style={[styles.gridV, { left: `${(i + 1) * 9}%` as any }]} />
            ))}
            <View style={styles.placeholderContent}>
              <Feather name="camera" size={40} color="rgba(255,255,255,0.1)" />
              <Text style={styles.placeholderLabel}>{label}</Text>
              <Text style={styles.placeholderSub}>No photo added yet</Text>
            </View>
          </View>
        )}
        {uri && <View style={styles.photoOverlay} />}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.panoramaStrip, { width: 3 * STRIP_W, transform: [{ translateX: panX }] }]}
        {...panResponder.panHandlers}
      >
        {tripled.map((photo, i) => renderPhoto(photo, i, i % N))}
      </Animated.View>

      {/* Pins for the current photo */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {pinsForCurrent.map((pin) => {
          const frac = (pin.position.x * N) - Math.floor(pin.position.x * N);
          const cfg  = PIN_CFG[pin.type] ?? { icon: "info", color: "#3B82F6" };

          if (pin.type === "navigation") {
            const px = Math.max(8, Math.min(frac * SW, SW - 150));
            const py = 110 + pin.position.y * (SH * 0.55);
            return (
              <TouchableOpacity
                key={pin.id}
                style={[styles.navPin, { left: px, top: py, backgroundColor: cfg.color }]}
                onPress={() => onPinPress(pin)}
                activeOpacity={0.8}
              >
                <Feather name="arrow-right-circle" size={15} color="#fff" />
                <Text style={styles.navPinLabel} numberOfLines={1}>{pin.title}</Text>
              </TouchableOpacity>
            );
          }

          const px = Math.max(8, Math.min(frac * SW, SW - 46));
          const py = 110 + pin.position.y * (SH * 0.55);
          return (
            <TouchableOpacity
              key={pin.id}
              style={[styles.pin, { left: px, top: py, backgroundColor: cfg.color }]}
              onPress={() => onPinPress(pin)}
              activeOpacity={0.8}
            >
              <Feather name={cfg.icon as any} size={16} color="#fff" />
              {pin.requiresNDA && (
                <View style={styles.pinLock}>
                  <Feather name="lock" size={7} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Progress dots */}
      <View style={styles.progressBar}>
        {Array.from({ length: N }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressSeg, {
              backgroundColor: i === photoIdx ? "#fff" : "rgba(255,255,255,0.22)",
            }]}
          />
        ))}
      </View>

      {/* Direction label */}
      <View style={styles.dirTag}>
        <Feather name="compass" size={11} color="rgba(255,255,255,0.75)" />
        <Text style={styles.dirTagText}>{dirLabels[photoIdx % dirLabels.length]}</Text>
      </View>

      {/* Compass rose */}
      <View style={styles.compass}>
        <View style={styles.compassRing}>
          {Array.from({ length: N }).map((_, i) => {
            const tickAngle = (i / N) * 360;
            const r   = 22;
            const rad = ((tickAngle - 90) * Math.PI) / 180;
            return (
              <View
                key={i}
                style={[styles.compassTick, {
                  left: 28 + r * Math.cos(rad) - 3,
                  top:  28 + r * Math.sin(rad) - 3,
                  backgroundColor: i === photoIdx ? "#3B82F6" : "rgba(255,255,255,0.35)",
                  width:        i === photoIdx ? 7 : 4,
                  height:       i === photoIdx ? 7 : 4,
                  borderRadius: i === photoIdx ? 3.5 : 2,
                }]}
              />
            );
          })}
          <Text style={styles.compassDir}>{compassLabels[photoIdx % compassLabels.length]}</Text>
          <Text style={styles.compassDeg}>{currentAngleDeg}°</Text>
        </View>
      </View>

      {/* Nav arrows */}
      {N > 1 && (
        <View style={styles.navArrows} pointerEvents="box-none">
          <TouchableOpacity style={styles.navArrow} onPress={() => stepBy(-1)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navArrow} onPress={() => stepBy(1)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="chevron-right" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Photo counter */}
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{photoIdx + 1} / {N}</Text>
      </View>

      {/* First-time hint */}
      {!interacted && N > 1 && (
        <View style={styles.hint}>
          <Feather name="move" size={13} color="rgba(255,255,255,0.7)" />
          <Text style={styles.hintText}>← Swipe to pan →  ·  Tap pins for details</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#071221", overflow: "hidden" },
  panoramaStrip: {
    position: "absolute", top: 0, bottom: 0, left: 0,
    flexDirection: "row",
  },
  placeholder: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  gridH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.04)" },
  gridV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.04)" },
  placeholderContent: { alignItems: "center", gap: 10 },
  placeholderLabel: { color: "rgba(255,255,255,0.25)", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  placeholderSub:   { color: "rgba(255,255,255,0.12)", fontSize: 12, fontFamily: "Inter_400Regular" },
  photoOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.18)" },
  progressBar: {
    position: "absolute", top: 52, left: 12, right: 12,
    flexDirection: "row", gap: 3, height: 3,
  },
  progressSeg: { flex: 1, height: 3, borderRadius: 1.5 },
  dirTag: {
    position: "absolute", top: 64, left: 16,
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  dirTagText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  compass: { position: "absolute", bottom: 72, right: 16 },
  compassRing: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  compassTick: { position: "absolute" },
  compassDir: { color: "#3B82F6", fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 18 },
  compassDeg: { color: "rgba(255,255,255,0.5)", fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center" },
  navArrows: {
    position: "absolute", top: "50%", left: 0, right: 0,
    marginTop: -22, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10,
  },
  navArrow: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  countBadge: {
    position: "absolute", bottom: 72, left: 16,
    backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  countText: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  navPin: {
    position: "absolute",
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 22,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6, shadowRadius: 8, elevation: 10,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.45)",
    maxWidth: 150,
  },
  navPinLabel: {
    color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold",
  },
  pin: {
    position: "absolute", width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55, shadowRadius: 6, elevation: 8,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
  },
  pinLock: {
    position: "absolute", top: -3, right: -3,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center",
  },
  hint: {
    position: "absolute", bottom: 72, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  hintText: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_400Regular" },
});
