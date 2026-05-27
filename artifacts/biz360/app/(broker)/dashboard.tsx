import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { DEMO_LISTINGS, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { formatLeadTime, useLeads } from "@/lib/brokerStore";

const BROKER_LISTINGS = [DEMO_LISTINGS[3], DEMO_LISTINGS[4]];

const QC_COLOR: Record<string, string> = { hot: "#EF4444", warm: "#F59E0B", cold: "#3B82F6" };

export default function BrokerDashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { leads } = useLeads();

  const totalLeads   = leads.length;
  const totalViews   = BROKER_LISTINGS.reduce((s, l) => s + l.viewCount, 0);
  const totalTours   = BROKER_LISTINGS.reduce((s, l) => s + l.tourStarts, 0);
  const portfolioVal = BROKER_LISTINGS.reduce((s, l) => s + l.askingPrice, 0);

  const portfolioStats = [
    { label: "Active Listings", value: String(BROKER_LISTINGS.length), icon: "briefcase",   color: "#3B82F6" },
    { label: "Total Leads",     value: String(totalLeads),             icon: "users",        color: "#F59E0B" },
    { label: "Tour Starts",     value: String(totalTours),             icon: "rotate-ccw",   color: "#8B5CF6" },
    { label: "Portfolio Value", value: formatPrice(portfolioVal),      icon: "dollar-sign",  color: "#16A34A" },
  ];

  const recentLeads = [...leads]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 4);

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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.firmName, { color: colors.mutedForeground }]}>Premium Business Brokers</Text>
            <Text style={[styles.name, { color: colors.foreground }]}>{user?.name?.split(" ")[0]}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <View style={[styles.planBadge, { backgroundColor: "#2563EB" }]}>
              <Text style={styles.planText}>Broker Pro</Text>
            </View>
            <TouchableOpacity style={[styles.avatarBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={showAccountMenu}>
              <Text style={[styles.avatarText, { color: colors.foreground }]}>{user?.name?.charAt(0) ?? "B"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {portfolioStats.map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIcon, { backgroundColor: s.color + "18" }]}>
                <Feather name={s.icon as any} size={16} color={s.color} />
              </View>
              <Text style={[styles.statVal, { color: colors.foreground }]}>{s.value}</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Active Listings</Text>
          <TouchableOpacity onPress={() => router.push("/(broker)/listings" as any)}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>

        {BROKER_LISTINGS.map((l) => (
          <TouchableOpacity
            key={l.id}
            style={[styles.listingRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/listing/${l.id}` as any)}
          >
            <View style={[styles.listingHero, { backgroundColor: l.heroColor }]}>
              <Feather name="briefcase" size={20} color="#fff" />
            </View>
            <View style={styles.listingInfo}>
              <Text style={[styles.listingName, { color: colors.foreground }]} numberOfLines={1}>{l.businessName}</Text>
              <Text style={[styles.listingMeta, { color: colors.mutedForeground }]}>{l.suburb} · {formatPrice(l.askingPrice)}</Text>
              <Text style={[styles.listingViews, { color: colors.primary }]}>{l.viewCount} views · {l.savedCount} saved</Text>
            </View>
            <View style={[styles.confidentialTag, { backgroundColor: l.confidential ? "#F59E0B20" : "#16A34A20" }]}>
              <Text style={[styles.confidentialText, { color: l.confidential ? "#F59E0B" : "#16A34A" }]}>
                {l.confidential ? "Private" : "Public"}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Leads</Text>
          <TouchableOpacity onPress={() => router.push("/(broker)/leads" as any)}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>

        {recentLeads.length === 0 ? (
          <View style={[styles.emptyLeads, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyLeadsText, { color: colors.mutedForeground }]}>No leads yet. Listings will generate leads as buyers engage.</Text>
          </View>
        ) : (
          recentLeads.map((lead) => (
            <TouchableOpacity
              key={lead.id}
              style={[styles.leadRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(broker)/leads" as any)}
            >
              <View style={[styles.leadDot, { backgroundColor: QC_COLOR[lead.quality] }]} />
              <View style={styles.leadInfo}>
                <Text style={[styles.leadName, { color: colors.foreground }]}>{lead.name}</Text>
                <Text style={[styles.leadListing, { color: colors.mutedForeground }]}>{lead.listing} · {lead.action}</Text>
              </View>
              <Text style={[styles.leadTime, { color: colors.mutedForeground }]}>{formatLeadTime(lead.timestamp)}</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, gap: 14 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  firmName: { fontSize: 12, fontFamily: "Inter_500Medium" },
  name: { fontSize: 24, fontFamily: "Inter_700Bold" },
  planBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  planText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", padding: 14, borderRadius: 14, borderWidth: 1, gap: 6 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statVal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  listingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  listingHero: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  listingInfo: { flex: 1 },
  listingName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  listingMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  listingViews: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  confidentialTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  confidentialText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  leadRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  leadDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  leadInfo: { flex: 1 },
  leadName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  leadListing: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  leadTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyLeads: { padding: 16, borderRadius: 12, borderWidth: 1 },
  emptyLeadsText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
});
