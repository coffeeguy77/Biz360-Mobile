import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEMO_USERS, useAuth } from "@/context/AuthContext";
import { formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { getBrokers, getPendingListings, PendingListing } from "@/lib/adminStore";
import { aggregateAnalytics, getMultiAnalytics, ListingAnalytics } from "@/lib/analyticsStore";
import { formatLeadTime, useLeads } from "@/lib/brokerStore";

const QC_COLOR: Record<string, string> = { hot: "#EF4444", warm: "#F59E0B", cold: "#3B82F6" };

const PLAN_COLORS: Record<string, string> = {
  "Broker Lite":   "#0891B2",
  "Broker Growth": "#7C3AED",
  "Broker Pro":    "#2563EB",
};

export default function BrokerDashboard() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user, realUser, logout, login, restoreReal } = useAuth();
  const { leads } = useLeads();

  const [myListings, setMyListings]       = useState<PendingListing[]>([]);
  const [analytics,  setAnalytics]        = useState<Record<string, ListingAnalytics>>({});
  const [firmName,   setFirmName]         = useState<string>("");
  const [plan,       setPlan]             = useState<string>("");
  const [loadingData, setLoadingData]     = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoadingData(true);

      (async () => {
        try {
          const [allListings, allBrokers] = await Promise.all([
            getPendingListings(),
            getBrokers(),
          ]);

          // My listings = submitted by me
          const mine    = allListings.filter((l) => l.submittedBy === user?.id);
          const approved = mine.filter((l) => l.status === "approved");

          // Fetch analytics for all approved listings in parallel
          const approvedIds = approved.map((l) => l.listingId).filter(Boolean);
          const analyticsMap = approvedIds.length > 0
            ? await getMultiAnalytics(approvedIds)
            : {};

          // Match broker record by user name (demo accounts) or user id
          const brokerRecord =
            allBrokers.find((b) => b.id === user?.id) ??
            allBrokers.find((b) => b.name.toLowerCase() === user?.name?.toLowerCase());

          if (active) {
            setMyListings(mine);
            setAnalytics(analyticsMap);
            setFirmName(brokerRecord?.firm ?? user?.displayName ?? "");
            setPlan(brokerRecord?.plan ?? "");
            setLoadingData(false);
          }
        } catch {
          if (active) setLoadingData(false);
        }
      })();

      return () => { active = false; };
    }, [user?.id, user?.name, user?.displayName]),
  );

  const approvedListings = myListings.filter((l) => l.status === "approved");
  const totalAnalytics   = aggregateAnalytics(approvedListings.map((l) => analytics[l.listingId] ?? {
    views: 0, uniqueBuyerIds: [], tourStarts: 0, messages: 0, callsClicked: 0, savedCount: 0, lastUpdated: 0,
  }));

  const portfolioVal = approvedListings.reduce((s, l) => s + (l.askingPrice ?? 0), 0);

  const portfolioStats = [
    { label: "Active Listings", value: String(approvedListings.length), icon: "briefcase",  color: "#3B82F6" },
    { label: "Total Leads",     value: String(leads.length),             icon: "users",       color: "#F59E0B" },
    { label: "Tour Starts",     value: String(totalAnalytics.tourStarts),icon: "rotate-ccw",  color: "#8B5CF6" },
    { label: "Portfolio Value", value: portfolioVal > 0 ? formatPrice(portfolioVal) : "$0", icon: "dollar-sign", color: "#16A34A" },
  ];

  const recentLeads = [...leads]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 4);

  const showAccountMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(user?.name ?? "Account", user?.email ?? "", [
      ...(realUser?.email === "+61414631463" ? [{ text: "Switch Account", onPress: () => Alert.alert("Switch Role", "Choose a demo account to test with:", [
          { text: "Buyer",     onPress: async () => { await login(DEMO_USERS.buyer);  router.replace("/(tabs)/discover" as any); } },
          { text: "My Seller", onPress: async () => { await restoreReal();             router.replace("/(seller)/dashboard" as any); } },
          { text: "Broker",    onPress: async () => { await login(DEMO_USERS.broker); router.replace("/(broker)/dashboard" as any); } },
          { text: "Admin",     onPress: async () => { await login(DEMO_USERS.admin);  router.replace("/(admin)/listings" as any); } },
          { text: "Cancel", style: "cancel" },
        ]) }] : []),
      { text: "Sign Out", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/welcome" as any); } },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const planColor = plan ? (PLAN_COLORS[plan] ?? "#2563EB") : "#2563EB";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            {firmName ? (
              <Text style={[styles.firmName, { color: colors.mutedForeground }]}>{firmName}</Text>
            ) : null}
            <Text style={[styles.name, { color: colors.foreground }]}>{user?.name?.split(" ")[0]}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {plan ? (
              <View style={[styles.planBadge, { backgroundColor: planColor }]}>
                <Text style={styles.planText}>{plan}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.avatarBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={showAccountMenu}
            >
              <Text style={[styles.avatarText, { color: colors.foreground }]}>{user?.name?.charAt(0) ?? "B"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats grid */}
        {loadingData ? (
          <View style={[styles.statsGrid, { justifyContent: "center", alignItems: "center", minHeight: 130 }]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
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
        )}

        {/* Active Listings */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Active Listings</Text>
          <TouchableOpacity onPress={() => router.push("/(broker)/listings" as any)}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>

        {loadingData ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : approvedListings.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyBoxText, { color: colors.mutedForeground }]}>
              No active listings yet. Submit a listing to get started.
            </Text>
          </View>
        ) : (
          approvedListings.slice(0, 3).map((l) => {
            const a      = analytics[l.listingId];
            const views  = a?.views      ?? 0;
            const saved  = a?.savedCount ?? 0;
            return (
              <TouchableOpacity
                key={l.id}
                style={[styles.listingRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/listing/${l.listingId}` as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.listingHero, { backgroundColor: l.heroColor ?? "#2563EB" }]}>
                  <Feather name="briefcase" size={20} color="#fff" />
                </View>
                <View style={styles.listingInfo}>
                  <Text style={[styles.listingName, { color: colors.foreground }]} numberOfLines={1}>
                    {l.businessName ?? "Unnamed Listing"}
                  </Text>
                  <Text style={[styles.listingMeta, { color: colors.mutedForeground }]}>
                    {[l.suburb, l.state].filter(Boolean).join(", ")}{l.askingPrice ? ` · ${formatPrice(l.askingPrice)}` : ""}
                  </Text>
                  <Text style={[styles.listingViews, { color: colors.primary }]}>
                    {views} views · {saved} saved
                  </Text>
                </View>
                <View style={[styles.confidentialTag, { backgroundColor: l.confidential ? "#F59E0B20" : "#16A34A20" }]}>
                  <Text style={[styles.confidentialText, { color: l.confidential ? "#F59E0B" : "#16A34A" }]}>
                    {l.confidential ? "Private" : "Public"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Pending listings note */}
        {!loadingData && myListings.some((l) => l.status === "pending") && (
          <View style={[styles.pendingNote, { backgroundColor: "#F59E0B12", borderColor: "#F59E0B30" }]}>
            <Feather name="clock" size={13} color="#F59E0B" />
            <Text style={[styles.pendingNoteText, { color: "#F59E0B" }]}>
              {myListings.filter((l) => l.status === "pending").length} listing{myListings.filter((l) => l.status === "pending").length !== 1 ? "s" : ""} awaiting admin review
            </Text>
          </View>
        )}

        {/* Recent Leads */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Leads</Text>
          <TouchableOpacity onPress={() => router.push("/(broker)/leads" as any)}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>

        {recentLeads.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyBoxText, { color: colors.mutedForeground }]}>
              No leads yet. Listings will generate leads as buyers engage.
            </Text>
          </View>
        ) : (
          recentLeads.map((lead) => (
            <TouchableOpacity
              key={lead.id}
              style={[styles.leadRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(broker)/leads" as any)}
              activeOpacity={0.7}
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

        {/* Wiki / Help */}
        <TouchableOpacity
          style={[styles.wikiCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}
          onPress={() => router.push("/wiki" as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.wikiIcon, { backgroundColor: "#3B82F620" }]}>
            <Feather name="book-open" size={18} color="#3B82F6" />
          </View>
          <View style={styles.wikiBody}>
            <Text style={[styles.wikiTitle, { color: "#fff" }]}>Help & Wiki</Text>
            <Text style={[styles.wikiSub, { color: "rgba(255,255,255,0.55)" }]}>Platform manual, feature guides, and troubleshooting</Text>
          </View>
          <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  scroll:            { paddingHorizontal: 16, gap: 14 },
  headerRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  firmName:          { fontSize: 12, fontFamily: "Inter_500Medium" },
  name:              { fontSize: 24, fontFamily: "Inter_700Bold" },
  planBadge:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  planText:          { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  avatarBtn:         { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  avatarText:        { fontSize: 15, fontFamily: "Inter_700Bold" },
  statsGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard:          { width: "47%", padding: 14, borderRadius: 14, borderWidth: 1, gap: 6 },
  statIcon:          { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statVal:           { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLbl:           { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle:      { fontSize: 16, fontFamily: "Inter_700Bold" },
  seeAll:            { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyBox:          { padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  emptyBoxText:      { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  listingRow:        { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  listingHero:       { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  listingInfo:       { flex: 1 },
  listingName:       { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  listingMeta:       { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  listingViews:      { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  confidentialTag:   { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  confidentialText:  { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  pendingNote:       { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  pendingNoteText:   { fontSize: 12, fontFamily: "Inter_500Medium" },
  leadRow:           { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  leadDot:           { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  leadInfo:          { flex: 1 },
  leadName:          { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  leadListing:       { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  leadTime:          { fontSize: 11, fontFamily: "Inter_400Regular" },
  wikiCard:          { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  wikiIcon:          { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  wikiBody:          { flex: 1, gap: 2 },
  wikiTitle:         { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  wikiSub:           { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
