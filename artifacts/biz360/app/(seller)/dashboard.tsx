import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getUsers, PendingListing, getPendingListings, saveUsers } from "@/lib/adminStore";

const STAT_ICONS: Record<string, string> = {
  "Listing Views":  "eye",
  "Tour Starts":    "rotate-ccw",
  "Unique Buyers":  "users",
  "Messages":       "message-circle",
  "Calls Clicked":  "phone",
  "Saved Count":    "bookmark",
};

const STAT_COLORS: Record<string, string> = {
  "Listing Views":  "#3B82F6",
  "Tour Starts":    "#8B5CF6",
  "Unique Buyers":  "#F59E0B",
  "Messages":       "#16A34A",
  "Calls Clicked":  "#EC4899",
  "Saved Count":    "#6366F1",
};

export default function SellerDashboard() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [listings, setListings] = useState<PendingListing[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      getPendingListings().then((all) => {
        setListings(all.filter((p) => p.submittedBy === user.id));
      });
    }, [user?.id]),
  );

  const featuredListing = listings.find((l) => l.status === "approved") ?? listings[0];

  const showAccountMenu = () => {
    Alert.alert(user?.name ?? "Account", user?.email ?? "", [
      {
        text: "Switch Account",
        onPress: () => router.replace("/(auth)/welcome" as any),
      },
      {
        text: "Delete Account & Data",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Delete Account",
            "This will permanently remove your account and all associated data. This cannot be undone.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete Account",
                style: "destructive",
                onPress: async () => {
                  try {
                    // Remove from admin users KV
                    const allUsers = await getUsers();
                    await saveUsers(allUsers.filter((u) => u.id !== user?.id && u.email !== user?.email));
                  } catch { /* non-critical */ }
                  await logout();
                  router.replace("/(auth)/welcome" as any);
                },
              },
            ],
          );
        },
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => { await logout(); router.replace("/(auth)/welcome" as any); },
      },
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
        {/* ── Header ── */}
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
            <TouchableOpacity
              style={[styles.avatarBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={showAccountMenu}
            >
              <Text style={[styles.avatarText, { color: colors.foreground }]}>{user?.name?.charAt(0) ?? "S"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Featured listing tour card ── */}
        {featuredListing ? (
          <View style={[styles.tourCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
            <View style={styles.tourCardLeft}>
              <Text style={styles.tourCardTitle}>{featuredListing.businessName ?? "My Listing"}</Text>
              <Text style={styles.tourCardSub}>
                {featuredListing.status === "approved" ? "Active" : featuredListing.status === "pending" ? "Pending review" : "Rejected"}
                {featuredListing.suburb ? ` · ${featuredListing.suburb}` : ""}
                {featuredListing.state  ? ` ${featuredListing.state}`    : ""}
                {featuredListing.askingPrice ? ` · $${(featuredListing.askingPrice / 1000).toFixed(0)}K` : ""}
              </Text>
              <View style={styles.tourMetrics}>
                <View style={styles.tourMetric}>
                  <Text style={styles.tourMetricVal}>—</Text>
                  <Text style={styles.tourMetricLbl}>Tour completion</Text>
                </View>
                <View style={styles.tourMetric}>
                  <Text style={styles.tourMetricVal}>—</Text>
                  <Text style={styles.tourMetricLbl}>Avg tour time</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.tourBtn}
              onPress={() => router.push("/(seller)/tours" as any)}
            >
              <Feather name="rotate-ccw" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          /* ── No listing yet ── */
          <View style={[styles.noListingCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
            <Feather name="plus-circle" size={24} color="#3B82F6" />
            <View style={{ flex: 1 }}>
              <Text style={styles.noListingTitle}>No listing yet</Text>
              <Text style={styles.noListingText}>Create your first listing to start receiving buyers.</Text>
            </View>
            <TouchableOpacity
              style={styles.noListingBtn}
              onPress={() => router.push("/create-listing" as any)}
            >
              <Text style={styles.noListingBtnText}>Create</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Performance stats ── */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Performance — Last 30 Days</Text>
        <View style={styles.statsGrid}>
          {Object.entries(STAT_ICONS).map(([label, icon]) => (
            <View key={label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIcon, { backgroundColor: STAT_COLORS[label] + "18" }]}>
                <Feather name={icon as any} size={16} color={STAT_COLORS[label]} />
              </View>
              <Text style={[styles.statVal, { color: colors.foreground }]}>—</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{label}</Text>
              <Text style={[styles.statChange, { color: colors.mutedForeground }]}>live soon</Text>
            </View>
          ))}
        </View>

        {/* ── Create listing CTA ── */}
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
  container:        { flex: 1 },
  scroll:           { paddingHorizontal: 16, gap: 16 },
  headerRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting:         { fontSize: 14, fontFamily: "Inter_400Regular" },
  name:             { fontSize: 24, fontFamily: "Inter_700Bold" },
  avatarBtn:        { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  avatarText:       { fontSize: 15, fontFamily: "Inter_700Bold" },
  upgradePill:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  upgradeText:      { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tourCard:         { borderRadius: 16, padding: 18, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  tourCardLeft:     { flex: 1, gap: 6 },
  tourCardTitle:    { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold", lineHeight: 24 },
  tourCardSub:      { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  tourMetrics:      { flexDirection: "row", gap: 20, marginTop: 8 },
  tourMetric:       {},
  tourMetricVal:    { color: "#3B82F6", fontSize: 20, fontFamily: "Inter_700Bold" },
  tourMetricLbl:    { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular" },
  tourBtn:          { width: 48, height: 48, borderRadius: 24, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" },
  noListingCard:    { borderRadius: 16, padding: 18, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  noListingTitle:   { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  noListingText:    { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  noListingBtn:     { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#2563EB", borderRadius: 12 },
  noListingBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionTitle:     { fontSize: 16, fontFamily: "Inter_700Bold" },
  statsGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard:         { width: "31%", padding: 12, borderRadius: 14, borderWidth: 1, alignItems: "center", gap: 4 },
  statIcon:         { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statVal:          { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLbl:          { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  statChange:       { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  createBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  createBtnText:    { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
