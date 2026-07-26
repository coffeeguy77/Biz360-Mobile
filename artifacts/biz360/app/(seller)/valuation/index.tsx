import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

function formatCurrency(val: string | number | null | undefined): string {
  const n = Number(val ?? 0);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default function ValuationIndex() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listingId } = useLocalSearchParams<{ listingId?: string }>();
  const {
    cafes, selectedCafe, loadingCafes, fetchCafes, createCafe,
    latestSnapshot, fetchSnapshot, businessUnits, fetchUnits,
    authToken,
  } = useValuation();
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchCafes().then((cafes) => {
      if (cafes.length > 0) { fetchSnapshot(); fetchUnits(); }
    });
  }, [authToken]));

  const handleCreateCafe = async () => {
    if (!authToken) { Alert.alert("Not authenticated", "Please log in to use Valuation."); return; }
    setCreating(true);
    const err = await createCafe({ name: "My Business", listing_id: listingId });
    setCreating(false);
    if (err) Alert.alert("Error", err);
    else { fetchSnapshot(); fetchUnits(); }
  };

  const handleSync = async () => {
    if (!selectedCafe || !authToken) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/valuation/square/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ cafeId: selectedCafe.id, periodMonths: 12 }),
      });
      if (!res.ok) { const err = await res.json(); Alert.alert("Sync Error", err.error || "Sync failed"); }
      else { await fetchSnapshot(); Alert.alert("Synced!", "Your valuation has been updated."); }
    } catch (e: any) { Alert.alert("Error", e.message || "Network error"); }
    setSyncing(false);
  };

  const combined = latestSnapshot.combined;
  const valMidpoint = combined?.valuationMidpoint;

  if (!authToken) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Valuation</Text>
        </View>
        <View style={styles.empty}>
          <Feather name="lock" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Authentication required</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Sign in with your phone number to access valuation tools.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Business Valuation</Text>
        </View>

        {loadingCafes ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : selectedCafe ? (
          <>
            <View style={[styles.card, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
              <Text style={styles.cafeNameLabel}>Valuing</Text>
              <Text style={styles.cafeName}>{selectedCafe.name}</Text>
              {valMidpoint ? (
                <View style={styles.valuationRow}>
                  <View style={styles.valuationLeft}>
                    <Text style={styles.valuationLabel}>Estimated Value</Text>
                    <Text style={styles.valuationAmount}>{formatCurrency(valMidpoint)}</Text>
                    <Text style={styles.snapshotDate}>as of {combined?.snapshotDate ?? "—"}</Text>
                  </View>
                  <View style={styles.breakdownRight}>
                    {([
                      ["Revenue", combined?.grossRevenue],
                      ["COGS", combined?.cogs],
                      ["Profit", combined?.grossProfit],
                      ["Equipment", combined?.totalEquipmentValue],
                    ] as [string, string | null | undefined][]).map(([label, val]) => (
                      <View key={label} style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>{label}</Text>
                        <Text style={styles.breakdownVal}>{formatCurrency(val)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={[styles.noSnapshot, { color: "#8B9CB8" }]}>No snapshot yet — tap Sync to generate your first valuation</Text>
              )}
              <TouchableOpacity
                style={[styles.syncBtn, { backgroundColor: syncing ? "#1E3A5C" : "#3B82F6" }]}
                onPress={handleSync}
                disabled={syncing}
              >
                {syncing ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="refresh-cw" size={16} color="#fff" />}
                <Text style={styles.syncBtnText}>{syncing ? "Syncing…" : "Sync Now"}</Text>
              </TouchableOpacity>
            </View>

            {businessUnits.length > 0 && (
              <View style={styles.divisionsSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Divisions</Text>
                  <TouchableOpacity onPress={() => router.push("/(seller)/valuation/units" as any)} style={styles.manageBtn}>
                    <Feather name="sliders" size={14} color={colors.primary} />
                    <Text style={[styles.manageBtnText, { color: colors.primary }]}>Manage</Text>
                  </TouchableOpacity>
                </View>
                {businessUnits.map((unit) => {
                  const unitSnap = latestSnapshot.units.find((u) => u.unit.id === unit.id)?.snapshot;
                  return (
                    <View key={unit.id} style={[styles.unitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <Text style={[styles.unitName, { color: colors.foreground }]}>{unit.name}</Text>
                          {unit.isIncludedInSale === false && (
                            <View style={styles.excludedPill}>
                              <Text style={styles.excludedPillText}>Excluded</Text>
                            </View>
                          )}
                        </View>
                        {unitSnap?.grossRevenue && Number(unitSnap.grossRevenue) > 0 ? (
                          <Text style={[styles.unitMeta, { color: colors.mutedForeground }]}>Revenue: {formatCurrency(unitSnap.grossRevenue)}</Text>
                        ) : (
                          <Text style={[styles.unitMeta, { color: colors.mutedForeground }]}>Assign income accounts to calculate</Text>
                        )}
                      </View>
                      <Text style={[styles.unitVal, { color: unit.isIncludedInSale === false ? colors.mutedForeground : colors.primary }]}>
                        {unitSnap?.valuationMidpoint && Number(unitSnap.valuationMidpoint) > 0 ? formatCurrency(unitSnap.valuationMidpoint) : "—"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Tools</Text>
            <View style={styles.toolGrid}>
              {[
                { label: "Divisions", icon: "layers", route: "/(seller)/valuation/units" },
                { label: "Equipment", icon: "tool", route: "/(seller)/valuation/equipment" },
                { label: "Add-backs", icon: "plus-circle", route: "/(seller)/valuation/adjustments" },
                { label: "Connections", icon: "link", route: "/(seller)/valuation/profile" },
                { label: "P&L Mapping", icon: "bar-chart-2", route: "/(seller)/valuation/pl-mappings" },
                { label: "Suppliers", icon: "package", route: "/(seller)/valuation/supplier-mappings" },
                { label: "Report Images", icon: "image", route: "/(seller)/valuation/report-images" },
                { label: "Full Report", icon: "file-text", route: "/(seller)/valuation/report" },
                { label: "Fin. Reports", icon: "bar-chart-2", route: "/(seller)/valuation/custom-reports" },
              ].map(({ label, icon, route }) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.toolCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(route as any)}
                >
                  <Feather name={icon as any} size={22} color={colors.primary} />
                  <Text style={[styles.toolLabel, { color: colors.foreground }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <Feather name="trending-up" size={48} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Set up your valuation</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Connect your business data to get an accurate valuation powered by your real revenue and expenses.</Text>
            <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={handleCreateCafe} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="plus" size={18} color="#fff" />}
              <Text style={styles.createBtnText}>Start Valuation</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1 },
  scroll:           { paddingHorizontal: 16, gap: 16 },
  header:           { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:          { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:            { fontSize: 22, fontFamily: "Inter_700Bold" },
  card:             { borderRadius: 16, padding: 20, borderWidth: 1, gap: 6 },
  cafeNameLabel:    { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  cafeName:         { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  valuationRow:     { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 12 },
  valuationLeft:    { flex: 1 },
  valuationLabel:   { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  valuationAmount:  { color: "#3B82F6", fontSize: 34, fontFamily: "Inter_700Bold", marginTop: 2 },
  snapshotDate:     { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  breakdownRight:   { gap: 7, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: "#1E3A5C" },
  noSnapshot:       { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, marginTop: 8 },
  syncBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, marginTop: 12 },
  syncBtnText:      { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  divisionsSection: { gap: 10 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle:     { fontSize: 16, fontFamily: "Inter_700Bold" },
  manageBtn:        { flexDirection: "row", alignItems: "center", gap: 5 },
  manageBtnText:    { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  unitCard:         { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1 },
  unitName:         { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  unitMeta:         { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  unitVal:          { fontSize: 16, fontFamily: "Inter_700Bold" },
  toolGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toolCard:         { width: "31%", padding: 16, borderRadius: 14, borderWidth: 1, alignItems: "center", gap: 8 },
  toolLabel:        { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },
  empty:            { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle:       { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptyText:        { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, maxWidth: 300 },
  createBtn:        { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  createBtnText:    { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  breakdownRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  breakdownLabel:   { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular" },
  breakdownVal:     { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  excludedPill:     { backgroundColor: "rgba(239,68,68,0.15)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  excludedPillText: { color: "#EF4444", fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3 },
});
