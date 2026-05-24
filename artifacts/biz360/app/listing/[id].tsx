import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VerificationBadges } from "@/components/VerificationBadge";
import { DEMO_LISTINGS, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [isSaved, setIsSaved] = useState(false);
  const listing = DEMO_LISTINGS.find((l) => l.id === id);

  if (!listing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFound, { color: colors.foreground }]}>Listing not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSaved((p) => !p);
  };

  const handleCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Click-to-Call", "This call will be tracked as a lead. Proceed?", [
      { text: "Cancel" },
      { text: "Call Now", onPress: () => Linking.openURL("tel:+61400000000") },
    ]);
  };

  const DETAIL_ROWS = [
    { label: "Asking Price", value: formatPrice(listing.askingPrice), highlight: true },
    { label: "Weekly Revenue", value: `$${listing.weeklyRevenue.toLocaleString()}` },
    { label: "SDE / Adjusted Profit", value: `$${listing.adjustedProfit.toLocaleString()} p.a.`, highlight: true },
    { label: "Monthly Rent", value: `$${listing.rent.toLocaleString()}` },
    { label: "Lease Expiry", value: listing.leaseExpiry },
    { label: "Lease Options", value: listing.leaseOptions },
    { label: "Staff Count", value: `${listing.staffCount} employees` },
    { label: "Owner Hours/week", value: `${listing.ownerHours}h` },
    { label: "Training Period", value: listing.trainingPeriod },
    { label: "Franchise Status", value: listing.franchiseStatus },
    { label: "Reason for Sale", value: listing.reasonForSale },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.hero, { backgroundColor: listing.heroColor }]}>
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + (Platform.OS === "web" ? 67 : 0) + 8 }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, { top: insets.top + (Platform.OS === "web" ? 67 : 0) + 8 }]}
            onPress={handleSave}
          >
            <Feather name={isSaved ? "bookmark" : "bookmark"} size={20} color={isSaved ? "#3B82F6" : "#fff"} />
          </TouchableOpacity>
          <View style={styles.heroContent}>
            {listing.confidential && (
              <View style={styles.confPill}>
                <Feather name="eye-off" size={11} color="#fff" />
                <Text style={styles.confText}>Confidential Listing</Text>
              </View>
            )}
            <Text style={styles.heroPrice}>{formatPrice(listing.askingPrice)}</Text>
            <Text style={styles.heroName}>{listing.businessName}</Text>
            <Text style={styles.heroMeta}>{listing.suburb}, {listing.state} · {listing.category}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {listing.hasTour && (
            <TouchableOpacity
              style={[styles.tourCTA, { backgroundColor: colors.primary }]}
              onPress={() => router.push(`/tour/${listing.id}` as any)}
            >
              <Feather name="rotate-ccw" size={20} color="#fff" />
              <View>
                <Text style={styles.tourCTATitle}>Enter 360° Business Tour</Text>
                <Text style={styles.tourCTASub}>{listing.tourSpaces?.length} spaces · {listing.tourSpaces?.reduce((a, s) => a + s.pins.length, 0)} interactive pins</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#fff" />
            </TouchableOpacity>
          )}

          <Text style={[styles.desc, { color: colors.mutedForeground }]}>{listing.description}</Text>

          <View style={[styles.section, { borderTopColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Business Financials</Text>
            {DETAIL_ROWS.map(({ label, value, highlight }) => (
              <View key={label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
                <Text style={[styles.detailValue, { color: highlight ? colors.accent : colors.foreground }]}>{value}</Text>
              </View>
            ))}
          </View>

          {listing.growthOpportunities && (
            <View style={[styles.oppCard, { backgroundColor: colors.accent + "12", borderColor: colors.accent + "30" }]}>
              <Feather name="star" size={16} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.oppTitle, { color: colors.accent }]}>Growth Opportunities</Text>
                <Text style={[styles.oppText, { color: colors.foreground }]}>{listing.growthOpportunities}</Text>
              </View>
            </View>
          )}

          {listing.risks && (
            <View style={[styles.riskCard, { backgroundColor: "#EF444412", borderColor: "#EF444430" }]}>
              <Feather name="alert-triangle" size={16} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.oppTitle, { color: "#EF4444" }]}>Risks / Notes</Text>
                <Text style={[styles.oppText, { color: colors.foreground }]}>{listing.risks}</Text>
              </View>
            </View>
          )}

          <View style={[styles.section, { borderTopColor: colors.border }]}>
            <VerificationBadges badges={listing.badges} />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 12 }]}>
        {listing.contactPreference !== "broker_only" && (
          <TouchableOpacity style={[styles.footerBtn, { backgroundColor: colors.muted }]} onPress={handleCall}>
            <Feather name="phone" size={18} color={colors.foreground} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.footerPrimaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/thread/thread-001" as any)}
        >
          <Feather name="message-circle" size={18} color="#fff" />
          <Text style={styles.footerPrimaryText}>
            {listing.contactPreference === "broker_only" ? "Contact Broker" : "Message Seller"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  notFound: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  hero: { height: 240, justifyContent: "flex-end" },
  backBtn: { position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  saveBtn: { position: "absolute", right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  heroContent: { padding: 16, gap: 4, backgroundColor: "rgba(0,0,0,0.3)" },
  confPill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginBottom: 4 },
  confText: { color: "#fff", fontSize: 10, fontFamily: "Inter_500Medium" },
  heroPrice: { color: "#fff", fontSize: 30, fontFamily: "Inter_700Bold" },
  heroName: { color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold" },
  heroMeta: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular" },
  body: { padding: 16, gap: 16 },
  tourCTA: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14 },
  tourCTATitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  tourCTASub: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  desc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  section: { borderTopWidth: 1, paddingTop: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1 },
  detailLabel: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  detailValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "right" },
  oppCard: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  riskCard: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  oppTitle: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 },
  oppText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  footerBtn: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  footerPrimaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  footerPrimaryText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
