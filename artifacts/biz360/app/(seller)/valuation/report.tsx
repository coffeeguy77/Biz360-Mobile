import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, Share, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem("biz360_auth_token");
}

function fmt(val: string | number | null | undefined): string {
  const n = Number(val ?? 0);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
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
  addbacks_adjusted_ebitda: "Add-backs",
  app_valuation_summary: "Valuation Summary",
  plant_equipment_summary: "Equipment",
  lease_premises_summary: "Lease",
  staffing_workforce: "Staffing",
  customer_base: "Customer Base",
  operations_overview: "Operations",
  growth_opportunities: "Growth Opportunities",
  asking_price_terms: "Asking Price & Terms",
};

interface ReportSection {
  id: string;
  sectionKey: string;
  title: string;
  body: string | null;
  status: string;
  visibility: string;
  isRequired: boolean;
}

interface ReportVersion {
  id: string;
  versionNumber: number;
  status: string;
  title: string | null;
  createdAt: string | null;
}

type ReportStatus = "empty" | "draft" | "ready" | "published" | "buyer_locked";

function computeStatus(sections: ReportSection[], pct: number, versions: ReportVersion[]): ReportStatus {
  if (sections.length === 0) return "empty";
  // buyer_locked: at least one version has been pushed live to buyers
  if (versions.some((v) => v.status === "published")) return "buyer_locked";
  // published: at least one version snapshot exists (even if still draft in DB)
  if (versions.length > 0) return "published";
  if (pct >= 80) return "ready";
  return "draft";
}

function healthScore(pct: number, sections: ReportSection[]): number {
  const filled = sections.filter((s) => s.status === "complete" || (s.body?.trim().length ?? 0) > 10).length;
  const total = sections.length;
  const coverageScore = total > 0 ? Math.round((filled / total) * 100) : 0;
  // Blend completeness (50%) with required-key coverage (50%)
  return Math.round((pct * 0.5) + (coverageScore * 0.5));
}

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string }> = {
  empty:        { label: "Empty",        color: "#6B7280" },
  draft:        { label: "Draft",        color: "#3B82F6" },
  ready:        { label: "Ready",        color: "#F59E0B" },
  published:    { label: "Published",    color: "#16A34A" },
  buyer_locked: { label: "Buyer Locked", color: "#A78BFA" },
};

function completenessScore(sections: ReportSection[]): number {
  if (!sections.length) return 0;
  const filled = REQUIRED_KEYS.filter((k) => {
    const s = sections.find((sec) => sec.sectionKey === k);
    return s && (s.status === "complete" || (s.body && s.body.trim().length > 10));
  }).length;
  return Math.round((filled / REQUIRED_KEYS.length) * 100);
}

export default function ReportHubScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { latestSnapshot, selectedCafe } = useValuation();
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const snap = latestSnapshot.combined;
  const listingId = selectedCafe?.listingId ?? selectedCafe?.listing_id;

  const loadData = useCallback(async () => {
    if (!listingId) return;
    const token = await getAuthToken();
    if (!token) return;
    setLoading(true);
    try {
      const [sectRes, verRes] = await Promise.all([
        fetch(`${API_BASE}/api/report-sections/${listingId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/report-versions/${listingId}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (sectRes.ok) {
        const data = await sectRes.json();
        setSections(data.sections ?? []);
      }
      if (verRes.ok) {
        const data = await verRes.json();
        setVersions(data.versions ?? []);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [listingId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const pct = completenessScore(sections);
  const score = healthScore(pct, sections);
  const status = computeStatus(sections, pct, versions);
  const statusCfg = STATUS_CONFIG[status];
  const adjEbitda = Number(snap?.adjustedEbitda ?? 0);
  const equipVal = Number(snap?.totalEquipmentValue ?? 0);
  const blendedLow = Math.round((adjEbitda * 2.0 + equipVal) * 0.9);
  const blendedHigh = Math.round((adjEbitda * 2.5 + equipVal) * 1.1);

  const missingRequired = REQUIRED_KEYS.filter((k) => {
    const s = sections.find((sec) => sec.sectionKey === k);
    return !s || (!s.body?.trim() && s.status !== "complete");
  });

  async function handleDownloadCsv() {
    if (!listingId) return;
    const token = await getAuthToken();
    if (!token) return;
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/api/report-sections/csv-template/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        Alert.alert("Error", "Could not generate CSV template. Please try again.");
        return;
      }
      const csvText = await res.text();
      const filename = `im-report-${listingId}-template.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([csvText], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const path = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(path, csvText, { encoding: FileSystem.EncodingType.UTF8 });
        await Share.share({ url: path, title: "IM Report AI Fill Template" });
      }
    } catch {
      Alert.alert("Error", "Download failed. Please check your connection.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleUploadCsv() {
    if (!listingId) return;
    const token = await getAuthToken();
    if (!token) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", ".csv"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      setUploading(true);

      // Read text for AsyncStorage (needed by confirm step)
      let csvText: string;
      if (Platform.OS === "web") {
        const resp = await fetch(file.uri);
        csvText = await resp.text();
      } else {
        csvText = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      }

      if (!csvText.trim()) {
        Alert.alert("Error", "The selected file appears to be empty.");
        return;
      }

      // Build multipart FormData for upload
      const formData = new FormData();
      if (Platform.OS === "web") {
        const blob = new Blob([csvText], { type: "text/csv" });
        formData.append("file", blob, file.name ?? "imported.csv");
      } else {
        formData.append("file", { uri: file.uri, type: "text/csv", name: file.name ?? "imported.csv" } as any);
      }

      const res = await fetch(`${API_BASE}/api/report-sections/csv-import/${listingId}?preview=true`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Parse Error", err.error ?? "Could not parse the CSV file.");
        return;
      }
      const previewData = await res.json();

      await AsyncStorage.setItem("csv_import_pending_text", csvText);

      router.push({
        pathname: "/(seller)/valuation/csv-import-preview" as any,
        params: {
          listingId,
          fileName: file.name ?? "imported.csv",
          preview: JSON.stringify(previewData),
        },
      });
    } catch {
      Alert.alert("Error", "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handlePublish() {
    if (!listingId || !snap) return;
    const token = await getAuthToken();
    if (!token) return;
    if (pct < 40) {
      Alert.alert("Report incomplete", "Please complete at least 40% of required sections before publishing.");
      return;
    }
    const versionNum = (versions[0]?.versionNumber ?? 0) + 1;
    Alert.alert(
      "Publish IM Report?",
      `This will snapshot your current ${sections.length} sections as Version ${versionNum} and make it visible to approved buyers.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: async () => {
            setPublishing(true);
            try {
              // Step 1: Create the version snapshot (starts as "draft")
              const createRes = await fetch(`${API_BASE}/api/report-versions`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ listingId, title: `Version ${versionNum} — ${new Date().toLocaleDateString("en-AU")}` }),
              });
              if (!createRes.ok) {
                const err = await createRes.json().catch(() => ({}));
                Alert.alert("Error", err.error ?? "Could not create version snapshot");
                return;
              }
              const { version: draftVersion } = await createRes.json();

              // Step 2: Immediately mark the version as "published" so buyers can see it
              const publishRes = await fetch(`${API_BASE}/api/report-versions/${draftVersion.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: "published" }),
              });
              if (publishRes.ok) {
                const { version: publishedVersion } = await publishRes.json();
                setVersions((prev) => [publishedVersion, ...prev]);
                Alert.alert("Published!", `Version ${versionNum} is now live. Approved buyers can view the IM report.`);
              } else {
                // Snapshot was created but not yet published — surface this clearly
                setVersions((prev) => [draftVersion, ...prev]);
                const err = await publishRes.json().catch(() => ({}));
                Alert.alert("Partially saved", `Snapshot created but could not be published: ${err.error ?? "unknown error"}. Go to Version History to publish it manually.`);
              }
            } catch { Alert.alert("Error", "Network error. Please try again."); }
            finally { setPublishing(false); }
          },
        },
      ]
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
          <Text style={[styles.title, { color: colors.foreground }]}>IM Report</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + "22" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
            <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        </View>

        {/* Version pill */}
        {versions.length > 0 && (
          <View style={[styles.versionPill, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
            <Feather name="clock" size={12} color="#8B9CB8" />
            <Text style={styles.versionText}>
              {versions.length} version{versions.length !== 1 ? "s" : ""} · Latest: {versions[0].title ?? `v${versions[0].versionNumber}`}
            </Text>
          </View>
        )}

        {/* Financial summary card */}
        {snap ? (
          <View style={[styles.summaryCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
            <Text style={styles.bizName}>{selectedCafe?.name ?? "Business"}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryLeft}>
                <Text style={styles.summaryLabel}>Estimated Value</Text>
                <Text style={styles.summaryVal}>{fmt(snap.valuationMidpoint)}</Text>
                <Text style={styles.summaryRange}>{fmt(blendedLow)} — {fmt(blendedHigh)}</Text>
              </View>
              <View style={styles.summaryRight}>
                {([
                  ["Revenue", snap.grossRevenue],
                  ["Adj. EBITDA", snap.adjustedEbitda],
                  ["Equipment", snap.totalEquipmentValue],
                ] as [string, string | null | undefined][]).map(([label, val]) => (
                  <View key={label} style={styles.metaRow}>
                    <Text style={styles.metaLabel}>{label}</Text>
                    <Text style={styles.metaVal}>{fmt(val)}</Text>
                  </View>
                ))}
                <View style={[styles.metaRow, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#1E3A5C" }]}>
                  <Text style={styles.metaLabel}>Report Health</Text>
                  <Text style={[styles.metaVal, { color: score >= 70 ? "#16A34A" : score >= 40 ? "#F59E0B" : "#EF4444" }]}>
                    {score}%
                  </Text>
                </View>
              </View>
            </View>
            {snap.snapshotDate && (
              <Text style={styles.updatedText}>Last synced {snap.snapshotDate}</Text>
            )}
          </View>
        ) : (
          <View style={[styles.noSnapCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="alert-circle" size={18} color={colors.mutedForeground} />
            <Text style={[styles.noSnapText, { color: colors.mutedForeground }]}>No valuation snapshot — sync from the Valuation hub first.</Text>
          </View>
        )}

        {/* Completeness bar */}
        <View style={[styles.completenessCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.completenessHeader}>
            <Text style={[styles.completenessTitle, { color: colors.foreground }]}>Report Completeness</Text>
            {loading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={[styles.completenessNum, { color: pct >= 80 ? "#16A34A" : pct >= 40 ? "#F59E0B" : colors.primary }]}>{pct}%</Text>}
          </View>
          <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: pct >= 80 ? "#16A34A" : pct >= 40 ? "#F59E0B" : colors.primary }]} />
          </View>
          <Text style={[styles.completenessHint, { color: colors.mutedForeground }]}>
            {sections.length === 0
              ? 'Tap "Edit Report" to build your Information Memorandum with 40 guided sections.'
              : `${sections.filter((s) => s.status === "complete" || (s.body?.trim().length ?? 0) > 10).length} of ${sections.length} sections have content`}
          </Text>
          {missingRequired.length > 0 && missingRequired.length <= 3 && (
            <View style={styles.recommendRow}>
              <Feather name="alert-triangle" size={13} color="#F59E0B" />
              <Text style={[styles.recommendText, { color: "#F59E0B" }]}>
                Missing: {missingRequired.slice(0, 3).map((k) => REQUIRED_LABELS[k]).join(", ")}
              </Text>
            </View>
          )}
          {missingRequired.length > 3 && (
            <TouchableOpacity
              style={[styles.recommendMore, { borderColor: "#F59E0B33" }]}
              onPress={() => router.push({ pathname: "/(seller)/valuation/report-builder" as any, params: { filter: "incomplete" } })}
            >
              <Feather name="list" size={13} color="#F59E0B" />
              <Text style={[styles.recommendText, { color: "#F59E0B" }]}>
                {missingRequired.length} required sections need content — tap to complete
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Primary actions */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACTIONS</Text>
        <View style={styles.primaryGrid}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(seller)/valuation/report-builder" as any)}
          >
            <Feather name="edit-2" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Edit Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: "#1E3A5C" }]}
            onPress={() => Alert.alert("Preview", "HTML preview is coming in the HTML/PDF export task.")}
          >
            <Feather name="eye" size={18} color="#60A5FA" />
            <Text style={[styles.primaryBtnText, { color: "#60A5FA" }]}>Preview Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: "#1E3A5C" }]}
            onPress={() => Alert.alert("Export PDF", "PDF export is coming in the HTML/PDF export task.")}
          >
            <Feather name="file-text" size={18} color="#A78BFA" />
            <Text style={[styles.primaryBtnText, { color: "#A78BFA" }]}>Export PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: downloading ? "#0F2040" : "#1E3A5C", opacity: downloading ? 0.7 : 1 }]}
            onPress={handleDownloadCsv}
            disabled={downloading}
          >
            {downloading
              ? <ActivityIndicator size="small" color="#34D399" />
              : <Feather name="download" size={18} color="#34D399" />}
            <Text style={[styles.primaryBtnText, { color: "#34D399" }]}>
              {downloading ? "Generating…" : "AI Fill Template"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: uploading ? "#0F2040" : "#1E3A5C", opacity: uploading ? 0.7 : 1 }]}
            onPress={handleUploadCsv}
            disabled={uploading}
          >
            {uploading
              ? <ActivityIndicator size="small" color="#FBBF24" />
              : <Feather name="upload" size={18} color="#FBBF24" />}
            <Text style={[styles.primaryBtnText, { color: "#FBBF24" }]}>
              {uploading ? "Uploading…" : "Upload CSV"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: publishing ? "#1E3A5C" : "#16A34A" }]}
            onPress={handlePublish}
            disabled={publishing}
          >
            {publishing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="upload-cloud" size={18} color="#fff" />}
            <Text style={styles.primaryBtnText}>
              {status === "buyer_locked" ? "Re-publish" : "Publish"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* AI fill warning notice */}
        <View style={[styles.aiWarning, { backgroundColor: "#7C2D1208", borderColor: "#F59E0B33" }]}>
          <Feather name="alert-triangle" size={13} color="#F59E0B" style={{ marginTop: 1 }} />
          <Text style={[styles.aiWarningText, { color: "#D97706" }]}>
            Do not upload confidential financial documents into third-party AI tools unless you are comfortable sharing that information.
          </Text>
        </View>

        {/* Secondary actions */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MORE</Text>
        <View style={styles.secondaryGrid}>
          {[
            { label: "Report Sections", icon: "list", color: "#3B82F6", route: "/(seller)/valuation/report-builder" },
            { label: "Access Settings", icon: "lock", color: "#8B5CF6", route: "/(seller)/valuation/report-access" },
            { label: "Version History", icon: "clock", color: "#6B7280", route: null, badge: versions.length > 0 ? `${versions.length}` : null },
            { label: "AI Draft Helper", icon: "zap", color: "#FBBF24", route: null },
            { label: "Charts & Stats", icon: "bar-chart-2", color: "#34D399", route: null },
            { label: "Due Diligence Pack", icon: "check-square", color: "#F87171", route: "/(seller)/valuation/due-diligence" },
          ].map(({ label, icon, color, route, badge }) => (
            <TouchableOpacity
              key={label}
              style={[styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                if (route) router.push(route as any);
                else Alert.alert(label, "Coming in a future update.");
              }}
            >
              <View style={[styles.secondaryIcon, { backgroundColor: color + "18" }]}>
                <Feather name={icon as any} size={18} color={color} />
              </View>
              <Text style={[styles.secondaryLabel, { color: colors.foreground }]}>{label}</Text>
              {badge && (
                <View style={[styles.secondaryBadge, { backgroundColor: color + "22" }]}>
                  <Text style={[styles.secondaryBadgeText, { color }]}>{badge}</Text>
                </View>
              )}
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  scroll:             { paddingHorizontal: 16, gap: 14 },
  header:             { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:            { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:              { fontSize: 22, fontFamily: "Inter_700Bold", flex: 1 },
  statusBadge:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot:          { width: 7, height: 7, borderRadius: 4 },
  statusText:         { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  versionPill:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, alignSelf: "flex-start" },
  versionText:        { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular" },
  summaryCard:        { borderRadius: 16, padding: 18, borderWidth: 1, gap: 10 },
  bizName:            { color: "#8B9CB8", fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  summaryRow:         { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  summaryLeft:        { flex: 1 },
  summaryLabel:       { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular" },
  summaryVal:         { color: "#3B82F6", fontSize: 30, fontFamily: "Inter_700Bold", marginTop: 2 },
  summaryRange:       { color: "#60A5FA", fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 2 },
  summaryRight:       { gap: 6, paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: "#1E3A5C" },
  metaRow:            { flexDirection: "row", justifyContent: "space-between", gap: 14 },
  metaLabel:          { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular" },
  metaVal:            { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  updatedText:        { color: "#6B7280", fontSize: 11, fontFamily: "Inter_400Regular" },
  noSnapCard:         { flexDirection: "row", gap: 10, alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1 },
  noSnapText:         { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  completenessCard:   { borderRadius: 14, padding: 16, borderWidth: 1, gap: 10 },
  completenessHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  completenessTitle:  { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  completenessNum:    { fontSize: 22, fontFamily: "Inter_700Bold" },
  progressBg:         { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill:       { height: 8, borderRadius: 4 },
  completenessHint:   { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  recommendRow:       { flexDirection: "row", alignItems: "center", gap: 6 },
  recommendText:      { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  recommendMore:      { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1 },
  sectionLabel:       { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  primaryGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  primaryBtn:         { width: "31.5%", borderRadius: 14, padding: 14, alignItems: "center", gap: 8 },
  primaryBtnText:     { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  secondaryGrid:      { gap: 8 },
  secondaryBtn:       { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, borderWidth: 1 },
  secondaryIcon:      { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  secondaryLabel:     { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  secondaryBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  secondaryBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  aiWarning:          { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  aiWarningText:      { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
