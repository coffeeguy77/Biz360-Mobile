import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem("biz360_auth_token");
}

interface ReportVersion {
  id: string;
  versionNumber: number;
  title: string | null;
  status: string;
  generatedHtmlUrl: string | null;
  generatedPdfUrl: string | null;
  createdAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  published: "#16A34A",
  draft:     "#3B82F6",
  archived:  "#6B7280",
};

export default function ReportVersionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe } = useValuation();
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const listingId = selectedCafe?.listingId ?? selectedCafe?.listing_id;

  const loadVersions = useCallback(async () => {
    if (!listingId) return;
    const token = await getAuthToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/report-versions/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions ?? []);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [listingId]);

  useFocusEffect(useCallback(() => { loadVersions(); }, [loadVersions]));

  async function handleViewHtml(version: ReportVersion) {
    if (!listingId) return;
    const token = await getAuthToken();
    const url = version.generatedHtmlUrl ??
      `${API_BASE.replace(/\/api$/, "")}/exit360-web/reports/${listingId}?v=${version.id}${token ? `&token=${token}` : ""}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open the report URL.");
    }
  }

  async function handleDownloadPdf(version: ReportVersion) {
    if (!listingId) return;
    const token = await getAuthToken();
    if (!token) return;
    setDownloadingId(version.id);
    try {
      const res = await fetch(
        `${API_BASE}/api/report-exports/pdf/${listingId}?mode=seller&versionId=${version.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err.error ?? "Could not generate PDF.");
        return;
      }

      if (Platform.OS === "web") {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `im-report-v${version.versionNumber}.pdf`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const filename = `im-report-v${version.versionNumber}-${Date.now()}.pdf`;
        const path = `${FileSystem.cacheDirectory}${filename}`;
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join("");
        const base64 = btoa(binary);
        await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(path, { mimeType: "application/pdf", dialogTitle: "Share IM Report PDF" });
      }
    } catch {
      Alert.alert("Error", "Download failed. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Version History</Text>
        </View>

        {!listingId && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="alert-circle" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No listing selected.</Text>
          </View>
        )}

        {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}

        {!loading && versions.length === 0 && listingId && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="clock" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No versions yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Use "Publish" on the Report Hub to create your first version snapshot.
            </Text>
          </View>
        )}

        {versions.map((v) => {
          const statusColor = STATUS_COLORS[v.status] ?? "#6B7280";
          const isDownloading = downloadingId === v.id;
          return (
            <View key={v.id} style={[styles.versionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.versionTop}>
                <View style={styles.versionLeft}>
                  <View style={styles.versionNumRow}>
                    <Text style={[styles.versionNum, { color: colors.foreground }]}>
                      Version {v.versionNumber}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: statusColor + "22" }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                  {v.title && (
                    <Text style={[styles.versionTitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {v.title}
                    </Text>
                  )}
                  <Text style={[styles.versionDate, { color: colors.mutedForeground }]}>
                    {formatDate(v.createdAt)}
                  </Text>
                </View>
              </View>

              <View style={styles.versionActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#1E3A5C" }]}
                  onPress={() => handleViewHtml(v)}
                >
                  <Feather name="eye" size={14} color="#60A5FA" />
                  <Text style={[styles.actionBtnText, { color: "#60A5FA" }]}>View HTML</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: isDownloading ? "#0F2040" : "#1E3A5C", opacity: isDownloading ? 0.7 : 1 }]}
                  onPress={() => handleDownloadPdf(v)}
                  disabled={isDownloading}
                >
                  {isDownloading
                    ? <ActivityIndicator size="small" color="#A78BFA" />
                    : <Feather name="file-text" size={14} color="#A78BFA" />}
                  <Text style={[styles.actionBtnText, { color: "#A78BFA" }]}>
                    {isDownloading ? "Generating…" : "Download PDF"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {versions.length > 0 && (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {versions.length} version{versions.length !== 1 ? "s" : ""} · Seller PDFs include seller-only sections
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 16, gap: 14 },
  header:       { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:      { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:        { fontSize: 22, fontFamily: "Inter_700Bold", flex: 1 },
  emptyCard:    { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: "center", gap: 12 },
  emptyTitle:   { fontSize: 17, fontFamily: "Inter_700Bold" },
  emptyText:    { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 280 },
  versionCard:  { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  versionTop:   { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  versionLeft:  { flex: 1, gap: 3 },
  versionNumRow:{ flexDirection: "row", alignItems: "center", gap: 10 },
  versionNum:   { fontSize: 16, fontFamily: "Inter_700Bold" },
  statusPill:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusDot:    { width: 6, height: 6, borderRadius: 3 },
  statusText:   { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  versionTitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  versionDate:  { fontSize: 11, fontFamily: "Inter_400Regular" },
  versionActions:{ flexDirection: "row", gap: 10 },
  actionBtn:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flex: 1, justifyContent: "center" },
  actionBtnText:{ fontSize: 12, fontFamily: "Inter_600SemiBold" },
  hint:         { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", paddingBottom: 8 },
});
