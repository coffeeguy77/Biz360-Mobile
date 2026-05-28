import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
import { getTourSpaces, addTourRequest, REQUEST_CATEGORIES } from "@/lib/tourStore";

const PIN_DISPLAY: Record<string, { color: string; label: string }> = {
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
  navigation:   { color: "#2563EB", label: "Navigate"   },
  external_link:{ color: "#0891B2", label: "Link"       },
  audio:        { color: "#EC4899", label: "Audio"      },
};

export default function TourScreen() {
  const { id, startSpace } = useLocalSearchParams<{ id: string; startSpace?: string }>();
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();
  const buyerId  = user?.id ?? "guest";

  const listing     = DEMO_LISTINGS.find((l) => l.id === id);
  const [kvSpaces,  setKvSpaces]  = useState<TourSpace[]>([]);
  const [kvLoading, setKvLoading] = useState(true);
  const tourTrackedRef = useRef(false);

  // Request More Info sheet
  const [showRequestSheet,  setShowRequestSheet]  = useState(false);
  const [selectedCategory,  setSelectedCategory]  = useState<string>("");
  const [reqMessage,        setReqMessage]        = useState("");
  const [reqSending,        setReqSending]        = useState(false);

  // Combine demo + KV spaces (KV takes precedence if available)
  const allSpaces: TourSpace[] = useMemo(() => {
    if (kvSpaces.length > 0) return kvSpaces;
    return listing?.tourSpaces ?? [];
  }, [listing, kvSpaces]);

  // Determine start index: param > isStartScene > 0
  const resolvedStartIdx = useMemo(() => {
    if (startSpace) return Math.max(0, parseInt(startSpace, 10));
    const idx = allSpaces.findIndex((s) => s.isStartScene);
    return idx >= 0 ? idx : 0;
  }, [startSpace, allSpaces]);

  const [activeSpaceIdx, setActiveSpaceIdx] = useState(resolvedStartIdx);
  const [activePin,      setActivePin]      = useState<TourPin | null>(null);
  const [focusPin,       setFocusPin]       = useState<TourPin | null>(null);

  // Load KV spaces
  useEffect(() => {
    if (!id) return;
    getTourSpaces(id).then((spaces) => {
      if (spaces && spaces.length > 0) setKvSpaces(spaces);
      setKvLoading(false);
    });
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

  const handlePinPress = (pin: TourPin) => {
    if (pin.type === "navigation" && pin.targetSpaceId) {
      const targetIdx = allSpaces.findIndex((s) => s.id === pin.targetSpaceId);
      if (targetIdx >= 0) { setActiveSpaceIdx(targetIdx); setFocusPin(null); return; }
    }
    setActivePin(pin);
  };

  const handleSubmitRequest = async () => {
    if (!selectedCategory) { Alert.alert("Select a category", "Please select what you'd like to know more about."); return; }
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
        <Feather name="rotate-ccw" size={40} color="#3B82F6" />
        <Text style={styles.noTourText}>No tour spaces yet</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const safeIdx     = Math.min(activeSpaceIdx, allSpaces.length - 1);
  const activeSpace = allSpaces[safeIdx];
  const hasAudio    = !!(activeSpace?.audioUrl);

  const infoTypes = useMemo(() => {
    const seen  = new Set<string>();
    const types: string[] = [];
    for (const p of (activeSpace?.pins ?? [])) {
      if (p.type === "navigation" || p.type === "external_link") continue;
      if (!seen.has(p.type)) { seen.add(p.type); types.push(p.type); }
    }
    return types;
  }, [activeSpace?.pins]);

  const shownTypes    = infoTypes.slice(0, 3);
  const shownCount    = shownTypes.reduce((s, t) => s + (activeSpace?.pins ?? []).filter((p) => p.type === t).length, 0);
  const extraCount    = (activeSpace?.pins.length ?? 0) - shownCount;
  const navPinCount   = (activeSpace?.pins ?? []).filter((p) => p.type === "navigation").length;
  const bottomBase    = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Feather name="x" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.tourInfo}>
          <Text style={styles.tourTitle} numberOfLines={1}>{listing?.businessName ?? "Tour"}</Text>
          {allSpaces.length <= 1 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.tourSpace}>{activeSpace?.name}</Text>
              {activeSpace?.isStartScene && (
                <View style={styles.startBadge}>
                  <Feather name="home" size={9} color="#fff" />
                </View>
              )}
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowRequestSheet(true)}>
          <Feather name="help-circle" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Scene tabs */}
      {allSpaces.length > 1 && (
        <View style={styles.spaceTabsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spaceTabs}>
            {allSpaces.map((space, idx) => (
              <TouchableOpacity
                key={space.id}
                style={[styles.spaceTab, { backgroundColor: idx === safeIdx ? "#2563EB" : "rgba(255,255,255,0.1)" }]}
                onPress={() => { setActiveSpaceIdx(idx); setFocusPin(null); }}
              >
                {space.isStartScene && (
                  <Feather name="home" size={9} color={idx === safeIdx ? "#fff" : "rgba(255,255,255,0.5)"} />
                )}
                <Text style={[styles.spaceTabText, { color: idx === safeIdx ? "#fff" : "rgba(255,255,255,0.6)" }]}>
                  {space.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <TourViewer
        key={activeSpace?.id}
        space={activeSpace}
        onPinPress={handlePinPress}
        focusPin={focusPin}
        onFocusPinHandled={() => setFocusPin(null)}
      />

      {/* Audio bar */}
      {hasAudio && (
        <View style={[styles.audioBar, { bottom: bottomBase + 72 }]}>
          <View style={styles.audioBarInner}>
            <Feather name="volume-2" size={14} color="#EC4899" />
            <Text style={styles.audioBarText}>Narration available</Text>
            <TouchableOpacity
              style={styles.audioPlayBtn}
              onPress={() => Linking.openURL(activeSpace.audioUrl!).catch(() => {})}
            >
              <Feather name="play" size={11} color="#fff" />
              <Text style={styles.audioPlayBtnText}>Play</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom overlay */}
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
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.requestBtn} onPress={() => setShowRequestSheet(true)}>
            <Feather name="help-circle" size={13} color="#fff" />
            <Text style={styles.requestBtnText}>Request Info</Text>
          </TouchableOpacity>
        </View>
        {navPinCount > 0 && (
          <View style={styles.navHint}>
            <Feather name="arrow-right-circle" size={11} color="#3B82F6" />
            <Text style={styles.navHintText}>Tap arrows to navigate between spaces</Text>
          </View>
        )}
      </View>

      <PinSheet pin={activePin} onClose={() => setActivePin(null)} />

      {/* Request More Info Modal */}
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
  tourInfo:        { flex: 1, alignItems: "center", gap: 2 },
  tourTitle:       { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  tourSpace:       { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  startBadge:      { backgroundColor: "#16A34A", width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  spaceTabsWrap:   { position: "absolute", top: 90, left: 0, right: 0, zIndex: 10 },
  spaceTabs:       { paddingHorizontal: 12, gap: 8, flexDirection: "row" },
  spaceTab:        { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  spaceTabText:    { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  audioBar:        { position: "absolute", left: 16, right: 16, zIndex: 10 },
  audioBarInner:   { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(7,18,33,0.88)", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#EC489940" },
  audioBarText:    { flex: 1, color: "#EC4899", fontSize: 12, fontFamily: "Inter_500Medium" },
  audioPlayBtn:    { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EC4899", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  audioPlayBtnText:{ color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
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
