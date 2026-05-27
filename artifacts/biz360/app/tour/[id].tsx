import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PinSheet } from "@/components/PinSheet";
import { TourViewer } from "@/components/TourViewer";
import { DEMO_LISTINGS, TourPin, TourSpace } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

export default function TourScreen() {
  const { id, startSpace } = useLocalSearchParams<{ id: string; startSpace?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const listing = DEMO_LISTINGS.find((l) => l.id === id);
  const [extraSpaces, setExtraSpaces] = useState<TourSpace[]>([]);
  const [activeSpaceIdx, setActiveSpaceIdx] = useState(startSpace ? parseInt(startSpace, 10) : 0);
  const [activePin, setActivePin] = useState<TourPin | null>(null);

  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`biz360_spaces_${id}`).then((raw) => {
      if (raw) {
        try { setExtraSpaces(JSON.parse(raw)); } catch { /* ignore */ }
      }
    });
  }, [id]);

  const allSpaces: TourSpace[] = [...(listing?.tourSpaces ?? []), ...extraSpaces];

  if (!listing && extraSpaces.length === 0 && allSpaces.length === 0) {
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

  const safeIdx = Math.min(activeSpaceIdx, allSpaces.length - 1);
  const activeSpace = allSpaces[safeIdx];
  const demoCount = listing?.tourSpaces?.length ?? 0;
  const isUserSpace = safeIdx >= demoCount;

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
                onPress={() => setActiveSpaceIdx(idx)}
              >
                <Text style={[styles.spaceTabText, { color: idx === safeIdx ? "#fff" : "rgba(255,255,255,0.6)" }]}>
                  {space.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <TourViewer key={activeSpace.id} space={activeSpace} onPinPress={setActivePin} />

      <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 8 }]}>
        <View style={styles.pinLegend}>
          {[
            { color: "#F59E0B", label: "Equipment" },
            { color: "#16A34A", label: "Revenue" },
            { color: "#3B82F6", label: "Staffing" },
          ].map(({ color, label }) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
          <Text style={styles.legendMore}>+{Math.max(0, activeSpace.pins.length ?? 0)} pins</Text>
        </View>
      </View>

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
