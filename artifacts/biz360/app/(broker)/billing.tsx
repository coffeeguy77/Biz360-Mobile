import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  AdminBroker,
  getBrokers,
  getPendingListings,
  PLAN_PRICES,
  saveBrokers,
} from "@/lib/adminStore";
import { aggregateAnalytics, getMultiAnalytics } from "@/lib/analyticsStore";
import { getLeads } from "@/lib/brokerStore";

// ─── Plan catalogue ───────────────────────────────────────────────────────────

interface PlanDef {
  name: string;
  price: number;
  listingLimit: number;
  tourViewLimit: number;
  leadExportLimit: number;
  features: string[];
  color: string;
  recommended?: boolean;
}

const PLAN_CATALOGUE: PlanDef[] = [
  {
    name: "Broker Lite",
    price: PLAN_PRICES["Broker Lite"] ?? 149,
    listingLimit: 3,
    tourViewLimit: 1000,
    leadExportLimit: 20,
    features: ["3 active listings", "Basic analytics", "Lead tracking", "Email support"],
    color: "#0891B2",
  },
  {
    name: "Broker Growth",
    price: PLAN_PRICES["Broker Growth"] ?? 249,
    listingLimit: 8,
    tourViewLimit: 2500,
    leadExportLimit: 50,
    features: ["8 active listings", "360° tour builder", "Advanced analytics", "Priority support", "Co-broker network"],
    color: "#7C3AED",
    recommended: true,
  },
  {
    name: "Broker Pro",
    price: PLAN_PRICES["Broker Pro"] ?? 499,
    listingLimit: 15,
    tourViewLimit: 5000,
    leadExportLimit: 100,
    features: ["15 active listings", "360° tour builder", "Advanced analytics", "Priority support", "Co-broker network", "NDA management", "API access"],
    color: "#2563EB",
  },
];

// ─── Mock invoice history ─────────────────────────────────────────────────────

function buildInvoices(planPrice: number) {
  const now   = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return [0, 1, 2].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return {
      id:     `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`,
      label:  `${months[d.getMonth()]} ${d.getFullYear()}`,
      amount: `$${planPrice.toLocaleString()}.00`,
      status: offset === 0 ? "Upcoming" : "Paid",
    };
  });
}

// ─── Renewal date helper ──────────────────────────────────────────────────────

function nextRenewal(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function BrokerBillingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [brokerRecord,    setBrokerRecord]    = useState<AdminBroker | null>(null);
  const [activeCount,     setActiveCount]     = useState(0);
  const [tourViews,       setTourViews]       = useState(0);
  const [leadCount,       setLeadCount]       = useState(0);
  const [loading,         setLoading]         = useState(true);
  const [changingPlan,    setChangingPlan]    = useState(false);
  const [showInvoices,    setShowInvoices]    = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);

      (async () => {
        try {
          const [allListings, allBrokers, allLeads] = await Promise.all([
            getPendingListings(),
            getBrokers(),
            getLeads(),
          ]);

          const mine    = allListings.filter((l) => l.submittedBy === user?.id);
          const approved = mine.filter((l) => l.status === "approved");
          const approvedIds = approved.map((l) => l.listingId).filter(Boolean);

          const analyticsMap = approvedIds.length > 0
            ? await getMultiAnalytics(approvedIds)
            : {};
          const agg = aggregateAnalytics(Object.values(analyticsMap));

          const record =
            allBrokers.find((b) => b.id === user?.id) ??
            allBrokers.find((b) => b.name.toLowerCase() === user?.name?.toLowerCase()) ??
            null;

          if (active) {
            setBrokerRecord(record);
            setActiveCount(approved.length);
            setTourViews(agg.tourStarts);
            setLeadCount(allLeads.length);
            setLoading(false);
          }
        } catch {
          if (active) setLoading(false);
        }
      })();

      return () => { active = false; };
    }, [user?.id, user?.name]),
  );

  // Resolve current plan def
  const currentPlanName = brokerRecord?.plan ?? "";
  const currentPlanDef  = PLAN_CATALOGUE.find((p) => p.name === currentPlanName) ?? null;

  // Usage limits from the plan def (fall back to showing "—" if no match)
  const limits = currentPlanDef ?? { listingLimit: 0, tourViewLimit: 0, leadExportLimit: 0 };

  const usage = [
    { label: "Active Listings",       used: activeCount, max: limits.listingLimit,    color: "#3B82F6" },
    { label: "Tour Views (this month)", used: tourViews,   max: limits.tourViewLimit,   color: "#8B5CF6" },
    { label: "Lead Exports",           used: leadCount,   max: limits.leadExportLimit, color: "#16A34A" },
  ];

  // ─── Plan change ──────────────────────────────────────────────────────────

  const handlePlanChange = (plan: PlanDef) => {
    if (plan.name === currentPlanName) return;
    const verb = (currentPlanDef?.price ?? 0) > plan.price ? "Downgrade" : "Upgrade";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      `${verb} to ${plan.name}`,
      `Switch from ${currentPlanName || "your current plan"} to ${plan.name} at $${plan.price}/month?\n\nChanges take effect at the next billing cycle.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setChangingPlan(true);
            try {
              const all = await getBrokers();
              const updated = all.map((b) =>
                (b.id === user?.id || b.name.toLowerCase() === user?.name?.toLowerCase())
                  ? { ...b, plan: plan.name }
                  : b,
              );
              await saveBrokers(updated);
              setBrokerRecord((prev) => prev ? { ...prev, plan: plan.name } : prev);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Plan Updated", `You're now on ${plan.name}. Changes take effect at your next billing date.`);
            } catch {
              Alert.alert("Error", "Could not update plan. Please try again.");
            } finally {
              setChangingPlan(false);
            }
          },
        },
      ],
    );
  };

  // ─── Invoices ─────────────────────────────────────────────────────────────

  const invoices = buildInvoices(currentPlanDef?.price ?? 0);

  const handleDownloadInvoice = (inv: typeof invoices[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      `Invoice ${inv.id}`,
      `${inv.label}  ·  ${inv.amount}\nStatus: ${inv.status}\n\nIn production this would download a PDF invoice to your device.`,
      [{ text: "OK" }],
    );
  };

  // ─── Payment method ───────────────────────────────────────────────────────

  const handlePaymentMethod = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Payment Method",
      "Visa ending in 4242\nExpiry 08 / 28\nBilling email: james@premiumbiz.com.au",
      [
        { text: "Update Card", onPress: () => Alert.alert("Update Card", "In production this would open a secure Stripe card update form.") },
        { text: "Close", style: "cancel" },
      ],
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Billing</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Current plan card */}
            <View style={[styles.currentCard, { backgroundColor: (currentPlanDef?.color ?? colors.primary) + "15", borderColor: currentPlanDef?.color ?? colors.primary }]}>
              <View style={styles.currentTop}>
                <View>
                  <Text style={[styles.currentLabel, { color: colors.mutedForeground }]}>Current Plan</Text>
                  <Text style={[styles.currentPlan, { color: colors.foreground }]}>
                    {currentPlanName || "No plan"}
                  </Text>
                </View>
                <View style={[styles.activeBadge, { backgroundColor: colors.accent + "20" }]}>
                  <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.activeText, { color: colors.accent }]}>Active</Text>
                </View>
              </View>
              {currentPlanDef && (
                <Text style={[styles.renewText, { color: colors.mutedForeground }]}>
                  Renews {nextRenewal()} · ${currentPlanDef.price.toLocaleString()}/month
                </Text>
              )}
            </View>

            {/* Usage */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Usage This Month</Text>
            {usage.map(({ label, used, max, color: barColor }) => (
              <View key={label} style={[styles.usageRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.usageTop}>
                  <Text style={[styles.usageLabel, { color: colors.foreground }]}>{label}</Text>
                  <Text style={[styles.usageCount, { color: colors.mutedForeground }]}>
                    {used.toLocaleString()} / {max === 0 ? "—" : max === 999 ? "∞" : max.toLocaleString()}
                  </Text>
                </View>
                {max > 0 && (
                  <View style={[styles.usageTrack, { backgroundColor: colors.muted }]}>
                    <View style={[styles.usageBar, { backgroundColor: barColor, width: `${Math.min((used / max) * 100, 100)}%` as any }]} />
                  </View>
                )}
              </View>
            ))}

            {/* Plans */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Plans</Text>
            {PLAN_CATALOGUE.map((plan) => {
              const isCurrent = plan.name === currentPlanName;
              const isUpgrade = (currentPlanDef?.price ?? 0) < plan.price;
              const btnLabel  = isCurrent ? "Current Plan" : isUpgrade ? "Upgrade" : "Downgrade";
              return (
                <View key={plan.name} style={[styles.planCard, { backgroundColor: colors.card, borderColor: isCurrent ? plan.color : colors.border, borderWidth: isCurrent ? 2 : 1 }]}>
                  {plan.recommended && !isCurrent && (
                    <View style={[styles.recommendedBadge, { backgroundColor: plan.color }]}>
                      <Text style={styles.recommendedText}>RECOMMENDED</Text>
                    </View>
                  )}
                  {isCurrent && (
                    <View style={[styles.recommendedBadge, { backgroundColor: plan.color }]}>
                      <Text style={styles.recommendedText}>YOUR PLAN</Text>
                    </View>
                  )}
                  <View style={styles.planTop}>
                    <View style={[styles.planColorDot, { backgroundColor: plan.color }]} />
                    <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
                    <View style={styles.planPriceRow}>
                      <Text style={[styles.planPrice, { color: colors.foreground }]}>${plan.price}</Text>
                      <Text style={[styles.planPeriod, { color: colors.mutedForeground }]}>/mo</Text>
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
                    style={[styles.planBtn, { backgroundColor: isCurrent ? colors.muted : plan.color, opacity: changingPlan ? 0.6 : 1 }]}
                    onPress={() => handlePlanChange(plan)}
                    disabled={isCurrent || changingPlan}
                  >
                    {changingPlan ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.planBtnText, { color: isCurrent ? colors.mutedForeground : "#fff" }]}>
                        {btnLabel}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Invoices */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Invoices</Text>
            <TouchableOpacity
              style={[styles.expandRow, { backgroundColor: colors.card, borderColor: colors.border, borderBottomLeftRadius: showInvoices ? 0 : 12, borderBottomRightRadius: showInvoices ? 0 : 12 }]}
              onPress={() => { Haptics.selectionAsync(); setShowInvoices((v) => !v); }}
              activeOpacity={0.7}
            >
              <Feather name="file-text" size={18} color={colors.primary} />
              <Text style={[styles.invoiceText, { color: colors.foreground }]}>Download Invoices</Text>
              <Feather name={showInvoices ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showInvoices && (
              <View style={[styles.invoiceList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {invoices.map((inv, i) => (
                  <TouchableOpacity
                    key={inv.id}
                    style={[styles.invoiceItem, i < invoices.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                    onPress={() => handleDownloadInvoice(inv)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.invLabel, { color: colors.foreground }]}>{inv.id} · {inv.label}</Text>
                      <Text style={[styles.invMeta, { color: colors.mutedForeground }]}>{inv.amount} · {inv.status}</Text>
                    </View>
                    <Feather name="download" size={15} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Payment method */}
            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handlePaymentMethod}
              activeOpacity={0.7}
            >
              <Feather name="credit-card" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.invoiceText, { color: colors.foreground }]}>Payment Method</Text>
                <Text style={[styles.paymentSub, { color: colors.mutedForeground }]}>Visa ending in 4242</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  header:            { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title:             { fontSize: 26, fontFamily: "Inter_700Bold" },
  scroll:            { padding: 16, gap: 14 },
  center:            { paddingTop: 60, alignItems: "center" },
  currentCard:       { borderRadius: 16, borderWidth: 2, padding: 16, gap: 6 },
  currentTop:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  currentLabel:      { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  currentPlan:       { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 2 },
  activeBadge:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  activeDot:         { width: 6, height: 6, borderRadius: 3 },
  activeText:        { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  renewText:         { fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionTitle:      { fontSize: 16, fontFamily: "Inter_700Bold" },
  usageRow:          { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  usageTop:          { flexDirection: "row", justifyContent: "space-between" },
  usageLabel:        { fontSize: 13, fontFamily: "Inter_500Medium" },
  usageCount:        { fontSize: 12, fontFamily: "Inter_400Regular" },
  usageTrack:        { height: 6, borderRadius: 3, overflow: "hidden" },
  usageBar:          { height: 6, borderRadius: 3 },
  planCard:          { borderRadius: 16, padding: 16, gap: 14, overflow: "hidden" },
  recommendedBadge:  { position: "absolute", top: 0, right: 0, paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 10 },
  recommendedText:   { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  planTop:           { flexDirection: "row", alignItems: "center", gap: 10 },
  planColorDot:      { width: 10, height: 10, borderRadius: 5 },
  planName:          { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold" },
  planPriceRow:      { flexDirection: "row", alignItems: "baseline", gap: 2 },
  planPrice:         { fontSize: 22, fontFamily: "Inter_700Bold" },
  planPeriod:        { fontSize: 13, fontFamily: "Inter_400Regular" },
  featureList:       { gap: 8 },
  featureRow:        { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText:       { fontSize: 13, fontFamily: "Inter_400Regular" },
  planBtn:           { paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  planBtnText:       { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  expandRow:         { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  invoiceList:       { borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  invoiceItem:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  invLabel:          { fontSize: 13, fontFamily: "Inter_500Medium" },
  invMeta:           { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  invoiceText:       { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  actionRow:         { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  paymentSub:        { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
});
