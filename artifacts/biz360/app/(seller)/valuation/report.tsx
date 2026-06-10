import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
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

type CogsItem = { supplierName: string; total: number; unitId: string | null; unitName: string | null };

function ReportCard({
  snap,
  name,
  cogsBreakdown,
  loadingCogs,
  staffSuppliers,
  showStaffNames,
  onToggleShowStaff,
  onToggleSupplierStaff,
  filterUnitId,
}: {
  snap: ValSnapshot | null;
  name: string;
  cogsBreakdown: CogsItem[];
  loadingCogs: boolean;
  staffSuppliers: Set<string>;
  showStaffNames: boolean;
  onToggleShowStaff: (v: boolean) => void;
  onToggleSupplierStaff: (supplierName: string) => void;
  filterUnitId?: string;
}) {
  const colors = useColors();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const adjEbitda = Number(snap?.adjustedEbitda ?? 0);
  const equipmentValue = Number(snap?.totalEquipmentValue ?? 0);
  const valMidpoint = Number(snap?.valuationMidpoint ?? 0);
  const sdeValuation = Math.max(adjEbitda, 0) * 2.0 + equipmentValue;
  const blendedLow = Math.min(valMidpoint, sdeValuation) * 0.85;
  const blendedHigh = Math.max(valMidpoint, sdeValuation) * 1.15;
  const hs = healthScore(snap);

  // Combined tab (filterUnitId=undefined) shows all suppliers; per-unit tabs filter by unitId
  const tabCogs = filterUnitId === undefined
    ? cogsBreakdown
    : cogsBreakdown.filter(c => c.unitId === filterUnitId);

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

      {/* EBITDA Method — uses valuationMidpoint stored in snapshot = AdjEBITDA×2.5 + Equipment */}
      <View style={[styles.methodCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.methodTitle, { color: colors.foreground }]}>Adj. EBITDA × 2.5 + Equipment</Text>
          <Text style={styles.methodFormula}>{fmt(adjEbitda)} × 2.5 + {fmt(equipmentValue)} equip</Text>
        </View>
        <Text style={[styles.methodVal, { color: "#3B82F6" }]}>{fmt(valMidpoint)}</Text>
      </View>

      {/* SDE Method — same structure as EBITDA method but 2.0× multiple */}
      <View style={[styles.methodCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.methodTitle, { color: colors.foreground }]}>Adj. EBITDA × 2.0 + Equipment</Text>
          <Text style={styles.methodFormula}>{fmt(adjEbitda)} × 2.0 + {fmt(equipmentValue)} equip</Text>
        </View>
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
        ] as [string, string][]).map(([label, val]) => (
          <View key={label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
            <Text style={[styles.detailVal, { color: colors.foreground }]}>{val}</Text>
          </View>
        ))}
        {/* Xero Revenue — with verified badge */}
        <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Xero Revenue (inc. Square)</Text>
            <View style={styles.squareVerifiedBadge}>
              <Feather name="check-circle" size={10} color="#1AB4D7" />
              <Text style={[styles.squareVerifiedText, { color: "#1AB4D7" }]}>VERIFIED · XERO CONNECTED</Text>
            </View>
          </View>
          <Text style={[styles.detailVal, { color: "#1AB4D7" }]}>{fmt(snap?.xeroRevenue)}</Text>
        </View>
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

      {/* ── Advanced section ─────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.advancedToggle, { borderColor: colors.border }]}
        onPress={() => setAdvancedOpen(v => !v)}
        activeOpacity={0.7}
      >
        <Text style={[styles.advancedToggleText, { color: colors.mutedForeground }]}>Advanced</Text>
        <Feather name={advancedOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      {advancedOpen && (
        <View style={[styles.advancedBody, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Staff reveal toggle */}
          <View style={styles.maskRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.maskLabel, { color: colors.foreground }]}>Show staff names</Text>
              <Text style={[styles.maskSub, { color: colors.mutedForeground }]}>Reveal real names of suppliers tagged as staff</Text>
            </View>
            <Switch
              value={showStaffNames}
              onValueChange={onToggleShowStaff}
              trackColor={{ false: "#374151", true: "#3B82F6" }}
              thumbColor="#fff"
              ios_backgroundColor="#374151"
            />
          </View>

          {/* COGS Breakdown */}
          <View style={[styles.cogsHeader, { borderTopColor: colors.border }]}>
            <Text style={[styles.cogsTitle, { color: colors.foreground }]}>COGS Breakdown</Text>
            <Text style={[styles.cogsSub, { color: colors.mutedForeground }]}>Tap 👁 to tag a supplier as staff — their name is replaced with a pill</Text>
          </View>

          {loadingCogs ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
          ) : tabCogs.length === 0 ? (
            <Text style={[styles.cogsEmpty, { color: colors.mutedForeground }]}>
              No COGS suppliers found for this period. Map supplier contacts in the Supplier Mappings tool.
            </Text>
          ) : (() => {
            // Build stable "Staff Wage N" numbers based on order in full cogsBreakdown list
            let staffCounter = 0;
            const staffIndex: Record<string, number> = {};
            for (const c of cogsBreakdown) {
              if (staffSuppliers.has(c.supplierName) && !(c.supplierName in staffIndex)) {
                staffCounter += 1;
                staffIndex[c.supplierName] = staffCounter;
              }
            }
            return tabCogs.map((item, i) => {
              const isStaff = staffSuppliers.has(item.supplierName);
              const masked = isStaff && !showStaffNames;
              const wageNum = staffIndex[item.supplierName] ?? 0;
              return (
                <View key={i} style={[styles.cogsRow, { borderTopColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    {masked ? (
                      <View style={styles.staffPill}>
                        <Text style={styles.staffPillText}>Staff Wage {wageNum}</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={[styles.cogsSupplier, { color: colors.foreground }]}>{item.supplierName}</Text>
                        {item.unitName ? (
                          <Text style={[styles.cogsUnit, { color: colors.mutedForeground }]}>{item.unitName}</Text>
                        ) : item.unitId === null ? (
                          <Text style={[styles.cogsUnit, { color: colors.mutedForeground }]}>Parent / Shared</Text>
                        ) : null}
                      </>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <Text style={[styles.cogsAmount, { color: colors.foreground }]}>{fmt(item.total)}</Text>
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => onToggleSupplierStaff(item.supplierName)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather
                        name={isStaff ? "eye-off" : "eye"}
                        size={17}
                        color={isStaff ? "#3B82F6" : colors.mutedForeground}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            });
          })()}
        </View>
      )}
    </View>
  );
}

export default function ReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { latestSnapshot, selectedCafe, fetchSnapshot, updateUnit, recalculateSnapshot } = useValuation();
  const [activeTab, setActiveTab] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [togglingUnit, setTogglingUnit] = useState<string | null>(null);
  const [publishedDate, setPublishedDate] = useState<string | null>(
    latestSnapshot.combined?.isPublished ? (latestSnapshot.combined.snapshotDate ?? null) : null
  );
  const [cogsBreakdown, setCogsBreakdown] = useState<CogsItem[]>([]);
  const [loadingCogs, setLoadingCogs] = useState(false);
  const [staffSuppliers, setStaffSuppliers] = useState<Set<string>>(new Set());
  const [showStaffNames, setShowStaffNames] = useState(false);

  // Load persisted staff tags for the current cafe
  useFocusEffect(useCallback(() => {
    fetchSnapshot();
    setPublishedDate(latestSnapshot.combined?.isPublished ? (latestSnapshot.combined.snapshotDate ?? null) : null);
    if (selectedCafe?.id) {
      fetchCogsBreakdown(selectedCafe.id);
      AsyncStorage.getItem(`staff-suppliers:${selectedCafe.id}`).then(raw => {
        if (raw) {
          try { setStaffSuppliers(new Set(JSON.parse(raw))); } catch { /* ignore */ }
        } else {
          setStaffSuppliers(new Set());
        }
      });
    }
  }, [selectedCafe?.id]));

  function toggleSupplierStaff(supplierName: string) {
    setStaffSuppliers(prev => {
      const next = new Set(prev);
      if (next.has(supplierName)) next.delete(supplierName);
      else next.add(supplierName);
      if (selectedCafe?.id) {
        AsyncStorage.setItem(`staff-suppliers:${selectedCafe.id}`, JSON.stringify([...next]));
      }
      return next;
    });
  }

  async function fetchCogsBreakdown(cafeId: string, periodMonths?: number) {
    const token = await getAuthToken();
    if (!token) return;
    setLoadingCogs(true);
    const months = periodMonths ?? latestSnapshot.combined?.periodMonths ?? 12;
    try {
      const res = await fetch(`${API_BASE}/api/valuation/cafes/${cafeId}/cogs-breakdown?months=${months}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCogsBreakdown(Array.isArray(data) ? data : []);
      }
    } catch {
      // non-critical, silent failure
    } finally {
      setLoadingCogs(false);
    }
  }

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
    ...latestSnapshot.units
      .filter(({ unit }) => unit.isIncludedInSale !== false)
      .map(({ unit, snapshot }) => ({ label: unit.name, snap: snapshot, unit })),
  ];

  const currentTab = tabs[activeTab];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
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

        {currentTab ? (
          <>
            <ReportCard
              snap={currentTab.snap}
              name={currentTab.label}
              cogsBreakdown={cogsBreakdown}
              loadingCogs={loadingCogs}
              staffSuppliers={staffSuppliers}
              showStaffNames={showStaffNames}
              onToggleShowStaff={setShowStaffNames}
              onToggleSupplierStaff={toggleSupplierStaff}
              filterUnitId={currentTab.unit?.id}
            />
            {activeTab === 0 && latestSnapshot.units.length > 0 && (
              <View style={[styles.bundleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.bundleTitle, { color: colors.foreground }]}>Sale Bundle</Text>
                <Text style={[styles.bundleSubtitle, { color: colors.mutedForeground }]}>
                  Toggle divisions on or off to revalue the business in real time.
                </Text>
                {latestSnapshot.units.map(({ unit, snapshot }) => {
                  const included = unit.isIncludedInSale !== false;
                  const val = snapshot?.valuationMidpoint ? Number(snapshot.valuationMidpoint) : null;
                  const isToggling = togglingUnit === unit.id;
                  return (
                    <View key={unit.id} style={[styles.bundleRow, { borderTopColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.bundleUnitName, { color: colors.foreground }]}>{unit.name}</Text>
                        <Text style={[styles.bundleUnitSub, { color: included ? "#16A34A" : colors.mutedForeground }]}>
                          {included ? "Included in sale" : "Excluded from sale"}
                          {val !== null ? `  ·  ${fmt(val)}` : ""}
                        </Text>
                      </View>
                      {isToggling ? (
                        <ActivityIndicator size="small" color={colors.primary} style={{ width: 50 }} />
                      ) : (
                        <Switch
                          value={included}
                          onValueChange={async (newVal) => {
                            setTogglingUnit(unit.id);
                            try {
                              await updateUnit(unit.id, { is_included_in_sale: newVal });
                              await recalculateSnapshot();
                              if (selectedCafe?.id) fetchCogsBreakdown(selectedCafe.id);
                            } finally {
                              setTogglingUnit(null);
                            }
                          }}
                          trackColor={{ false: "#374151", true: "#16A34A" }}
                          thumbColor="#fff"
                          ios_backgroundColor="#374151"
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
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
  container:           { flex: 1 },
  scroll:              { paddingHorizontal: 16, gap: 14 },
  header:              { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:             { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:               { fontSize: 22, fontFamily: "Inter_700Bold" },
  tabs:                { gap: 8, paddingBottom: 4 },
  tab:                 { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1E3A5C" },
  tabText:             { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8B9CB8" },
  tabName:             { fontSize: 18, fontFamily: "Inter_700Bold" },
  metricRow:           { flexDirection: "row", borderRadius: 14, padding: 16, borderWidth: 1 },
  metricCell:          { flex: 1, alignItems: "center", gap: 4 },
  metricLabel:         { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular" },
  metricVal:           { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  methodCard:          { borderRadius: 14, padding: 16, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  methodTitle:         { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  methodFormula:       { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  methodVal:           { fontSize: 20, fontFamily: "Inter_700Bold" },
  blendedCard:         { borderRadius: 14, padding: 16, borderWidth: 1 },
  blendedLabel:        { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  blendedRange:        { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 4 },
  healthCard:          { borderRadius: 14, padding: 16, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  healthLabel:         { fontSize: 12, fontFamily: "Inter_400Regular" },
  healthScore:         { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 2 },
  healthBadge:         { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  healthBadgeText:     { fontSize: 18, fontFamily: "Inter_700Bold" },
  detailRows:          { gap: 0 },
  detailRow:           { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1 },
  detailLabel:         { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailVal:           { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  squareVerifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  squareVerifiedText:  { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#16A34A", letterSpacing: 0.3 },
  advancedToggle:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderTopWidth: 1 },
  advancedToggleText:  { fontSize: 13, fontFamily: "Inter_500Medium" },
  advancedBody:        { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  maskRow:             { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  maskLabel:           { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  maskSub:             { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  cogsHeader:          { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  cogsTitle:           { fontSize: 13, fontFamily: "Inter_700Bold" },
  cogsSub:             { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  cogsEmpty:           { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, paddingHorizontal: 16, paddingBottom: 16 },
  cogsRow:             { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, gap: 12 },
  cogsSupplier:        { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  cogsUnit:            { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  cogsAmount:          { fontSize: 13, fontFamily: "Inter_700Bold" },
  staffPill:           { backgroundColor: "#1D3461", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  staffPillText:       { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#60A5FA" },
  eyeBtn:              { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  empty:               { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle:          { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText:           { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 280 },
  publishSection:      { gap: 10, paddingTop: 4 },
  publishedBadge:      { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  publishedText:       { fontSize: 13, fontFamily: "Inter_500Medium", color: "#16A34A" },
  publishBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 16 },
  publishBtnText:      { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  accessBtn:           { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginLeft: "auto" },
  accessBtnText:       { fontSize: 13, fontFamily: "Inter_500Medium" },
  bundleCard:          { borderRadius: 14, padding: 16, borderWidth: 1, gap: 4 },
  bundleTitle:         { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 2 },
  bundleSubtitle:      { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 8 },
  bundleRow:           { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderTopWidth: 1, gap: 12 },
  bundleUnitName:      { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  bundleUnitSub:       { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
