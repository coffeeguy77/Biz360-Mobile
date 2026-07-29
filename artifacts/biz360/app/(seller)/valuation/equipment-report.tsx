import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator, Platform, ScrollView, Share, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useValuation, ValUnit } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Equipment {
  id: string;
  unitId?: string | null;
  name: string;
  category?: string | null;
  brand?: string | null;
  condition?: string | null;
  valuationMode?: string | null;
  purchasePrice?: string | null;
  secondhandValue?: string | null;
  replacementCost?: string | null;
  currentValue?: string | null;
  ownership?: string | null;
  isLeased?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (val: string | number | null | undefined): string => {
  const n = Number(val ?? 0);
  if (isNaN(n) || n === 0) return "—";
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const num = (val: string | number | null | undefined): number => {
  const n = Number(val ?? 0);
  return isNaN(n) ? 0 : n;
};

function conditionColor(condition?: string | null): string {
  switch ((condition ?? "").toLowerCase()) {
    case "excellent": return "#10B981";
    case "good":      return "#3B82F6";
    case "fair":      return "#F59E0B";
    case "poor":      return "#EF4444";
    default:          return "#6B7280";
  }
}

function buildShareText(
  unitName: string,
  items: Equipment[],
  categoryMap: Record<string, Equipment[]>,
): string {
  const totalValue = items.reduce((s, i) => s + num(i.currentValue), 0);
  const totalRepl  = items.reduce((s, i) => s + num(i.replacementCost), 0);

  const lines: string[] = [
    `EQUIPMENT REPORT — ${unitName.toUpperCase()}`,
    `Generated: ${new Date().toLocaleDateString("en-AU", { dateStyle: "long" })}`,
    `Items: ${items.length} | Current Value: $${Math.round(totalValue).toLocaleString("en-AU")} | Replacement Cost: $${Math.round(totalRepl).toLocaleString("en-AU")}`,
    "",
  ];

  for (const [cat, catItems] of Object.entries(categoryMap)) {
    const catTotal = catItems.reduce((s, i) => s + num(i.currentValue), 0);
    lines.push(`── ${cat.toUpperCase()} (${catItems.length} items, $${Math.round(catTotal).toLocaleString("en-AU")}) ──`);
    for (const item of catItems) {
      const brand = item.brand ? ` [${item.brand}]` : "";
      const cond  = item.condition ? ` — ${item.condition}` : "";
      const val   = fmt(item.currentValue);
      lines.push(`  • ${item.name}${brand}${cond}: ${val}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function EquipmentReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe, authToken, businessUnits: ctxUnits } = useValuation();

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null); // null = All Units
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const authHeaders = () => ({
    Authorization: `Bearer ${authToken}`,
  });

  // Units — include an "All Units" sentinel
  type UnitOrSentinel = (ValUnit & { sentinel?: boolean }) | { id: string; name: string; sentinel: true; isIncludedInSale?: boolean | null };
  const units: UnitOrSentinel[] = useMemo(() => [
    { id: "__all__", name: "All Units", sentinel: true as const },
    ...ctxUnits,
  ], [ctxUnits]);

  const selectedUnit = useMemo(
    () => units.find((u) => (selectedUnitId === null ? u.id === "__all__" : u.id === selectedUnitId)),
    [units, selectedUnitId],
  );

  useFocusEffect(useCallback(() => {
    if (!selectedCafe || !authToken) return;
    if (selectedUnitId === undefined) return; // not initialised yet
    fetchEquipment();
  }, [selectedCafe?.id, authToken, selectedUnitId]));

  const fetchEquipment = async () => {
    if (!selectedCafe) return;
    setLoading(true);
    try {
      const qs = selectedUnitId ? `?unit_id=${selectedUnitId}` : "";
      const res = await fetch(
        `${API_BASE}/api/valuation/cafes/${selectedCafe.id}/equipment${qs}`,
        { headers: authHeaders() },
      );
      if (res.ok) {
        const data = await res.json();
        setEquipment(data.equipment ?? []);
        // Default all categories expanded
        const cats = [...new Set((data.equipment ?? []).map((e: Equipment) => e.category ?? "Uncategorised"))] as string[];
        const expMap: Record<string, boolean> = {};
        cats.forEach((c) => { expMap[c] = true; });
        setExpandedCategories(expMap);
      }
    } catch {}
    setLoading(false);
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const categoryMap = useMemo<Record<string, Equipment[]>>(() => {
    const map: Record<string, Equipment[]> = {};
    for (const item of equipment) {
      const cat = item.category?.trim() || "Uncategorised";
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    // Sort items within each category by currentValue descending
    for (const cat of Object.keys(map)) {
      map[cat].sort((a, b) => num(b.currentValue) - num(a.currentValue));
    }
    return map;
  }, [equipment]);

  const totalCurrentValue   = useMemo(() => equipment.reduce((s, i) => s + num(i.currentValue), 0),   [equipment]);
  const totalReplacementCost = useMemo(() => equipment.reduce((s, i) => s + num(i.replacementCost), 0), [equipment]);
  const totalPurchasePrice   = useMemo(() => equipment.reduce((s, i) => s + num(i.purchasePrice), 0),   [equipment]);

  const categoryTotals = useMemo(() =>
    Object.fromEntries(
      Object.entries(categoryMap).map(([cat, items]) => [
        cat,
        { value: items.reduce((s, i) => s + num(i.currentValue), 0), count: items.length },
      ])
    ),
  [categoryMap]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleShare = async () => {
    const unitName = selectedUnit?.name ?? "All Units";
    const text = buildShareText(unitName, equipment, categoryMap);
    try {
      await Share.share({ message: text, title: `Equipment Report — ${unitName}` });
    } catch {}
  };

  const toggleCategory = (cat: string) =>
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Equipment Report</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Pick a business location to view its equipment
            </Text>
          </View>
          {equipment.length > 0 && (
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleShare}
            >
              <Feather name="share" size={16} color={colors.primary} />
              <Text style={[styles.shareBtnText, { color: colors.primary }]}>Share</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Unit Selector */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>LOCATION</Text>
        <View style={styles.unitGrid}>
          {units.map((unit) => {
            const active = selectedUnitId === null
              ? unit.id === "__all__"
              : unit.id === selectedUnitId;
            return (
              <TouchableOpacity
                key={unit.id}
                style={[
                  styles.unitCard,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  setSelectedUnitId(unit.id === "__all__" ? null : unit.id);
                }}
                activeOpacity={0.8}
              >
                <Feather
                  name={unit.id === "__all__" ? "layers" : "briefcase"}
                  size={18}
                  color={active ? "#fff" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.unitCardText,
                    { color: active ? "#fff" : colors.foreground },
                  ]}
                  numberOfLines={2}
                >
                  {unit.name}
                </Text>
                {!unit.sentinel && !active && unit.isIncludedInSale && (
                  <View style={[styles.saleBadge, { backgroundColor: `${colors.primary}20` }]}>
                    <Text style={[styles.saleBadgeText, { color: colors.primary }]}>In sale</Text>
                  </View>
                )}
                {active && (
                  <View style={styles.activeCheck}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Loading */}
        {loading && (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        )}

        {/* No data */}
        {!loading && equipment.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="inbox" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No equipment found</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {selectedUnitId
                ? "This location has no equipment assigned to it yet."
                : "No equipment has been added to this business yet."}
            </Text>
            <TouchableOpacity
              style={[styles.goBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(seller)/valuation/equipment" as any)}
            >
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.goBtnText}>Add Equipment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Summary Cards */}
        {!loading && equipment.length > 0 && (
          <>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="dollar-sign" size={16} color="#3B82F6" />
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Current Value</Text>
                <Text style={[styles.summaryValue, { color: "#3B82F6" }]}>
                  {fmt(totalCurrentValue)}
                </Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="refresh-cw" size={16} color="#8B5CF6" />
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Replacement Cost</Text>
                <Text style={[styles.summaryValue, { color: "#8B5CF6" }]}>
                  {fmt(totalReplacementCost)}
                </Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="package" size={16} color="#F59E0B" />
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Items</Text>
                <Text style={[styles.summaryValue, { color: "#F59E0B" }]}>
                  {equipment.length}
                </Text>
              </View>
            </View>

            {/* Category overview bar */}
            <View style={[styles.overviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.overviewTitle, { color: colors.foreground }]}>By Category</Text>
              {Object.entries(categoryTotals)
                .sort((a, b) => b[1].value - a[1].value)
                .map(([cat, { value, count }]) => {
                  const pct = totalCurrentValue > 0 ? value / totalCurrentValue : 0;
                  return (
                    <View key={cat} style={styles.catRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.catLabelRow}>
                          <Text style={[styles.catName, { color: colors.foreground }]}>{cat}</Text>
                          <Text style={[styles.catCount, { color: colors.mutedForeground }]}>{count} item{count !== 1 ? "s" : ""}</Text>
                          <Text style={[styles.catValue, { color: colors.foreground }]}>{fmt(value)}</Text>
                        </View>
                        <View style={[styles.barBg, { backgroundColor: colors.border }]}>
                          <View
                            style={[styles.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: colors.primary }]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
            </View>

            {/* Equipment by category */}
            {Object.entries(categoryMap)
              .sort((a, b) => {
                const aV = a[1].reduce((s, i) => s + num(i.currentValue), 0);
                const bV = b[1].reduce((s, i) => s + num(i.currentValue), 0);
                return bV - aV;
              })
              .map(([cat, items]) => (
                <View key={cat} style={[styles.categorySection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {/* Category header */}
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => toggleCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.categoryName, { color: colors.foreground }]}>{cat}</Text>
                      <Text style={[styles.categoryMeta, { color: colors.mutedForeground }]}>
                        {items.length} item{items.length !== 1 ? "s" : ""} · {fmt(categoryTotals[cat]?.value)}
                      </Text>
                    </View>
                    <Feather
                      name={expandedCategories[cat] ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.mutedForeground}
                    />
                  </TouchableOpacity>

                  {/* Items */}
                  {expandedCategories[cat] && (
                    <View style={[styles.itemList, { borderTopColor: colors.border }]}>
                      {items.map((item, idx) => (
                        <View
                          key={item.id}
                          style={[
                            styles.itemRow,
                            idx < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                          ]}
                        >
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
                            <View style={styles.itemMetaRow}>
                              {item.brand && (
                                <View style={[styles.tag, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}>
                                  <Text style={[styles.tagText, { color: colors.primary }]}>{item.brand}</Text>
                                </View>
                              )}
                              {item.condition && (
                                <View style={[styles.tag, { backgroundColor: `${conditionColor(item.condition)}15`, borderColor: `${conditionColor(item.condition)}30` }]}>
                                  <Text style={[styles.tagText, { color: conditionColor(item.condition) }]}>{item.condition}</Text>
                                </View>
                              )}
                              {item.ownership === "leased" && (
                                <View style={[styles.tag, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B30" }]}>
                                  <Text style={[styles.tagText, { color: "#F59E0B" }]}>Leased</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 3 }}>
                            <Text style={[styles.itemValue, { color: colors.foreground }]}>{fmt(item.currentValue)}</Text>
                            {num(item.replacementCost) > 0 && (
                              <Text style={[styles.itemRepl, { color: colors.mutedForeground }]}>
                                Repl: {fmt(item.replacementCost)}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}

            {/* Footer note */}
            <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
              * Current value is the secondhand, replacement, or manual value as configured per item.
              Purchase price used where no other value is set.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 16, gap: 14 },

  header:       { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  backBtn:      { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: 2 },
  title:        { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle:     { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  shareBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  shareBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8 },

  unitGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  unitCard:     { width: "47%", borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 8, position: "relative" },
  unitCardText: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 19 },
  saleBadge:    { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  saleBadgeText:{ fontSize: 10, fontFamily: "Inter_600SemiBold" },
  activeCheck:  { position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },

  emptyCard:    { borderRadius: 14, borderWidth: 1, padding: 28, alignItems: "center", gap: 8 },
  emptyTitle:   { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyText:    { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  goBtn:        { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  goBtnText:    { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },

  summaryRow:   { flexDirection: "row", gap: 10 },
  summaryCard:  { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, gap: 4, alignItems: "center" },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  summaryValue: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },

  overviewCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  overviewTitle:{ fontSize: 14, fontFamily: "Inter_700Bold" },
  catRow:       { gap: 6 },
  catLabelRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  catName:      { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  catCount:     { fontSize: 12, fontFamily: "Inter_400Regular" },
  catValue:     { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  barBg:        { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill:      { height: "100%", borderRadius: 3 },

  categorySection: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  categoryHeader:  { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  categoryName:    { fontSize: 15, fontFamily: "Inter_700Bold" },
  categoryMeta:    { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  itemList:     { borderTopWidth: 1 },
  itemRow:      { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  itemName:     { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  itemMetaRow:  { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  tag:          { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  tagText:      { fontSize: 10, fontFamily: "Inter_500Medium" },
  itemValue:    { fontSize: 14, fontFamily: "Inter_700Bold" },
  itemRepl:     { fontSize: 11, fontFamily: "Inter_400Regular" },

  footerNote:   { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 17, paddingHorizontal: 8 },
});
