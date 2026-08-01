import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VerificationBadges } from "@/components/VerificationBadge";
import { DEMO_LISTINGS, formatPrice, getPriceStat } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { getPendingListings, PendingListing } from "@/lib/adminStore";
import { trackEvent } from "@/lib/analyticsStore";
import { apiGet } from "@/lib/apiStore";

import { useAuth } from "@/context/AuthContext";
import { getSavedIds, toggleSaved as persistToggleSaved } from "@/lib/savedStore";

const _domain = (global as any).__replit_dev_domain as string | undefined;
const LISTING_API_BASE = _domain ? `https://${_domain}` : "";


// ── Helpers ────────────────────────────────────────────────────────────────────

function safeFormatPrice(price: number | undefined | null): string {
  if (!price || price <= 0) return "Price TBC";
  return formatPrice(price);
}

// ── Verified Financials inline section ─────────────────────────────────────────

function VerifiedFinancialsSection({
  listingId,
  valSnapshot,
  valTabIdx,
  setValTabIdx,
}: {
  listingId: string;
  valSnapshot: { combined: any; units: { unit: any; snapshot: any }[] };
  valTabIdx: number;
  setValTabIdx: (i: number) => void;
}) {
  const tabs = [
    { label: "Combined", snap: valSnapshot.combined },
    ...valSnapshot.units.map(({ unit, snapshot }) => ({ label: unit.name as string, snap: snapshot })),
  ];
  const active = tabs[valTabIdx] ?? tabs[0];
  const snap = active?.snap;
  const fmt = (v: any) => v != null && v !== "" ? `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—";
  const rows: { label: string; value: string; highlight?: boolean }[] = [
    { label: "Gross Revenue",   value: fmt(snap?.grossRevenue) },
    { label: "COGS",            value: fmt(snap?.cogs) },
    { label: "Gross Profit",    value: fmt(snap?.grossProfit) },
    { label: "EBITDA",          value: fmt(snap?.ebitda) },
    { label: "Adjusted EBITDA", value: fmt(snap?.adjustedEbitda), highlight: true },
    { label: "Equipment Value", value: fmt(snap?.totalEquipmentValue) },
    { label: "Valuation",       value: fmt(snap?.valuationMidpoint), highlight: true },
  ];
  return (
    <View style={[vfStyles.section, { backgroundColor: "#0A1628", borderColor: "#16A34A30" }]}>
      <View style={vfStyles.header}>
        <View style={[vfStyles.icon, { backgroundColor: "#16A34A20" }]}>
          <Feather name="shield" size={18} color="#16A34A" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={vfStyles.title}>Verified Financials</Text>
          <Text style={vfStyles.sub}>Seller-connected revenue &amp; valuation data</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/listing/valuation-report?listingId=${listingId}` as any)}
          style={[vfStyles.fullBtn, { borderColor: "#16A34A50" }]}
        >
          <Text style={{ color: "#16A34A", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>Full Report</Text>
        </TouchableOpacity>
      </View>
      {tabs.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
          {tabs.map((t, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setValTabIdx(i)}
              style={[vfStyles.tab, valTabIdx === i && { backgroundColor: "#16A34A20", borderColor: "#16A34A60" }]}
            >
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: valTabIdx === i ? "#16A34A" : "#8B9CB8" }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {snap && (
        <View>
          {rows.map(({ label, value, highlight }) => (
            <View key={label} style={vfStyles.row}>
              <Text style={{ color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 }}>{label}</Text>
              <Text style={{ color: highlight ? "#16A34A" : "#E2E8F0", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{value}</Text>
            </View>
          ))}
          {snap.snapshotDate != null && (
            <Text style={{ color: "#4A5568", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 8, textAlign: "right" }}>
              Snapshot: {snap.snapshotDate} · {snap.periodMonths}mo period
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const vfStyles = StyleSheet.create({
  section: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  header:  { flexDirection: "row", alignItems: "center", gap: 12 },
  icon:    { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title:   { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sub:     { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  fullBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  tab:     { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderColor: "#1E2D40" },
  row:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1E2D40" },
});

// ── Locked Financials card (access restricted) ──────────────────────────────

const LOCKED_ROW_LABELS = ["Gross Revenue", "EBITDA", "Adjusted EBITDA", "Valuation"];

function LockedFinancialsCard({ listingId }: { listingId: string }) {
  return (
    <View style={[lfStyles.section, { backgroundColor: "#0A1628", borderColor: "#F59E0B30" }]}>
      <View style={lfStyles.header}>
        <View style={[lfStyles.icon, { backgroundColor: "#F59E0B18" }]}>
          <Feather name="lock" size={18} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={lfStyles.title}>Verified Financials</Text>
          <Text style={lfStyles.sub}>Access restricted by seller</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/listing/valuation-report?listingId=${listingId}` as any)}
          style={lfStyles.unlockBtn}
        >
          <Feather name="unlock" size={12} color="#F59E0B" />
          <Text style={{ color: "#F59E0B", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>Unlock</Text>
        </TouchableOpacity>
      </View>
      <View>
        {LOCKED_ROW_LABELS.map((label) => (
          <View key={label} style={lfStyles.row}>
            <Text style={{ color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 }}>{label}</Text>
            <View style={lfStyles.blurBar} />
          </View>
        ))}
      </View>
      <Text style={lfStyles.hint}>Tap Unlock to enter the seller-provided password</Text>
    </View>
  );
}

const lfStyles = StyleSheet.create({
  section:   { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  header:    { flexDirection: "row", alignItems: "center", gap: 12 },
  icon:      { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title:     { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sub:       { color: "#F59E0B", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  unlockBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#F59E0B50", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  row:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1E2D40" },
  blurBar:   { width: 80, height: 12, borderRadius: 4, backgroundColor: "#1E3A5C" },
  hint:      { color: "#4A5568", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
});

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const buyerId  = user?.id ?? "guest";

  const [isSaved,           setIsSaved]           = useState(false);
  const [hasTour,           setHasTour]           = useState(false);
  const [valSnapshot,       setValSnapshot]       = useState<null | { combined: any; units: { unit: any; snapshot: any }[] }>(null);
  const [valLoading,        setValLoading]        = useState(false);
  const [valTabIdx,         setValTabIdx]         = useState(0);
  const [valAccessRequired, setValAccessRequired] = useState(false);
  const viewFiredRef = useRef(false);

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

  // Restore saved state from persistent store on mount
  useEffect(() => {
    if (!id) return;
    getSavedIds().then((ids) => setIsSaved(ids.includes(id)));
  }, [id]);

  // Check for 360 tour spaces in KV once the listing resolves
  useEffect(() => {
    if (!id || !pendingItem) return;
    apiGet<unknown[]>(`biz360_tour_spaces_v1_${id}`).then((spaces) => {
      setHasTour(Array.isArray(spaces) && spaces.length > 0);
    });
  }, [id, pendingItem]);

  // Fetch valuation snapshot — respects report access settings
  useEffect(() => {
    const listingId = pendingItem?.listingId;
    if (!listingId) return;
    setValLoading(true);
    fetch(`${LISTING_API_BASE}/api/valuation/listing/${listingId}/snapshot`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.requiresAccess) {
          setValAccessRequired(true);
          setValSnapshot(null);
        } else if (data?.combined) {
          setValAccessRequired(false);
          setValSnapshot(data);
        } else {
          setValAccessRequired(false);
          setValSnapshot(null);
        }
      })
      .catch(() => { setValSnapshot(null); setValAccessRequired(false); })
      .finally(() => setValLoading(false));
  }, [pendingItem?.listingId]);

  // Track listing view — fires once when a KV listing resolves
  useEffect(() => {
    if (!id || viewFiredRef.current) return;
    if (!demoListing && pendingItem === undefined) return; // still loading
    if (!pendingItem) return; // skip demo listings (no real seller to show data to)
    viewFiredRef.current = true;
    trackEvent(id, "view", buyerId);
  }, [id, demoListing, pendingItem, buyerId]);

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
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    persistToggleSaved(id).then((newIds) => {
      const nowSaved = newIds.includes(id);
      setIsSaved(nowSaved);
      trackEvent(id, nowSaved ? "save" : "unsave", buyerId);
    });
  };

  const handleCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (id) trackEvent(id, "call", buyerId);
    Alert.alert("Click-to-Call", "This call will be tracked as a lead. Proceed?", [
      { text: "Cancel" },
      { text: "Call Now", onPress: () => Linking.openURL("tel:+61400000000") },
    ]);
  };

  const handleMessage = (threadId: string, listingName: string, sellerName: string, listingId?: string) => {
    if (!user) {
      Alert.alert(
        "Sign in required",
        "You need an account to message sellers.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: () => router.push("/(auth)/login" as any) },
        ],
      );
      return;
    }
    if (id) trackEvent(id, "message", buyerId);
    const lid = listingId ?? threadId;
    router.push(`/thread/${threadId}?listingName=${encodeURIComponent(listingName)}&sellerName=${encodeURIComponent(sellerName)}&listingId=${encodeURIComponent(lid)}&buyerId=${encodeURIComponent(buyerId)}` as any);
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
      { label: "Asking Price",         value: getPriceStat(listing).value,                         highlight: true  },
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
          </View>

          <View style={styles.listingInfoBlock}>
            {listing.confidential && (
              <View style={[styles.confPill, { alignSelf: "flex-start", marginBottom: 4 }]}>
                <Feather name="eye-off" size={11} color="#fff" />
                <Text style={styles.confText}>Confidential Listing</Text>
              </View>
            )}
            {(() => {
              const ps = getPriceStat(listing);
              return (
                <View>
                  <Text style={[styles.infoPrice, { color: colors.foreground }]}>{ps.value}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>{ps.label}</Text>
                </View>
              );
            })()}
            <Text style={[styles.infoName, { color: colors.foreground }]}>{listing.businessName}</Text>
            <Text style={[styles.infoMeta, { color: colors.mutedForeground }]}>{listing.suburb}, {listing.state} · {listing.category}</Text>
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
              onPress={() => handleMessage(`listing-${listing.id}_${buyerId}`, listing.businessName, "Sarah Mitchell", listing.id)}
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
  const item         = pendingItem!;
  const heroColor    = item.heroColor ?? "#2563EB";
  const businessName = item.businessName ?? "Unnamed Listing";
  const price        = item.askingPrice;
  const revenue      = item.weeklyRevenue;
  const hasPhotos    = !!(item.photos?.length);
  const topOffset    = insets.top + (Platform.OS === "web" ? 67 : 0) + 8;

  const financialRows = [
    (item.priceDisplay !== "weeklyRevenue" && item.priceDisplay !== "poa" &&
      (price > 0 || (item.askingPriceMin ?? 0) > 0 || (item.askingPriceMax ?? 0) > 0))
      ? { label: "Asking Price", value: getPriceStat(item as any).value, highlight: true } : null,
    revenue  && revenue  > 0 ? { label: "Weekly Revenue",        value: `$${revenue.toLocaleString()}`                                 } : null,
    item.adjustedProfit && item.adjustedProfit > 0 ? { label: "Adj. Profit / SDE", value: `$${item.adjustedProfit.toLocaleString()} p.a.`, highlight: true } : null,
    item.rent           && item.rent > 0           ? { label: "Monthly Rent",       value: `$${item.rent.toLocaleString()}`             } : null,
    item.staffCount     && item.staffCount > 0     ? { label: "Staff Count",        value: `${item.staffCount} employees`               } : null,
    item.ownerHours     && item.ownerHours > 0     ? { label: "Owner Hours/week",   value: `${item.ownerHours}h`                        } : null,
    item.leaseExpiry                               ? { label: "Lease Expiry",       value: item.leaseExpiry                             } : null,
    item.leaseOptions                              ? { label: "Lease Options",      value: item.leaseOptions                            } : null,
    item.franchiseStatus                           ? { label: "Franchise Status",   value: item.franchiseStatus                         } : null,
    item.trainingPeriod                            ? { label: "Training Period",    value: item.trainingPeriod                          } : null,
  ].filter(Boolean) as { label: string; value: string; highlight?: boolean }[];

  const locationMeta = [item.suburb, item.state].filter(Boolean).join(", ");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>

        {/* ── Hero ── */}
        <View style={[styles.hero, !hasPhotos && { backgroundColor: heroColor }]}>
          {hasPhotos && (
            <Image source={{ uri: item.photos![0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
          {hasPhotos && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.38)" }]} />
          )}
          <TouchableOpacity style={[styles.backBtn, { top: topOffset }]} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, { top: topOffset }]} onPress={handleSave}>
            <Feather name="bookmark" size={20} color={isSaved ? "#3B82F6" : "#fff"} />
          </TouchableOpacity>
        </View>

        {/* ── Photo strip (if > 1 photo) ── */}
        {hasPhotos && item.photos!.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoStrip}
          >
            {item.photos!.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={styles.photoStripThumb} resizeMode="cover" />
            ))}
          </ScrollView>
        )}

        <View style={styles.listingInfoBlock}>
          {item.confidential && (
            <View style={[styles.confPill, { alignSelf: "flex-start", marginBottom: 4 }]}>
              <Feather name="eye-off" size={11} color="#fff" />
              <Text style={styles.confText}>Confidential Listing</Text>
            </View>
          )}
          {(() => {
            const ps = getPriceStat(item as any);
            return (
              <View>
                <Text style={[styles.infoPrice, { color: colors.foreground }]}>{ps.value}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>{ps.label}</Text>
              </View>
            );
          })()}
          <Text style={[styles.infoName, { color: colors.foreground }]}>{businessName}</Text>
          {(locationMeta || item.category) && (
            <Text style={[styles.infoMeta, { color: colors.mutedForeground }]}>
              {locationMeta}{item.category ? `${locationMeta ? " · " : ""}${item.category}` : ""}
            </Text>
          )}
        </View>

        <View style={styles.body}>
          {/* ── 360° Tour CTA ── */}
          {hasTour && (
            <TouchableOpacity
              style={[styles.tourCTA, { backgroundColor: "#1E3A5C" }]}
              onPress={() => {
                trackEvent(id!, "tour_start", buyerId);
                router.push(`/tour/${id}` as any);
              }}
              activeOpacity={0.8}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" }}>
                <Feather name="rotate-ccw" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tourCTATitle}>Enter 360° Business Tour</Text>
                <Text style={styles.tourCTASub}>Walk through the space before you enquire</Text>
              </View>
              <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}

          {/* Description */}
          {!!item.description && (
            <Text style={[styles.desc, { color: colors.mutedForeground }]}>{item.description}</Text>
          )}

          {/* Financials & details */}
          {financialRows.length > 0 && (
            <View style={[styles.section, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Business Details</Text>
              {financialRows.map(({ label, value, highlight }) => (
                <View key={label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <Text style={[styles.detailValue, { color: highlight ? colors.accent : colors.foreground }]}>{value}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Growth opportunities */}
          {!!item.growthOpportunities && (
            <View style={[styles.oppCard, { backgroundColor: colors.accent + "12", borderColor: colors.accent + "30" }]}>
              <Feather name="star" size={16} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTag, { color: colors.accent }]}>Growth Opportunities</Text>
                <Text style={[styles.cardText, { color: colors.foreground }]}>{item.growthOpportunities}</Text>
              </View>
            </View>
          )}

          {/* Risks */}
          {!!item.risks && (
            <View style={[styles.riskCard, { backgroundColor: "#EF444412", borderColor: "#EF444430" }]}>
              <Feather name="alert-triangle" size={16} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTag, { color: "#EF4444" }]}>Risks / Notes</Text>
                <Text style={[styles.cardText, { color: colors.foreground }]}>{item.risks}</Text>
              </View>
            </View>
          )}

          {/* Badges */}
          {item.badges && item.badges.length > 0 && (
            <View style={[styles.section, { borderTopColor: colors.border }]}>
              <VerificationBadges badges={item.badges as any} />
            </View>
          )}

          {/* ── Verified Financials: locked or open depending on seller's access settings ── */}
          {item.listingId && !valLoading && valAccessRequired && (
            <LockedFinancialsCard listingId={item.listingId} />
          )}
          {item.listingId && !valLoading && valSnapshot != null && (
            <VerifiedFinancialsSection
              listingId={item.listingId}
              valSnapshot={valSnapshot}
              valTabIdx={valTabIdx}
              setValTabIdx={setValTabIdx}
            />
          )}

          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="info" size={15} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Full financials, lease details, and supporting documents are available on request.
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
            onPress={() => handleMessage(`${item.listingId}_${buyerId}`, businessName, item.submittedByName ?? item.submittedByRole ?? "Seller", item.listingId)}
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
  confPill:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#1E3A5C", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  confText:        { color: "#fff", fontSize: 10, fontFamily: "Inter_500Medium" },
  photoStrip:      { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  photoStripThumb: { width: 120, height: 80, borderRadius: 8 },
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
  listingInfoBlock:{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2, gap: 3 },
  infoPrice:       { fontSize: 30, fontFamily: "Inter_700Bold" },
  infoName:        { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  infoMeta:        { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 1 },
  verifiedFinancials: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  verifiedIcon:    { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  verifiedTitle:   { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  verifiedSub:     { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  snapSection:     { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  snapHeader:      { flexDirection: "row", alignItems: "center", gap: 12 },
  snapViewFull:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  snapTab:         { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderColor: "#1E2D40" },
  snapRow:         { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1E2D40" },
  snapEmpty:       { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 8 },
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
