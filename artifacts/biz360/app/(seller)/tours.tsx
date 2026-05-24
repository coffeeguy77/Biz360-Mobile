import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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
import { DEMO_LISTINGS } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

const cafe = DEMO_LISTINGS[0];

const DIRECTIONS = ["Front", "Left", "Right", "Back", "Ceiling"] as const;
const PIN_TYPES = [
  { type: "financial", label: "Financial", icon: "dollar-sign", color: "#16A34A" },
  { type: "lease", label: "Lease", icon: "file-text", color: "#3B82F6" },
  { type: "equipment", label: "Equipment", icon: "tool", color: "#F59E0B" },
  { type: "staff", label: "Staff", icon: "users", color: "#8B5CF6" },
  { type: "compliance", label: "Compliance", icon: "shield", color: "#EF4444" },
] as const;

interface NewSpace {
  name: string;
  photos: Record<string, boolean>;
  pins: { type: string; label: string }[];
}

export default function ToursScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSpace, setNewSpace] = useState<NewSpace>({
    name: "",
    photos: {},
    pins: [],
  });

  const togglePhoto = (dir: string) => {
    setNewSpace((prev) => ({
      ...prev,
      photos: { ...prev.photos, [dir]: !prev.photos[dir] },
    }));
  };

  const togglePin = (type: string, label: string) => {
    setNewSpace((prev) => {
      const exists = prev.pins.some((p) => p.type === type);
      return {
        ...prev,
        pins: exists ? prev.pins.filter((p) => p.type !== type) : [...prev.pins, { type, label }],
      };
    });
  };

  const handleSaveSpace = () => {
    if (!newSpace.name.trim()) {
      Alert.alert("Name required", "Please enter a name for this tour space.");
      return;
    }
    Alert.alert(
      "Space Created",
      `"${newSpace.name}" has been added to the tour with ${Object.values(newSpace.photos).filter(Boolean).length} photo angles and ${newSpace.pins.length} info pins.`,
      [{ text: "Done", onPress: () => { setShowCreateModal(false); setNewSpace({ name: "", photos: {}, pins: [] }); } }]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>360 Tours</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowCreateModal(true)}>
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
                <Text style={[styles.tourStatVal, { color: colors.primary }]}>
                  {cafe.tourSpaces?.reduce((acc, s) => acc + s.pins.length, 0) ?? 0}
                </Text>
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
                  <Text style={[styles.spaceMeta, { color: colors.mutedForeground }]}>
                    {space.photos.length} photos · {space.pins.length} pins
                  </Text>
                </View>
                <TouchableOpacity onPress={() => router.push(`/tour/${cafe.id}` as any)}>
                  <Feather name="eye" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => setShowCreateModal(true)}>
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

      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
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
              value={newSpace.name}
              onChangeText={(t) => setNewSpace((p) => ({ ...p, name: t }))}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PHOTO ANGLES</Text>
            <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Select which directions you'll photograph for this space.</Text>
            <View style={styles.photoGrid}>
              {DIRECTIONS.map((dir) => {
                const active = !!newSpace.photos[dir];
                return (
                  <TouchableOpacity
                    key={dir}
                    style={[styles.photoSlot, { backgroundColor: active ? colors.primary + "20" : colors.card, borderColor: active ? colors.primary : colors.border }]}
                    onPress={() => togglePhoto(dir)}
                  >
                    <Feather name={active ? "check-circle" : "camera"} size={20} color={active ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.photoLabel, { color: active ? colors.primary : colors.mutedForeground }]}>{dir}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>INFO PINS</Text>
            <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Choose which data points buyers can tap in this space.</Text>
            <View style={styles.pinGrid}>
              {PIN_TYPES.map(({ type, label, icon, color: pinColor }) => {
                const active = newSpace.pins.some((p) => p.type === type);
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.pinChip, { backgroundColor: active ? pinColor + "20" : colors.card, borderColor: active ? pinColor : colors.border }]}
                    onPress={() => togglePin(type, label)}
                  >
                    <Feather name={icon as any} size={14} color={active ? pinColor : colors.mutedForeground} />
                    <Text style={[styles.pinChipLabel, { color: active ? pinColor : colors.mutedForeground }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
                {Object.values(newSpace.photos).filter(Boolean).length} angle{Object.values(newSpace.photos).filter(Boolean).length !== 1 ? "s" : ""} ·{" "}
                {newSpace.pins.length} pin{newSpace.pins.length !== 1 ? "s" : ""} · Buyers can explore "{newSpace.name || "this space"}" in the 360 tour
              </Text>
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
  fieldLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 8 },
  fieldHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  nameInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 4 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  photoSlot: { width: "30%", aspectRatio: 1, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center", gap: 6 },
  photoLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pinGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  pinChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  pinChipLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  summaryCard: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  summaryText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
