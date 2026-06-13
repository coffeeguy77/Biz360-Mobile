import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("biz360_auth_token");
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportVisual {
  id: string;
  sectionKey: string | null;
  title: string;
  subtitle: string | null;
  visualType: string;
  dataSourceType: string;
  dataSourceConfig: Record<string, unknown> | null;
  chartData: Record<string, unknown> | null;
  status: string;
  sourceLabel: string | null;
  sourceConfidence: string;
  includeInPdf: boolean;
  includeInHtml: boolean;
  includeInBuyerReport: boolean;
  sortOrder: number;
  createdAt: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VISUAL_TYPES: Array<{ key: string; label: string; icon: string; desc: string }> = [
  { key: "stat_card",             label: "Stat Card",           icon: "hash",         desc: "Single headline metric" },
  { key: "metric_grid",           label: "Metric Grid",         icon: "grid",         desc: "2–4 metrics side-by-side" },
  { key: "table",                 label: "Data Table",          icon: "list",         desc: "Rows of label + value" },
  { key: "bar_chart",             label: "Bar Chart",           icon: "bar-chart-2",  desc: "Vertical bars" },
  { key: "horizontal_bar_chart",  label: "Horizontal Bars",     icon: "align-left",   desc: "Ranked bars left to right" },
  { key: "donut_chart",           label: "Donut Chart",         icon: "pie-chart",    desc: "Proportional slices" },
  { key: "valuation_bridge",      label: "Valuation Bridge",    icon: "trending-up",  desc: "EBITDA × multiple + equipment" },
  { key: "funnel",                label: "Buyer Funnel",        icon: "filter",       desc: "Engagement stages" },
  { key: "checklist",             label: "Checklist",           icon: "check-square", desc: "Ticked / pending items" },
  { key: "score_card",            label: "Score Card",          icon: "award",        desc: "Business health gauge" },
];

const DATA_SOURCES: Array<{ key: string; label: string; icon: string; desc: string }> = [
  { key: "valuation",       label: "Valuation",         icon: "trending-up",  desc: "EBITDA, revenue, multiples from valuation engine" },
  { key: "divisions",       label: "Divisions",         icon: "layers",       desc: "Revenue & valuation split by business unit" },
  { key: "equipment",       label: "Equipment",         icon: "tool",         desc: "Asset ledger — categories, values, top items" },
  { key: "lease",           label: "Lease Analysis",    icon: "file-text",    desc: "Clause risk counts from lease scan" },
  { key: "tour",            label: "360° Tour",         icon: "aperture",     desc: "Space & pin summary from your virtual tour" },
  { key: "buyer_engagement",label: "Buyer Engagement",  icon: "users",        desc: "Views, enquiries & funnel from live buyers" },
  { key: "due_diligence",   label: "Due Diligence",     icon: "check-square", desc: "Document availability checklist" },
  { key: "listing",         label: "Listing Info",      icon: "info",         desc: "Business name, price, category, location" },
  { key: "manual",          label: "Enter Manually",    icon: "edit-2",       desc: "You supply every value — clearly marked" },
];

const SECTION_OPTIONS = [
  { key: "",                          label: "All Sections (global)" },
  { key: "executive_summary",         label: "Executive Summary" },
  { key: "business_overview",         label: "Business Overview" },
  { key: "financial_performance_summary", label: "Financial Performance" },
  { key: "addbacks_adjusted_ebitda",  label: "Add-backs & EBITDA" },
  { key: "division_breakdown",        label: "Division Breakdown" },
  { key: "app_valuation_summary",     label: "Valuation Summary" },
  { key: "plant_equipment_summary",   label: "Equipment Summary" },
  { key: "lease_premises_summary",    label: "Lease & Premises" },
  { key: "staff_owner_involvement",   label: "Staff & Operations" },
  { key: "customer_base",             label: "Customer Base" },
  { key: "growth_opportunities",      label: "Growth Opportunities" },
  { key: "risks_mitigations",         label: "Risks & Mitigations" },
  { key: "due_diligence_documents_available", label: "Due Diligence" },
];

// 11 default suggestion templates
const DEFAULT_TEMPLATES: Array<{
  title: string; visualType: string; dataSourceType: string; icon: string; accentColor: string;
}> = [
  { title: "Revenue vs Profit Snapshot",    visualType: "metric_grid",          dataSourceType: "valuation",        icon: "trending-up",   accentColor: "#3B82F6" },
  { title: "Valuation Bridge",              visualType: "valuation_bridge",     dataSourceType: "valuation",        icon: "bar-chart-2",   accentColor: "#8B5CF6" },
  { title: "Revenue by Division",           visualType: "donut_chart",          dataSourceType: "divisions",        icon: "pie-chart",     accentColor: "#10B981" },
  { title: "Divisions Breakdown Table",     visualType: "table",                dataSourceType: "divisions",        icon: "list",          accentColor: "#0EA5E9" },
  { title: "Top 10 Equipment by Value",     visualType: "horizontal_bar_chart", dataSourceType: "equipment",        icon: "tool",          accentColor: "#F59E0B" },
  { title: "Equipment by Category",         visualType: "donut_chart",          dataSourceType: "equipment",        icon: "pie-chart",     accentColor: "#F97316" },
  { title: "Lease Risk Breakdown",          visualType: "horizontal_bar_chart", dataSourceType: "lease",            icon: "file-text",     accentColor: "#EF4444" },
  { title: "Due Diligence Checklist",       visualType: "checklist",            dataSourceType: "due_diligence",    icon: "check-square",  accentColor: "#16A34A" },
  { title: "360° Tour Overview",            visualType: "metric_grid",          dataSourceType: "tour",             icon: "aperture",      accentColor: "#6366F1" },
  { title: "Buyer Engagement Funnel",       visualType: "funnel",               dataSourceType: "buyer_engagement", icon: "users",         accentColor: "#A78BFA" },
  { title: "Business Health Score",         visualType: "score_card",           dataSourceType: "valuation",        icon: "award",         accentColor: "#34D399" },
];

const ACCENT_COLORS = [
  { key: "#3B82F6", label: "Blue" }, { key: "#10B981", label: "Green" },
  { key: "#8B5CF6", label: "Purple" }, { key: "#F59E0B", label: "Amber" },
  { key: "#6B7280", label: "Neutral" },
];

// Fields available for explicit selection per data source (metric-based sources only)
const SOURCE_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  listing: [
    { key: "businessName",    label: "Business Name" },
    { key: "suburb",          label: "Suburb" },
    { key: "state",           label: "State" },
    { key: "category",        label: "Category" },
    { key: "askingPrice",     label: "Asking Price" },
    { key: "staffCount",      label: "Staff Count" },
    { key: "ownerHours",      label: "Owner Hours / Week" },
    { key: "trainingPeriod",  label: "Training Period" },
  ],
  valuation: [
    { key: "estimatedValue",       label: "Estimated Value" },
    { key: "valuationLow",         label: "Valuation (Low)" },
    { key: "valuationHigh",        label: "Valuation (High)" },
    { key: "revenue",              label: "Revenue" },
    { key: "cogs",                 label: "COGS" },
    { key: "grossProfit",          label: "Gross Profit" },
    { key: "ebitda",               label: "EBITDA" },
    { key: "adjustedEbitda",       label: "Adj. EBITDA" },
    { key: "equipmentValue",       label: "Equipment Value" },
    { key: "businessHealthScore",  label: "Health Score" },
  ],
  equipment: [
    { key: "totalItems",            label: "Total Items" },
    { key: "totalSecondhandValue",  label: "Total SH Value" },
    { key: "totalReplacementValue", label: "Total Replacement Value" },
  ],
  tour: [
    { key: "spaceCount", label: "Space Count" },
    { key: "pinCount",   label: "Pin Count" },
    { key: "audioCount", label: "Audio Pins" },
  ],
};

// ─── Preview renderer ─────────────────────────────────────────────────────────

function VisualPreview({ visual }: { visual: ReportVisual | null }) {
  if (!visual) return null;
  if (visual.status !== "ready" || !visual.chartData) {
    return (
      <View style={pv.noData}>
        <Feather name="info" size={14} color="#6B7280" />
        <Text style={pv.noDataText}>
          {visual.dataSourceType === "manual" ? "No data entered yet" : "Data not available — check source"}
        </Text>
      </View>
    );
  }
  const d = visual.chartData;
  switch (visual.visualType) {
    case "stat_card": {
      const metrics = (d.metrics as Array<{ label: string; value: unknown }>) ?? [];
      const m = metrics[0];
      if (!m) return null;
      return (
        <View style={pv.statCard}>
          <Text style={pv.statValue}>{String(m.value)}</Text>
          <Text style={pv.statLabel}>{m.label}</Text>
        </View>
      );
    }
    case "metric_grid": {
      const metrics = (d.metrics as Array<{ label: string; value: unknown }>) ?? [];
      return (
        <View style={pv.metricGrid}>
          {metrics.slice(0, 4).map((m, i) => (
            <View key={i} style={pv.metricCell}>
              <Text style={pv.metricVal}>{String(m.value)}</Text>
              <Text style={pv.metricLbl}>{m.label}</Text>
            </View>
          ))}
        </View>
      );
    }
    case "table": {
      const rows = (d.rows as Array<{ label: string; value: unknown }>) ?? [];
      return (
        <View style={pv.table}>
          {rows.slice(0, 6).map((r, i) => (
            <View key={i} style={[pv.tableRow, i % 2 === 0 && pv.tableRowAlt]}>
              <Text style={pv.tableLabel}>{r.label}</Text>
              <Text style={pv.tableValue}>{String(r.value ?? "—")}</Text>
            </View>
          ))}
        </View>
      );
    }
    case "bar_chart":
    case "horizontal_bar_chart": {
      const bars = (d.bars as Array<{ label: string; value: unknown; raw?: number }>) ?? [];
      const maxRaw = Math.max(...bars.map((b) => Number(b.raw ?? 0)), 1);
      return (
        <View style={pv.bars}>
          {bars.slice(0, 6).map((b, i) => {
            const pct = Math.max(Math.round((Number(b.raw ?? 0) / maxRaw) * 100), 2);
            return (
              <View key={i} style={pv.barRow}>
                <Text style={pv.barLabel} numberOfLines={1}>{b.label}</Text>
                <View style={pv.barTrack}>
                  <View style={[pv.barFill, { width: `${pct}%` as any }]} />
                </View>
                <Text style={pv.barVal}>{String(b.value)}</Text>
              </View>
            );
          })}
        </View>
      );
    }
    case "donut_chart": {
      const slices = (d.slices as Array<{ label: string; value: unknown }>) ?? [];
      const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#6B7280"];
      return (
        <View style={pv.donut}>
          {slices.slice(0, 5).map((s, i) => (
            <View key={i} style={pv.donutRow}>
              <View style={[pv.donutDot, { backgroundColor: COLORS[i % COLORS.length] }]} />
              <Text style={pv.donutLabel} numberOfLines={1}>{s.label}</Text>
              <Text style={pv.donutVal}>{String(s.value)}</Text>
            </View>
          ))}
        </View>
      );
    }
    case "valuation_bridge": {
      return (
        <View style={pv.bridge}>
          <View style={pv.bridgeRow}><Text style={pv.bridgeLbl}>Adj. EBITDA</Text><Text style={pv.bridgeVal}>{String(d.adjustedEbitda ?? "—")}</Text></View>
          <View style={pv.bridgeRow}><Text style={pv.bridgeLbl}>Equipment</Text><Text style={pv.bridgeVal}>{String(d.equipmentValue ?? "—")}</Text></View>
          <View style={[pv.bridgeRow, pv.bridgeTotal]}>
            <Text style={pv.bridgeTotalLbl}>Est. Value Range</Text>
            <Text style={pv.bridgeTotalVal}>{String(d.valuationLow ?? "—")} – {String(d.valuationHigh ?? "—")}</Text>
          </View>
        </View>
      );
    }
    case "funnel": {
      const funnel = (d.funnel as Array<{ label: string; value: number; pct: number }>) ?? [];
      return (
        <View style={pv.bars}>
          {funnel.filter((f) => f.value > 0).slice(0, 6).map((f, i) => (
            <View key={i} style={pv.barRow}>
              <Text style={pv.barLabel} numberOfLines={1}>{f.label}</Text>
              <View style={pv.barTrack}>
                <View style={[pv.barFill, { width: `${f.pct}%` as any, backgroundColor: "#A78BFA" }]} />
              </View>
              <Text style={pv.barVal}>{f.value}</Text>
            </View>
          ))}
        </View>
      );
    }
    case "checklist": {
      const items = (d.items as Array<{ label: string; status: string }>) ?? [];
      const icon = (s: string) => s === "available" ? "check-circle" : s === "pending" ? "clock" : "x-circle";
      const col  = (s: string) => s === "available" ? "#16A34A" : s === "pending" ? "#F59E0B" : "#EF4444";
      return (
        <View style={pv.checklist}>
          {items.slice(0, 6).map((item, i) => (
            <View key={i} style={pv.checkRow}>
              <Feather name={icon(item.status) as any} size={12} color={col(item.status)} />
              <Text style={pv.checkLabel} numberOfLines={1}>{item.label}</Text>
            </View>
          ))}
        </View>
      );
    }
    case "score_card": {
      const score = Number(d.score ?? 0);
      return (
        <View style={pv.scoreCard}>
          <Text style={[pv.scoreNum, { color: score >= 70 ? "#16A34A" : score >= 40 ? "#F59E0B" : "#EF4444" }]}>
            {score}
          </Text>
          <Text style={pv.scoreLabel}>{String(d.label ?? "Score")}</Text>
        </View>
      );
    }
    default:
      return <Text style={pv.noDataText}>{visual.visualType}</Text>;
  }
}

const pv = StyleSheet.create({
  noData:       { flexDirection: "row", alignItems: "center", gap: 6, padding: 12 },
  noDataText:   { color: "#6B7280", fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  statCard:     { alignItems: "center", padding: 12 },
  statValue:    { fontSize: 28, fontFamily: "Inter_700Bold", color: "#3B82F6" },
  statLabel:    { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 4 },
  metricGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 8 },
  metricCell:   { flex: 1, minWidth: "45%", backgroundColor: "#0F2040", borderRadius: 8, padding: 10, alignItems: "center" },
  metricVal:    { fontSize: 16, fontFamily: "Inter_700Bold", color: "#3B82F6" },
  metricLbl:    { fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2, textAlign: "center" },
  table:        { borderRadius: 8, overflow: "hidden" },
  tableRow:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, paddingHorizontal: 10 },
  tableRowAlt:  { backgroundColor: "#0A1828" },
  tableLabel:   { color: "#9CA3AF", fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  tableValue:   { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  bars:         { gap: 6, padding: 4 },
  barRow:       { flexDirection: "row", alignItems: "center", gap: 6 },
  barLabel:     { width: 80, color: "#9CA3AF", fontSize: 10, fontFamily: "Inter_400Regular" },
  barTrack:     { flex: 1, height: 8, backgroundColor: "#1E3A5C", borderRadius: 4, overflow: "hidden" },
  barFill:      { height: 8, borderRadius: 4, backgroundColor: "#3B82F6" },
  barVal:       { width: 50, color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  donut:        { gap: 6, padding: 4 },
  donutRow:     { flexDirection: "row", alignItems: "center", gap: 6 },
  donutDot:     { width: 10, height: 10, borderRadius: 5 },
  donutLabel:   { flex: 1, color: "#9CA3AF", fontSize: 11, fontFamily: "Inter_400Regular" },
  donutVal:     { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  bridge:       { gap: 4, padding: 4 },
  bridgeRow:    { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 6 },
  bridgeLbl:    { color: "#9CA3AF", fontSize: 11, fontFamily: "Inter_400Regular" },
  bridgeVal:    { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  bridgeTotal:  { borderTopWidth: 1, borderTopColor: "#1E3A5C", marginTop: 4 },
  bridgeTotalLbl: { color: "#60A5FA", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  bridgeTotalVal: { color: "#60A5FA", fontSize: 12, fontFamily: "Inter_700Bold" },
  checklist:    { gap: 6, padding: 4 },
  checkRow:     { flexDirection: "row", alignItems: "center", gap: 6 },
  checkLabel:   { flex: 1, color: "#9CA3AF", fontSize: 11, fontFamily: "Inter_400Regular" },
  scoreCard:    { alignItems: "center", padding: 12 },
  scoreNum:     { fontSize: 48, fontFamily: "Inter_700Bold" },
  scoreLabel:   { color: "#6B7280", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChartsStatsScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { selectedCafe } = useValuation();
  const listingId = selectedCafe?.listingId ?? (selectedCafe as any)?.listing_id;

  const [visuals, setVisuals] = useState<ReportVisual[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editVisual, setEditVisual] = useState<ReportVisual | null>(null);

  // wizard state
  const [step, setStep] = useState(0);
  const [wizTitle,    setWizTitle]    = useState("");
  const [wizSubtitle, setWizSubtitle] = useState("");
  const [wizSection,  setWizSection]  = useState("");
  const [wizType,     setWizType]     = useState("metric_grid");
  const [wizSource,   setWizSource]   = useState("valuation");
  const [wizColor,    setWizColor]    = useState("#3B82F6");
  const [wizManual,   setWizManual]   = useState<Array<{ label: string; value: string }>>([]);
  const [wizFields,   setWizFields]   = useState<string[]>([]);
  const [wizPreview,  setWizPreview]  = useState<ReportVisual | null>(null);
  const [resolving,   setResolving]   = useState(false);

  const loadVisuals = useCallback(async () => {
    if (!listingId) return;
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/report-visuals/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVisuals(data.visuals ?? []);
      }
    } catch { /* non-fatal */ } finally { setLoading(false); }
  }, [listingId]);

  useFocusEffect(useCallback(() => { loadVisuals(); }, [loadVisuals]));

  // ── Resolve preview ───────────────────────────────────────────────────────

  async function resolvePreview() {
    if (!listingId) return;
    const token = await getToken();
    if (!token) return;
    setResolving(true);
    try {
      const body: Record<string, unknown> = {
        dataSourceType:   wizSource,
        visualType:       wizType,
        dataSourceConfig: wizFields.length > 0 ? { fields: wizFields } : {},
      };
      if (wizSource === "manual" && wizManual.length) {
        body.manualData = wizManual.filter((r) => r.label.trim());
      }
      const res = await fetch(`${API_BASE}/api/report-visuals/${listingId}/resolve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setWizPreview({
          id: "_preview",
          sectionKey: wizSection || null,
          title: wizTitle || "Preview",
          subtitle: wizSubtitle || null,
          visualType: wizType,
          dataSourceType: wizSource,
          dataSourceConfig: wizFields.length > 0 ? { fields: wizFields } : null,
          chartData: data.chartData,
          status: data.status,
          sourceLabel: data.resolved?.sourceLabel ?? null,
          sourceConfidence: data.resolved?.sourceConfidence ?? "manual",
          includeInPdf: true,
          includeInHtml: true,
          includeInBuyerReport: true,
          sortOrder: 0,
          createdAt: null,
        });
      }
    } catch { /* non-fatal */ } finally { setResolving(false); }
  }

  // ── Open wizard ───────────────────────────────────────────────────────────

  function openNew(template?: typeof DEFAULT_TEMPLATES[0]) {
    setEditVisual(null);
    setStep(0);
    setWizTitle(template?.title ?? "");
    setWizSubtitle("");
    setWizSection("");
    setWizType(template?.visualType ?? "metric_grid");
    setWizSource(template?.dataSourceType ?? "valuation");
    setWizColor(template?.accentColor ?? "#3B82F6");
    setWizManual([]);
    setWizFields([]);
    setWizPreview(null);
    setModalOpen(true);
  }

  function openEdit(v: ReportVisual) {
    setEditVisual(v);
    setStep(0);
    setWizTitle(v.title);
    setWizSubtitle(v.subtitle ?? "");
    setWizSection(v.sectionKey ?? "");
    setWizType(v.visualType);
    setWizSource(v.dataSourceType);
    setWizColor((v.chartData as any)?.accentColor ?? "#3B82F6");
    setWizManual([]);
    setWizFields((v.dataSourceConfig as any)?.fields ?? []);
    setWizPreview(v);
    setModalOpen(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!listingId || !wizTitle.trim()) {
      Alert.alert("Title required", "Please enter a title for this visual.");
      return;
    }
    const token = await getToken();
    if (!token) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title:           wizTitle.trim(),
        subtitle:        wizSubtitle.trim() || null,
        sectionKey:      wizSection || null,
        visualType:      wizType,
        dataSourceType:   wizSource,
        dataSourceConfig: wizFields.length > 0 ? { fields: wizFields } : {},
        visualConfig:     { accentColor: wizColor },
        includeInPdf:    true,
        includeInHtml:   true,
        includeInBuyerReport: true,
        includeInSellerReport: true,
        visibility:      "public",
      };
      if (wizSource === "manual" && wizManual.length) {
        body.manualData = wizManual.filter((r) => r.label.trim());
      }

      const url = editVisual
        ? `${API_BASE}/api/report-visuals/${listingId}/${editVisual.id}`
        : `${API_BASE}/api/report-visuals/${listingId}`;
      const method = editVisual ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Save failed", err.error ?? "Please try again.");
        return;
      }
      setModalOpen(false);
      await loadVisuals();
    } catch {
      Alert.alert("Save failed", "Network error — please try again.");
    } finally { setSaving(false); }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string, title: string) {
    Alert.alert("Delete Visual", `Remove "${title}" from your report?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          const token = await getToken();
          if (!token) return;
          try {
            await fetch(`${API_BASE}/api/report-visuals/${listingId}/${id}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            await loadVisuals();
          } catch { Alert.alert("Error", "Could not delete visual."); }
        },
      },
    ]);
  }

  // ── Toggle PDF/HTML/Buyer inclusion ──────────────────────────────────────

  async function toggleField(id: string, field: "includeInPdf" | "includeInHtml" | "includeInBuyerReport", current: boolean) {
    const token = await getToken();
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/report-visuals/${listingId}/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !current }),
      });
      setVisuals((prev) => prev.map((v) => v.id === id ? { ...v, [field]: !current } : v));
    } catch { /* non-fatal */ }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  const totalCount   = visuals.length;
  const readyCount   = visuals.filter((v) => v.status === "ready").length;
  const noDataCount  = visuals.filter((v) => v.status === "needs_data").length;
  const buyerCount   = visuals.filter((v) => v.includeInBuyerReport).length;

  // ─── Wizard steps ─────────────────────────────────────────────────────────

  const needsFieldConfig = wizSource !== "manual"
    && ["stat_card", "metric_grid", "table"].includes(wizType)
    && !!SOURCE_FIELDS[wizSource];

  const wizardSteps = [
    "Section",
    "Visual Type",
    "Data Source",
    ...(wizSource === "manual" ? ["Enter Data"] : []),
    ...(needsFieldConfig ? ["Fields"] : []),
    "Style",
    "Preview",
  ];

  // ─── Step renderers ───────────────────────────────────────────────────────

  function renderStep() {
    // Dynamic step mapping based on whether manual/field-config is chosen
    const hasManual  = wizSource === "manual";
    const hasFields  = wizSource !== "manual" && ["stat_card", "metric_grid", "table"].includes(wizType) && !!SOURCE_FIELDS[wizSource];
    const steps = ["section", "type", "source", ...(hasManual ? ["manual"] : []), ...(hasFields ? ["fields"] : []), "style", "preview"];
    const currentKey = steps[step] ?? "preview";

    switch (currentKey) {
      case "section":
        return (
          <View style={wiz.stepContent}>
            <Text style={wiz.stepHint}>Which report section should this visual appear in? (Optional)</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {SECTION_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[wiz.option, wizSection === s.key && wiz.optionSelected]}
                  onPress={() => setWizSection(s.key)}
                >
                  <Text style={[wiz.optionLabel, wizSection === s.key && wiz.optionLabelSelected]}>{s.label}</Text>
                  {wizSection === s.key && <Feather name="check" size={14} color="#3B82F6" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );

      case "type":
        return (
          <View style={wiz.stepContent}>
            <Text style={wiz.stepHint}>Choose how to display this data</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {VISUAL_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[wiz.option, wizType === t.key && wiz.optionSelected]}
                  onPress={() => setWizType(t.key)}
                >
                  <View style={[wiz.optionIcon, wizType === t.key && { backgroundColor: "#3B82F622" }]}>
                    <Feather name={t.icon as any} size={16} color={wizType === t.key ? "#3B82F6" : "#6B7280"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[wiz.optionLabel, wizType === t.key && wiz.optionLabelSelected]}>{t.label}</Text>
                    <Text style={wiz.optionDesc}>{t.desc}</Text>
                  </View>
                  {wizType === t.key && <Feather name="check" size={14} color="#3B82F6" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );

      case "source":
        return (
          <View style={wiz.stepContent}>
            <Text style={wiz.stepHint}>Where should the data come from?</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {DATA_SOURCES.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[wiz.option, wizSource === s.key && wiz.optionSelected]}
                  onPress={() => setWizSource(s.key)}
                >
                  <View style={[wiz.optionIcon, wizSource === s.key && { backgroundColor: "#10B98122" }]}>
                    <Feather name={s.icon as any} size={16} color={wizSource === s.key ? "#10B981" : "#6B7280"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[wiz.optionLabel, wizSource === s.key && wiz.optionLabelSelected]}>{s.label}</Text>
                    <Text style={wiz.optionDesc}>{s.desc}</Text>
                  </View>
                  {wizSource === s.key && <Feather name="check" size={14} color="#10B981" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );

      case "manual":
        return (
          <View style={wiz.stepContent}>
            <Text style={wiz.stepHint}>Enter your data rows. Label + value pairs.</Text>
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {[...wizManual, { label: "", value: "" }].map((row, i) => (
                <View key={i} style={wiz.manualRow}>
                  <TextInput
                    style={[wiz.manualInput, { flex: 1.2 }]}
                    placeholder="Label"
                    placeholderTextColor="#4B5563"
                    value={row.label}
                    onChangeText={(v) => {
                      const next = [...wizManual];
                      if (i === wizManual.length) next.push({ label: v, value: "" });
                      else next[i] = { ...next[i], label: v };
                      setWizManual(next.filter((r, ri) => ri < next.length - 1 || r.label || r.value));
                    }}
                  />
                  <TextInput
                    style={[wiz.manualInput, { flex: 1 }]}
                    placeholder="Value"
                    placeholderTextColor="#4B5563"
                    value={row.value}
                    onChangeText={(v) => {
                      const next = [...wizManual];
                      if (i === wizManual.length) next.push({ label: "", value: v });
                      else next[i] = { ...next[i], value: v };
                      setWizManual(next.filter((r, ri) => ri < next.length - 1 || r.label || r.value));
                    }}
                  />
                  {i < wizManual.length && (
                    <TouchableOpacity onPress={() => setWizManual((prev) => prev.filter((_, ri) => ri !== i))}>
                      <Feather name="trash-2" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
            <Text style={{ color: "#6B7280", fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 8 }}>
              Manually entered data is clearly marked as "Seller Supplied" in the report.
            </Text>
          </View>
        );

      case "fields": {
        const availableFields = SOURCE_FIELDS[wizSource] ?? [];
        return (
          <View style={wiz.stepContent}>
            <Text style={wiz.stepHint}>Select which metrics to include (uncheck all to use defaults)</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {availableFields.map((f) => {
                const checked = wizFields.length === 0 || wizFields.includes(f.key);
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[wiz.option, checked && wiz.optionSelected]}
                    onPress={() => {
                      setWizFields((prev) => {
                        if (prev.length === 0) {
                          return availableFields.map((af) => af.key).filter((k) => k !== f.key);
                        }
                        return prev.includes(f.key)
                          ? prev.filter((k) => k !== f.key)
                          : [...prev, f.key];
                      });
                    }}
                  >
                    <Feather name={checked ? "check-square" : "square"} size={16} color={checked ? "#3B82F6" : "#6B7280"} />
                    <Text style={[wiz.optionLabel, checked && wiz.optionLabelSelected, { marginLeft: 8 }]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {wizFields.length > 0 && (
              <TouchableOpacity onPress={() => setWizFields([])} style={{ marginTop: 8 }}>
                <Text style={{ color: "#6B7280", fontSize: 11, fontFamily: "Inter_400Regular" }}>Reset — include all fields</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }

      case "style":
        return (
          <View style={wiz.stepContent}>
            <Text style={wiz.fieldLabel}>Title *</Text>
            <TextInput
              style={wiz.textInput}
              placeholder="e.g. Revenue vs Profit Snapshot"
              placeholderTextColor="#4B5563"
              value={wizTitle}
              onChangeText={setWizTitle}
            />
            <Text style={wiz.fieldLabel}>Subtitle (optional)</Text>
            <TextInput
              style={wiz.textInput}
              placeholder="e.g. Based on latest valuation data"
              placeholderTextColor="#4B5563"
              value={wizSubtitle}
              onChangeText={setWizSubtitle}
            />
            <Text style={wiz.fieldLabel}>Accent Colour</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              {ACCENT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setWizColor(c.key)}
                  style={[wiz.colorSwatch, { backgroundColor: c.key, borderWidth: wizColor === c.key ? 3 : 0 }]}
                />
              ))}
            </View>
          </View>
        );

      case "preview":
        return (
          <View style={wiz.stepContent}>
            {resolving ? (
              <View style={{ alignItems: "center", padding: 24, gap: 8 }}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={{ color: "#6B7280", fontSize: 12, fontFamily: "Inter_400Regular" }}>Resolving data…</Text>
              </View>
            ) : wizPreview ? (
              <View>
                <Text style={wiz.previewTitle}>{wizPreview.title}</Text>
                {wizPreview.subtitle && <Text style={wiz.previewSubtitle}>{wizPreview.subtitle}</Text>}
                <View style={wiz.previewBox}>
                  <VisualPreview visual={wizPreview} />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                  <Feather
                    name={wizPreview.status === "ready" ? "check-circle" : "alert-circle"}
                    size={12}
                    color={wizPreview.status === "ready" ? "#16A34A" : "#F59E0B"}
                  />
                  <Text style={{ color: wizPreview.status === "ready" ? "#16A34A" : "#F59E0B", fontSize: 11, fontFamily: "Inter_500Medium" }}>
                    {wizPreview.status === "ready"
                      ? `Data ready · ${wizPreview.sourceLabel ?? "Source"}`
                      : "Data not available — visual will be hidden until data exists"}
                  </Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={wiz.resolveBtn} onPress={resolvePreview}>
                <Feather name="refresh-cw" size={14} color="#3B82F6" />
                <Text style={{ color: "#3B82F6", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Load Preview</Text>
              </TouchableOpacity>
            )}
          </View>
        );
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const typeLabel = (key: string) => VISUAL_TYPES.find((t) => t.key === key)?.label ?? key;
  const srcLabel  = (key: string) => DATA_SOURCES.find((s) => s.key === key)?.label ?? key;
  const secLabel  = (key: string) => SECTION_OPTIONS.find((s) => s.key === key)?.label ?? key;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.foreground }]}>Charts & Stats</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: "#3B82F6" }]}
          onPress={() => openNew()}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={s.addBtnText}>Add Visual</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary row */}
        <View style={[s.summaryRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: "Total",        val: totalCount,  color: colors.foreground },
            { label: "Ready",        val: readyCount,  color: "#16A34A" },
            { label: "Needs Data",   val: noDataCount, color: "#F59E0B" },
            { label: "Buyer Visible",val: buyerCount,  color: "#3B82F6" },
          ].map(({ label, val, color }) => (
            <View key={label} style={s.summaryCell}>
              <Text style={[s.summaryNum, { color }]}>{val}</Text>
              <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Visuals list */}
        {loading ? (
          <View style={{ alignItems: "center", padding: 32 }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : visuals.length === 0 ? (
          <>
            <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>
              No visuals yet. Add one above or choose from these ready-made templates:
            </Text>
            {DEFAULT_TEMPLATES.map((tpl) => (
              <TouchableOpacity
                key={tpl.title}
                style={[s.templateCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => openNew(tpl)}
                activeOpacity={0.7}
              >
                <View style={[s.templateIcon, { backgroundColor: tpl.accentColor + "18" }]}>
                  <Feather name={tpl.icon as any} size={20} color={tpl.accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.templateTitle, { color: colors.foreground }]}>{tpl.title}</Text>
                  <Text style={[s.templateMeta, { color: colors.mutedForeground }]}>
                    {typeLabel(tpl.visualType)} · {srcLabel(tpl.dataSourceType)}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </>
        ) : (
          visuals.map((v) => (
            <View key={v.id} style={[s.visualCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Card header */}
              <View style={s.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{v.title}</Text>
                  <Text style={[s.cardMeta, { color: colors.mutedForeground }]}>
                    {typeLabel(v.visualType)} · {srcLabel(v.dataSourceType)}
                    {v.sectionKey ? ` · ${secLabel(v.sectionKey)}` : ""}
                  </Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: v.status === "ready" ? "#16A34A18" : "#F59E0B18" }]}>
                  <View style={[s.statusDot, { backgroundColor: v.status === "ready" ? "#16A34A" : "#F59E0B" }]} />
                  <Text style={[s.statusText, { color: v.status === "ready" ? "#16A34A" : "#F59E0B" }]}>
                    {v.status === "ready" ? "Ready" : "Needs Data"}
                  </Text>
                </View>
              </View>

              {/* Preview */}
              <View style={s.previewArea}>
                <VisualPreview visual={v} />
              </View>

              {/* Toggles */}
              <View style={[s.toggleRow, { borderTopColor: colors.border }]}>
                <TouchableOpacity style={s.toggleChip} onPress={() => toggleField(v.id, "includeInPdf", v.includeInPdf)}>
                  <Feather name={v.includeInPdf ? "check-circle" : "circle"} size={13} color={v.includeInPdf ? "#3B82F6" : "#6B7280"} />
                  <Text style={[s.toggleText, { color: v.includeInPdf ? "#3B82F6" : "#6B7280" }]}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.toggleChip} onPress={() => toggleField(v.id, "includeInHtml", v.includeInHtml)}>
                  <Feather name={v.includeInHtml ? "check-circle" : "circle"} size={13} color={v.includeInHtml ? "#8B5CF6" : "#6B7280"} />
                  <Text style={[s.toggleText, { color: v.includeInHtml ? "#8B5CF6" : "#6B7280" }]}>Online</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.toggleChip} onPress={() => toggleField(v.id, "includeInBuyerReport", v.includeInBuyerReport)}>
                  <Feather name={v.includeInBuyerReport ? "check-circle" : "circle"} size={13} color={v.includeInBuyerReport ? "#10B981" : "#6B7280"} />
                  <Text style={[s.toggleText, { color: v.includeInBuyerReport ? "#10B981" : "#6B7280" }]}>Buyer</Text>
                </TouchableOpacity>
                {v.sourceLabel && (
                  <Text style={[s.sourceChip, { color: "#6B7280" }]} numberOfLines={1}>
                    {v.sourceLabel}
                  </Text>
                )}
              </View>

              {/* Actions */}
              <View style={[s.cardActions, { borderTopColor: colors.border }]}>
                <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(v)}>
                  <Feather name="edit-2" size={14} color="#3B82F6" />
                  <Text style={[s.actionText, { color: "#3B82F6" }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={() => { setEditVisual(v); setWizPreview(v); setStep(wizardSteps.length - 1); setWizTitle(v.title); setWizSubtitle(v.subtitle ?? ""); setWizSection(v.sectionKey ?? ""); setWizType(v.visualType); setWizSource(v.dataSourceType); setModalOpen(true); }}>
                  <Feather name="eye" size={14} color="#A78BFA" />
                  <Text style={[s.actionText, { color: "#A78BFA" }]}>Preview</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={() => handleDelete(v.id, v.title)}>
                  <Feather name="trash-2" size={14} color="#EF4444" />
                  <Text style={[s.actionText, { color: "#EF4444" }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Templates hint when visuals exist */}
        {visuals.length > 0 && (
          <>
            <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>ADD FROM TEMPLATE</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {DEFAULT_TEMPLATES.map((tpl) => (
                <TouchableOpacity
                  key={tpl.title}
                  style={[s.tinyChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => openNew(tpl)}
                >
                  <Feather name={tpl.icon as any} size={11} color={tpl.accentColor} />
                  <Text style={[s.tinyChipText, { color: colors.foreground }]}>{tpl.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Add / Edit Wizard Modal ──────────────────────────────────────── */}
      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={wiz.overlay}>
          <View style={[wiz.sheet, { backgroundColor: colors.card }]}>
            {/* Modal header */}
            <View style={wiz.modalHeader}>
              <Text style={[wiz.modalTitle, { color: colors.foreground }]}>
                {editVisual ? "Edit Visual" : "Add Visual"}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Feather name="x" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Step progress */}
            <View style={wiz.stepBar}>
              {wizardSteps.map((label, i) => (
                <TouchableOpacity
                  key={i}
                  style={[wiz.stepPill, i === step && wiz.stepPillActive]}
                  onPress={() => setStep(i)}
                >
                  <Text style={[wiz.stepPillText, i === step && wiz.stepPillTextActive]}>
                    {i + 1}. {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Step content */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
            >
              {renderStep()}
            </ScrollView>

            {/* Footer nav */}
            <View style={[wiz.footer, { borderTopColor: colors.border }]}>
              {step > 0 ? (
                <TouchableOpacity style={wiz.navBtn} onPress={() => setStep((p) => p - 1)}>
                  <Feather name="arrow-left" size={14} color="#6B7280" />
                  <Text style={wiz.navBtnText}>Back</Text>
                </TouchableOpacity>
              ) : <View style={{ flex: 1 }} />}

              {step < wizardSteps.length - 1 ? (
                <TouchableOpacity
                  style={[wiz.navBtnPrimary, { backgroundColor: "#3B82F6" }]}
                  onPress={() => {
                    const nextStep = step + 1;
                    setStep(nextStep);
                    // Auto-resolve on preview step
                    const hasManual = wizSource === "manual";
                    const steps = ["section", "type", "source", ...(hasManual ? ["manual"] : []), "style", "preview"];
                    if ((steps[nextStep] ?? "") === "preview") {
                      setTimeout(resolvePreview, 100);
                    }
                  }}
                >
                  <Text style={wiz.navBtnPrimaryText}>Next</Text>
                  <Feather name="arrow-right" size={14} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[wiz.navBtnPrimary, { backgroundColor: saving ? "#0F2040" : "#16A34A" }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Feather name="check" size={14} color="#fff" />}
                  <Text style={wiz.navBtnPrimaryText}>{saving ? "Saving…" : "Save Visual"}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn:        { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:          { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold" },
  addBtn:         { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  addBtnText:     { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  scroll:         { paddingHorizontal: 16 },
  summaryRow:     { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 14 },
  summaryCell:    { flex: 1, alignItems: "center" },
  summaryNum:     { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryLabel:   { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2, textAlign: "center" },
  emptyHint:      { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  templateCard:   { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  templateIcon:   { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  templateTitle:  { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  templateMeta:   { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  visualCard:     { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardHead:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, paddingBottom: 10 },
  cardTitle:      { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardMeta:       { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusPill:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusText:     { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  previewArea:    { paddingHorizontal: 12, paddingBottom: 10, minHeight: 60 },
  toggleRow:      { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, flexWrap: "wrap" },
  toggleChip:     { flexDirection: "row", alignItems: "center", gap: 4 },
  toggleText:     { fontSize: 11, fontFamily: "Inter_500Medium" },
  sourceChip:     { fontSize: 10, fontFamily: "Inter_400Regular", marginLeft: "auto" },
  cardActions:    { flexDirection: "row", borderTopWidth: 1, paddingVertical: 10 },
  actionBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  actionText:     { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionLabel:   { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  tinyChip:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  tinyChipText:   { fontSize: 11, fontFamily: "Inter_500Medium" },
});

const wiz = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet:           { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%", minHeight: 500 },
  modalHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 12 },
  modalTitle:      { fontSize: 18, fontFamily: "Inter_700Bold" },
  stepBar:         { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, paddingBottom: 12 },
  stepPill:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: "#1E3A5C" },
  stepPillActive:  { backgroundColor: "#3B82F6" },
  stepPillText:    { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_500Medium" },
  stepPillTextActive: { color: "#fff" },
  stepContent:     { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 10 },
  stepHint:        { color: "#6B7280", fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 6 },
  option:          { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4, backgroundColor: "#0A1828" },
  optionSelected:  { backgroundColor: "#1E3A5C", borderWidth: 1, borderColor: "#3B82F6" },
  optionIcon:      { width: 32, height: 32, borderRadius: 8, backgroundColor: "#1E3A5C", alignItems: "center", justifyContent: "center" },
  optionLabel:     { fontSize: 13, fontFamily: "Inter_500Medium", color: "#9CA3AF", flex: 1 },
  optionLabelSelected: { color: "#fff" },
  optionDesc:      { fontSize: 11, fontFamily: "Inter_400Regular", color: "#4B5563", marginTop: 1 },
  fieldLabel:      { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#9CA3AF" },
  textInput:       { backgroundColor: "#0A1828", borderRadius: 10, padding: 12, color: "#fff", fontSize: 13, fontFamily: "Inter_400Regular", borderWidth: 1, borderColor: "#1E3A5C" },
  colorSwatch:     { width: 28, height: 28, borderRadius: 14, borderColor: "#fff" },
  previewTitle:    { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 2 },
  previewSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 8 },
  previewBox:      { backgroundColor: "#0A1828", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#1E3A5C", minHeight: 80 },
  resolveBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#0A1828", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#3B82F6" },
  manualRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  manualInput:     { backgroundColor: "#0A1828", borderRadius: 8, padding: 10, color: "#fff", fontSize: 12, fontFamily: "Inter_400Regular", borderWidth: 1, borderColor: "#1E3A5C" },
  footer:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderTopWidth: 1 },
  navBtn:          { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  navBtnText:      { color: "#6B7280", fontSize: 13, fontFamily: "Inter_500Medium" },
  navBtnPrimary:   { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 },
  navBtnPrimaryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
