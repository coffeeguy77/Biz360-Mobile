import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PinSheet } from "@/components/PinSheet";
import { TourViewer } from "@/components/TourViewer";
import { DEMO_LISTINGS, TourPin, TourSpace } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/lib/apiStore";
import { trackEvent } from "@/lib/analyticsStore";
import { useAuth } from "@/context/AuthContext";

const PIN_DISPLAY: Record<string, { color: string; label: string }> = {
  equipment:   { color: "#F59E0B", label: "Equipment" },
  revenue:     { color: "#16A34A", label: "Revenue" },
  cogs:        { color: "#EF4444", label: "COGS" },
  workflow:    { color: "#8B5CF6", label: "Workflow" },
  staffing:    { color: "#3B82F6", label: "Staffing" },
  lease:       { color: "#F97316", label: "Lease" },
  risk:        { color: "#EF4444", label: "Risk" },
  opportunity: { color: "#16A34A", label: "Opportunity" },
  narration:   { color: "#EC4899", label: "Narration" },
  inspection:  { color: "#06B6D4", label: "Inspection" },
  highlight:   { color: "#F59E0B", label: "Highlight" },
  document:    { color: "#6366F1", label: "Document" },
};

export default function TourScreen() {
  const { id, startSpace } = useLocalSearchParams<{ id: string; startSpace?: string }>();
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const buyerId  = user?.id ?? "guest";

  const listing = DEMO_LISTINGS.find((l) => l.id === id);
  const [kvSpaces,  setKvSpaces]  = useState<TourSpace[]>([]);
  const [kvLoading, setKvLoading] = useState(true);
  const tourTrackedRef = useRef(false);
  const [activeSpaceIdx, setActiveSpaceIdx] = useState(startSpace ? parseInt(startSpace, 10) : 0);
  const [activePin,      setActivePin]      = useState<TourPin | null>(null);
  const [focusPin,       setFocusPin]       = useState<TourPin | null>(null);

  useEffect(() => {
    if (!id) return;
    apiGet<TourSpace[]>(`biz360_tour_spaces_v1_${id}`).then((spaces) => {
      if (spaces && spaces.length > 0) setKvSpaces(spaces);
      setKvLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (kvLoading || tourTrackedRef.current || !id) return;
    const spaces: TourSpace[] = [...(listing?.tourSpaces ?? []), ...kvSpaces];
    if (spaces.length === 0) return;
    tourTrackedRef.current = true;
    trackEvent(id, "tour_start", buyerId);
  }, [id, kvLoading, kvSpaces.length, buyerId]);

  const allSpaces: TourSpace[] = [...(listing?.tourSpaces ?? []), ...kvSpaces];

  if (kvLoading && !listing) {
    return (
      <View style={[styles.center, { backgroundColor: "#071221" }]}>
        <Feather name="rotate-ccw" size={28} color="#3B82F6" />
        <Text style={styles.noTourText}>Loading tour…</Text>
      </View>
    );
  }

  if (!listing && allSpaces.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: "#071221" }]}>
        <Feather name="rotate-ccw" size={40} color="#3B82F6" />
        <Text style={styles.noTourText}>No tour available for this listing</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (allSpaces.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: "#071221" }]}>
        <Feather name="rotate-ccw" size={40} color="#3B82F6" />
        <Text style={styles.noTourText}>No tour spaces yet</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const safeIdx    = Math.min(activeSpaceIdx, allSpaces.length - 1);
  const activeSpace = allSpaces[safeIdx];
  const demoCount  = listing?.tourSpaces?.length ?? 0;
  const isUserSpace = safeIdx >= demoCount;

  const uniquePinTypes = useMemo(() => {
    const seen = new Set<string>();
    const types: string[] = [];
    for (const p of activeSpace.pins) {
      if (!seen.has(p.type)) { seen.add(p.type); types.push(p.type); }
    }
    return types;
  }, [activeSpace.pins]);

  const shownTypes  = uniquePinTypes.slice(0, 3);
  const shownPinCount = shownTypes.reduce((sum, t) => sum + activeSpace.pins.filter((p) => p.type === t).length, 0);
  const extraCount  = activeSpace.pins.length - shownPinCount;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Feather name="x" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.tourInfo}>
          <Text style={styles.tourTitle} numberOfLines={1}>{listing?.businessName ?? "Tour"}</Text>
          {allSpaces.length <= 1 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.tourSpace}>{activeSpace.name}</Text>
              {isUserSpace && (
                <View style={styles.userSpaceBadge}>
                  <Text style={styles.userSpaceBadgeText}>YOUR SPACE</Text>
                </View>
              )}
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <Feather name="share-2" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {allSpaces.length > 1 && (
        <View style={styles.spaceTabs}>
          {allSpaces.map((space, idx) => {
            const isUser = idx >= demoCount;
            return (
              <TouchableOpacity
                key={space.id}
                style={[
                  styles.spaceTab,
                  {
                    backgroundColor:
                      idx === safeIdx
                        ? isUser ? "#16A34A" : "#2563EB"
                        : "rgba(255,255,255,0.1)",
                  },
                ]}
                onPress={() => { setActiveSpaceIdx(idx); setFocusPin(null); }}
              >
                <Text style={[styles.spaceTabText, { color: idx === safeIdx ? "#fff" : "rgba(255,255,255,0.6)" }]}>
                  {space.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <TourViewer
        key={activeSpace.id}
        space={activeSpace}
        onPinPress={setActivePin}
        focusPin={focusPin}
        onFocusPinHandled={() => setFocusPin(null)}
      />

      {activeSpace.pins.length > 0 && (
        <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 8 }]}>
          <View style={styles.pinLegend}>
            {shownTypes.map((type) => {
              const cfg = PIN_DISPLAY[type] ?? { color: "#3B82F6", label: type };
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
              <Text style={styles.legendMore}>+{extraCount} more</Text>
            )}
          </View>
        </View>
      )}

      <PinSheet pin={activePin} onClose={() => setActivePin(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#071221" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  noTourText: { color: "#fff", fontSize: 16, fontFamily: "Inter_500Medium" },
  backText: { color: "#3B82F6", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12,
    backgroundColor: "rgba(7,18,33,0.7)",
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center",
  },
  tourInfo: { flex: 1, alignItems: "center", gap: 2 },
  tourTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  tourSpace: { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  userSpaceBadge: { backgroundColor: "#16A34A", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  userSpaceBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  spaceTabs: {
    position: "absolute", top: 90, left: 0, right: 0, zIndex: 10,
    flexDirection: "row", paddingHorizontal: 12, gap: 8,
  },
  spaceTab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  spaceTabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  bottomOverlay: {
    position: "absolute", bottom: 60, left: 0, right: 0, zIndex: 10,
    paddingHorizontal: 16,
  },
  pinLegend: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, alignSelf: "flex-start",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_500Medium" },
  legendMore: { color: "#3B82F6", fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
