import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useValuation, ValSnapshot, ValUnit } from "@/context/ValuationContext";

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

function healthScore(snap: ValSnapshot | null): { score: number; label: string; color: string } {
  if (!snap) return { score: 0, label: "No data", color: "#6B7280" };
  const adjEbitda = Number(snap.adjustedEbitda ?? 0);
  const revenue = Number(snap.grossRevenue ?? 1);
  const margin = adjEbitda / revenue;
  if (margin >= 0.2) return { score: 85, label: "Strong", color: "#16A34A" };
  if (margin >= 0.1) return { score: 65, label: "Moderate", color: "#F59E0B" };
  if (margin >= 0) return { score: 40, label: "Tight", color: "#F97316" };
  return { score: 15, label: "Loss-making", color: "#EF4444" };
}

function ReportCard({ snap, name }: { snap: ValSnapshot | null; name: string }) {
  const colors = useColors();
  const adjEbitda = Number(snap?.adjustedEbitda ?? 0);
  const valMidpoint = Number(snap?.valuationMidpoint ?? 0);
  const sdeMultiple = 2.0;
  const sdeValuation = Math.max(adjEbitda, 0) * sdeMultiple;
  const blendedLow = Math.min(valMidpoint, sdeValuation) * 0.85;
  const blendedHigh = Math.max(valMidpoint, sdeValuation) * 1.15;
  const hs = healthScore(snap);

  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.tabName, { color: colors.foreground }]}>{name}</Text>
      <View style={[styles.metricRow, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Revenue</Text>
          <Text style={styles.metricVal}>{fmt(snap?.grossRevenue)}</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>EBITDA</Text>
          <Text style={styles.metricVal}>{fmt(snap?.ebitda)}</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Adj. EBITDA</Text>
          <Text style={[styles.metricVal, { color: "#3B82F6" }]}>{fmt(snap?.adjustedEbitda)}</Text>
        </View>
      </View>
      <View style={[styles.methodCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.methodTitle, { color: colors.foreground }]}>EBITDA Method (×2.5)</Text>
        <Text style={[styles.methodVal, { color: "#3B82F6" }]}>{fmt(valMidpoint)}</Text>
      </View>
      <View style={[styles.methodCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.methodTitle, { color: colors.foreground }]}>SDE Method (×2.0)</Text>
        <Text style={[styles.methodVal, { color: "#8B5CF6" }]}>{fmt(sdeValuation)}</Text>
      </View>
      <View style={[styles.blendedCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
        <Text style={styles.blendedLabel}>Blended Asking Range</Text>
        <Text style={styles.blendedRange}>{fmt(blendedLow)} — {fmt(blendedHigh)}</Text>
      </View>
      <View style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.healthLabel, { color: colors.mutedForeground }]}>Business Health</Text>
          <Text style={[styles.healthScore, { color: hs.color }]}>{hs.label}</Text>
        </View>
        <View style={[styles.healthBadge, { backgroundColor: hs.color + "20" }]}>
          <Text style={[styles.healthBadgeText, { color: hs.color }]}>{hs.score}/100</Text>
        </View>
      </View>
      <View style={styles.detailRows}>
        {([
          ["COGS", fmt(snap?.cogs)],
          ["Gross Profit", fmt(snap?.grossProfit)],
          ["Equipment Value", fmt(snap?.totalEquipmentValue)],
          ["Xero Revenue (inc. Square)", fmt(snap?.xeroRevenue)],
        ] as [string, string][]).map(([label, val]) => (
          <View key={label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
            <Text style={[styles.detailVal, { color: colors.foreground }]}>{val}</Text>
          </View>
        ))}
        {/* Square Revenue — shown as a verification row, NOT added to Xero total */}
        {snap?.squareRevenue && Number(snap.squareRevenue) > 0 ? (
          <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Square Revenue</Text>
              <View style={styles.squareVerifiedBadge}>
                <Feather name="check-circle" size={10} color="#16A34A" />
                <Text style={styles.squareVerifiedText}>VERIFIED · SQUARE CONNECTED</Text>
              </View>
            </View>
            <Text style={[styles.detailVal, { color: "#16A34A" }]}>{fmt(snap.squareRevenue)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function ReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { latestSnapshot, selectedCafe, fetchSnapshot, businessUnits } = useValuation();
  const [activeTab, setActiveTab] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [publishedDate, setPublishedDate] = useState<string | null>(
    latestSnapshot.combined?.isPublished ? (latestSnapshot.combined.snapshotDate ?? null) : null
  );

  useFocusEffect(useCallback(() => {
    fetchSnapshot();
    setPublishedDate(latestSnapshot.combined?.isPublished ? (latestSnapshot.combined.snapshotDate ?? null) : null);
  }, [selectedCafe?.id]));

  async function handlePublish() {
    if (!selectedCafe?.id) return;
    const token = await getAuthToken();
    if (!token) return;
    Alert.alert(
      "Publish to buyers?",
      "This will make your verified financials visible to buyers on your listing page. You can re-sync and re-publish any time.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          style: "default",
          onPress: async () => {
            setPublishing(true);
            try {
              const res = await fetch(`${API_BASE}/api/valuation/cafes/${selectedCafe.id}/snapshots/publish`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                const data = await res.json();
                setPublishedDate(data.snapshotDate ?? new Date().toISOString().slice(0, 10));
                Alert.alert("Published!", "Your financials are now visible to buyers on your listing.");
              } else {
                const err = await res.json().catch(() => ({}));
                Alert.alert("Error", err.error ?? "Failed to publish. Please try again.");
              }
            } catch {
              Alert.alert("Error", "Network error. Please try again.");
            } finally {
              setPublishing(false);
            }
          },
        },
      ]
    );
  }

  const tabs: { label: string; snap: ValSnapshot | null; unit?: ValUnit }[] = [
    { label: "Combined", snap: latestSnapshot.combined },
    ...latestSnapshot.units.map(({ unit, snapshot }) => ({ label: unit.name, snap: snapshot, unit })),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Valuation Report</Text>
          <TouchableOpacity
            onPress={() => router.push("/(seller)/valuation/report-access" as any)}
            style={[styles.accessBtn, { backgroundColor: "#1E3A5C" }]}
          >
            <Feather name="lock" size={15} color={colors.foreground} />
            <Text style={[styles.accessBtnText, { color: colors.foreground }]}>Access</Text>
          </TouchableOpacity>
        </View>

        {tabs.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {tabs.map((tab, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.tab, activeTab === i && { backgroundColor: colors.primary }]}
                onPress={() => setActiveTab(i)}
              >
                <Text style={[styles.tabText, activeTab === i && { color: "#fff" }]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {tabs[activeTab] ? (
          <ReportCard snap={tabs[activeTab].snap} name={tabs[activeTab].label} />
        ) : (
          <View style={styles.empty}>
            <Feather name="file-text" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No snapshot yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Sync your data from the Valuation hub to generate a report.</Text>
          </View>
        )}

        {latestSnapshot.combined && (
          <View style={styles.publishSection}>
            {publishedDate ? (
              <View style={styles.publishedBadge}>
                <Feather name="check-circle" size={16} color="#16A34A" />
                <Text style={styles.publishedText}>Published to buyers · {publishedDate}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.publishBtn, { backgroundColor: publishedDate ? colors.card : "#16A34A", borderWidth: publishedDate ? 1 : 0, borderColor: colors.border }]}
              onPress={handlePublish}
              disabled={publishing}
            >
              {publishing ? (
                <ActivityIndicator size="small" color={publishedDate ? colors.foreground : "#fff"} />
              ) : (
                <>
                  <Feather name="upload-cloud" size={16} color={publishedDate ? colors.foreground : "#fff"} />
                  <Text style={[styles.publishBtnText, { color: publishedDate ? colors.foreground : "#fff" }]}>
                    {publishedDate ? "Re-publish to buyers" : "Publish to buyers"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  scroll:         { paddingHorizontal: 16, gap: 14 },
  header:         { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:        { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:          { fontSize: 22, fontFamily: "Inter_700Bold" },
  tabs:           { gap: 8, paddingBottom: 4 },
  tab:            { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1E3A5C" },
  tabText:        { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8B9CB8" },
  tabName:        { fontSize: 18, fontFamily: "Inter_700Bold" },
  metricRow:      { flexDirection: "row", borderRadius: 14, padding: 16, borderWidth: 1 },
  metricCell:     { flex: 1, alignItems: "center", gap: 4 },
  metricLabel:    { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular" },
  metricVal:      { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  methodCard:     { borderRadius: 14, padding: 16, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  methodTitle:    { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  methodVal:      { fontSize: 20, fontFamily: "Inter_700Bold" },
  blendedCard:    { borderRadius: 14, padding: 16, borderWidth: 1 },
  blendedLabel:   { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  blendedRange:   { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 4 },
  healthCard:     { borderRadius: 14, padding: 16, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  healthLabel:    { fontSize: 12, fontFamily: "Inter_400Regular" },
  healthScore:    { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 2 },
  healthBadge:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  healthBadgeText:{ fontSize: 18, fontFamily: "Inter_700Bold" },
  detailRows:     { gap: 0 },
  detailRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1 },
  detailLabel:    { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailVal:           { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  squareVerifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  squareVerifiedText:  { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#16A34A", letterSpacing: 0.3 },
  empty:          { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle:     { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText:      { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 280 },
  publishSection: { gap: 10, paddingTop: 4 },
  publishedBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  publishedText:  { fontSize: 13, fontFamily: "Inter_500Medium", color: "#16A34A" },
  publishBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 16 },
  publishBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  accessBtn:      { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginLeft: "auto" },
  accessBtnText:  { fontSize: 13, fontFamily: "Inter_500Medium" },
});
