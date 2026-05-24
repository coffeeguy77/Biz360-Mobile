import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEMO_LISTINGS, TourPin } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

const cafe = DEMO_LISTINGS[0];

const DIRECTIONS = ["Front", "Left", "Right", "Back", "Ceiling"] as const;

const ALL_PIN_TYPES: { type: TourPin["type"]; label: string; icon: string; color: string }[] = [
  { type: "equipment", label: "Equipment", icon: "tool", color: "#F59E0B" },
  { type: "revenue", label: "Revenue", icon: "trending-up", color: "#16A34A" },
  { type: "cogs", label: "COGS", icon: "package", color: "#EF4444" },
  { type: "workflow", label: "Workflow", icon: "git-branch", color: "#8B5CF6" },
  { type: "staffing", label: "Staffing", icon: "users", color: "#3B82F6" },
  { type: "lease", label: "Lease", icon: "home", color: "#F97316" },
  { type: "risk", label: "Risk", icon: "alert-triangle", color: "#EF4444" },
  { type: "opportunity", label: "Opportunity", icon: "star", color: "#16A34A" },
  { type: "narration", label: "Narration", icon: "mic", color: "#EC4899" },
];

interface DraftPin {
  id: string;
  type: TourPin["type"];
  title: string;
  description: string;
  requiresNDA: boolean;
}

interface DraftSpace {
  name: string;
  photos: Record<string, string>;
  pins: DraftPin[];
}

const EMPTY_SPACE: DraftSpace = { name: "", photos: {}, pins: [] };
const EMPTY_PIN: DraftPin = { id: "", type: "equipment", title: "", description: "", requiresNDA: false };

export default function ToursScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [draftSpace, setDraftSpace] = useState<DraftSpace>(EMPTY_SPACE);

  const [showPinModal, setShowPinModal] = useState(false);
  const [draftPin, setDraftPin] = useState<DraftPin>(EMPTY_PIN);

  const pickPhoto = async (dir: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo library access to add photos to your tour.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setDraftSpace((prev) => ({
        ...prev,
        photos: { ...prev.photos, [dir]: result.assets[0].uri },
      }));
    }
  };

  const removePhoto = (dir: string) => {
    setDraftSpace((prev) => {
      const { [dir]: _, ...rest } = prev.photos;
      return { ...prev, photos: rest };
    });
  };

  const openAddPin = () => {
    setDraftPin({ ...EMPTY_PIN, id: `pin-${Date.now()}` });
    setShowPinModal(true);
  };

  const savePin = () => {
    if (!draftPin.title.trim()) {
      Alert.alert("Title required", "Please enter a title for this pin.");
      return;
    }
    if (!draftPin.description.trim()) {
      Alert.alert("Description required", "Please add a description so buyers know what this pin is about.");
      return;
    }
    setDraftSpace((prev) => ({ ...prev, pins: [...prev.pins, draftPin] }));
    setShowPinModal(false);
  };

  const removePin = (id: string) => {
    setDraftSpace((prev) => ({ ...prev, pins: prev.pins.filter((p) => p.id !== id) }));
  };

  const handleSaveSpace = () => {
    if (!draftSpace.name.trim()) {
      Alert.alert("Name required", "Please enter a name for this tour space.");
      return;
    }
    const photoCount = Object.keys(draftSpace.photos).length;
    Alert.alert(
      "Space Created",
      `"${draftSpace.name}" added with ${photoCount} photo${photoCount !== 1 ? "s" : ""} and ${draftSpace.pins.length} info pin${draftSpace.pins.length !== 1 ? "s" : ""}.`,
      [{ text: "Done", onPress: () => { setShowSpaceModal(false); setDraftSpace(EMPTY_SPACE); } }]
    );
  };

  const selectedPinMeta = ALL_PIN_TYPES.find((p) => p.type === draftPin.type) ?? ALL_PIN_TYPES[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>360 Tours</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowSpaceModal(true)}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.tourCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.tourHero, { backgroundColor: cafe.heroColor }]}>
            <Feather name="rotate-ccw" size={28} color="#fff" />
            <Text style={styles.tourHeroTitle}>{cafe.businessName}</Text>
          </View>
          <View style={styles.tourBody}>
            <View style={styles.tourStats}>
              <View style={styles.tourStat}>
                <Text style={[styles.tourStatVal, { color: colors.primary }]}>{cafe.tourSpaces?.length ?? 0}</Text>
                <Text style={[styles.tourStatLbl, { color: colors.mutedForeground }]}>Spaces</Text>
              </View>
              <View style={styles.tourStat}>
                <Text style={[styles.tourStatVal, { color: colors.primary }]}>{cafe.tourSpaces?.reduce((acc, s) => acc + s.pins.length, 0) ?? 0}</Text>
                <Text style={[styles.tourStatLbl, { color: colors.mutedForeground }]}>Pins</Text>
              </View>
              <View style={styles.tourStat}>
                <Text style={[styles.tourStatVal, { color: colors.primary }]}>{cafe.tourStarts}</Text>
                <Text style={[styles.tourStatLbl, { color: colors.mutedForeground }]}>Starts</Text>
              </View>
              <View style={styles.tourStat}>
                <Text style={[styles.tourStatVal, { color: colors.accent }]}>89%</Text>
                <Text style={[styles.tourStatLbl, { color: colors.mutedForeground }]}>Completion</Text>
              </View>
            </View>

            <Text style={[styles.spacesTitle, { color: colors.foreground }]}>Tour Spaces</Text>
            {cafe.tourSpaces?.map((space) => (
              <View key={space.id} style={[styles.spaceRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.spaceIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="camera" size={16} color={colors.primary} />
                </View>
                <View style={styles.spaceInfo}>
                  <Text style={[styles.spaceName, { color: colors.foreground }]}>{space.name}</Text>
                  <Text style={[styles.spaceMeta, { color: colors.mutedForeground }]}>{space.photos.length} photos · {space.pins.length} pins</Text>
                </View>
                <TouchableOpacity onPress={() => router.push(`/tour/${cafe.id}` as any)}>
                  <Feather name="eye" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => setShowSpaceModal(true)}>
                <Feather name="plus" size={14} color={colors.foreground} />
                <Text style={[styles.btnText, { color: colors.foreground }]}>Add Space</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/tour/${cafe.id}` as any)}>
                <Feather name="rotate-ccw" size={14} color="#fff" />
                <Text style={[styles.btnText, { color: "#fff" }]}>Preview Tour</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── Create Space Modal ── */}
      <Modal visible={showSpaceModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSpaceModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowSpaceModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Tour Space</Text>
            <TouchableOpacity onPress={handleSaveSpace}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>Create</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>SPACE NAME</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. Main Dining Area, Kitchen, Front Counter…"
              placeholderTextColor={colors.mutedForeground}
              value={draftSpace.name}
              onChangeText={(t) => setDraftSpace((p) => ({ ...p, name: t }))}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DIRECTIONAL PHOTOS</Text>
            <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Tap each direction to choose a photo from your library. Buyers swipe through these in the tour.</Text>
            <View style={styles.photoGrid}>
              {DIRECTIONS.map((dir) => {
                const uri = draftSpace.photos[dir];
                return (
                  <View key={dir} style={styles.photoSlotWrapper}>
                    <TouchableOpacity
                      style={[styles.photoSlot, { backgroundColor: uri ? "transparent" : colors.card, borderColor: uri ? colors.primary : colors.border }]}
                      onPress={() => pickPhoto(dir)}
                    >
                      {uri ? (
                        <Image source={{ uri }} style={styles.photoThumb} />
                      ) : (
                        <>
                          <Feather name="camera" size={22} color={colors.mutedForeground} />
                          <Text style={[styles.photoLabel, { color: colors.mutedForeground }]}>{dir}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    {uri && (
                      <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(dir)}>
                        <Feather name="x" size={12} color="#fff" />
                      </TouchableOpacity>
                    )}
                    {uri && (
                      <Text style={[styles.photoLabelUnder, { color: colors.primary }]}>{dir}</Text>
                    )}
                  </View>
                );
              })}
            </View>

            <View style={styles.pinSectionHeader}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>INFO PINS ({draftSpace.pins.length})</Text>
              <TouchableOpacity style={[styles.addPinBtn, { backgroundColor: colors.primary }]} onPress={openAddPin}>
                <Feather name="plus" size={13} color="#fff" />
                <Text style={styles.addPinText}>Add Pin</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Buyers tap pins in the tour to see details. Add financial, lease, equipment, and other data points.</Text>

            {draftSpace.pins.map((pin) => {
              const meta = ALL_PIN_TYPES.find((p) => p.type === pin.type) ?? ALL_PIN_TYPES[0];
              return (
                <View key={pin.id} style={[styles.pinRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.pinDot, { backgroundColor: meta.color }]}>
                    <Feather name={meta.icon as any} size={12} color="#fff" />
                  </View>
                  <View style={styles.pinRowInfo}>
                    <Text style={[styles.pinRowTitle, { color: colors.foreground }]}>{pin.title}</Text>
                    <Text style={[styles.pinRowMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {meta.label}{pin.requiresNDA ? " · 🔒 NDA required" : ""}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => removePin(pin.id)}>
                    <Feather name="trash-2" size={15} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              );
            })}

            {draftSpace.pins.length === 0 && (
              <View style={[styles.emptyPins, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="map-pin" size={20} color={colors.mutedForeground} />
                <Text style={[styles.emptyPinsText, { color: colors.mutedForeground }]}>No pins yet. Tap "Add Pin" to create your first info pin.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Create Pin Modal ── */}
      <Modal visible={showPinModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPinModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowPinModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Info Pin</Text>
            <TouchableOpacity onPress={savePin}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>Add</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PIN TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pinTypeRow}>
              {ALL_PIN_TYPES.map(({ type, label, icon, color: pinColor }) => {
                const active = draftPin.type === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.pinTypeChip, { backgroundColor: active ? pinColor + "20" : colors.card, borderColor: active ? pinColor : colors.border }]}
                    onPress={() => setDraftPin((p) => ({ ...p, type }))}
                  >
                    <Feather name={icon as any} size={14} color={active ? pinColor : colors.mutedForeground} />
                    <Text style={[styles.pinTypeLabel, { color: active ? pinColor : colors.mutedForeground }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.pinTypeBanner, { backgroundColor: selectedPinMeta.color + "15", borderColor: selectedPinMeta.color + "30" }]}>
              <Feather name={selectedPinMeta.icon as any} size={14} color={selectedPinMeta.color} />
              <Text style={[styles.pinTypeBannerText, { color: selectedPinMeta.color }]}>
                {selectedPinMeta.label} pin — buyers tap this to learn about {selectedPinMeta.label.toLowerCase()} details
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TITLE</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder={`e.g. ${selectedPinMeta.label} — key detail here`}
              placeholderTextColor={colors.mutedForeground}
              value={draftPin.title}
              onChangeText={(t) => setDraftPin((p) => ({ ...p, title: t }))}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESCRIPTION</Text>
            <TextInput
              style={[styles.descInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Detailed information buyers will see when they tap this pin…"
              placeholderTextColor={colors.mutedForeground}
              value={draftPin.description}
              onChangeText={(t) => setDraftPin((p) => ({ ...p, description: t }))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.ndaLabelRow}>
                  <Feather name="lock" size={14} color="#F59E0B" />
                  <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Requires NDA</Text>
                </View>
                <Text style={[styles.toggleHint, { color: colors.mutedForeground }]}>Lock this pin — buyers must request NDA access to view it</Text>
              </View>
              <Switch
                value={draftPin.requiresNDA}
                onValueChange={(v) => setDraftPin((p) => ({ ...p, requiresNDA: v }))}
                trackColor={{ false: colors.muted, true: "#F59E0B60" }}
                thumbColor={draftPin.requiresNDA ? "#F59E0B" : colors.mutedForeground}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, gap: 16 },
  tourCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  tourHero: { height: 100, alignItems: "center", justifyContent: "center", gap: 8 },
  tourHeroTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  tourBody: { padding: 14, gap: 14 },
  tourStats: { flexDirection: "row", justifyContent: "space-between" },
  tourStat: { alignItems: "center" },
  tourStatVal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  tourStatLbl: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  spacesTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  spaceRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  spaceIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  spaceInfo: { flex: 1 },
  spaceName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  spaceMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  btnRow: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12 },
  btnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalCancel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  modalSave: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalScroll: { padding: 20, gap: 12 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  fieldHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -6 },
  nameInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 4 },
  descInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 100, marginTop: 4 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  photoSlotWrapper: { width: "30%", alignItems: "center", gap: 4 },
  photoSlot: { width: "100%", aspectRatio: 1, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center", gap: 6, overflow: "hidden" },
  photoThumb: { width: "100%", height: "100%" },
  photoLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  photoLabelUnder: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  removePhotoBtn: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  pinSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addPinBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  addPinText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pinRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  pinDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pinRowInfo: { flex: 1 },
  pinRowTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pinRowMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  emptyPins: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" },
  emptyPinsText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  pinTypeRow: { gap: 8, paddingVertical: 4 },
  pinTypeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  pinTypeLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pinTypeBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  pinTypeBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1 },
  ndaLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
