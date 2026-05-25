import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { TourPin, TourSpace } from "@/data/listings";

const { width: SW, height: SH } = Dimensions.get("window");

const DIRECTION_LABELS_8 = ["Front", "Front-Right", "Right", "Back-Right", "Back", "Back-Left", "Left", "Front-Left"];
const DIRECTION_LABELS_4 = ["Front", "Right", "Back", "Left"];
const COMPASS_LABELS_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const COMPASS_LABELS_4 = ["N", "E", "S", "W"];
const PLACEHOLDER_COLORS = ["#1A3A5C", "#142E4A", "#0F2238", "#0A1628", "#142E4A", "#1A3A5C", "#0F2238", "#0A1628"];

const PIN_CFG: Record<string, { icon: string; color: string }> = {
  equipment:  { icon: "tool",           color: "#F59E0B" },
  revenue:    { icon: "trending-up",    color: "#16A34A" },
  cogs:       { icon: "package",        color: "#EF4444" },
  workflow:   { icon: "git-branch",     color: "#8B5CF6" },
  staffing:   { icon: "users",          color: "#3B82F6" },
  lease:      { icon: "home",           color: "#F97316" },
  risk:       { icon: "alert-triangle", color: "#EF4444" },
  opportunity:{ icon: "star",           color: "#16A34A" },
  narration:  { icon: "mic",            color: "#EC4899" },
  inspection: { icon: "clipboard",      color: "#06B6D4" },
  highlight:  { icon: "zap",            color: "#F59E0B" },
  document:   { icon: "file-text",      color: "#6366F1" },
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
}

export function TourViewer({ space, onPinPress }: Props) {
  const N = Math.max(space.photos.length, 1);
  const dirLabels = N >= 8 ? DIRECTION_LABELS_8 : DIRECTION_LABELS_4;
  const compassLabels = N >= 8 ? COMPASS_LABELS_8 : COMPASS_LABELS_4;

  const currentIdxRef = useRef(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const stripX = useRef(new Animated.Value(-SW)).current;
  const stripXSnapshot = useRef(-SW);
  const isAnimating = useRef(false);
  const [interacted, setInteracted] = useState(false);

  const prevIdx = mod(currentIdx - 1, N);
  const nextIdx = mod(currentIdx + 1, N);
  const currentAngleDeg = Math.round((currentIdx / N) * 360);
  const currentDirLabel = dirLabels[currentIdx % dirLabels.length];
  const currentCompassLabel = compassLabels[currentIdx % compassLabels.length];

  const snapTo = (direction: "next" | "prev" | "center", velocity = 0) => {
    if (isAnimating.current) return;
    isAnimating.current = true;

    const toValue = direction === "next" ? -2 * SW : direction === "prev" ? 0 : -SW;
    const newIdx =
      direction === "next" ? mod(currentIdxRef.current + 1, N) :
      direction === "prev" ? mod(currentIdxRef.current - 1, N) :
      currentIdxRef.current;

    Animated.spring(stripX, {
      toValue,
      velocity,
      tension: 130,
      friction: 20,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        stripX.setValue(-SW);
        stripXSnapshot.current = -SW;
        currentIdxRef.current = newIdx;
        setCurrentIdx(newIdx);
        isAnimating.current = false;
      }
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        !isAnimating.current &&
        Math.abs(gs.dx) > 6 &&
        Math.abs(gs.dx) > Math.abs(gs.dy) * 1.3,

      onPanResponderGrant: () => {
        setInteracted(true);
        stripX.stopAnimation((val) => {
          stripXSnapshot.current = val;
          stripX.setValue(val);
        });
      },

      onPanResponderMove: (_, gs) => {
        stripX.setValue(stripXSnapshot.current + gs.dx);
      },

      onPanResponderRelease: (_, gs) => {
        stripXSnapshot.current = stripXSnapshot.current + gs.dx;
        const goNext = gs.dx < -SW * 0.18 || gs.vx < -0.7;
        const goPrev = gs.dx > SW * 0.18 || gs.vx > 0.7;

        if (goNext) snapTo("next", gs.vx);
        else if (goPrev) snapTo("prev", gs.vx);
        else snapTo("center", gs.vx);
      },
    })
  ).current;

  const pinsForCurrent = space.pins.filter(
    (p) => Math.floor(p.position.x * N) === currentIdx
  );

  const renderPhotoSlot = (photoIdx: number) => {
    const photo = space.photos[photoIdx] ?? "";
    const uri = isUri(photo) ? photo : null;
    const bgColor = PLACEHOLDER_COLORS[photoIdx % PLACEHOLDER_COLORS.length];
    const label = dirLabels[photoIdx % dirLabels.length];

    return (
      <View key={photoIdx} style={{ width: SW, overflow: "hidden", backgroundColor: bgColor }}>
        {uri ? (
          <Image source={{ uri }} style={[StyleSheet.absoluteFill, { width: SW }]} resizeMode="cover" />
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
      {/* ── Panoramic photo strip ── */}
      <Animated.View
        style={[styles.strip, { transform: [{ translateX: stripX }] }]}
        {...panResponder.panHandlers}
      >
        {renderPhotoSlot(prevIdx)}
        {renderPhotoSlot(currentIdx)}
        {renderPhotoSlot(nextIdx)}
      </Animated.View>

      {/* ── Info pins overlay (above strip, passes through drags) ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {pinsForCurrent.map((pin) => {
          const frac = (pin.position.x * N) - Math.floor(pin.position.x * N);
          const px = Math.max(8, Math.min(frac * SW, SW - 165));
          const py = 110 + pin.position.y * (SH * 0.55);
          const cfg = PIN_CFG[pin.type] ?? { icon: "info", color: "#3B82F6" };
          return (
            <TouchableOpacity
              key={pin.id}
              style={[styles.pin, { left: px, top: py, backgroundColor: cfg.color }]}
              onPress={() => onPinPress(pin)}
              activeOpacity={0.85}
            >
              {pin.requiresNDA && (
                <Feather name="lock" size={9} color="rgba(255,255,255,0.85)" />
              )}
              <Feather name={cfg.icon as any} size={13} color="#fff" />
              <Text style={styles.pinLabel} numberOfLines={1}>
                {pin.title.split(" ").slice(0, 3).join(" ")}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Top segmented progress bar ── */}
      <View style={styles.progressBar}>
        {Array.from({ length: N }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressSeg,
              { backgroundColor: i === currentIdx ? "#fff" : "rgba(255,255,255,0.22)" },
            ]}
          />
        ))}
      </View>

      {/* ── Direction label (top-left) ── */}
      <View style={styles.dirTag}>
        <Feather name="compass" size={11} color="rgba(255,255,255,0.75)" />
        <Text style={styles.dirTagText}>{currentDirLabel}</Text>
      </View>

      {/* ── Compass rose (bottom-right) ── */}
      <View style={styles.compass}>
        <View style={[styles.compassRing]}>
          {/* Tick marks for each photo angle */}
          {Array.from({ length: N }).map((_, i) => {
            const tickAngle = (i / N) * 360;
            const r = 22;
            const rad = ((tickAngle - 90) * Math.PI) / 180;
            const x = r * Math.cos(rad);
            const y = r * Math.sin(rad);
            return (
              <View
                key={i}
                style={[
                  styles.compassTick,
                  {
                    left: 28 + x - 3,
                    top: 28 + y - 3,
                    backgroundColor: i === currentIdx ? "#3B82F6" : "rgba(255,255,255,0.35)",
                    width: i === currentIdx ? 7 : 4,
                    height: i === currentIdx ? 7 : 4,
                    borderRadius: i === currentIdx ? 3.5 : 2,
                  },
                ]}
              />
            );
          })}
          <Text style={styles.compassDir}>{currentCompassLabel}</Text>
          <Text style={styles.compassDeg}>{currentAngleDeg}°</Text>
        </View>
      </View>

      {/* ── Nav arrows (center vertical) ── */}
      {N > 1 && (
        <View style={styles.navArrows} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.navArrow}
            onPress={() => snapTo("prev")}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navArrow}
            onPress={() => snapTo("next")}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="chevron-right" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Photo count badge ── */}
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{currentIdx + 1} / {N}</Text>
      </View>

      {/* ── First-time swipe hint ── */}
      {!interacted && N > 1 && (
        <View style={styles.hint}>
          <Feather name="move" size={13} color="rgba(255,255,255,0.7)" />
          <Text style={styles.hintText}>Drag left or right to rotate view · Tap pins for details</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071221",
    overflow: "hidden",
  },
  strip: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: SW * 3,
    flexDirection: "row",
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  gridH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  gridV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  placeholderContent: {
    alignItems: "center",
    gap: 10,
  },
  placeholderLabel: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  placeholderSub: {
    color: "rgba(255,255,255,0.12)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  progressBar: {
    position: "absolute",
    top: 52,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 3,
    height: 3,
  },
  progressSeg: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  dirTag: {
    position: "absolute",
    top: 64,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dirTagText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  compass: {
    position: "absolute",
    bottom: 72,
    right: 16,
  },
  compassRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  compassTick: {
    position: "absolute",
  },
  compassDir: {
    color: "#3B82F6",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 18,
  },
  compassDeg: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  navArrows: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    marginTop: -22,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  navArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  countBadge: {
    position: "absolute",
    bottom: 72,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  countText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  pin: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
    maxWidth: 175,
  },
  pinLabel: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  hint: {
    position: "absolute",
    bottom: 72,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hintText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
