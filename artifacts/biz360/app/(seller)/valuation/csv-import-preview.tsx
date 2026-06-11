import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { useColors } from "@/hooks/useColors";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem("biz360_auth_token");
}

interface PreviewRow {
  section_key: string;
  section_title: string;
  main_body: string;
  visibility: string;
  status: string;
  bullets: string;
}

interface PreviewData {
  rowCount: number;
  validRowCount: number;
  matchedCount: number;
  unknownKeys: string[];
  invalidVisibility: string[];
  changedFields: number;
  previewRows: PreviewRow[];
}

export default function CsvImportPreviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ listingId: string; fileName: string; preview: string }>();
  const [confirming, setConfirming] = useState(false);

  const listingId = params.listingId ?? "";
  const fileName = params.fileName ?? "imported.csv";
  const previewData: PreviewData | null = (() => {
    try { return params.preview ? JSON.parse(params.preview) : null; } catch { return null; }
  })();

  if (!previewData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No preview data available.</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={[styles.backLinkText, { color: colors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasWarnings = previewData.unknownKeys.length > 0 || previewData.invalidVisibility.length > 0;

  async function handleConfirm() {
    const token = await getAuthToken();
    if (!token || !listingId) return;

    const csvText = await AsyncStorage.getItem("csv_import_pending_text");
    if (!csvText) {
      Alert.alert("Error", "CSV content not found. Please re-upload the file.");
      return;
    }

    setConfirming(true);
    try {
      const formData = new FormData();
      if (Platform.OS === "web") {
        const blob = new Blob([csvText ?? ""], { type: "text/csv" });
        formData.append("file", blob, fileName);
      } else {
        const tempPath = `${FileSystem.cacheDirectory}confirm_import.csv`;
        await FileSystem.writeAsStringAsync(tempPath, csvText ?? "", { encoding: FileSystem.EncodingType.UTF8 });
        formData.append("file", { uri: tempPath, type: "text/csv", name: fileName } as any);
      }

      const res = await fetch(`${API_BASE}/api/report-sections/csv-import/${listingId}?preview=false`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      await AsyncStorage.removeItem("csv_import_pending_text");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Import Failed", err.error ?? "Could not import CSV.");
        return;
      }
      const data = await res.json();
      Alert.alert(
        "Report content imported successfully",
        `${data.updated ?? 0} section${(data.updated ?? 0) !== 1 ? "s" : ""} updated.`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  function handleCancel() {
    AsyncStorage.removeItem("csv_import_pending_text").catch(() => {});
    router.back();
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Import Preview</Text>
        </View>

        {/* File info */}
        <View style={[styles.fileCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
          <Feather name="file-text" size={22} color="#34D399" />
          <View style={{ flex: 1 }}>
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
            <Text style={styles.fileSubtitle}>CSV ready for import</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: "#60A5FA" }]}>{previewData.validRowCount ?? previewData.rowCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Valid Rows</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: "#34D399" }]}>{previewData.matchedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Sections Matched</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: "#A78BFA" }]}>{previewData.changedFields}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Fields Changed</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: previewData.unknownKeys.length > 0 ? "#F59E0B" : "#6B7280" }]}>
              {previewData.unknownKeys.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Unknown Keys</Text>
          </View>
        </View>

        {/* Warnings */}
        {hasWarnings && (
          <View style={[styles.warningCard, { backgroundColor: "#7C2D1220", borderColor: "#F59E0B44" }]}>
            <View style={styles.warningHeader}>
              <Feather name="alert-triangle" size={16} color="#F59E0B" />
              <Text style={styles.warningTitle}>Import Warnings</Text>
            </View>
            {previewData.unknownKeys.length > 0 && (
              <View style={styles.warningSection}>
                <Text style={styles.warningSubtitle}>Unknown section keys (will be skipped):</Text>
                {previewData.unknownKeys.map((k) => (
                  <Text key={k} style={styles.warningItem}>• {k}</Text>
                ))}
              </View>
            )}
            {previewData.invalidVisibility.length > 0 && (
              <View style={styles.warningSection}>
                <Text style={styles.warningSubtitle}>Invalid visibility values (will be skipped):</Text>
                {previewData.invalidVisibility.map((v) => (
                  <Text key={v} style={styles.warningItem}>• {v}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Preview table */}
        {previewData.previewRows.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              PREVIEW — FIRST {previewData.previewRows.length} ROWS
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
              <View>
                {/* Table header */}
                <View style={[styles.tableRow, styles.tableHead, { backgroundColor: "#0F2040" }]}>
                  {["Section Key", "Title", "Body Preview", "Visibility", "Bullets"].map((h) => (
                    <Text key={h} style={[styles.tableHeadCell, { width: h === "Body Preview" ? 180 : 120 }]}>{h}</Text>
                  ))}
                </View>
                {/* Table rows */}
                {previewData.previewRows.map((row, i) => (
                  <View
                    key={row.section_key + i}
                    style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? colors.card : colors.background, borderColor: colors.border }]}
                  >
                    <Text style={[styles.tableCell, styles.tableCellKey, { width: 120, color: "#60A5FA" }]} numberOfLines={2}>
                      {row.section_key}
                    </Text>
                    <Text style={[styles.tableCell, { width: 120, color: colors.foreground }]} numberOfLines={2}>
                      {row.section_title || "—"}
                    </Text>
                    <Text style={[styles.tableCell, { width: 180, color: colors.mutedForeground }]} numberOfLines={3}>
                      {row.main_body || "—"}
                    </Text>
                    <Text style={[styles.tableCell, { width: 120, color: colors.foreground }]} numberOfLines={1}>
                      {row.visibility}
                    </Text>
                    <Text style={[styles.tableCell, { width: 120, color: "#A78BFA" }]} numberOfLines={1}>
                      {row.bullets}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        {/* Info box */}
        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Sections not in the CSV will be untouched. App-generated financial data will be preserved. Matched sections will have their data source set to "csv_imported".
          </Text>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.actionBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={handleCancel} disabled={confirming}>
          <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: confirming ? "#16A34A88" : "#16A34A" }]}
          onPress={handleConfirm}
          disabled={confirming}
        >
          {confirming
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="check" size={18} color="#fff" />}
          <Text style={styles.confirmBtnText}>{confirming ? "Importing…" : "Confirm Import"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  scroll:          { paddingHorizontal: 16, gap: 14 },
  header:          { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:         { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:           { fontSize: 22, fontFamily: "Inter_700Bold", flex: 1 },
  emptyText:       { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 12 },
  backLink:        { marginTop: 16 },
  backLinkText:    { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fileCard:        { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  fileName:        { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fileSubtitle:    { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statsRow:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard:        { flex: 1, minWidth: "44%", borderRadius: 12, padding: 14, borderWidth: 1, alignItems: "center", gap: 4 },
  statNum:         { fontSize: 26, fontFamily: "Inter_700Bold" },
  statLabel:       { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  warningCard:     { borderRadius: 12, padding: 14, borderWidth: 1, gap: 8 },
  warningHeader:   { flexDirection: "row", alignItems: "center", gap: 8 },
  warningTitle:    { color: "#F59E0B", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  warningSection:  { gap: 4 },
  warningSubtitle: { color: "#F59E0B", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  warningItem:     { color: "#FCD34D", fontSize: 12, fontFamily: "Inter_400Regular", paddingLeft: 8 },
  sectionLabel:    { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  tableScroll:     { borderRadius: 12, overflow: "hidden" },
  tableRow:        { flexDirection: "row", borderBottomWidth: 1 },
  tableHead:       {},
  tableHeadCell:   { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_600SemiBold", padding: 10, paddingVertical: 8 },
  tableCell:       { fontSize: 11, fontFamily: "Inter_400Regular", padding: 10, paddingVertical: 8 },
  tableCellKey:    { fontFamily: "Inter_500Medium" },
  infoBox:         { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText:        { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  actionBar:       { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  cancelBtn:       { flex: 1, borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1 },
  cancelBtnText:   { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  confirmBtn:      { flex: 2, flexDirection: "row", borderRadius: 14, padding: 16, alignItems: "center", justifyContent: "center", gap: 8 },
  confirmBtnText:  { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
