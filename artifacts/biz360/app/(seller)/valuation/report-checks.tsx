import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
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

const REQUIRED_LABELS: Record<string, string> = {
  business_overview: "Business Overview",
  reason_for_sale: "Reason for Sale",
  products_services: "Products & Services",
  financial_performance_summary: "Financial Summary",
  addbacks_adjusted_ebitda: "Add-backs & Adjusted EBITDA",
  app_valuation_summary: "Valuation Summary",
  plant_equipment_summary: "Plant & Equipment",
  lease_premises_summary: "Lease & Premises",
  staffing_workforce: "Staffing & Workforce",
  customer_base: "Customer Base",
  operations_overview: "Operations Overview",
  growth_opportunities: "Growth Opportunities",
  asking_price_terms: "Asking Price & Terms",
};

const PLACEHOLDER_PHRASES = [
  "seller should", "to be confirmed", "insert", "placeholder",
  "example only", "not yet provided", "replace this", "add details",
  "update this", "enter details", "lorem ipsum",
];

interface ReportSection {
  id: string;
  sectionKey: string;
  title: string;
  body: string | null;
  bulletPoints?: string[] | null;
  tableData?: unknown;
  chartData?: unknown;
  status: string;
  visibility: string;
  isRequired: boolean;
}

function hasContent(s: ReportSection): boolean {
  if (s.status === "complete") return true;
  if (s.body && s.body.trim().length > 10) return true;
  if (Array.isArray(s.bulletPoints) && s.bulletPoints.length > 0) return true;
  if (s.tableData) return true;
  if (s.chartData) return true;
  return false;
}

function needsReview(s: ReportSection): boolean {
  if (!hasContent(s)) return false;
  const text = [
    s.body ?? "",
    ...(Array.isArray(s.bulletPoints) ? s.bulletPoints : []),
  ].join(" ").toLowerCase();
  return PLACEHOLDER_PHRASES.some((p) => text.includes(p));
}

type CheckStatus = "ok" | "warn" | "error";
interface Check {
  status: CheckStatus;
  label: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function ReportChecksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { latestSnapshot, selectedCafe } = useValuation();
  const params = useLocalSearchParams<{ listingId: string }>();
  const listingId = params.listingId ?? selectedCafe?.listingId ?? selectedCafe?.listing_id ?? "";

  const [sections, setSections] = useState<ReportSection[]>([]);
  const [loading, setLoading] = useState(false);

  const snap = latestSnapshot.combined;

  const loadSections = useCallback(async () => {
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
        setSections(data.sections ?? []);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [listingId]);

  useFocusEffect(useCallback(() => { loadSections(); }, [loadSections]));

  const filledSections = sections.filter(hasContent);
  const missingRequired = REQUIRED_KEYS.filter((k) => {
    const s = sections.find((sec) => sec.sectionKey === k);
    return !s || !hasContent(s);
  });
  const placeholderSections = sections.filter(needsReview);
  const placeholderRequired = REQUIRED_KEYS.filter((k) => {
    const s = sections.find((sec) => sec.sectionKey === k);
    return s && hasContent(s) && needsReview(s);
  });

  const checks: Check[] = [];

  // ── POSITIVE CHECKS ─────────────────────────────────────────────────────
  if (sections.length > 0 && filledSections.length === sections.length) {
    checks.push({
      status: "ok",
      label: `${filledSections.length} / ${sections.length} sections contain text`,
    });
  } else if (sections.length > 0) {
    checks.push({
      status: filledSections.length === sections.length ? "ok" : "ok",
      label: `${filledSections.length} / ${sections.length} sections contain text`,
    });
  }

  if (snap?.grossRevenue && Number(snap.grossRevenue) > 0) {
    checks.push({ status: "ok", label: "Revenue data available" });
  }

  if (snap?.valuationMidpoint && Number(snap.valuationMidpoint) > 0) {
    checks.push({ status: "ok", label: "Valuation data available" });
  }

  if (snap?.totalEquipmentValue && Number(snap.totalEquipmentValue) > 0) {
    checks.push({ status: "ok", label: "Equipment value available" });
  }

  if (snap?.adjustedEbitda && Number(snap.adjustedEbitda) > 0) {
    checks.push({ status: "ok", label: "Adjusted EBITDA calculated" });
  }

  if (missingRequired.length === 0) {
    checks.push({ status: "ok", label: "All 13 required sections have content" });
  }

  if (placeholderRequired.length === 0 && sections.length > 0) {
    checks.push({ status: "ok", label: "No placeholder text detected in required sections" });
  }

  // ── WARNINGS ────────────────────────────────────────────────────────────
  for (const sectionKey of placeholderRequired) {
    const s = sections.find((sec) => sec.sectionKey === sectionKey);
    checks.push({
      status: "warn",
      label: `${REQUIRED_LABELS[sectionKey] ?? sectionKey} — placeholder text detected`,
      detail: "Replace the AI-guidance text with your own seller-specific wording.",
      actionLabel: "Edit Section",
      onAction: s ? () => router.push({ pathname: "/(seller)/valuation/report-section-editor" as any, params: { sectionId: s.id } }) : undefined,
    });
  }

  for (const sectionKey of placeholderSections
    .filter((s) => !REQUIRED_KEYS.includes(s.sectionKey))
    .slice(0, 5)
  ) {
    checks.push({
      status: "warn",
      label: `${sectionKey.title} — placeholder text detected`,
      detail: "Review and replace with your own content.",
      actionLabel: "Edit Section",
      onAction: () => router.push({ pathname: "/(seller)/valuation/report-section-editor" as any, params: { sectionId: sectionKey.id } }),
    });
  }

  if (!snap || !snap.valuationMidpoint || Number(snap.valuationMidpoint) === 0) {
    checks.push({
      status: "warn",
      label: "No valuation snapshot",
      detail: "Sync your financial data from the Valuation hub.",
      actionLabel: "Go to Valuation",
      onAction: () => router.back(),
    });
  }

  if (!snap?.grossRevenue || Number(snap.grossRevenue) === 0) {
    checks.push({
      status: "warn",
      label: "No revenue data — connect Xero or Square",
      detail: "Revenue figures are used to calculate your business valuation.",
    });
  }

  // ── ERRORS ──────────────────────────────────────────────────────────────
  for (const sectionKey of missingRequired) {
    checks.push({
      status: "error",
      label: `${REQUIRED_LABELS[sectionKey] ?? sectionKey} — missing content`,
      detail: "This required section has no content. Add text before publishing.",
      actionLabel: "Edit Section",
      onAction: () => router.push("/(seller)/valuation/report-builder" as any),
    });
  }

  const okCount = checks.filter((c) => c.status === "ok").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const errorCount = checks.filter((c) => c.status === "error").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Report Checks</Text>
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
        </View>

        {/* Summary row */}
        {!loading && (
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCell, { backgroundColor: "#16A34A18", borderColor: "#16A34A33" }]}>
              <Text style={[styles.summaryCellNum, { color: "#16A34A" }]}>{okCount}</Text>
              <Text style={[styles.summaryCellLabel, { color: "#16A34A" }]}>Passed</Text>
            </View>
            <View style={[styles.summaryCell, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B33" }]}>
              <Text style={[styles.summaryCellNum, { color: "#F59E0B" }]}>{warnCount}</Text>
              <Text style={[styles.summaryCellLabel, { color: "#F59E0B" }]}>Need Review</Text>
            </View>
            <View style={[styles.summaryCell, { backgroundColor: "#EF444418", borderColor: "#EF444433" }]}>
              <Text style={[styles.summaryCellNum, { color: "#EF4444" }]}>{errorCount}</Text>
              <Text style={[styles.summaryCellLabel, { color: "#EF4444" }]}>Blockers</Text>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Running checks…</Text>
          </View>
        ) : (
          <>
            {/* Passed checks */}
            {okCount > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PASSED</Text>
                {checks.filter((c) => c.status === "ok").map((c, i) => (
                  <View key={i} style={[styles.checkRow, { backgroundColor: "#16A34A0A", borderColor: "#16A34A22" }]}>
                    <Feather name="check-circle" size={16} color="#16A34A" />
                    <Text style={[styles.checkLabel, { color: colors.foreground }]}>{c.label}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Warnings */}
            {warnCount > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NEEDS REVIEW</Text>
                {checks.filter((c) => c.status === "warn").map((c, i) => (
                  <View key={i} style={[styles.checkCard, { backgroundColor: colors.card, borderColor: "#F59E0B33" }]}>
                    <View style={styles.checkCardTop}>
                      <Feather name="alert-triangle" size={15} color="#F59E0B" style={{ marginTop: 1 }} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={[styles.checkLabel, { color: colors.foreground }]}>{c.label}</Text>
                        {c.detail && (
                          <Text style={[styles.checkDetail, { color: colors.mutedForeground }]}>{c.detail}</Text>
                        )}
                      </View>
                    </View>
                    {c.actionLabel && c.onAction && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: "#F59E0B55", backgroundColor: "#F59E0B11" }]}
                        onPress={c.onAction}
                      >
                        <Text style={[styles.actionBtnText, { color: "#F59E0B" }]}>{c.actionLabel}</Text>
                        <Feather name="arrow-right" size={13} color="#F59E0B" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </>
            )}

            {/* Errors */}
            {errorCount > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MISSING CONTENT</Text>
                {checks.filter((c) => c.status === "error").map((c, i) => (
                  <View key={i} style={[styles.checkCard, { backgroundColor: colors.card, borderColor: "#EF444433" }]}>
                    <View style={styles.checkCardTop}>
                      <Feather name="x-circle" size={15} color="#EF4444" style={{ marginTop: 1 }} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={[styles.checkLabel, { color: colors.foreground }]}>{c.label}</Text>
                        {c.detail && (
                          <Text style={[styles.checkDetail, { color: colors.mutedForeground }]}>{c.detail}</Text>
                        )}
                      </View>
                    </View>
                    {c.actionLabel && c.onAction && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: "#EF444455", backgroundColor: "#EF444411" }]}
                        onPress={c.onAction}
                      >
                        <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>{c.actionLabel}</Text>
                        <Feather name="arrow-right" size={13} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </>
            )}

            {/* All clear */}
            {!loading && sections.length > 0 && errorCount === 0 && warnCount === 0 && (
              <View style={[styles.allClearCard, { backgroundColor: "#16A34A0F", borderColor: "#16A34A33" }]}>
                <Feather name="check-circle" size={28} color="#16A34A" />
                <Text style={[styles.allClearTitle, { color: "#16A34A" }]}>Report looks great!</Text>
                <Text style={[styles.allClearSub, { color: colors.mutedForeground }]}>
                  All required sections have content and no placeholder text was detected.
                </Text>
              </View>
            )}

            {sections.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Feather name="file-text" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No sections loaded</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Go to Edit Report to build your IM Report sections first.
                </Text>
              </View>
            )}

            {/* Quick links */}
            {sections.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>QUICK ACTIONS</Text>
                {[
                  { label: "Edit Report Sections", icon: "edit-2", color: "#3B82F6", route: "/(seller)/valuation/report-builder" },
                  { label: "Configure Buyer Access", icon: "lock", color: "#8B5CF6", route: "/(seller)/valuation/report-access" },
                  { label: "Due Diligence Pack", icon: "check-square", color: "#F87171", route: "/(seller)/valuation/due-diligence" },
                ].map(({ label, icon, color, route }) => (
                  <TouchableOpacity
                    key={label}
                    style={[styles.quickLink, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => router.push(route as any)}
                  >
                    <View style={[styles.quickLinkIcon, { backgroundColor: color + "18" }]}>
                      <Feather name={icon as any} size={16} color={color} />
                    </View>
                    <Text style={[styles.quickLinkLabel, { color: colors.foreground }]}>{label}</Text>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1 },
  scroll:           { paddingHorizontal: 16, gap: 12 },
  header:           { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  backBtn:          { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:            { fontSize: 22, fontFamily: "Inter_700Bold", flex: 1 },
  summaryRow:       { flexDirection: "row", gap: 10 },
  summaryCell:      { flex: 1, alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 4 },
  summaryCellNum:   { fontSize: 26, fontFamily: "Inter_700Bold" },
  summaryCellLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  sectionLabel:     { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 6 },
  checkRow:         { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  checkCard:        { borderRadius: 12, padding: 14, borderWidth: 1, gap: 10 },
  checkCardTop:     { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkLabel:       { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19 },
  checkDetail:      { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  actionBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  actionBtnText:    { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  allClearCard:     { alignItems: "center", padding: 28, borderRadius: 16, borderWidth: 1, gap: 10, marginVertical: 8 },
  allClearTitle:    { fontSize: 18, fontFamily: "Inter_700Bold" },
  allClearSub:      { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  loadingState:     { alignItems: "center", paddingVertical: 60, gap: 12 },
  loadingText:      { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyState:       { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle:       { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText:        { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  quickLink:        { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, borderWidth: 1 },
  quickLinkIcon:    { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  quickLinkLabel:   { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
