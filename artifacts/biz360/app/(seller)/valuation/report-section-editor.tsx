import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem("biz360_auth_token");
}

type Visibility = "public" | "verified_buyer" | "nda_signed" | "hidden";

interface SectionData {
  id: string;
  sectionKey: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  bullets: string[] | null;
  status: string;
  visibility: Visibility;
  includeInPdf: boolean;
  includeInHtml: boolean;
  includeInApp: boolean;
  sortOrder: number;
}

const VISIBILITY_OPTIONS: { value: Visibility; label: string; desc: string; color: string }[] = [
  { value: "public",          label: "Public",          desc: "Visible to all marketplace visitors",          color: "#16A34A" },
  { value: "verified_buyer",  label: "Verified Buyer",  desc: "Only buyers who have requested info",          color: "#3B82F6" },
  { value: "nda_signed",      label: "NDA Signed",      desc: "Only buyers who have signed the NDA",          color: "#A78BFA" },
  { value: "hidden",          label: "Hidden",          desc: "Not shown on any buyer-facing view",           color: "#6B7280" },
];

export default function ReportSectionEditorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe } = useValuation();
  const { sectionId } = useLocalSearchParams<{ sectionId: string; title: string }>();

  const [section, setSection] = useState<SectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [bullets, setBullets] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("verified_buyer");
  const [includeInPdf, setIncludeInPdf] = useState(true);
  const [includeInHtml, setIncludeInHtml] = useState(true);
  const [includeInApp, setIncludeInApp] = useState(true);
  const [showVisibility, setShowVisibility] = useState(false);

  const listingId = selectedCafe?.listingId ?? selectedCafe?.listing_id;

  useEffect(() => {
    if (!sectionId) return;
    (async () => {
      setLoading(true);
      try {
        const token = await getAuthToken();
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/report-sections/${sectionId}/detail`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const s: SectionData = data.section;
          setSection(s);
          setTitle(s.title ?? "");
          setSubtitle(s.subtitle ?? "");
          setBody(s.body ?? "");
          setBullets(Array.isArray(s.bullets) ? s.bullets : []);
          setVisibility(s.visibility as Visibility ?? "verified_buyer");
          setIncludeInPdf(s.includeInPdf ?? true);
          setIncludeInHtml(s.includeInHtml ?? true);
          setIncludeInApp(s.includeInApp ?? true);
        } else {
          Alert.alert("Error", "Could not load section. Please try again.");
          router.back();
        }
      } catch {
        Alert.alert("Error", "Network error. Please try again.");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [sectionId]);

  async function handleSave(markComplete?: boolean) {
    if (!sectionId) return;
    const token = await getAuthToken();
    if (!token) return;
    setSaving(true);
    try {
      const cleanBullets = bullets.filter((b) => b.trim().length > 0);
      const body_payload: Record<string, unknown> = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        body: body.trim() || null,
        bullets: cleanBullets.length ? cleanBullets : null,
        visibility,
        includeInPdf,
        includeInHtml,
        includeInApp,
      };
      if (markComplete) body_payload.status = "complete";

      const res = await fetch(`${API_BASE}/api/report-sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body_payload),
      });
      if (res.ok) {
        if (markComplete) {
          Alert.alert("Marked Complete", "This section is now marked as complete.", [
            { text: "OK", onPress: () => router.back() },
          ]);
        } else {
          router.back();
        }
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err.error ?? "Failed to save section");
      }
    } catch { Alert.alert("Error", "Network error. Please try again."); }
    finally { setSaving(false); }
  }

  async function handleAutoFill() {
    if (!listingId || !section) return;
    const token = await getAuthToken();
    if (!token) return;
    setAutoFilling(true);
    try {
      const res = await fetch(`${API_BASE}/api/report-sections/auto-fill/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const suggestion = data.suggestions?.[section.sectionKey];
        if (suggestion) {
          const suggestedBody = suggestion.suggestedBody as string | undefined;
          const suggestedBullets = suggestion.suggestedBullets as string[] | undefined;
          const sourceLabel = (suggestion.sourceLabel as string) ?? "app data";

          Alert.alert(
            "Auto-fill Suggestion",
            `Found data from ${sourceLabel}:\n\n${suggestedBody ? suggestedBody.slice(0, 200) + (suggestedBody.length > 200 ? "…" : "") : "(bullet points only)"}`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Apply",
                onPress: () => {
                  if (suggestedBody && suggestedBody.trim()) setBody(suggestedBody.trim());
                  if (suggestedBullets?.length) setBullets(suggestedBullets);
                },
              },
            ]
          );
        } else {
          Alert.alert("No suggestion", "No auto-fill data found for this section. Fill it in manually or import from CSV.");
        }
      } else {
        Alert.alert("Error", "Could not fetch auto-fill data.");
      }
    } catch { Alert.alert("Error", "Network error. Please try again."); }
    finally { setAutoFilling(false); }
  }

  function addBullet() {
    setBullets((prev) => [...prev, ""]);
  }

  function updateBullet(idx: number, val: string) {
    setBullets((prev) => prev.map((b, i) => (i === idx ? val : b)));
  }

  function removeBullet(idx: number) {
    setBullets((prev) => prev.filter((_, i) => i !== idx));
  }

  const selVis = VISIBILITY_OPTIONS.find((v) => v.value === visibility)!;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {title || "Edit Section"}
          </Text>
          <TouchableOpacity
            style={[styles.autoFillBtn, { opacity: autoFilling ? 0.6 : 1 }]}
            onPress={handleAutoFill}
            disabled={autoFilling}
          >
            {autoFilling
              ? <ActivityIndicator size="small" color="#FBBF24" />
              : <Feather name="zap" size={16} color="#FBBF24" />}
            <Text style={styles.autoFillText}>Auto-fill</Text>
          </TouchableOpacity>
        </View>

        {/* Section title */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>SECTION TITLE</Text>
          <TextInput
            style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Business Overview"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        {/* Subtitle */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>SUBTITLE (optional)</Text>
          <TextInput
            style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={subtitle}
            onChangeText={setSubtitle}
            placeholder="Short supporting headline"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        {/* Body */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>SECTION BODY</Text>
          <TextInput
            style={[styles.bodyInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={body}
            onChangeText={setBody}
            placeholder="Write the full text content for this section. Buyers will read this in the IM."
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
            {body.length} chars{body.length < 50 && body.length > 0 ? " — add more detail" : ""}
          </Text>
        </View>

        {/* Bullet points */}
        <View style={styles.fieldBlock}>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>KEY POINTS</Text>
            <TouchableOpacity onPress={addBullet}>
              <Text style={[styles.addLink, { color: colors.primary }]}>+ Add point</Text>
            </TouchableOpacity>
          </View>
          {bullets.length === 0 && (
            <Text style={[styles.emptyBullets, { color: colors.mutedForeground }]}>
              Bullet points appear as a quick-reference list in the IM.
            </Text>
          )}
          {bullets.map((bullet, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
              <TextInput
                style={[styles.bulletInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                value={bullet}
                onChangeText={(val) => updateBullet(idx, val)}
                placeholder={`Key point ${idx + 1}`}
                placeholderTextColor={colors.mutedForeground}
              />
              <TouchableOpacity onPress={() => removeBullet(idx)} style={styles.removeBulletBtn}>
                <Feather name="x" size={15} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Visibility */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>VISIBILITY</Text>
          <TouchableOpacity
            style={[styles.visSelector, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowVisibility((v) => !v)}
          >
            <View style={[styles.visDot, { backgroundColor: selVis.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.visLabel, { color: colors.foreground }]}>{selVis.label}</Text>
              <Text style={[styles.visDesc, { color: colors.mutedForeground }]}>{selVis.desc}</Text>
            </View>
            <Feather name={showVisibility ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {showVisibility && (
            <View style={[styles.visDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {VISIBILITY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.visOption, { borderBottomColor: colors.border }]}
                  onPress={() => { setVisibility(opt.value); setShowVisibility(false); }}
                >
                  <View style={[styles.visDot, { backgroundColor: opt.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.visLabel, { color: colors.foreground }]}>{opt.label}</Text>
                    <Text style={[styles.visDesc, { color: colors.mutedForeground }]}>{opt.desc}</Text>
                  </View>
                  {visibility === opt.value && <Feather name="check" size={14} color={opt.color} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Include toggles */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>INCLUDE IN</Text>
          <View style={[styles.toggleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {([
              ["PDF Export", includeInPdf, setIncludeInPdf],
              ["HTML Export", includeInHtml, setIncludeInHtml],
              ["App Display", includeInApp, setIncludeInApp],
            ] as [string, boolean, (v: boolean) => void][]).map(([label, val, setter]) => (
              <TouchableOpacity
                key={label}
                style={[styles.toggleRow, { borderBottomColor: colors.border }]}
                onPress={() => setter(!val)}
              >
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
                <View style={[styles.toggle, { backgroundColor: val ? colors.primary : colors.border }]}>
                  <View style={[styles.toggleThumb, { left: val ? 18 : 2 }]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
            onPress={() => handleSave(false)}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="save" size={16} color="#fff" />}
            <Text style={styles.saveBtnText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.completeBtn, { opacity: saving ? 0.6 : 1 }]}
            onPress={() => handleSave(true)}
            disabled={saving}
          >
            <Feather name="check-circle" size={16} color="#16A34A" />
            <Text style={styles.completeBtnText}>Mark Complete</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  scroll:          { paddingHorizontal: 16, gap: 18 },
  header:          { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  backBtn:         { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: 2 },
  title:           { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 26 },
  autoFillBtn:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: "#2D2010" },
  autoFillText:    { color: "#FBBF24", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  fieldBlock:      { gap: 8 },
  fieldLabel:      { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  fieldRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldInput:      { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  bodyInput:       { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 160, lineHeight: 22 },
  charCount:       { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },
  addLink:         { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyBullets:    { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  bulletRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  bulletDot:       { width: 6, height: 6, borderRadius: 3 },
  bulletInput:     { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontFamily: "Inter_400Regular" },
  removeBulletBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  visSelector:     { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  visDot:          { width: 10, height: 10, borderRadius: 5 },
  visLabel:        { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  visDesc:         { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  visDropdown:     { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  visOption:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1 },
  toggleCard:      { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  toggleRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  toggleLabel:     { fontSize: 14, fontFamily: "Inter_500Medium" },
  toggle:          { width: 40, height: 24, borderRadius: 12, position: "relative" },
  toggleThumb:     { position: "absolute", top: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" },
  actionRow:       { flexDirection: "row", gap: 10 },
  saveBtn:         { flex: 3, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  saveBtnText:     { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  completeBtn:     { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: "#16A34A" },
  completeBtnText: { color: "#16A34A", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
