import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const SELLER_PLANS = [
  { id: "starter", name: "Starter", price: "$29", period: "/month", features: ["Basic listing", "3 photos", "Email enquiries"], highlight: false },
  { id: "tour", name: "Tour Listing", price: "$79", period: "/month", features: ["360° tour (4 directions)", "5 interactive pins", "Analytics dashboard", "Message inbox"], highlight: true },
  { id: "pro", name: "Pro Seller", price: "$149", period: "/month", features: ["360° tour (8 directions)", "Unlimited pins", "Document uploads", "Full analytics", "Priority support"], highlight: false },
  { id: "premium", name: "Premium Exit Pack", price: "$299", period: "/month", features: ["Everything in Pro", "Featured listing", "AI listing tools", "Broker matching", "Advanced analytics"], highlight: false },
];

const BROKER_PLANS = [
  { id: "lite", name: "Broker Lite", price: "$99", period: "/month", features: ["Up to 3 listings", "Lead management", "Basic analytics"], highlight: false },
  { id: "growth", name: "Broker Growth", price: "$249", period: "/month", features: ["Up to 10 listings", "Team member (1)", "Lead routing", "Full analytics"], highlight: true },
  { id: "bpro", name: "Broker Pro", price: "$499", period: "/month", features: ["Up to 30 listings", "3 team members", "Branded profile page", "Priority listing placement"], highlight: false },
  { id: "enterprise", name: "Enterprise", price: "Custom", period: "", features: ["Unlimited listings", "Unlimited team", "Dedicated support", "Custom integrations"], highlight: false },
];

export default function PackagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"seller" | "broker">("seller");

  const plans = tab === "seller" ? SELLER_PLANS : BROKER_PLANS;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Plans & Pricing</Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
        {(["seller", "broker"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, { backgroundColor: tab === t ? colors.background : "transparent" }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.foreground : colors.mutedForeground }]}>
              {t === "seller" ? "Sellers" : "Brokers"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {plans.map((plan) => (
          <View
            key={plan.id}
            style={[
              styles.planCard,
              {
                backgroundColor: plan.highlight ? colors.primary : colors.card,
                borderColor: plan.highlight ? colors.primary : colors.border,
                borderWidth: plan.highlight ? 0 : 1,
              },
            ]}
          >
            {plan.highlight && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Most Popular</Text>
              </View>
            )}
            <Text style={[styles.planName, { color: plan.highlight ? "#fff" : colors.foreground }]}>{plan.name}</Text>
            <View style={styles.priceRow}>
              <Text style={[styles.planPrice, { color: plan.highlight ? "#fff" : colors.primary }]}>{plan.price}</Text>
              <Text style={[styles.planPeriod, { color: plan.highlight ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>{plan.period}</Text>
            </View>
            <View style={styles.featureList}>
              {plan.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Feather name="check" size={14} color={plan.highlight ? "#fff" : colors.accent} />
                  <Text style={[styles.featureText, { color: plan.highlight ? "rgba(255,255,255,0.9)" : colors.foreground }]}>{f}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={[styles.selectBtn, { backgroundColor: plan.highlight ? "#fff" : colors.primary }]}>
              <Text style={[styles.selectBtnText, { color: plan.highlight ? colors.primary : "#fff" }]}>
                {plan.price === "Custom" ? "Contact Sales" : "Get Started"}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  tabRow: { flexDirection: "row", margin: 16, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  scroll: { paddingHorizontal: 16, gap: 14 },
  planCard: { borderRadius: 16, padding: 20, gap: 14, position: "relative" },
  popularBadge: { position: "absolute", top: -10, right: 16, backgroundColor: "#F59E0B", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  popularText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  planName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  planPrice: { fontSize: 32, fontFamily: "Inter_700Bold" },
  planPeriod: { fontSize: 14, fontFamily: "Inter_400Regular" },
  featureList: { gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  selectBtn: { paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  selectBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
