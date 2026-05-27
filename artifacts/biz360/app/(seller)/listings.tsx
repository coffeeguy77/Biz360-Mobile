import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { DEMO_LISTINGS, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { getPendingListings, PendingListing } from "@/lib/adminStore";

const STATUS_CONFIG = {
  pending:  { label: "Pending Review", color: "#F59E0B", icon: "clock"       },
  approved: { label: "Active",         color: "#16A34A", icon: "check-circle" },
  rejected: { label: "Rejected",       color: "#EF4444", icon: "x-circle"     },
} as const;

export default function SellerListings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [listings, setListings] = useState<PendingListing[]>([]);

  useFocusEffect(
    useCallback(() => {
      getPendingListings().then((all) => {
        setListings(all.filter((p) => p.submittedBy === user?.id));
      });
    }, [user?.id]),
  );

  const activeCount  = listings.filter((l) => l.status === "approved").length;
  const pendingCount = listings.filter((l) => l.status === "pending").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>My Listings</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {activeCount} active{pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/create-listing" as any)}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="list" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No listings yet</Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>Tap + to submit your first listing for review</Text>
          </View>
        }
        renderItem={({ item }) => {
          const demo = DEMO_LISTINGS.find((d) => d.id === item.listingId);
          const sc   = STATUS_CONFIG[item.status];

          const heroColor = demo?.heroColor ?? item.heroColor ?? "#2563EB";
          const name      = demo?.businessName ?? item.businessName ?? "Unnamed Listing";
          const price     = demo?.askingPrice  ?? item.askingPrice;
          const suburb    = demo?.suburb       ?? item.suburb       ?? "";
          const state     = demo?.state        ?? item.state        ?? "";
          const category  = demo?.category     ?? item.category     ?? "";

          const cardContent = (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: item.status === "rejected" ? "#EF444440" : colors.border }]}>
              <View style={[styles.cardHero, { backgroundColor: heroColor }]}>
                <View style={[styles.statusPill, { backgroundColor: sc.color }]}>
                  <Feather name={sc.icon as any} size={10} color="#fff" />
                  <Text style={styles.statusPillText}>{sc.label}</Text>
                </View>
                <Text style={styles.heroPrice}>{price && price > 0 ? formatPrice(price) : "Price TBC"}</Text>
              </View>

              <View style={styles.cardBody}>
                <Text style={[styles.cardName, { color: colors.foreground }]}>{name}</Text>
                <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                  {[suburb, state].filter(Boolean).join(", ")}{category ? ` · ${category}` : ""}
                </Text>

                {/* Metrics for approved DEMO listings */}
                {demo && item.status === "approved" && (
                  <View style={styles.metricsRow}>
                    {[
                      { label: "Views",  val: demo.viewCount  },
                      { label: "Tours",  val: demo.tourStarts },
                      { label: "Saved",  val: demo.savedCount },
                    ].map(({ label, val }) => (
                      <View key={label} style={styles.metric}>
                        <Text style={[styles.metricVal, { color: colors.primary }]}>{val}</Text>
                        <Text style={[styles.metricLbl, { color: colors.mutedForeground }]}>{label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Status notes */}
                {item.status === "pending" && (
                  <View style={[styles.statusNote, { backgroundColor: "#F59E0B12", borderColor: "#F59E0B30" }]}>
                    <Feather name="info" size={12} color="#F59E0B" />
                    <Text style={[styles.statusNoteText, { color: "#F59E0B" }]}>
                      Under review by admin. Approval typically within 1 business day.
                    </Text>
                  </View>
                )}
                {item.status === "rejected" && (
                  <View style={[styles.statusNote, { backgroundColor: "#EF444412", borderColor: "#EF444430" }]}>
                    <Feather name="alert-circle" size={12} color="#EF4444" />
                    <Text style={[styles.statusNoteText, { color: "#EF4444" }]}>
                      This listing was not approved. Contact support or revise and resubmit.
                    </Text>
                  </View>
                )}

                {/* Edit button — user-created pending/rejected listings */}
                {(item.status === "pending" || item.status === "rejected") && !demo && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary, flex: 1 }]}
                      onPress={() => router.push(`/create-listing?editId=${item.id}` as any)}
                    >
                      <Feather name="edit-2" size={13} color="#fff" />
                      <Text style={[styles.actionBtnText, { color: "#fff" }]}>
                        {item.status === "rejected" ? "Revise & Resubmit" : "Edit Listing"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Action buttons — all approved listings get View; DEMO listings also get Tour */}
                {item.status === "approved" && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.muted }]}
                      onPress={() => router.push(`/listing/${item.listingId}` as any)}
                    >
                      <Feather name="eye" size={13} color={colors.foreground} />
                      <Text style={[styles.actionBtnText, { color: colors.foreground }]}>View</Text>
                    </TouchableOpacity>
                    {demo && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                        onPress={() => router.push(`/tour/${demo.id}` as any)}
                      >
                        <Feather name="rotate-ccw" size={13} color="#fff" />
                        <Text style={[styles.actionBtnText, { color: "#fff" }]}>View Tour</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          );

          // All approved listings are tappable (non-DEMO uses pending store fallback in /listing/[id])
          if (item.status === "approved") {
            return (
              <TouchableOpacity onPress={() => router.push(`/listing/${item.listingId}` as any)}>
                {cardContent}
              </TouchableOpacity>
            );
          }
          return cardContent;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title:         { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle:      { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  addBtn:        { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  list:          { padding: 16, gap: 16 },
  empty:         { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle:    { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyHint:     { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  card:          { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cardHero:      { height: 110, padding: 14, justifyContent: "space-between" },
  statusPill:    { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusPillText:{ color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  heroPrice:     { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  cardBody:      { padding: 14, gap: 8 },
  cardName:      { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cardMeta:      { fontSize: 12, fontFamily: "Inter_400Regular" },
  metricsRow:    { flexDirection: "row", gap: 24, paddingVertical: 4 },
  metric:        {},
  metricVal:     { fontSize: 18, fontFamily: "Inter_700Bold" },
  metricLbl:     { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  statusNote:    { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  statusNoteText:{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  actionRow:     { flexDirection: "row", gap: 8 },
  actionBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
