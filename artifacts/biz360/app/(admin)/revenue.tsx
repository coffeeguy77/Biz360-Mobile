import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  AdminBroker,
  AdminUser,
  getBrokers,
  getFeaturedRevenue,
  getUsers,
  PLAN_ORDER,
  PLAN_PRICES,
  saveFeaturedRevenue,
} from "@/lib/adminStore";

// ─── Revenue computation ───────────────────────────────────────────────────────

interface PlanRow { name: string; count: number; revenue: number }

interface Stats {
  mrr:         number;
  arr:         number;
  subscriptions: number;
  featuredRev: number;
  plans:       PlanRow[];
  sellerCount: number;
  brokerCount: number;
}

function computeStats(
  users:       AdminUser[],
  brokers:     AdminBroker[],
  featuredRev: number,
): Stats {
  const planMap: Record<string, { count: number; revenue: number }> = {};

  let sellerCount = 0;
  let brokerCount = 0;

  for (const u of users) {
    if (u.role === "seller" && u.status === "active" && u.plan) {
      const price = PLAN_PRICES[u.plan] ?? 0;
      if (!planMap[u.plan]) planMap[u.plan] = { count: 0, revenue: 0 };
      planMap[u.plan].count++;
      planMap[u.plan].revenue += price;
      sellerCount++;
    }
  }

  for (const b of brokers) {
    if (b.status === "approved" && b.plan) {
      const price = PLAN_PRICES[b.plan] ?? 0;
      if (!planMap[b.plan]) planMap[b.plan] = { count: 0, revenue: 0 };
      planMap[b.plan].count++;
      planMap[b.plan].revenue += price;
      brokerCount++;
    }
  }

  const mrr  = Object.values(planMap).reduce((s, p) => s + p.revenue, 0);
  const subs = Object.values(planMap).reduce((s, p) => s + p.count,   0);

  const plans = Object.entries(planMap)
    .map(([name, { count, revenue }]) => ({ name, count, revenue }))
    .sort((a, b) => PLAN_ORDER.indexOf(a.name) - PLAN_ORDER.indexOf(b.name));

  return { mrr, arr: mrr * 12, subscriptions: subs, featuredRev, plans, sellerCount, brokerCount };
}

function fmt$(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n.toLocaleString()}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminRevenue() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [brokers, setBrokers] = useState<AdminBroker[]>([]);
  const [featRev, setFeatRev] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([getUsers(), getBrokers(), getFeaturedRevenue()]).then(([u, b, f]) => {
        if (!active) return;
        setUsers(u);
        setBrokers(b);
        setFeatRev(f);
        setLoading(false);
      });
      return () => { active = false; };
    }, []),
  );

  const stats = computeStats(users, brokers, featRev);

  const startEditFeatured = () => {
    setEditVal(featRev > 0 ? String(featRev) : "");
    setEditing(true);
  };

  const saveFeatured = () => {
    const val = Number(editVal.replace(/[^0-9.]/g, ""));
    if (isNaN(val) || val < 0) { Alert.alert("Invalid amount"); return; }
    setFeatRev(val);
    saveFeaturedRevenue(val).catch(() => {});
    setEditing(false);
  };

  const STAT_CARDS = [
    { label: "MRR",                  value: fmt$(stats.mrr),           color: "#16A34A", icon: "trending-up"   as const },
    { label: "Active Subscriptions", value: String(stats.subscriptions), color: "#3B82F6", icon: "users"         as const },
    { label: "Featured Ad Revenue",  value: fmt$(stats.featuredRev),   color: "#F59E0B", icon: "star"          as const, editable: true },
    { label: "ARR",                  value: fmt$(stats.arr),           color: "#8B5CF6", icon: "bar-chart-2"   as const },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Revenue</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Platform financials · live data</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── KPI grid ── */}
          <View style={styles.statsGrid}>
            {STAT_CARDS.map((s) => (
              <TouchableOpacity
                key={s.label}
                activeOpacity={s.editable ? 0.75 : 1}
                onPress={s.editable ? startEditFeatured : undefined}
                style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.statTop}>
                  <View style={[styles.statIcon, { backgroundColor: s.color + "20" }]}>
                    <Feather name={s.icon} size={14} color={s.color} />
                  </View>
                  {s.editable && (
                    <Feather name="edit-2" size={11} color={colors.mutedForeground} />
                  )}
                </View>
                <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
                <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Subscriber breakdown ── */}
          <View style={styles.breakdownRow}>
            <View style={[styles.breakdownPill, { backgroundColor: "#3B82F620", borderColor: "#3B82F640" }]}>
              <Feather name="shopping-bag" size={12} color="#3B82F6" />
              <Text style={[styles.breakdownText, { color: "#3B82F6" }]}>{stats.sellerCount} seller{stats.sellerCount !== 1 ? "s" : ""}</Text>
            </View>
            <View style={[styles.breakdownPill, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B40" }]}>
              <Feather name="briefcase" size={12} color="#F59E0B" />
              <Text style={[styles.breakdownText, { color: "#F59E0B" }]}>{stats.brokerCount} broker{stats.brokerCount !== 1 ? "s" : ""}</Text>
            </View>
            <View style={[styles.breakdownPill, { backgroundColor: "#16A34A20", borderColor: "#16A34A40" }]}>
              <Feather name="dollar-sign" size={12} color="#16A34A" />
              <Text style={[styles.breakdownText, { color: "#16A34A" }]}>{fmt$(stats.mrr)}/mo</Text>
            </View>
          </View>

          {/* ── Revenue by Plan ── */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Revenue by Plan</Text>
          {stats.plans.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="inbox" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No active subscriptions</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Revenue will appear here as sellers and brokers join with plans.
              </Text>
            </View>
          ) : (
            <View style={[styles.plansCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {stats.plans.map((plan, idx) => {
                const isSeller = plan.name.startsWith("Seller");
                const planColor = isSeller ? "#8B5CF6" : "#F59E0B";
                return (
                  <View
                    key={plan.name}
                    style={[
                      styles.planRow,
                      idx < stats.plans.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <View style={[styles.planDot, { backgroundColor: planColor }]} />
                    <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
                    <Text style={[styles.planCount, { color: colors.mutedForeground }]}>{plan.count}</Text>
                    <Text style={[styles.planRevenue, { color: "#16A34A" }]}>{fmt$(plan.revenue)}</Text>
                  </View>
                );
              })}
              {/* Totals row */}
              <View style={[styles.planRow, styles.totalRow, { backgroundColor: colors.muted }]}>
                <View style={[styles.planDot, { backgroundColor: "transparent" }]} />
                <Text style={[styles.planName, styles.totalLabel, { color: colors.foreground }]}>Total MRR</Text>
                <Text style={[styles.planCount, { color: colors.mutedForeground }]}>{stats.subscriptions}</Text>
                <Text style={[styles.planRevenue, styles.totalRevenue, { color: "#16A34A" }]}>{fmt$(stats.mrr)}</Text>
              </View>
            </View>
          )}

          {/* ── Featured Ad Revenue edit hint ── */}
          <TouchableOpacity
            style={[styles.featuredHint, { backgroundColor: colors.card, borderColor: "#F59E0B40" }]}
            onPress={startEditFeatured}
          >
            <Feather name="star" size={14} color="#F59E0B" />
            <Text style={[styles.featuredHintText, { color: colors.mutedForeground }]}>
              Tap to update Featured Ad Revenue
            </Text>
            <Feather name="edit-2" size={13} color="#F59E0B" />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Featured revenue edit modal ── */}
      {editing && (
        <View style={styles.editOverlay}>
          <TouchableOpacity style={styles.editBackdrop} onPress={() => setEditing(false)} />
          <View style={[styles.editSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.editTitle, { color: colors.foreground }]}>Featured Ad Revenue (Monthly)</Text>
            <View style={[styles.editInputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.editDollar, { color: colors.mutedForeground }]}>$</Text>
              <TextInput
                style={[styles.editInput, { color: colors.foreground }]}
                value={editVal}
                onChangeText={setEditVal}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
              />
            </View>
            <View style={styles.editBtns}>
              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: colors.muted }]}
                onPress={() => setEditing(false)}
              >
                <Text style={[styles.editBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: colors.primary }]}
                onPress={saveFeatured}
              >
                <Text style={[styles.editBtnText, { color: "#fff" }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1 },
  header:           { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title:            { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle:         { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  loadingWrap:      { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll:           { padding: 16, gap: 16 },
  statsGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard:         { width: "47%", padding: 14, borderRadius: 14, borderWidth: 1, gap: 6 },
  statTop:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statIcon:         { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  statVal:          { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLbl:          { fontSize: 11, fontFamily: "Inter_400Regular" },
  breakdownRow:     { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  breakdownPill:    { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  breakdownText:    { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionTitle:     { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyCard:        { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: "center", gap: 10 },
  emptyTitle:       { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyText:        { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  plansCard:        { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  planRow:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13 },
  planDot:          { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
  planName:         { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  planCount:        { fontSize: 13, fontFamily: "Inter_400Regular", width: 30, textAlign: "right", marginRight: 4 },
  planRevenue:      { fontSize: 13, fontFamily: "Inter_700Bold", width: 58, textAlign: "right" },
  totalRow:         { marginTop: 0 },
  totalLabel:       { fontFamily: "Inter_700Bold", fontSize: 13 },
  totalRevenue:     { fontFamily: "Inter_700Bold" },
  featuredHint:     { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  featuredHintText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  editOverlay:      { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  editBackdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  editSheet:        { margin: 16, borderRadius: 20, borderWidth: 1, padding: 24, gap: 16 },
  editTitle:        { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  editInputWrap:    { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  editDollar:       { fontSize: 20, fontFamily: "Inter_600SemiBold", marginRight: 6 },
  editInput:        { flex: 1, fontSize: 24, fontFamily: "Inter_700Bold" },
  editBtns:         { flexDirection: "row", gap: 10 },
  editBtn:          { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  editBtnText:      { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
