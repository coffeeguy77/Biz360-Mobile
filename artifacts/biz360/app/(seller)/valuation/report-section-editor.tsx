import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
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
interface TableRow { label: string; value: string }

// ── Canberra location context structured fields ────────────────────────────────
// Shown in place of the generic table editor for the two Canberra location
// sections. Values are stored in tableData.rows so the same data appears
// in the HTML/PDF report table.
const LOCATION_SECTION_KEYS = ["business_location_market_context", "canberra_location_explainer"] as const;
type LocationSectionKey = typeof LOCATION_SECTION_KEYS[number];

const LOCATION_FIELDS: Record<LocationSectionKey, Array<{ label: string; placeholder: string }>> = {
  business_location_market_context: [
    { label: "Suburb / Location",       placeholder: "e.g. Dickson, Braddon, Kingston" },
    { label: "Trade Area Type",         placeholder: "e.g. Inner-north retail strip, light industrial estate" },
    { label: "Foot Traffic",            placeholder: "e.g. High weekday lunch traffic from office workers" },
    { label: "Competitive Environment", placeholder: "e.g. 3 cafes within 200m; no direct format competitor" },
    { label: "Nearby Demand Drivers",   placeholder: "e.g. 2 hospitals, ANU, ACT Government offices" },
    { label: "Demographic Profile",     placeholder: "e.g. 25–45 professionals, above-average household income" },
  ],
  canberra_location_explainer: [
    { label: "Canberra Area",              placeholder: "e.g. Inner North, Gungahlin, City/Civic, Belconnen" },
    { label: "North/South Accessibility", placeholder: "e.g. Easy access from north Canberra, 5 min from Braddon" },
    { label: "Commercial Catchment",      placeholder: "e.g. Large residential catchment + high office foot traffic" },
    { label: "Parking",                   placeholder: "e.g. Free street parking; 200 m from multi-storey car park" },
    { label: "Landmark References",       placeholder: "e.g. Opposite Dickson shops, adjacent Northbourne Ave" },
    { label: "Public Transport",          placeholder: "e.g. Rapid bus stop 50 m; light rail 600 m" },
  ],
};

function isLocationSection(key: string | undefined): key is LocationSectionKey {
  return LOCATION_SECTION_KEYS.includes(key as LocationSectionKey);
}

/** Read a location field value from the current tableRows by matching label. */
function getLocField(rows: TableRow[], label: string): string {
  return rows.find((r) => r.label === label)?.value ?? "";
}

/** Update (or insert) a location field value in tableRows by label. */
function setLocField(rows: TableRow[], label: string, value: string): TableRow[] {
  const idx = rows.findIndex((r) => r.label === label);
  if (idx >= 0) {
    return rows.map((r, i) => (i === idx ? { ...r, value } : r));
  }
  return [...rows, { label, value }];
}

interface SectionData {
  id: string;
  sectionKey: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  bulletPoints: string[] | null;
  tableData: { rows?: TableRow[] } | null;
  status: string;
  visibility: Visibility;
  includeInPdf: boolean;
  includeInHtml: boolean;
  includeInApp: boolean;
  sortOrder: number;
  lastUpdatedAt: string | null;
  dataSource: string | null;
}

const VISIBILITY_OPTIONS: { value: Visibility; label: string; desc: string; color: string }[] = [
  { value: "public",         label: "Public",         desc: "All marketplace visitors",      color: "#16A34A" },
  { value: "verified_buyer", label: "Verified Buyer", desc: "Buyers who requested info",      color: "#3B82F6" },
  { value: "nda_signed",     label: "NDA Signed",     desc: "Buyers who signed the NDA",      color: "#A78BFA" },
  { value: "hidden",         label: "Hidden",         desc: "Not shown on any buyer view",    color: "#6B7280" },
];

const DATA_SOURCE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  seller_supplied: { label: "Manual",       color: "#6B7280", icon: "edit" },
  app_generated:   { label: "App Data",     color: "#3B82F6", icon: "database" },
  csv_imported:    { label: "CSV Import",   color: "#16A34A", icon: "upload" },
  ai_drafted:      { label: "AI Drafted",   color: "#FBBF24", icon: "zap" },
  mixed:           { label: "Mixed",        color: "#A78BFA", icon: "layers" },
};

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "Not saved yet";
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

export default function ReportSectionEditorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe } = useValuation();
  const { sectionId } = useLocalSearchParams<{ sectionId: string }>();

  const [section, setSection] = useState<SectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [body, setBody] = useState("");
  const [bulletPoints, setBulletPoints] = useState<string[]>([]);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [showTable, setShowTable] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("verified_buyer");
  const [includeInPdf, setIncludeInPdf] = useState(true);
  const [includeInHtml, setIncludeInHtml] = useState(true);
  const [includeInApp, setIncludeInApp] = useState(true);
  const [showVisibility, setShowVisibility] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>("seller_supplied");

  const listingId = selectedCafe?.listingId ?? (selectedCafe as any)?.listing_id;

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
          setBulletPoints(Array.isArray(s.bulletPoints) ? s.bulletPoints : []);
          const tRows = s.tableData?.rows ?? [];
          setTableRows(tRows);
          setShowTable(tRows.length > 0);
          setVisibility((s.visibility as Visibility) ?? "verified_buyer");
          setIncludeInPdf(s.includeInPdf ?? true);
          setIncludeInHtml(s.includeInHtml ?? true);
          setIncludeInApp(s.includeInApp ?? true);
          setSavedAt(s.lastUpdatedAt);
          setDataSource(s.dataSource ?? "seller_supplied");
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
      const cleanBullets = bulletPoints.filter((b) => b.trim().length > 0);
      const cleanRows = tableRows.filter((r) => r.label.trim() || r.value.trim());
      const payload: Record<string, unknown> = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        body: body.trim() || null,
        bulletPoints: cleanBullets.length ? cleanBullets : null,
        tableData: cleanRows.length ? { rows: cleanRows } : null,
        visibility,
        includeInPdf,
        includeInHtml,
        includeInApp,
        dataSource: "seller_supplied",
      };
      if (markComplete) payload.status = "complete";

      const res = await fetch(`${API_BASE}/api/report-sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setSavedAt(data.section?.lastUpdatedAt ?? new Date().toISOString());
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
          const sb = (suggestion.suggestedBody as string | undefined) ?? "";
          const sBullets = (suggestion.suggestedBullets as string[] | undefined) ?? [];
          const sTable = (suggestion.tableData as { rows?: TableRow[] } | undefined);
          Alert.alert(
            "Auto-fill Suggestion",
            `${sb ? sb.slice(0, 200) + (sb.length > 200 ? "…" : "") : "(bullet points / table data only)"}`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Apply",
                onPress: () => {
                  if (sb.trim()) setBody(sb.trim());
                  if (sBullets.length) setBulletPoints(sBullets);
                  if (sTable?.rows?.length) {
                    setTableRows(sTable.rows);
                    setShowTable(true);
                  }
                  setDataSource("app_generated");
                },
              },
            ]
          );
        } else {
          Alert.alert("No suggestion", "No auto-fill data available for this section.");
        }
      } else {
        Alert.alert("Error", "Could not fetch auto-fill data.");
      }
    } catch { Alert.alert("Error", "Network error. Please try again."); }
    finally { setAutoFilling(false); }
  }

  async function handleCopy() {
    const tableText = tableRows.filter((r) => r.label.trim() || r.value.trim())
      .map((r) => `${r.label}: ${r.value}`).join("\n");
    const text = [title, subtitle, body, tableText, ...bulletPoints].filter(Boolean).join("\n\n");
    try { await Share.share({ message: text, title }); } catch { /* cancelled */ }
  }

  function handleClear() {
    Alert.alert("Clear content?", "This will remove body text, bullet points, and table rows.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => { setBody(""); setBulletPoints([]); setTableRows([]); } },
    ]);
  }

  function handleRestoreDefault() {
    Alert.alert("Restore default?", "Re-run auto-fill to restore suggested content.", [
      { text: "Cancel", style: "cancel" },
      { text: "Restore", onPress: () => handleAutoFill() },
    ]);
  }

  const selVis = VISIBILITY_OPTIONS.find((v) => v.value === visibility) ?? VISIBILITY_OPTIONS[1];
  const wordCount = countWords(body);
  const srcCfg = DATA_SOURCE_LABELS[dataSource] ?? DATA_SOURCE_LABELS.seller_supplied;

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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 120 }]}
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

        {/* Meta bar: data source + last saved + word count */}
        <View style={[styles.metaBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.metaItem}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {formatRelativeDate(savedAt)}
            </Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Feather name="align-left" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {wordCount} word{wordCount !== 1 ? "s" : ""}
            </Text>
          </View>
          {dataSource && (
            <>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Feather name={srcCfg.icon as any} size={12} color={srcCfg.color} />
                <Text style={[styles.metaText, { color: srcCfg.color }]}>{srcCfg.label}</Text>
              </View>
            </>
          )}
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
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>SECTION BODY</Text>
            <Text style={[styles.charCount, { color: wordCount < 20 && body.length > 0 ? "#F59E0B" : colors.mutedForeground }]}>
              {wordCount} words
            </Text>
          </View>
          <TextInput
            style={[styles.bodyInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={body}
            onChangeText={setBody}
            placeholder="Write the full text content for this section. Buyers will read this in the IM."
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
          />
          {wordCount > 0 && wordCount < 30 && (
            <Text style={[styles.hintText, { color: "#F59E0B" }]}>
              Add more detail — buyers expect at least 30–50 words per section.
            </Text>
          )}
        </View>

        {/* Bullet points */}
        <View style={styles.fieldBlock}>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>KEY POINTS</Text>
            <TouchableOpacity onPress={() => setBulletPoints((prev) => [...prev, ""])}>
              <Text style={[styles.addLink, { color: colors.primary }]}>+ Add point</Text>
            </TouchableOpacity>
          </View>
          {bulletPoints.length === 0 && (
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Bullet points appear as a quick-reference list in the IM.
            </Text>
          )}
          {bulletPoints.map((bullet, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
              <TextInput
                style={[styles.bulletInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                value={bullet}
                onChangeText={(val) => setBulletPoints((prev) => prev.map((b, i) => (i === idx ? val : b)))}
                placeholder={`Key point ${idx + 1}`}
                placeholderTextColor={colors.mutedForeground}
              />
              <TouchableOpacity onPress={() => setBulletPoints((prev) => prev.filter((_, i) => i !== idx))} style={styles.removeBulletBtn}>
                <Feather name="x" size={15} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ── Canberra location context structured editor ─────────────────────
             Replaces the generic table editor for business_location_market_context
             and canberra_location_explainer. Values are persisted in tableData.rows
             using the field label as the row key so they appear in the report table. */}
        {isLocationSection(section?.sectionKey) && (
          <View style={styles.fieldBlock}>
            <View style={[styles.locationHeader, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
              <Feather name="map-pin" size={14} color="#3B82F6" />
              <Text style={styles.locationHeaderText}>Location Context Fields</Text>
              <Text style={[styles.locationHeaderSub, { color: colors.mutedForeground }]}>
                Stored in report table · shown to buyers
              </Text>
            </View>
            {LOCATION_FIELDS[section!.sectionKey as LocationSectionKey].map((field) => (
              <View key={field.label} style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  {field.label.toUpperCase()}
                </Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  value={getLocField(tableRows, field.label)}
                  onChangeText={(val) => setTableRows((prev) => setLocField(prev, field.label, val))}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            ))}
          </View>
        )}

        {/* Table editor — shown for all sections; hidden label for location sections */}
        <View style={styles.fieldBlock}>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              {isLocationSection(section?.sectionKey) ? "RAW TABLE DATA" : "TABLE (optional)"}
            </Text>
            <TouchableOpacity onPress={() => setShowTable((v) => !v)}>
              <Text style={[styles.addLink, { color: colors.primary }]}>{showTable ? "Hide table" : "Add table"}</Text>
            </TouchableOpacity>
          </View>
          {showTable && (
            <View style={[styles.tableContainer, { borderColor: colors.border }]}>
              {/* Column headers */}
              <View style={[styles.tableHeaderRow, { backgroundColor: colors.border + "40" }]}>
                <Text style={[styles.tableHeaderCell, { color: colors.mutedForeground, flex: 1 }]}>Label / Metric</Text>
                <View style={[styles.tableDivider, { backgroundColor: colors.border }]} />
                <Text style={[styles.tableHeaderCell, { color: colors.mutedForeground, flex: 1 }]}>Value</Text>
                <View style={{ width: 32 }} />
              </View>
              {tableRows.length === 0 && (
                <Text style={[styles.emptyHint, { color: colors.mutedForeground, padding: 12 }]}>
                  Tap "+ Add row" to add key/value pairs (e.g. Revenue: $2.5M).
                </Text>
              )}
              {tableRows.map((row, idx) => (
                <View key={idx} style={[styles.tableRow, { borderTopColor: colors.border }]}>
                  <TextInput
                    style={[styles.tableCellInput, { color: colors.foreground, flex: 1 }]}
                    value={row.label}
                    onChangeText={(val) => setTableRows((prev) => prev.map((r, i) => i === idx ? { ...r, label: val } : r))}
                    placeholder="e.g. Revenue"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <View style={[styles.tableDivider, { backgroundColor: colors.border }]} />
                  <TextInput
                    style={[styles.tableCellInput, { color: colors.foreground, flex: 1 }]}
                    value={row.value}
                    onChangeText={(val) => setTableRows((prev) => prev.map((r, i) => i === idx ? { ...r, value: val } : r))}
                    placeholder="e.g. $2.5M"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TouchableOpacity
                    onPress={() => setTableRows((prev) => prev.filter((_, i) => i !== idx))}
                    style={styles.removeRowBtn}
                  >
                    <Feather name="x" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.addRowBtn, { borderTopColor: colors.border }]}
                onPress={() => setTableRows((prev) => [...prev, { label: "", value: "" }])}
              >
                <Feather name="plus" size={14} color={colors.primary} />
                <Text style={[styles.addLink, { color: colors.primary }]}>Add row</Text>
              </TouchableOpacity>
            </View>
          )}
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
            ] as [string, boolean, (v: boolean) => void][]).map(([label, val, setter], idx, arr) => (
              <TouchableOpacity
                key={label}
                style={[styles.toggleRow, idx < arr.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
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

        {/* Primary action buttons */}
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
            style={[styles.completeBtn, { borderColor: "#16A34A", opacity: saving ? 0.6 : 1 }]}
            onPress={() => handleSave(true)}
            disabled={saving}
          >
            <Feather name="check-circle" size={16} color="#16A34A" />
            <Text style={styles.completeBtnText}>Mark Complete</Text>
          </TouchableOpacity>
        </View>

        {/* Secondary actions */}
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>MORE ACTIONS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.secondaryRow}>
          {[
            { label: "Regenerate", icon: "refresh-cw", color: "#FBBF24", action: handleAutoFill },
            { label: "Copy Text",  icon: "copy",       color: "#3B82F6", action: handleCopy },
            { label: "Clear",      icon: "trash-2",    color: "#EF4444", action: handleClear },
            { label: "Restore",    icon: "rotate-ccw", color: "#6B7280", action: handleRestoreDefault },
            { label: "Preview",    icon: "eye",        color: "#A78BFA", action: () => setShowPreview(true) },
          ].map(({ label, icon, color, action }) => (
            <TouchableOpacity
              key={label}
              style={[styles.secondaryAction, { backgroundColor: color + "18", borderColor: color + "33" }]}
              onPress={action}
            >
              <Feather name={icon as any} size={15} color={color} />
              <Text style={[styles.secondaryActionText, { color }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>

      {/* Preview modal */}
      <Modal visible={showPreview} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPreview(false)}>
        <View style={[styles.previewModal, { backgroundColor: colors.background }]}>
          <View style={styles.previewHeader}>
            <Text style={[styles.previewTitle, { color: colors.foreground }]}>Section Preview</Text>
            <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.closeBtn}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.previewBody} showsVerticalScrollIndicator={false}>
            <Text style={[styles.previewHeading, { color: colors.foreground }]}>{title}</Text>
            {subtitle ? <Text style={[styles.previewSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
            {body ? <Text style={[styles.previewBodyText, { color: colors.foreground }]}>{body}</Text> : null}
            {tableRows.filter((r) => r.label.trim() || r.value.trim()).length > 0 && (
              <View style={[styles.previewTable, { borderColor: colors.border }]}>
                {tableRows.filter((r) => r.label.trim() || r.value.trim()).map((row, i) => (
                  <View key={i} style={[styles.previewTableRow, { borderTopColor: i > 0 ? colors.border : "transparent", borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0 }]}>
                    <Text style={[styles.previewTableLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                    <Text style={[styles.previewTableValue, { color: colors.foreground }]}>{row.value}</Text>
                  </View>
                ))}
              </View>
            )}
            {bulletPoints.filter((b) => b.trim()).length > 0 && (
              <View style={styles.previewBullets}>
                {bulletPoints.filter((b) => b.trim()).map((b, i) => (
                  <View key={i} style={styles.previewBulletRow}>
                    <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.previewBulletText, { color: colors.foreground }]}>{b}</Text>
                  </View>
                ))}
              </View>
            )}
            {!body && !bulletPoints.length && !tableRows.length && (
              <Text style={[styles.previewEmpty, { color: colors.mutedForeground }]}>No content yet — use Auto-fill or type in the fields above.</Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  scroll:            { paddingHorizontal: 16, gap: 18 },
  header:            { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  backBtn:           { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: 2 },
  title:             { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 26 },
  autoFillBtn:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: "#2D2010" },
  autoFillText:      { color: "#FBBF24", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  metaBar:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 10 },
  metaItem:          { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText:          { fontSize: 11, fontFamily: "Inter_400Regular" },
  metaDivider:       { width: 1, height: 12, backgroundColor: "#1E3A5C" },
  fieldBlock:        { gap: 8 },
  fieldLabel:        { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  fieldRow:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldInput:        { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  bodyInput:         { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 160, lineHeight: 22 },
  charCount:         { fontSize: 11, fontFamily: "Inter_400Regular" },
  hintText:          { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  emptyHint:         { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  addLink:           { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  bulletRow:         { flexDirection: "row", alignItems: "center", gap: 8 },
  bulletDot:         { width: 6, height: 6, borderRadius: 3 },
  bulletInput:       { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontFamily: "Inter_400Regular" },
  removeBulletBtn:   { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  tableContainer:    { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  tableHeaderRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
  tableHeaderCell:   { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4, textTransform: "uppercase" },
  tableDivider:      { width: 1, height: "100%", minHeight: 20 },
  tableRow:          { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth },
  tableCellInput:    { paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: "Inter_400Regular" },
  removeRowBtn:      { width: 32, height: 40, alignItems: "center", justifyContent: "center" },
  addRowBtn:         { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  visSelector:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  visDot:            { width: 10, height: 10, borderRadius: 5 },
  visLabel:          { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  visDesc:           { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  visDropdown:       { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  visOption:         { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1 },
  toggleCard:        { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  toggleRow:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12 },
  toggleLabel:       { fontSize: 14, fontFamily: "Inter_500Medium" },
  toggle:            { width: 40, height: 24, borderRadius: 12, position: "relative" },
  toggleThumb:       { position: "absolute", top: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" },
  actionRow:         { flexDirection: "row", gap: 10 },
  saveBtn:           { flex: 3, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  saveBtnText:       { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  completeBtn:       { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5 },
  completeBtnText:   { color: "#16A34A", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  secondaryRow:      { gap: 8, paddingBottom: 4 },
  secondaryAction:   { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  secondaryActionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  previewModal:      { flex: 1 },
  previewHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  previewTitle:      { fontSize: 18, fontFamily: "Inter_700Bold" },
  closeBtn:          { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  previewBody:       { paddingHorizontal: 20, paddingBottom: 60, gap: 14 },
  previewHeading:    { fontSize: 22, fontFamily: "Inter_700Bold" },
  previewSubtitle:   { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  previewBodyText:   { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  previewTable:      { borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  previewTableRow:   { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10 },
  previewTableLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  previewTableValue: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  previewBullets:    { gap: 8 },
  previewBulletRow:  { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  previewBulletText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  previewEmpty:      { fontSize: 14, fontFamily: "Inter_400Regular", fontStyle: "italic", textAlign: "center", paddingVertical: 40 },
  locationHeader:    { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, flexWrap: "wrap" },
  locationHeaderText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#3B82F6" },
  locationHeaderSub: { fontSize: 11, fontFamily: "Inter_400Regular", width: "100%", marginTop: 2 },
});
