import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$99",
    period: "/mo",
    listings: 3,
    features: ["3 active listings", "Basic analytics", "Lead tracking", "Email support"],
    color: "#6B7280",
  },
  {
    id: "pro",
    name: "Broker Pro",
    price: "$249",
    period: "/mo",
    listings: 15,
    features: ["15 active listings", "360° tour builder", "Advanced analytics", "Priority support", "Co-broker network", "NDA management"],
    color: "#3B82F6",
    recommended: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$599",
    period: "/mo",
    listings: 999,
    features: ["Unlimited listings", "White-label tours", "Dedicated account manager", "API access", "Custom branding", "Multi-office support"],
    color: "#8B5CF6",
  },
];

const USAGE = [
  { label: "Active Listings", used: 2, max: 15, color: "#3B82F6" },
  { label: "Tour Views (this month)", used: 879, max: 5000, color: "#8B5CF6" },
  { label: "Lead Exports", used: 12, max: 100, color: "#16A34A" },
];

export default function BrokerBillingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [currentPlan] = useState("pro");

  const handleUpgrade = (planId: string) => {
    if (planId === currentPlan) return;
    Alert.alert(
      "Change Plan",
      `Switch to ${PLANS.find((p) => p.id === planId)?.name}? Changes take effect at the next billing cycle.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => Alert.alert("Plan Updated", "Your subscription has been updated.") },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Billing</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.currentCard, { backgroundColor: "#2563EB15", borderColor: "#3B82F6" }]}>
          <View style={styles.currentTop}>
            <View>
              <Text style={[styles.currentLabel, { color: colors.mutedForeground }]}>Current Plan</Text>
              <Text style={[styles.currentPlan, { color: colors.foreground }]}>Broker Pro</Text>
            </View>
            <View style={[styles.activeBadge, { backgroundColor: colors.accent + "20" }]}>
              <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.activeText, { color: colors.accent }]}>Active</Text>
            </View>
          </View>
          <Text style={[styles.renewText, { color: colors.mutedForeground }]}>Renews June 24, 2026 · $249/month</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Usage This Month</Text>
        {USAGE.map(({ label, used, max, color: barColor }) => (
          <View key={label} style={[styles.usageRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.usageTop}>
              <Text style={[styles.usageLabel, { color: colors.foreground }]}>{label}</Text>
              <Text style={[styles.usageCount, { color: colors.mutedForeground }]}>{used.toLocaleString()} / {max === 999 ? "∞" : max.toLocaleString()}</Text>
            </View>
            <View style={[styles.usageTrack, { backgroundColor: colors.muted }]}>
              <View style={[styles.usageBar, { backgroundColor: barColor, width: `${Math.min((used / max) * 100, 100)}%` as any }]} />
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Plans</Text>
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <View key={plan.id} style={[styles.planCard, { backgroundColor: colors.card, borderColor: isCurrent ? plan.color : colors.border, borderWidth: isCurrent ? 2 : 1 }]}>
              {plan.recommended && (
                <View style={[styles.recommendedBadge, { backgroundColor: plan.color }]}>
                  <Text style={styles.recommendedText}>RECOMMENDED</Text>
                </View>
              )}
              <View style={styles.planTop}>
                <View style={[styles.planColorDot, { backgroundColor: plan.color }]} />
                <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
                <View style={styles.planPriceRow}>
                  <Text style={[styles.planPrice, { color: colors.foreground }]}>{plan.price}</Text>
                  <Text style={[styles.planPeriod, { color: colors.mutedForeground }]}>{plan.period}</Text>
                </View>
              </View>
              <View style={styles.featureList}>
                {plan.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Feather name="check" size={14} color={plan.color} />
                    <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.planBtn, { backgroundColor: isCurrent ? colors.muted : plan.color }]}
                onPress={() => handleUpgrade(plan.id)}
              >
                <Text style={[styles.planBtnText, { color: isCurrent ? colors.mutedForeground : "#fff" }]}>
                  {isCurrent ? "Current Plan" : plan.id === "starter" ? "Downgrade" : "Upgrade"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity style={[styles.invoiceRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="file-text" size={18} color={colors.primary} />
          <Text style={[styles.invoiceText, { color: colors.foreground }]}>Download Invoices</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.invoiceRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="credit-card" size={18} color={colors.primary} />
          <Text style={[styles.invoiceText, { color: colors.foreground }]}>Manage Payment Method</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  scroll: { padding: 16, gap: 14 },
  currentCard: { borderRadius: 16, borderWidth: 2, padding: 16, gap: 6 },
  currentTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  currentLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  currentPlan: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 2 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  renewText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  usageRow: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  usageTop: { flexDirection: "row", justifyContent: "space-between" },
  usageLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  usageCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  usageTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  usageBar: { height: 6, borderRadius: 3 },
  planCard: { borderRadius: 16, padding: 16, gap: 14, overflow: "hidden" },
  recommendedBadge: { position: "absolute", top: 0, right: 0, paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 10 },
  recommendedText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  planTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  planColorDot: { width: 10, height: 10, borderRadius: 5 },
  planName: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold" },
  planPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  planPrice: { fontSize: 22, fontFamily: "Inter_700Bold" },
  planPeriod: { fontSize: 13, fontFamily: "Inter_400Regular" },
  featureList: { gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  planBtn: { paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  planBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  invoiceRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  invoiceText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
});
