import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VerificationBadges } from "@/components/VerificationBadge";
import { DEMO_LISTINGS, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { getPendingListings, PendingListing } from "@/lib/adminStore";

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeFormatPrice(price: number | undefined | null): string {
  if (!price || price <= 0) return "Price TBC";
  return formatPrice(price);
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [isSaved, setIsSaved] = useState(false);

  // 1. Try DEMO_LISTINGS first (synchronous)
  const demoListing = DEMO_LISTINGS.find((l) => l.id === id);

  // 2. If not found, look up the pending store (async)
  const [pendingItem, setPendingItem] = useState<PendingListing | null | undefined>(
    demoListing ? null : undefined, // undefined = loading, null = not found
  );

  useEffect(() => {
    if (demoListing) return; // no need to load
    getPendingListings().then((all) => {
      const match = all.find((p) => p.listingId === id);
      setPendingItem(match ?? null);
    });
  }, [id, demoListing]);

  // ── Loading state (only while pending store resolves) ──────────────────────
  if (!demoListing && pendingItem === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Loading…</Text>
      </View>
    );
  }

  // ── Not found in either source ─────────────────────────────────────────────
  if (!demoListing && !pendingItem) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={[styles.notFoundText, { color: colors.foreground }]}>Listing not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Shared interaction handlers ─────────────────────────────────────────────
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

  const handleNDA = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Request NDA",
      "To access confidential financials and lease details, you'll need to sign a Non-Disclosure Agreement. The seller will review your request within 24 hours.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send Request", onPress: () => Alert.alert("NDA Requested", "Your request has been sent. You'll be notified once the seller approves.") },
      ],
    );
  };

  const handleInspection = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Book Inspection",
      "Request a time to visit the premises and meet the current owner. Your details will be shared with the seller.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Request Inspection", onPress: () => Alert.alert("Inspection Requested", "Your inspection request has been sent. Expect a callback within 1 business day.") },
      ],
    );
  };

  const handleDocRequest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Request Documents",
      "Ask the seller to share supporting documents such as financial statements, BAS returns, lease agreement, and equipment lists.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send Request", onPress: () => Alert.alert("Documents Requested", "Your request has been sent. The seller will upload documents for your review.") },
      ],
    );
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // FULL DEMO LISTING VIEW
  // ══════════════════════════════════════════════════════════════════════════════
  if (demoListing) {
    const listing = demoListing;
    const DETAIL_ROWS = [
      { label: "Asking Price",         value: formatPrice(listing.askingPrice),                    highlight: true  },
      { label: "Weekly Revenue",       value: `$${listing.weeklyRevenue.toLocaleString()}`                          },
      { label: "SDE / Adjusted Profit",value: `$${listing.adjustedProfit.toLocaleString()} p.a.`, highlight: true  },
      { label: "Monthly Rent",         value: `$${listing.rent.toLocaleString()}`                                   },
      { label: "Lease Expiry",         value: listing.leaseExpiry                                                   },
      { label: "Lease Options",        value: listing.leaseOptions                                                   },
      { label: "Staff Count",          value: `${listing.staffCount} employees`                                     },
      { label: "Owner Hours/week",     value: `${listing.ownerHours}h`                                              },
      { label: "Training Period",      value: listing.trainingPeriod                                                 },
      { label: "Franchise Status",     value: listing.franchiseStatus                                               },
      { label: "Reason for Sale",      value: listing.reasonForSale                                                  },
    ];

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
          <View style={[styles.hero, { backgroundColor: listing.heroColor }]}>
            <TouchableOpacity style={[styles.backBtn, { top: insets.top + (Platform.OS === "web" ? 67 : 0) + 8 }]} onPress={() => router.back()}>
              <Feather name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { top: insets.top + (Platform.OS === "web" ? 67 : 0) + 8 }]} onPress={handleSave}>
              <Feather name="bookmark" size={20} color={isSaved ? "#3B82F6" : "#fff"} />
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
              <TouchableOpacity style={[styles.tourCTA, { backgroundColor: colors.primary }]} onPress={() => router.push(`/tour/${listing.id}` as any)}>
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
                  <Text style={[styles.cardTag, { color: colors.accent }]}>Growth Opportunities</Text>
                  <Text style={[styles.cardText, { color: colors.foreground }]}>{listing.growthOpportunities}</Text>
                </View>
              </View>
            )}
            {listing.risks && (
              <View style={[styles.riskCard, { backgroundColor: "#EF444412", borderColor: "#EF444430" }]}>
                <Feather name="alert-triangle" size={16} color="#EF4444" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTag, { color: "#EF4444" }]}>Risks / Notes</Text>
                  <Text style={[styles.cardText, { color: colors.foreground }]}>{listing.risks}</Text>
                </View>
              </View>
            )}
            <View style={[styles.section, { borderTopColor: colors.border }]}>
              <VerificationBadges badges={listing.badges} />
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 8 }]}>
          <View style={styles.footerTopRow}>
            {listing.contactPreference !== "broker_only" && (
              <TouchableOpacity style={[styles.footerIconBtn, { backgroundColor: colors.muted }]} onPress={handleCall}>
                <Feather name="phone" size={18} color={colors.foreground} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.footerPrimaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push(`/thread/listing-${listing.id}?listingName=${encodeURIComponent(listing.businessName)}&sellerName=Sarah+Mitchell` as any)}
            >
              <Feather name="message-circle" size={18} color="#fff" />
              <Text style={styles.footerPrimaryText}>{listing.contactPreference === "broker_only" ? "Contact Broker" : "Message Seller"}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.footerSecondRow}>
            {listing.confidential && (
              <TouchableOpacity style={[styles.footerSecBtn, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B40" }]} onPress={handleNDA}>
                <Feather name="lock" size={14} color="#F59E0B" />
                <Text style={[styles.footerSecText, { color: "#F59E0B" }]}>Request NDA</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.footerSecBtn, { backgroundColor: colors.accent + "15", borderColor: colors.accent + "40" }]} onPress={handleInspection}>
              <Feather name="calendar" size={14} color={colors.accent} />
              <Text style={[styles.footerSecText, { color: colors.accent }]}>Book Inspection</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.footerSecBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]} onPress={handleDocRequest}>
              <Feather name="file-text" size={14} color={colors.primary} />
              <Text style={[styles.footerSecText, { color: colors.primary }]}>Request Docs</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // USER-CREATED LISTING VIEW (pending store data only)
  // ══════════════════════════════════════════════════════════════════════════════
  const item = pendingItem!;
  const heroColor    = item.heroColor ?? "#2563EB";
  const businessName = item.businessName ?? "Unnamed Listing";
  const price        = item.askingPrice;
  const revenue      = item.weeklyRevenue;

  const infoRows = [
    item.suburb || item.state ? { label: "Location",       value: [item.suburb, item.state].filter(Boolean).join(", ") } : null,
    item.category             ? { label: "Category",       value: item.category }                                         : null,
    price && price > 0        ? { label: "Asking Price",   value: formatPrice(price),       highlight: true }              : null,
    revenue && revenue > 0    ? { label: "Weekly Revenue", value: `$${revenue.toLocaleString()}` }                         : null,
  ].filter(Boolean) as { label: string; value: string; highlight?: boolean }[];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
        <View style={[styles.hero, { backgroundColor: heroColor }]}>
          <TouchableOpacity style={[styles.backBtn, { top: insets.top + (Platform.OS === "web" ? 67 : 0) + 8 }]} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, { top: insets.top + (Platform.OS === "web" ? 67 : 0) + 8 }]} onPress={handleSave}>
            <Feather name="bookmark" size={20} color={isSaved ? "#3B82F6" : "#fff"} />
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <Text style={styles.heroPrice}>{safeFormatPrice(price)}</Text>
            <Text style={styles.heroName}>{businessName}</Text>
            {(item.suburb || item.state || item.category) && (
              <Text style={styles.heroMeta}>
                {[item.suburb, item.state].filter(Boolean).join(", ")}{item.category ? ` · ${item.category}` : ""}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.body}>
          {infoRows.length > 0 && (
            <View style={[styles.section, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Listing Details</Text>
              {infoRows.map(({ label, value, highlight }) => (
                <View key={label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <Text style={[styles.detailValue, { color: highlight ? colors.accent : colors.foreground }]}>{value}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="info" size={15} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              This listing was submitted directly by the seller. Full financials, lease details, and documents are available on request.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 8 }]}>
        <View style={styles.footerTopRow}>
          <TouchableOpacity style={[styles.footerIconBtn, { backgroundColor: colors.muted }]} onPress={handleCall}>
            <Feather name="phone" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerPrimaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/thread/${item.listingId}?listingName=${encodeURIComponent(businessName)}&sellerName=${encodeURIComponent(item.submittedBy)}` as any)}
          >
            <Feather name="message-circle" size={18} color="#fff" />
            <Text style={styles.footerPrimaryText}>Contact Seller</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.footerSecondRow}>
          <TouchableOpacity style={[styles.footerSecBtn, { backgroundColor: colors.accent + "15", borderColor: colors.accent + "40" }]} onPress={handleInspection}>
            <Feather name="calendar" size={14} color={colors.accent} />
            <Text style={[styles.footerSecText, { color: colors.accent }]}>Book Inspection</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.footerSecBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]} onPress={handleDocRequest}>
            <Feather name="file-text" size={14} color={colors.primary} />
            <Text style={[styles.footerSecText, { color: colors.primary }]}>Request Docs</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  center:          { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  notFoundText:    { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  hero:            { height: 240, justifyContent: "flex-end" },
  backBtn:         { position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  saveBtn:         { position: "absolute", right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  heroContent:     { padding: 16, gap: 4, backgroundColor: "rgba(0,0,0,0.3)" },
  confPill:        { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginBottom: 4 },
  confText:        { color: "#fff", fontSize: 10, fontFamily: "Inter_500Medium" },
  heroPrice:       { color: "#fff", fontSize: 30, fontFamily: "Inter_700Bold" },
  heroName:        { color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold" },
  heroMeta:        { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular" },
  body:            { padding: 16, gap: 16 },
  tourCTA:         { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14 },
  tourCTATitle:    { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  tourCTASub:      { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  desc:            { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  section:         { borderTopWidth: 1, paddingTop: 16, gap: 12 },
  sectionTitle:    { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
  detailRow:       { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1 },
  detailLabel:     { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  detailValue:     { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "right" },
  oppCard:         { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  riskCard:        { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  cardTag:         { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 },
  cardText:        { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  infoBox:         { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText:        { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  footer:          { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, gap: 8 },
  footerTopRow:    { flexDirection: "row", gap: 10 },
  footerSecondRow: { flexDirection: "row", gap: 10 },
  footerIconBtn:   { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  footerPrimaryBtn:{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
  footerPrimaryText:{ color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  footerSecBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  footerSecText:   { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
