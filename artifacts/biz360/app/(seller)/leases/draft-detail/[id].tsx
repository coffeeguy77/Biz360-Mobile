import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLease } from "@/context/LeaseContext";
import { DraftSection } from "@/context/leaseTypes";
import { DisclaimerBanner } from "@/components/lease/DisclaimerBanner";

const SECTION_ICONS: Record<DraftSection["type"], string> = {
  "schedule":            "list",
  "special-conditions":  "shield",
  "licence-clauses":     "layers",
  "tenant-protections":  "check-circle",
  "summary":             "file-text",
  "checklist":           "check-square",
  "red-flags":           "alert-triangle",
};
const SECTION_COLORS: Record<DraftSection["type"], string> = {
  "schedule":            "#3B82F6",
  "special-conditions":  "#8B5CF6",
  "licence-clauses":     "#F59E0B",
  "tenant-protections":  "#16A34A",
  "summary":             "#93C5FD",
  "checklist":           "#86EFAC",
  "red-flags":           "#FCA5A5",
};

export default function DraftDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { drafts, deleteDraft } = useLease();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const draft = drafts.find(d => d.id === id);

  if (!draft) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, marginTop: 8, fontFamily: "Inter_400Regular" }}>Draft not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleShare = async () => {
    const allText = draft.sections.map(s => `=== ${s.title.toUpperCase()} ===\n\n${s.content}`).join("\n\n\n");
    try {
      await Share.share({ message: allText, title: draft.name });
    } catch { /* ignore */ }
  };

  const handleDelete = () => {
    Alert.alert("Delete Draft", "Remove this draft permanently?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteDraft(draft.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{draft.name}</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {draft.jurisdiction} · {draft.leaseType} · {new Date(draft.createdAt).toLocaleDateString("en-AU")}
            </Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity onPress={handleShare} style={[styles.iconBtn, { backgroundColor: "#1E3A5C" }]}>
              <Feather name="share-2" size={16} color="#93C5FD" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={[styles.iconBtn, { backgroundColor: "#7F1D1D" }]}>
              <Feather name="trash-2" size={16} color="#FCA5A5" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.metaCard, { backgroundColor: "#0F1F35", borderColor: "#1E3A5C" }]}>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Premises Type</Text>
            <Text style={styles.metaVal}>{draft.premisesType}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Position</Text>
            <Text style={[styles.metaVal, { color: draft.position === "tenant-friendly" ? "#86EFAC" : draft.position === "landlord-friendly" ? "#FCA5A5" : "#93C5FD" }]}>{draft.position}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Protections</Text>
            <Text style={[styles.metaVal, { color: "#86EFAC" }]}>{draft.selectedProtections.length} selected</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Licence Areas</Text>
            <Text style={styles.metaVal}>{draft.licenceAreas.length || "None"}</Text>
          </View>
        </View>

        <Text style={[styles.sectionListTitle, { color: colors.foreground }]}>Sections ({draft.sections.length})</Text>
        {draft.sections.map(section => {
          const expanded = expandedSection === section.id;
          const icon = SECTION_ICONS[section.type] ?? "file-text";
          const color = SECTION_COLORS[section.type] ?? "#3B82F6";
          return (
            <View key={section.id} style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: expanded ? color : colors.border }]}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => setExpandedSection(expanded ? null : section.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.sectionIcon, { backgroundColor: color + "20" }]}>
                  <Feather name={icon as any} size={16} color={color} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{section.title}</Text>
                <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              {expanded && (
                <View style={[styles.sectionContent, { borderTopColor: color + "40" }]}>
                  <Text style={[styles.sectionText, { color: colors.mutedForeground }]}>{section.content}</Text>
                </View>
              )}
            </View>
          );
        })}

        <DisclaimerBanner text="This draft is a starting point for legal negotiations only. It does not constitute legal advice. Have a qualified solicitor review and finalise before use." />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  scroll:          { paddingHorizontal: 16, gap: 14 },
  headerRow:       { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn:         { padding: 4 },
  title:           { fontSize: 18, fontFamily: "Inter_700Bold" },
  sub:             { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  actions:         { flexDirection: "row", gap: 8 },
  iconBtn:         { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  metaCard:        { borderRadius: 14, padding: 14, borderWidth: 1, gap: 8 },
  metaRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaKey:         { fontSize: 12, fontFamily: "Inter_400Regular", color: "#8B9CB8" },
  metaVal:         { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  sectionListTitle:{ fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionCard:     { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  sectionHeader:   { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  sectionIcon:     { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  sectionTitle:    { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionContent:  { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1 },
  sectionText:     { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, paddingTop: 12 },
});
