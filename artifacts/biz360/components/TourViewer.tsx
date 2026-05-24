import { Feather } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { TourPin, TourSpace } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

const { width: SW } = Dimensions.get("window");

const DIRECTION_LABELS = ["Front", "Front-Right", "Right", "Back-Right", "Back", "Back-Left", "Left", "Front-Left"];
const SEGMENT_COLORS = [
  "#1A3A5C", "#142E4A", "#0F2238", "#0A1628",
  "#142E4A", "#1A3A5C", "#0F2238", "#0A1628",
];

const PIN_TYPE_ICONS: Record<string, string> = {
  equipment: "tool",
  revenue: "trending-up",
  cogs: "package",
  workflow: "git-branch",
  staffing: "users",
  lease: "home",
  risk: "alert-triangle",
  opportunity: "star",
  narration: "mic",
};

const PIN_TYPE_COLORS: Record<string, string> = {
  equipment: "#F59E0B",
  revenue: "#16A34A",
  cogs: "#EF4444",
  workflow: "#8B5CF6",
  staffing: "#3B82F6",
  lease: "#F97316",
  risk: "#EF4444",
  opportunity: "#16A34A",
  narration: "#EC4899",
};

function isUri(s: string): boolean {
  return (
    s.startsWith("file://") ||
    s.startsWith("content://") ||
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("data:") ||
    s.startsWith("ph://")
  );
}

interface Props {
  space: TourSpace;
  onPinPress: (pin: TourPin) => void;
}

export function TourViewer({ space, onPinPress }: Props) {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentSegment, setCurrentSegment] = useState(0);
  const numSegments = space.photos.length;
  const segmentWidth = SW;

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (e: any) => {
        const x = e.nativeEvent.contentOffset.x;
        const seg = Math.round(x / segmentWidth);
        setCurrentSegment(Math.min(Math.max(seg, 0), numSegments - 1));
      },
    }
  );

  const goTo = (seg: number) => {
    scrollRef.current?.scrollTo({ x: seg * segmentWidth, animated: true });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {space.photos.map((photo, idx) => {
          const bg = SEGMENT_COLORS[idx % SEGMENT_COLORS.length];
          const pinsForSegment = space.pins.filter((p) => {
            const segFraction = idx / numSegments;
            const nextFraction = (idx + 1) / numSegments;
            return p.position.x >= segFraction && p.position.x < nextFraction;
          });
          const photoIsUri = isUri(photo);

          return (
            <View key={idx} style={[styles.segment, { width: segmentWidth, backgroundColor: bg }]}>
              {photoIsUri ? (
                <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={styles.perspectiveGrid}>
                  {Array.from({ length: 8 }).map((_, gi) => (
                    <View key={gi} style={[styles.gridLine, { top: `${gi * 14}%` as any, borderColor: "rgba(255,255,255,0.05)" }]} />
                  ))}
                  {Array.from({ length: 12 }).map((_, gi) => (
                    <View key={`v${gi}`} style={[styles.gridLineV, { left: `${gi * 9}%` as any, borderColor: "rgba(255,255,255,0.05)" }]} />
                  ))}
                  <View style={styles.placeholderCenter}>
                    <Feather name="camera" size={32} color="rgba(255,255,255,0.15)" />
                    <Text style={styles.placeholderText}>{DIRECTION_LABELS[idx] ?? photo}</Text>
                  </View>
                </View>
              )}

              {photoIsUri && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.15)" }]} />
              )}

              <View style={styles.directionLabel}>
                <Feather name="compass" size={10} color="rgba(255,255,255,0.7)" />
                <Text style={styles.directionText}>{DIRECTION_LABELS[idx] ?? photo}</Text>
              </View>

              <View style={styles.progressStrip}>
                {space.photos.map((_, si) => (
                  <View
                    key={si}
                    style={[styles.progressSeg, { backgroundColor: si === currentSegment ? "#3B82F6" : "rgba(255,255,255,0.2)", flex: 1 }]}
                  />
                ))}
              </View>

              {pinsForSegment.map((pin) => {
                const pinX = ((pin.position.x - idx / numSegments) * numSegments) * SW;
                const pinColor = PIN_TYPE_COLORS[pin.type] ?? "#3B82F6";
                return (
                  <TouchableOpacity
                    key={pin.id}
                    style={[
                      styles.pin,
                      {
                        left: Math.max(20, Math.min(pinX, SW - 160)),
                        top: `${pin.position.y * 100}%` as any,
                        backgroundColor: pinColor,
                      },
                    ]}
                    onPress={() => onPinPress(pin)}
                    activeOpacity={0.8}
                  >
                    {pin.requiresNDA && <Feather name="lock" size={11} color="rgba(255,255,255,0.8)" />}
                    <Feather name={(PIN_TYPE_ICONS[pin.type] as any) || "info"} size={14} color="#fff" />
                    <Text style={styles.pinText} numberOfLines={1}>{pin.title.split(" ").slice(0, 3).join(" ")}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.dotRow}>
          {space.photos.map((_, idx) => (
            <TouchableOpacity key={idx} onPress={() => goTo(idx)}>
              <View style={[styles.dot, { backgroundColor: idx === currentSegment ? "#3B82F6" : "rgba(255,255,255,0.3)", width: idx === currentSegment ? 20 : 6 }]} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.swipeHint}>Swipe to explore  ·  Tap pins for details</Text>
      </View>

      <View style={styles.navArrows}>
        <TouchableOpacity style={styles.arrow} onPress={() => goTo(Math.max(0, currentSegment - 1))}>
          <Feather name="chevron-left" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.arrow} onPress={() => goTo(Math.min(numSegments - 1, currentSegment + 1))}>
          <Feather name="chevron-right" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#071221" },
  segment: { flex: 1, position: "relative", overflow: "hidden" },
  perspectiveGrid: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, borderTopWidth: 1 },
  gridLineV: { position: "absolute", top: 0, bottom: 0, width: 1, borderLeftWidth: 1 },
  placeholderCenter: { alignItems: "center", gap: 8 },
  placeholderText: { color: "rgba(255,255,255,0.3)", fontSize: 13, fontFamily: "Inter_500Medium" },
  directionLabel: { position: "absolute", top: 56, left: 16, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  directionText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  progressStrip: { position: "absolute", top: 0, left: 0, right: 0, height: 3, flexDirection: "row", gap: 2, paddingHorizontal: 12, paddingTop: 50 },
  progressSeg: { height: 3, borderRadius: 2 },
  pin: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 5, maxWidth: 180 },
  pinText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  bottomBar: { position: "absolute", bottom: 20, left: 0, right: 0, alignItems: "center", gap: 6 },
  dotRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { height: 6, borderRadius: 3 },
  swipeHint: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Inter_400Regular" },
  navArrows: { position: "absolute", top: "50%", left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, marginTop: -22 },
  arrow: { width: 44, height: 44, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
