import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLease } from "@/context/LeaseContext";

export default function LeaseDrafts() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { drafts, deleteDraft } = useLease();

  const handleDelete = (id: string) => {
    Alert.alert("Delete Draft", "Remove this draft?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteDraft(id) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>My Drafts</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>{drafts.length} lease draft{drafts.length !== 1 ? "s" : ""}</Text>
          </View>
          <TouchableOpacity
            style={[styles.newBtn, { backgroundColor: "#16A34A" }]}
            onPress={() => router.push("/(seller)/leases/builder" as any)}
          >
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.newBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {drafts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="edit-3" size={28} color="#16A34A" />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No drafts yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Use the Lease Builder to create a customised draft with tenant protections for your specific jurisdiction and premises type.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: "#16A34A" }]}
              onPress={() => router.push("/(seller)/leases/builder" as any)}
            >
              <Text style={styles.emptyBtnText}>Create First Draft</Text>
            </TouchableOpacity>
          </View>
        ) : (
          drafts.map(draft => (
            <View key={draft.id} style={[styles.draftCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.draftMain}
                onPress={() => router.push({ pathname: "/(seller)/leases/draft-detail/[id]", params: { id: draft.id } } as any)}
              >
                <View style={[styles.draftIcon, { backgroundColor: "#052E16" }]}>
                  <Feather name="file-text" size={18} color="#16A34A" />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.draftName, { color: colors.foreground }]} numberOfLines={1}>{draft.name}</Text>
                  <Text style={[styles.draftMeta, { color: colors.mutedForeground }]}>
                    {draft.jurisdiction} · {draft.premisesType} · {new Date(draft.createdAt).toLocaleDateString("en-AU")}
                  </Text>
                  <Text style={[styles.draftSections, { color: colors.mutedForeground }]}>
                    {draft.sections.length} sections · {draft.selectedProtections.length} protections
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(draft.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="trash-2" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 16, gap: 14 },
  headerRow:    { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:      { padding: 4 },
  title:        { fontSize: 20, fontFamily: "Inter_700Bold" },
  sub:          { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  newBtn:       { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  newBtnText:   { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyCard:    { borderRadius: 14, padding: 24, borderWidth: 1, alignItems: "center", gap: 10 },
  emptyTitle:   { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyText:    { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  emptyBtn:     { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 4 },
  emptyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  draftCard:    { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  draftMain:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  draftIcon:    { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  draftName:    { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  draftMeta:    { fontSize: 11, fontFamily: "Inter_400Regular" },
  draftSections:{ fontSize: 11, fontFamily: "Inter_400Regular" },
});
