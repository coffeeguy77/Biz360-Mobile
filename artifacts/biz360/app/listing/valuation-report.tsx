import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

function fmt(val: string | number | null | undefined): string {
  const n = Number(val ?? 0);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function healthScore(adjEbitda: number, revenue: number): { label: string; color: string; score: number } {
  const margin = revenue > 0 ? adjEbitda / revenue : 0;
  if (margin >= 0.2) return { score: 85, label: "Strong", color: "#16A34A" };
  if (margin >= 0.1) return { score: 65, label: "Moderate", color: "#F59E0B" };
  if (margin >= 0) return { score: 40, label: "Tight", color: "#F97316" };
  return { score: 15, label: "Loss-making", color: "#EF4444" };
}

interface SnapData {
  combined: any | null;
  units: { unit: any; snapshot: any | null }[];
}

export default function BuyerValuationReport() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const [data, setData] = useState<SnapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!listingId) return;
    fetch(`${API_BASE}/api/valuation/listing/${listingId}/snapshot`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d ?? null); })
      .finally(() => setLoading(false));
  }, [listingId]);

  const tabs = data ? [
    { label: "Combined", snap: data.combined },
    ...data.units.map(({ unit, snapshot }) => ({ label: unit.name, snap: snapshot })),
  ] : [];

  const activeSnap = tabs[activeTab]?.snap ?? null;
  const adjEbitda = Number(activeSnap?.adjustedEbitda ?? 0);
  const revenue = Number(activeSnap?.grossRevenue ?? 1);
  const valMidpoint = Number(activeSnap?.valuationMidpoint ?? 0);
  const sdeValuation = Math.max(adjEbitda, 0) * 2.0;
  const blendedLow = Math.min(valMidpoint, sdeValuation) * 0.85;
  const blendedHigh = Math.max(valMidpoint, sdeValuation) * 1.15;
  const hs = healthScore(adjEbitda, revenue);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Verified Financials</Text>
            <View style={styles.verifiedBadge}>
              <Feather name="shield" size={12} color="#16A34A" />
              <Text style={styles.verifiedText}>Seller-verified · Read-only view</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : !data?.combined && (!data?.units || data.units.length === 0) ? (
          <View style={styles.empty}>
            <Feather name="file-text" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No financials published</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>The seller has not published a verified financial snapshot for this listing.</Text>
          </View>
        ) : (
          <>
            {tabs.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
                {tabs.map((tab, i) => (
                  <TouchableOpacity key={i} style={[styles.tab, activeTab === i && { backgroundColor: colors.primary }]} onPress={() => setActiveTab(i)}>
                    <Text style={[styles.tabText, activeTab === i && { color: "#fff" }]}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={[styles.metricRow, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
              {[["Revenue", fmt(activeSnap?.grossRevenue)], ["EBITDA", fmt(activeSnap?.ebitda)], ["Adj. EBITDA", fmt(activeSnap?.adjustedEbitda)]].map(([l, v]) => (
                <View key={l} style={styles.metricCell}>
                  <Text style={styles.metricLabel}>{l}</Text>
                  <Text style={styles.metricVal}>{v}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.blendedCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
              <Text style={styles.blendedLabel}>Estimated Business Value</Text>
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

            <View style={{ gap: 0 }}>
              {[
                ["EBITDA Method (×2.5)", fmt(valMidpoint)],
                ["SDE Method (×2.0)", fmt(sdeValuation)],
                ["Equipment Value", fmt(activeSnap?.totalEquipmentValue)],
                ["Gross Profit", fmt(activeSnap?.grossProfit)],
                ["Period", `${activeSnap?.periodMonths ?? 12} months`],
                ["Snapshot Date", activeSnap?.snapshotDate ?? "—"],
              ].map(([label, val]) => (
                <View key={label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <Text style={[styles.detailVal, { color: colors.foreground }]}>{val}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.disclaimerBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
                These financials were provided by the seller and have not been independently audited. Engage a qualified accountant or business broker before making any purchase decisions.
              </Text>
            </View>
          </>
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
  verifiedBadge:  { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  verifiedText:   { fontSize: 11, fontFamily: "Inter_500Medium", color: "#16A34A" },
  tabs:           { gap: 8, paddingBottom: 4 },
  tab:            { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1E3A5C" },
  tabText:        { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8B9CB8" },
  metricRow:      { flexDirection: "row", borderRadius: 14, padding: 16, borderWidth: 1 },
  metricCell:     { flex: 1, alignItems: "center", gap: 4 },
  metricLabel:    { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular" },
  metricVal:      { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  blendedCard:    { borderRadius: 14, padding: 16, borderWidth: 1 },
  blendedLabel:   { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  blendedRange:   { color: "#3B82F6", fontSize: 24, fontFamily: "Inter_700Bold", marginTop: 4 },
  healthCard:     { borderRadius: 14, padding: 16, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  healthLabel:    { fontSize: 12, fontFamily: "Inter_400Regular" },
  healthScore:    { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 2 },
  healthBadge:    { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  healthBadgeText:{ fontSize: 18, fontFamily: "Inter_700Bold" },
  detailRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1 },
  detailLabel:    { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailVal:      { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  disclaimerBox:  { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  disclaimerText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  empty:          { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle:     { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText:      { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 280 },
});
