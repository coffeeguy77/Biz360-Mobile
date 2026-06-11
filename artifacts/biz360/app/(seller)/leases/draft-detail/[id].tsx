import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert, Animated, Keyboard, Platform, ScrollView, Share, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
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
  const { drafts, updateDraft, deleteDraft } = useLease();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const saveOpacity = useRef(new Animated.Value(0)).current;

  const draft = drafts.find(d => d.id === id);
  const hasEdits = Object.keys(edits).length > 0;

  const showSaveBar = useCallback((show: boolean) => {
    Animated.timing(saveOpacity, {
      toValue: show ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [saveOpacity]);

  const handleSectionEdit = (sectionId: string, text: string) => {
    setEdits(prev => {
      const next = { ...prev, [sectionId]: text };
      showSaveBar(Object.keys(next).length > 0);
      return next;
    });
  };

  const handleSave = async () => {
    if (!draft || Object.keys(edits).length === 0) return;
    setSaving(true);
    try {
      const updatedSections = draft.sections.map(s =>
        edits[s.id] !== undefined ? { ...s, content: edits[s.id] } : s
      );
      await updateDraft(draft.id, { sections: updatedSections });
      setEdits({});
      showSaveBar(false);
      setEditingSection(null);
      Keyboard.dismiss();
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardEdits = () => {
    Alert.alert("Discard Changes", "Undo all unsaved edits?", [
      { text: "Keep Editing", style: "cancel" },
      {
        text: "Discard", style: "destructive",
        onPress: () => {
          setEdits({});
          showSaveBar(false);
          setEditingSection(null);
          Keyboard.dismiss();
        },
      },
    ]);
  };

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
    const sections = draft.sections.map(s => ({
      ...s,
      content: edits[s.id] ?? s.content,
    }));
    const allText = sections.map(s => `=== ${s.title.toUpperCase()} ===\n\n${s.content}`).join("\n\n\n");
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
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => {
              if (hasEdits) {
                handleDiscardEdits();
              } else {
                router.back();
              }
            }}
            style={styles.backBtn}
          >
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

        <View style={styles.editHint}>
          <Feather name="edit-2" size={12} color="#8B9CB8" />
          <Text style={[styles.editHintText, { color: "#8B9CB8" }]}>Expand a section then tap its text to edit</Text>
        </View>

        <Text style={[styles.sectionListTitle, { color: colors.foreground }]}>Sections ({draft.sections.length})</Text>
        {draft.sections.map(section => {
          const expanded = expandedSection === section.id;
          const isEditing = editingSection === section.id;
          const icon = SECTION_ICONS[section.type] ?? "file-text";
          const color = SECTION_COLORS[section.type] ?? "#3B82F6";
          const currentContent = edits[section.id] ?? section.content;
          const isDirty = edits[section.id] !== undefined;

          return (
            <View key={section.id} style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: expanded ? color : colors.border }]}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => {
                  if (expanded && isEditing) setEditingSection(null);
                  setExpandedSection(expanded ? null : section.id);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.sectionIcon, { backgroundColor: color + "20" }]}>
                  <Feather name={icon as any} size={16} color={color} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{section.title}</Text>
                {isDirty && <View style={[styles.dirtyDot, { backgroundColor: "#F59E0B" }]} />}
                <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              {expanded && (
                <View style={[styles.sectionContent, { borderTopColor: color + "40" }]}>
                  {isEditing ? (
                    <>
                      <TextInput
                        style={[styles.sectionInput, { color: colors.foreground, borderColor: color + "60" }]}
                        value={currentContent}
                        onChangeText={text => handleSectionEdit(section.id, text)}
                        multiline
                        autoFocus
                        scrollEnabled={false}
                        placeholderTextColor={colors.mutedForeground}
                      />
                      <TouchableOpacity
                        style={[styles.doneEditBtn, { borderColor: color + "60" }]}
                        onPress={() => setEditingSection(null)}
                      >
                        <Feather name="check" size={13} color={color} />
                        <Text style={[styles.doneEditText, { color }]}>Done Editing</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity activeOpacity={0.75} onPress={() => setEditingSection(section.id)}>
                      <Text style={[styles.sectionText, { color: colors.mutedForeground }]}>{currentContent}</Text>
                      <View style={styles.tapToEditRow}>
                        <Feather name="edit-2" size={11} color={color + "80"} />
                        <Text style={[styles.tapToEdit, { color: color + "80" }]}>Tap to edit</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <DisclaimerBanner text="This draft is a starting point for legal negotiations only. It does not constitute legal advice. Have a qualified solicitor review and finalise before use." />
      </ScrollView>

      {/* Floating save bar */}
      <Animated.View
        style={[
          styles.saveBar,
          { opacity: saveOpacity, bottom: insets.bottom + (Platform.OS === "web" ? 84 : 70) },
        ]}
        pointerEvents={hasEdits ? "auto" : "none"}
      >
        <TouchableOpacity style={styles.discardBtn} onPress={handleDiscardEdits}>
          <Text style={styles.discardText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, { opacity: saving ? 0.6 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Feather name="save" size={15} color="#fff" />
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Changes"}</Text>
        </TouchableOpacity>
      </Animated.View>
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
  editHint:        { flexDirection: "row", alignItems: "center", gap: 6 },
  editHintText:    { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionListTitle:{ fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionCard:     { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  sectionHeader:   { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  sectionIcon:     { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  sectionTitle:    { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  dirtyDot:        { width: 8, height: 8, borderRadius: 4 },
  sectionContent:  { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1 },
  sectionText:     { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, paddingTop: 12 },
  tapToEditRow:    { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 },
  tapToEdit:       { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionInput:    {
    fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18,
    paddingTop: 12, paddingBottom: 8, paddingHorizontal: 10, marginTop: 4,
    borderWidth: 1, borderRadius: 8, minHeight: 120, textAlignVertical: "top",
  },
  doneEditBtn:     {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  doneEditText:    { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  saveBar:         {
    position: "absolute", left: 16, right: 16,
    flexDirection: "row", gap: 10, alignItems: "center",
    backgroundColor: "#0F1F35", borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: "#1E3A5C",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 8,
  },
  discardBtn:      { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  discardText:     { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8B9CB8" },
  saveBtn:         {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#2563EB", borderRadius: 10, paddingVertical: 10,
  },
  saveBtnText:     { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
