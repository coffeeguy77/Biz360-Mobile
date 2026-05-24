import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const STATS = [
  { label: "Listing Views", value: "312", change: "+18%", icon: "eye", color: "#3B82F6" },
  { label: "Tour Starts", value: "89", change: "+31%", icon: "rotate-ccw", color: "#8B5CF6" },
  { label: "Unique Buyers", value: "47", change: "+12%", icon: "users", color: "#F59E0B" },
  { label: "Messages", value: "14", change: "+5", icon: "message-circle", color: "#16A34A" },
  { label: "Calls Clicked", value: "8", change: "+3", icon: "phone", color: "#EC4899" },
  { label: "Saved Count", value: "47", change: "+9", icon: "bookmark", color: "#6366F1" },
];

const TOP_PINS = [
  { name: "POS Counter — Revenue", views: 67, type: "revenue" },
  { name: "La Marzocco Espresso Machine", views: 54, type: "equipment" },
  { name: "Lease — $4,200/mo", views: 43, type: "lease" },
  { name: "COGS — 28% Revenue", views: 38, type: "cogs" },
  { name: "Catering Opportunity", views: 31, type: "opportunity" },
];

export default function SellerDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const showAccountMenu = () => {
    Alert.alert(user?.name ?? "Account", user?.email ?? "", [
      { text: "Switch Account", onPress: () => router.replace("/(auth)/welcome" as any) },
      { text: "Sign Out", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/welcome" as any); } },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Good morning,</Text>
            <Text style={[styles.name, { color: colors.foreground }]}>{user?.name?.split(" ")[0]}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TouchableOpacity style={[styles.upgradePill, { backgroundColor: colors.accent + "20" }]}>
              <Feather name="star" size={12} color={colors.accent} />
              <Text style={[styles.upgradeText, { color: colors.accent }]}>Upgrade</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.avatarBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={showAccountMenu}>
              <Text style={[styles.avatarText, { color: colors.foreground }]}>{user?.name?.charAt(0) ?? "S"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.tourCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
          <View style={styles.tourCardLeft}>
            <Text style={styles.tourCardTitle}>The Daily Press{"\n"}Espresso Bar</Text>
            <Text style={styles.tourCardSub}>Active · Fitzroy VIC · $185K</Text>
            <View style={styles.tourMetrics}>
              <View style={styles.tourMetric}>
                <Text style={styles.tourMetricVal}>89%</Text>
                <Text style={styles.tourMetricLbl}>Tour completion</Text>
              </View>
              <View style={styles.tourMetric}>
                <Text style={styles.tourMetricVal}>4:32</Text>
                <Text style={styles.tourMetricLbl}>Avg tour time</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.tourBtn}
            onPress={() => router.push("/listing/listing-cafe-001" as any)}
          >
            <Feather name="rotate-ccw" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Performance — Last 30 Days</Text>
        <View style={styles.statsGrid}>
          {STATS.map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIcon, { backgroundColor: s.color + "18" }]}>
                <Feather name={s.icon as any} size={16} color={s.color} />
              </View>
              <Text style={[styles.statVal, { color: colors.foreground }]}>{s.value}</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{s.label}</Text>
              <Text style={[styles.statChange, { color: colors.accent }]}>{s.change}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Most Viewed Pins</Text>
        <View style={[styles.pinsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {TOP_PINS.map((pin, idx) => (
            <View
              key={pin.name}
              style={[
                styles.pinRow,
                idx < TOP_PINS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.pinRank, { color: colors.mutedForeground }]}>{idx + 1}</Text>
              <Text style={[styles.pinName, { color: colors.foreground }]} numberOfLines={1}>
                {pin.name}
              </Text>
              <Text style={[styles.pinViews, { color: colors.primary }]}>{pin.views}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/create-listing" as any)}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.createBtnText}>Create New Listing</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular" },
  name: { fontSize: 24, fontFamily: "Inter_700Bold" },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  upgradePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  upgradeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tourCard: {
    borderRadius: 16, padding: 18, borderWidth: 1,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  tourCardLeft: { flex: 1, gap: 6 },
  tourCardTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold", lineHeight: 24 },
  tourCardSub: { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  tourMetrics: { flexDirection: "row", gap: 20, marginTop: 8 },
  tourMetric: {},
  tourMetricVal: { color: "#3B82F6", fontSize: 20, fontFamily: "Inter_700Bold" },
  tourMetricLbl: { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular" },
  tourBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "31%", padding: 12, borderRadius: 14,
    borderWidth: 1, alignItems: "center", gap: 4,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statVal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  statChange: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  pinsCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  pinRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  pinRank: { fontSize: 12, fontFamily: "Inter_700Bold", width: 16 },
  pinName: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  pinViews: { fontSize: 13, fontFamily: "Inter_700Bold" },
  createBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  createBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
