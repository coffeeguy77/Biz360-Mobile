import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const REVENUE_STATS = [
  { label: "MRR", value: "$12,450", trend: "+18%", color: "#16A34A" },
  { label: "Active Subscriptions", value: "89", trend: "+7", color: "#3B82F6" },
  { label: "Featured Ad Revenue", value: "$3,200", trend: "+12%", color: "#F59E0B" },
  { label: "ARR", value: "$149,400", trend: "+22%", color: "#8B5CF6" },
];

const PLANS = [
  { name: "Seller Starter", count: 34, revenue: "$1,020" },
  { name: "Seller Tour Listing", count: 28, revenue: "$2,800" },
  { name: "Seller Pro", count: 18, revenue: "$3,060" },
  { name: "Seller Premium Exit", count: 5, revenue: "$1,245" },
  { name: "Broker Lite", count: 2, revenue: "$298" },
  { name: "Broker Growth", count: 1, revenue: "$249" },
  { name: "Broker Pro", count: 1, revenue: "$499" },
];

export default function AdminRevenue() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Revenue</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Platform financials</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          {REVENUE_STATS.map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{s.label}</Text>
              <Text style={[styles.statTrend, { color: colors.accent }]}>{s.trend}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Revenue by Plan</Text>
        <View style={[styles.plansCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {PLANS.map((plan, idx) => (
            <View
              key={plan.name}
              style={[styles.planRow, idx < PLANS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
              <Text style={[styles.planCount, { color: colors.mutedForeground }]}>{plan.count}</Text>
              <Text style={[styles.planRevenue, { color: colors.accent }]}>{plan.revenue}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  scroll: { padding: 16, gap: 16 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", padding: 14, borderRadius: 14, borderWidth: 1, gap: 4 },
  statVal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statTrend: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  plansCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  planRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  planName: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  planCount: { fontSize: 13, fontFamily: "Inter_400Regular", width: 30, textAlign: "right" },
  planRevenue: { fontSize: 13, fontFamily: "Inter_700Bold", width: 60, textAlign: "right" },
});
