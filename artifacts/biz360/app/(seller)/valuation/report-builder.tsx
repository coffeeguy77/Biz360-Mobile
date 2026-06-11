import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
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

const REQUIRED_KEYS = [
  "business_overview", "reason_for_sale", "products_services",
  "financial_performance_summary", "addbacks_adjusted_ebitda",
  "app_valuation_summary", "plant_equipment_summary",
  "lease_premises_summary", "staffing_workforce", "customer_base",
  "operations_overview", "growth_opportunities", "asking_price_terms",
];

const VISIBILITY_CYCLE: Visibility[] = ["public", "verified_buyer", "nda_signed", "hidden"];
type Visibility = "public" | "verified_buyer" | "nda_signed" | "hidden";

interface ReportSection {
  id: string;
  sectionKey: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  status: string;
  visibility: Visibility;
  sortOrder: number;
  isRequired: boolean;
  includeInPdf: boolean;
  lastUpdatedAt: string | null;
}

function hasContent(s: ReportSection): boolean {
  return s.status === "complete" || (!!s.body && s.body.trim().length > 10);
}

function deriveSource(s: ReportSection): { label: string; color: string } | null {
  if (!s.body?.trim()) return null;
  const lines = s.body.split("\n").filter((l) => l.trim());
  const kvLines = lines.filter((l) => /^[A-Za-z].+:\s.+/.test(l)).length;
  if (lines.length > 0 && kvLines / lines.length > 0.4) return { label: "App Data", color: "#3B82F6" };
  return { label: "Manual", color: "#6B7280" };
}

function visibilityConfig(v: Visibility): { icon: string; color: string; label: string } {
  if (v === "public")         return { icon: "globe", color: "#16A34A", label: "Public" };
  if (v === "verified_buyer") return { icon: "user-check", color: "#3B82F6", label: "Verified" };
  if (v === "nda_signed")     return { icon: "lock", color: "#A78BFA", label: "NDA" };
  return { icon: "eye-off", color: "#6B7280", label: "Hidden" };
}

function statusConfig(s: ReportSection): { label: string; color: string } {
  if (s.status === "complete")     return { label: "Complete",     color: "#16A34A" };
  if (s.status === "needs_review") return { label: "Needs Review", color: "#F87171" };
  if (hasContent(s))               return { label: "Draft",        color: "#F59E0B" };
  return { label: "Empty", color: "#6B7280" };
}

type FilterTab = "all" | "incomplete" | "complete";

export default function ReportBuilderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe } = useValuation();
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [toggling, setToggling] = useState<string | null>(null);

  const listingId = selectedCafe?.listingId ?? selectedCafe?.listing_id;

  const loadSections = useCallback(async (autoSeed = false) => {
    if (!listingId) return;
    const token = await getAuthToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/report-sections/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const fetched: ReportSection[] = (data.sections ?? []).sort(
          (a: ReportSection, b: ReportSection) => a.sortOrder - b.sortOrder
        );
        if (fetched.length === 0 && autoSeed) {
          // First visit with no sections: auto-create the 40 default guided sections
          setSeeding(true);
          try {
            const seedRes = await fetch(`${API_BASE}/api/report-sections/defaults/${listingId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            });
            if (seedRes.ok) {
              const seedData = await seedRes.json();
              setSections((seedData.sections ?? []).sort(
                (a: ReportSection, b: ReportSection) => a.sortOrder - b.sortOrder
              ));
            } else {
              setSections([]);
            }
          } catch { setSections([]); }
          finally { setSeeding(false); }
        } else {
          setSections(fetched);
        }
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [listingId]);

  useFocusEffect(useCallback(() => { loadSections(true); }, [loadSections]));

  async function handleSeedDefaults() {
    if (!listingId) return;
    const token = await getAuthToken();
    if (!token) return;
    setSeeding(true);
    try {
      const res = await fetch(`${API_BASE}/api/report-sections/defaults/${listingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await loadSections();
        Alert.alert("Report created", "40 guided sections have been added. Tap any section to fill in your content.");
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err.error ?? "Failed to create default sections");
      }
    } catch { Alert.alert("Error", "Network error. Please try again."); }
    finally { setSeeding(false); }
  }

  async function handleTogglePdf(section: ReportSection) {
    const token = await getAuthToken();
    if (!token) return;
    setToggling(section.id + "_pdf");
    try {
      const res = await fetch(`${API_BASE}/api/report-sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ includeInPdf: !section.includeInPdf }),
      });
      if (res.ok) {
        setSections((prev) => prev.map((s) => s.id === section.id ? { ...s, includeInPdf: !section.includeInPdf } : s));
      }
    } catch { /* non-fatal */ }
    finally { setToggling(null); }
  }

  async function handleCycleVisibility(section: ReportSection) {
    const token = await getAuthToken();
    if (!token) return;
    const currentIdx = VISIBILITY_CYCLE.indexOf(section.visibility);
    const nextVisibility = VISIBILITY_CYCLE[(currentIdx + 1) % VISIBILITY_CYCLE.length];
    setToggling(section.id + "_vis");
    try {
      const res = await fetch(`${API_BASE}/api/report-sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ visibility: nextVisibility }),
      });
      if (res.ok) {
        setSections((prev) => prev.map((s) => s.id === section.id ? { ...s, visibility: nextVisibility } : s));
      }
    } catch { /* non-fatal */ }
    finally { setToggling(null); }
  }

  async function handleDelete(section: ReportSection) {
    Alert.alert("Delete Section?", `Remove "${section.title}" from the report?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          const token = await getAuthToken();
          if (!token) return;
          try {
            const res = await fetch(`${API_BASE}/api/report-sections/${section.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              setSections((prev) => prev.filter((s) => s.id !== section.id));
            } else {
              const err = await res.json().catch(() => ({}));
              Alert.alert("Cannot delete", err.error ?? "This section could not be removed.");
            }
          } catch {
            Alert.alert("Error", "Network error — please try again.");
          }
        },
      },
    ]);
  }

  const filled = sections.filter(hasContent).length;
  const requiredFilled = sections.filter((s) => REQUIRED_KEYS.includes(s.sectionKey) && hasContent(s)).length;
  const pct = sections.length === 0 ? 0 : Math.round((requiredFilled / REQUIRED_KEYS.length) * 100);

  const missingRequired = REQUIRED_KEYS.filter((k) => !sections.find((s) => s.sectionKey === k && hasContent(s)));

  const filtered = filter === "all"
    ? sections
    : filter === "complete"
      ? sections.filter(hasContent)
      : sections.filter((s) => !hasContent(s));

  if (!listingId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.foreground }]}>Report Builder</Text>
          </View>
          <View style={styles.emptyState}>
            <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Listing Linked</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Link this business to a listing to build an IM report.</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Report Builder</Text>
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
        </View>

        {/* Completeness bar */}
        {sections.length > 0 && (
          <View style={[styles.progressCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressTitle}>Completeness</Text>
                <Text style={styles.progressSub}>{filled} of {sections.length} sections with content</Text>
              </View>
              <Text style={[styles.progressPct, { color: pct >= 80 ? "#16A34A" : pct >= 40 ? "#F59E0B" : "#3B82F6" }]}>{pct}%</Text>
            </View>
            <View style={[styles.progressBg, { backgroundColor: "#1E3A5C" }]}>
              <View style={[styles.progressFill, {
                width: `${pct}%` as any,
                backgroundColor: pct >= 80 ? "#16A34A" : pct >= 40 ? "#F59E0B" : "#3B82F6",
              }]} />
            </View>
            <View style={styles.progressStats}>
              {[
                { label: "Required", val: `${requiredFilled}/${REQUIRED_KEYS.length}`, color: "#3B82F6" },
                { label: "Total", val: `${sections.length}`, color: "#8B9CB8" },
                { label: "In PDF", val: `${sections.filter((s) => s.includeInPdf).length}`, color: "#A78BFA" },
              ].map(({ label, val, color }) => (
                <View key={label} style={styles.statCell}>
                  <Text style={[styles.statNum, { color }]}>{val}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
            {/* Actionable recommendations */}
            {missingRequired.length > 0 && (
              <View style={[styles.recommendBox, { backgroundColor: "#F59E0B11", borderColor: "#F59E0B33" }]}>
                <Feather name="alert-triangle" size={13} color="#F59E0B" />
                <Text style={[styles.recommendText, { color: "#F59E0B" }]}>
                  {missingRequired.length === 1
                    ? `Add "${missingRequired[0].replace(/_/g, " ")}" to complete the required sections.`
                    : `${missingRequired.length} required sections still need content to meet IM standards.`}
                </Text>
              </View>
            )}
          </View>
        )}

        {sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Sections Yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Create 40 guided sections based on your business data, or add sections manually.
            </Text>
            <TouchableOpacity
              style={[styles.seedBtn, { opacity: seeding ? 0.6 : 1 }]}
              onPress={handleSeedDefaults}
              disabled={seeding}
            >
              {seeding
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="zap" size={16} color="#fff" />}
              <Text style={styles.seedBtnText}>{seeding ? "Creating sections…" : "Create Default Sections"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Filter tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {(["all", "incomplete", "complete"] as FilterTab[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.filterChip, filter === t && { backgroundColor: colors.primary }]}
                  onPress={() => setFilter(t)}
                >
                  <Text style={[styles.filterText, filter === t && { color: "#fff" }]}>
                    {t === "all" ? `All (${sections.length})` : t === "complete" ? `Complete (${sections.filter(hasContent).length})` : `Incomplete (${sections.filter((s) => !hasContent(s)).length})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Section cards */}
            {filtered.map((section) => {
              const sc = statusConfig(section);
              const vc = visibilityConfig(section.visibility);
              const src = deriveSource(section);
              return (
                <View key={section.id} style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: hasContent(section) ? colors.border : colors.border }]}>
                  <View style={styles.sectionCardTop}>
                    {/* Required dot + title */}
                    <View style={styles.sectionTitleRow}>
                      {REQUIRED_KEYS.includes(section.sectionKey) && (
                        <View style={styles.requiredDot} />
                      )}
                      <Text style={[styles.sectionTitle, { color: colors.foreground }]} numberOfLines={2}>
                        {section.title}
                      </Text>
                    </View>

                    {/* Badge row */}
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, { backgroundColor: sc.color + "22" }]}>
                        <Text style={[styles.badgeText, { color: sc.color }]}>{sc.label}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.badge, { backgroundColor: vc.color + "18" }]}
                        onPress={() => handleCycleVisibility(section)}
                        disabled={toggling === section.id + "_vis"}
                      >
                        {toggling === section.id + "_vis"
                          ? <ActivityIndicator size="small" color={vc.color} style={{ width: 10, height: 10 }} />
                          : <Feather name={vc.icon as any} size={10} color={vc.color} />}
                        <Text style={[styles.badgeText, { color: vc.color }]}>{vc.label}</Text>
                      </TouchableOpacity>
                      {section.includeInPdf && (
                        <View style={[styles.badge, { backgroundColor: "#A78BFA18" }]}>
                          <Feather name="file-text" size={10} color="#A78BFA" />
                          <Text style={[styles.badgeText, { color: "#A78BFA" }]}>PDF</Text>
                        </View>
                      )}
                      {src && (
                        <View style={[styles.badge, { backgroundColor: src.color + "18" }]}>
                          <Feather name={src.label === "App Data" ? "database" : "edit"} size={10} color={src.color} />
                          <Text style={[styles.badgeText, { color: src.color }]}>{src.label}</Text>
                        </View>
                      )}
                    </View>

                    {/* Body preview */}
                    {section.body ? (
                      <Text style={[styles.sectionBodyPreview, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {section.body}
                      </Text>
                    ) : (
                      <Text style={[styles.sectionEmpty, { color: colors.mutedForeground }]}>No content yet</Text>
                    )}
                  </View>

                  {/* Actions row */}
                  <View style={[styles.sectionCardActions, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                      onPress={() => router.push({ pathname: "/(seller)/valuation/report-section-editor" as any, params: { sectionId: section.id } })}
                    >
                      <Feather name="edit-2" size={13} color="#fff" />
                      <Text style={styles.actionBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtnOutline, { borderColor: colors.border }]}
                      onPress={() => handleTogglePdf(section)}
                      disabled={toggling === section.id + "_pdf"}
                    >
                      {toggling === section.id + "_pdf"
                        ? <ActivityIndicator size="small" color={colors.mutedForeground} />
                        : <Feather name={section.includeInPdf ? "file-minus" : "file-plus"} size={13} color={colors.mutedForeground} />}
                      <Text style={[styles.actionBtnOutlineText, { color: colors.mutedForeground }]}>
                        {section.includeInPdf ? "Remove PDF" : "Add PDF"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(section)}
                    >
                      <Feather name="trash-2" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {/* Re-seed nudge */}
            <TouchableOpacity
              style={[styles.reseedBtn, { borderColor: colors.border }]}
              onPress={handleSeedDefaults}
              disabled={seeding}
            >
              <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
              <Text style={[styles.reseedText, { color: colors.mutedForeground }]}>Re-run defaults (adds missing sections)</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  scroll:            { paddingHorizontal: 16, gap: 14 },
  header:            { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:           { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:             { fontSize: 22, fontFamily: "Inter_700Bold", flex: 1 },
  progressCard:      { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  progressHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  progressTitle:     { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  progressSub:       { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  progressPct:       { fontSize: 30, fontFamily: "Inter_700Bold" },
  progressBg:        { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill:      { height: 8, borderRadius: 4 },
  progressStats:     { flexDirection: "row", justifyContent: "space-around", paddingTop: 6 },
  statCell:          { alignItems: "center", gap: 2 },
  statNum:           { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel:         { color: "#8B9CB8", fontSize: 10, fontFamily: "Inter_400Regular" },
  recommendBox:      { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 10, borderWidth: 1 },
  recommendText:     { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },
  filterRow:         { gap: 8, paddingBottom: 2 },
  filterChip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1E3A5C" },
  filterText:        { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8B9CB8" },
  sectionCard:       { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  sectionCardTop:    { padding: 14, gap: 8 },
  sectionTitleRow:   { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  requiredDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: "#3B82F6", marginTop: 5 },
  sectionTitle:      { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1, lineHeight: 20 },
  badgeRow:          { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badge:             { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText:         { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  sectionBodyPreview:{ fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  sectionEmpty:      { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  sectionCardActions:{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  actionBtn:         { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  actionBtnText:     { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  actionBtnOutline:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, flex: 1 },
  actionBtnOutlineText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  deleteBtn:         { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  emptyState:        { alignItems: "center", paddingVertical: 60, gap: 14 },
  emptyTitle:        { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText:         { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 280 },
  seedBtn:           { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#2563EB", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  seedBtnText:       { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  reseedBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" },
  reseedText:        { fontSize: 13, fontFamily: "Inter_500Medium" },
});
