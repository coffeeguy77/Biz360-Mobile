import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert, ActivityIndicator, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEMO_USERS, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getUsers, isMySubmission, PendingListing, getPendingListings, saveUsers } from "@/lib/adminStore";
import { aggregateAnalytics, getMultiAnalytics, ListingAnalytics } from "@/lib/analyticsStore";
import { useValuation } from "@/context/ValuationContext";

function formatValuation(val: string | number | null | undefined): string {
  const n = Number(val ?? 0);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

// ─── Plan definitions ──────────────────────────────────────────────────────────

interface Plan {
  id:       "free" | "pro" | "business";
  name:     string;
  price:    string;
  period:   string;
  badge?:   string;
  color:    string;
  features: string[];
  cta:      string;
}

const PLANS: Plan[] = [
  {
    id:      "free",
    name:    "Free",
    price:   "$0",
    period:  "forever",
    color:   "#4B5563",
    cta:     "Current Plan",
    features: [
      "1 active listing",
      "Basic buyer analytics",
      "Up to 5 photos per listing",
      "Standard search placement",
      "Community support",
    ],
  },
  {
    id:      "pro",
    name:    "Pro",
    price:   "$49",
    period:  "/ month",
    badge:   "MOST POPULAR",
    color:   "#3B82F6",
    cta:     "Upgrade to Pro",
    features: [
      "Up to 3 active listings",
      "Full buyer analytics & insights",
      "Unlimited photos + 360° tours",
      "Priority search placement",
      "Buyer lead notifications",
      "Email & chat support",
    ],
  },
  {
    id:      "business",
    name:    "Business",
    price:   "$149",
    period:  "/ month",
    color:   "#8B5CF6",
    cta:     "Upgrade to Business",
    features: [
      "Unlimited active listings",
      "Advanced analytics & lead scoring",
      "Dedicated account manager",
      "Featured homepage placement",
      "Branded PDF reports",
      "Priority broker matching",
      "White-label buyer portal",
    ],
  },
];

// ─── Stat config ───────────────────────────────────────────────────────────────

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

// ─── Upgrade Modal ─────────────────────────────────────────────────────────────

function UpgradeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Plan["id"]>("pro");

  const handleSelect = (plan: Plan) => {
    if (plan.id === "free") return; // already on free
    setSelected(plan.id);
    Alert.alert(
      `Upgrade to ${plan.name}`,
      `You'll be charged ${plan.price}/month. This is a demo — no actual payment will be processed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Upgrade",
          onPress: () => {
            onClose();
            Alert.alert("Plan Upgraded! 🎉", `You're now on the ${plan.name} plan. Enjoy your new features!`);
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
        {/* Handle bar */}
        <View style={styles.modalHandle} />

        {/* Header */}
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>Choose Your Plan</Text>
            <Text style={styles.modalSub}>Unlock more listings, analytics & support</Text>
          </View>
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Feather name="x" size={18} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        {/* Plan cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.plansRow}
          decelerationRate="fast"
          snapToInterval={PLAN_CARD_W + 12}
          snapToAlignment="start"
        >
          {PLANS.map((plan) => {
            const isActive = plan.id === "free";
            const isSelected = plan.id === selected && plan.id !== "free";
            return (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  { borderColor: isSelected ? plan.color : isActive ? "#374151" : "#1E3A5C" },
                  isSelected && { backgroundColor: plan.color + "14" },
                ]}
                onPress={() => handleSelect(plan)}
                activeOpacity={isActive ? 1 : 0.8}
              >
                {/* Badge */}
                {plan.badge ? (
                  <View style={[styles.planBadge, { backgroundColor: plan.color }]}>
                    <Text style={styles.planBadgeText}>{plan.badge}</Text>
                  </View>
                ) : isActive ? (
                  <View style={[styles.planBadge, { backgroundColor: "#374151" }]}>
                    <Text style={styles.planBadgeText}>CURRENT PLAN</Text>
                  </View>
                ) : null}

                {/* Name + price */}
                <Text style={[styles.planName, { color: isActive ? "#9CA3AF" : "#fff" }]}>{plan.name}</Text>
                <View style={styles.planPriceRow}>
                  <Text style={[styles.planPrice, { color: isActive ? "#9CA3AF" : plan.color }]}>{plan.price}</Text>
                  <Text style={[styles.planPeriod, { color: "#6B7280" }]}>{plan.period}</Text>
                </View>

                {/* Divider */}
                <View style={[styles.planDivider, { backgroundColor: isActive ? "#374151" : "#1E3A5C" }]} />

                {/* Features */}
                {plan.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Feather name="check" size={12} color={isActive ? "#6B7280" : plan.color} />
                    <Text style={[styles.featureText, { color: isActive ? "#6B7280" : "#D1D5DB" }]}>{f}</Text>
                  </View>
                ))}

                {/* CTA */}
                <TouchableOpacity
                  style={[
                    styles.planCta,
                    {
                      backgroundColor: isActive ? "#374151" : plan.color,
                      marginTop: "auto" as any,
                    },
                  ]}
                  onPress={() => handleSelect(plan)}
                  disabled={isActive}
                >
                  <Text style={[styles.planCtaText, { color: isActive ? "#6B7280" : "#fff" }]}>
                    {plan.cta}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Footer note */}
        <Text style={styles.modalFooter}>Cancel anytime · No contracts · GST included</Text>
      </View>
    </Modal>
  );
}

const PLAN_CARD_W = 220;

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export default function SellerDashboard() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user, realUser, logout, login, restoreReal } = useAuth();

  const [listings,          setListings]          = useState<PendingListing[]>([]);
  const [analytics,         setAnalytics]         = useState<ListingAnalytics | null>(null);
  const [featuredAnalytics, setFeaturedAnalytics] = useState<ListingAnalytics | null>(null);
  const [analyticsLoading,  setAnalyticsLoading]  = useState(true);
  const [upgradeVisible,    setUpgradeVisible]    = useState(false);

  const { selectedCafe, latestSnapshot, fetchCafes, fetchSnapshot, authToken } = useValuation();
  const valMidpoint = latestSnapshot.combined?.valuationMidpoint;

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      setAnalyticsLoading(true);

      getPendingListings().then(async (all) => {
        const mine = all.filter((p) => isMySubmission(p.submittedBy, user.id));
        setListings(mine);

        if (mine.length === 0) {
          setAnalytics(aggregateAnalytics([]));
          setFeaturedAnalytics(null);
          setAnalyticsLoading(false);
          return;
        }

        const ids = mine.map((p) => p.listingId);
        const map = await getMultiAnalytics(ids);

        setAnalytics(aggregateAnalytics(Object.values(map)));

        const featured = mine.find((l) => l.status === "approved") ?? mine[0];
        setFeaturedAnalytics(map[featured.listingId] ?? null);

        setAnalyticsLoading(false);
      });

      // Refresh valuation snapshot on focus
      if (authToken) {
        fetchCafes().then((cafes) => { if (cafes.length > 0) fetchSnapshot(); });
      }
    }, [user?.id, authToken]),
  );

  const featuredListing = listings.find((l) => l.status === "approved") ?? listings[0];

  const statValue = (label: string): string => {
    if (analyticsLoading) return "…";
    if (!analytics) return "0";
    switch (label) {
      case "Listing Views":  return String(analytics.views);
      case "Tour Starts":    return String(analytics.tourStarts);
      case "Unique Buyers":  return String(analytics.uniqueBuyerIds.length);
      case "Messages":       return String(analytics.messages);
      case "Calls Clicked":  return String(analytics.callsClicked);
      case "Saved Count":    return String(analytics.savedCount);
      default:               return "0";
    }
  };

  const showAccountMenu = () => {
    Alert.alert(user?.name ?? "Account", user?.email ?? "", [
      ...(realUser?.email === "+61414631463" ? [{ text: "Switch Account", onPress: () => Alert.alert("Switch Role", "Choose a demo account to test with:", [
          { text: "Buyer",     onPress: async () => { await login(DEMO_USERS.buyer);  router.replace("/(tabs)/discover" as any); } },
          { text: "My Seller", onPress: async () => { await restoreReal();             router.replace("/(seller)/dashboard" as any); } },
          { text: "Broker",    onPress: async () => { await login(DEMO_USERS.broker); router.replace("/(broker)/dashboard" as any); } },
          { text: "Admin",     onPress: async () => { await login(DEMO_USERS.admin);  router.replace("/(admin)/listings" as any); } },
          { text: "Cancel", style: "cancel" },
        ]) }] : []),
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
            <TouchableOpacity
              style={[styles.upgradePill, { backgroundColor: "#16A34A20" }]}
              onPress={() => setUpgradeVisible(true)}
              activeOpacity={0.75}
            >
              <Feather name="zap" size={12} color="#16A34A" />
              <Text style={[styles.upgradeText, { color: "#16A34A" }]}>Upgrade</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.avatarBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={showAccountMenu}
            >
              <Text style={[styles.avatarText, { color: colors.foreground }]}>{user?.name?.charAt(0) ?? "S"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Featured listing card ── */}
        {featuredListing ? (
          <TouchableOpacity
            style={[styles.tourCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}
            onPress={() => router.push("/(seller)/listings" as any)}
            activeOpacity={0.85}
          >
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
                  {analyticsLoading ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <Text style={styles.tourMetricVal}>{featuredAnalytics?.views ?? 0}</Text>
                  )}
                  <Text style={styles.tourMetricLbl}>Total views</Text>
                </View>
                <View style={styles.tourMetric}>
                  {analyticsLoading ? (
                    <ActivityIndicator size="small" color="#3B82F6" />
                  ) : (
                    <Text style={styles.tourMetricVal}>{featuredAnalytics?.uniqueBuyerIds.length ?? 0}</Text>
                  )}
                  <Text style={styles.tourMetricLbl}>Unique buyers</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.tourBtn}
              onPress={(e) => { e.stopPropagation(); router.push("/(seller)/tours" as any); }}
            >
              <Feather name="rotate-ccw" size={20} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
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
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Performance — Last 30 Days</Text>
          {analyticsLoading && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
        <View style={styles.statsGrid}>
          {Object.entries(STAT_ICONS).map(([label, icon]) => {
            const val    = statValue(label);
            const isLive = !analyticsLoading && analytics !== null;
            return (
              <View key={label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: STAT_COLORS[label] + "18" }]}>
                  <Feather name={icon as any} size={16} color={STAT_COLORS[label]} />
                </View>
                <Text style={[styles.statVal, { color: colors.foreground }]}>{val}</Text>
                <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{label}</Text>
                <Text style={[styles.statChange, { color: isLive ? "#16A34A" : colors.mutedForeground }]}>
                  {isLive ? "all time" : "loading…"}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Valuation card ── */}
        <TouchableOpacity
          style={[styles.valuationCard, { backgroundColor: "#0F1F35", borderColor: "#1E3A5C" }]}
          onPress={() => {
            const lid = featuredListing?.listingId;
            router.push(`/(seller)/valuation${lid ? `?listingId=${lid}` : ""}` as any);
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.valuationIconWrap, { backgroundColor: "#2563EB20" }]}>
            <Feather name="trending-up" size={22} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.valuationTitle}>
              {selectedCafe?.name ?? "Business Valuation"}
            </Text>
            {valMidpoint != null && Number(valMidpoint) > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                <Text style={{ color: "#3B82F6", fontSize: 20, fontFamily: "Inter_700Bold" }}>
                  {formatValuation(valMidpoint)}
                </Text>
                <Text style={[styles.valuationSub, { marginTop: 0 }]}>est. value</Text>
              </View>
            ) : (
              <Text style={styles.valuationSub}>Not yet synced · Tap to set up</Text>
            )}
          </View>
          <Feather name="chevron-right" size={18} color="#8B9CB8" />
        </TouchableOpacity>

        {/* ── Listings quick action ── */}
        <TouchableOpacity
          style={[styles.listingsCard, { backgroundColor: "#0F1F35", borderColor: "#1E3A5C" }]}
          onPress={() => router.push("/(seller)/listings" as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.listingsIconWrap, { backgroundColor: "#3B82F620" }]}>
            <Feather name="list" size={22} color="#3B82F6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.listingsTitle}>My Listings</Text>
            <Text style={styles.listingsSub}>
              {listings.length > 0 ? `${listings.length} listing${listings.length !== 1 ? "s" : ""}` : "No listings yet"}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color="#8B9CB8" />
        </TouchableOpacity>

        {/* ── Create listing CTA ── */}
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/create-listing" as any)}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.createBtnText}>Create New Listing</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Upgrade modal ── */}
      <UpgradeModal visible={upgradeVisible} onClose={() => setUpgradeVisible(false)} />
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
  tourMetric:       { minHeight: 36, justifyContent: "flex-end" },
  tourMetricVal:    { color: "#3B82F6", fontSize: 20, fontFamily: "Inter_700Bold" },
  tourMetricLbl:    { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular" },
  tourBtn:          { width: 48, height: 48, borderRadius: 24, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" },
  noListingCard:    { borderRadius: 16, padding: 18, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  noListingTitle:   { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  noListingText:    { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  noListingBtn:     { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#2563EB", borderRadius: 12 },
  noListingBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionHeader:    { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle:     { fontSize: 16, fontFamily: "Inter_700Bold", flex: 1 },
  statsGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard:         { width: "31%", padding: 12, borderRadius: 14, borderWidth: 1, alignItems: "center", gap: 4 },
  statIcon:         { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statVal:          { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLbl:          { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  statChange:       { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  createBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  createBtnText:    { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  valuationCard:    { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, padding: 18, borderWidth: 1 },
  valuationIconWrap:{ width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  valuationTitle:   { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  valuationSub:     { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  listingsCard:     { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, padding: 18, borderWidth: 1 },
  listingsIconWrap: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  listingsTitle:    { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  listingsSub:      { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  // ── Modal ──
  modalBackdrop:    { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.65)" },
  modalSheet: {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: "#0D1F38",
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingTop:      12,
    borderTopWidth:  1,
    borderColor:     "#1E3A5C",
  },
  modalHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: "#2D4A6A", alignSelf: "center", marginBottom: 16 },
  modalHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, marginBottom: 20 },
  modalTitle:    { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  modalSub:      { color: "#8B9CB8", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 3 },
  modalClose:    { width: 32, height: 32, borderRadius: 16, backgroundColor: "#1E3A5C", alignItems: "center", justifyContent: "center" },
  plansRow:      { paddingHorizontal: 20, gap: 12, paddingBottom: 8 },
  planCard: {
    width:           PLAN_CARD_W,
    backgroundColor: "#0F2040",
    borderRadius:    18,
    borderWidth:     1.5,
    padding:         18,
    gap:             8,
    minHeight:       340,
  },
  planBadge:     { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  planBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  planName:      { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 4 },
  planPriceRow:  { flexDirection: "row", alignItems: "baseline", gap: 4 },
  planPrice:     { fontSize: 28, fontFamily: "Inter_700Bold" },
  planPeriod:    { fontSize: 13, fontFamily: "Inter_400Regular" },
  planDivider:   { height: 1, marginVertical: 4 },
  featureRow:    { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  featureText:   { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  planCta:       { paddingVertical: 12, borderRadius: 12, alignItems: "center", marginTop: 12 },
  planCtaText:   { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  modalFooter:   { textAlign: "center", color: "#4B5563", fontSize: 11, fontFamily: "Inter_400Regular", paddingVertical: 12, paddingHorizontal: 20 },
});
