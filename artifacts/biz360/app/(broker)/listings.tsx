import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { DEMO_LISTINGS, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { getPendingListings, PendingListing, savePendingListings } from "@/lib/adminStore";

const STATUS_CONFIG = {
  pending:  { label: "Pending Review", color: "#F59E0B", icon: "clock"       },
  approved: { label: "Active",         color: "#16A34A", icon: "check-circle" },
  rejected: { label: "Rejected",       color: "#EF4444", icon: "x-circle"     },
  sold:     { label: "Sold",           color: "#8B5CF6", icon: "tag"          },
} as const;

export default function BrokerListings() {
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

  const handleDelete = (item: PendingListing, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Listing", `Remove "${name}" from your listings?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          const updated = listings.filter((l) => l.id !== item.id);
          setListings(updated);
          const all = await getPendingListings();
          await savePendingListings(all.filter((l) => l.id !== item.id));
        },
      },
    ]);
  };

  const activeCount  = listings.filter((l) => l.status === "approved").length;
  const pendingCount = listings.filter((l) => l.status === "pending").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Listings</Text>
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

          const card = (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: item.status === "rejected" ? "#EF444440" : colors.border }]}>
              <View style={[styles.cardHero, { backgroundColor: heroColor }]}>
                <View style={[styles.statusPill, { backgroundColor: sc.color }]}>
                  <Feather name={sc.icon as any} size={10} color="#fff" />
                  <Text style={styles.statusPillText}>{sc.label}</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteIcon}
                  onPress={() => handleDelete(item, name)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather name="trash-2" size={15} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
                <Text style={styles.heroName} numberOfLines={1}>{name}</Text>
                <Text style={styles.heroPrice}>{price && price > 0 ? formatPrice(price) : "Price TBC"}</Text>
              </View>

              <View style={styles.cardBody}>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {[suburb, state].filter(Boolean).join(", ")}{category ? ` · ${category}` : ""}
                </Text>

                {demo && item.status === "approved" && (
                  <View style={styles.metricsRow}>
                    {[
                      { lbl: "Views", val: demo.viewCount  },
                      { lbl: "Saved", val: demo.savedCount },
                      { lbl: "Tours", val: demo.tourStarts },
                    ].map(({ lbl, val }) => (
                      <View key={lbl} style={styles.metric}>
                        <Text style={[styles.metricVal, { color: colors.primary }]}>{val}</Text>
                        <Text style={[styles.metricLbl, { color: colors.mutedForeground }]}>{lbl}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {item.status === "pending" && (
                  <View style={[styles.statusNote, { backgroundColor: "#F59E0B12", borderColor: "#F59E0B30" }]}>
                    <Feather name="info" size={12} color="#F59E0B" />
                    <Text style={[styles.statusNoteText, { color: "#F59E0B" }]}>
                      Awaiting admin approval. Typically reviewed within 1 business day.
                    </Text>
                  </View>
                )}
                {item.status === "rejected" && (
                  <View style={[styles.statusNote, { backgroundColor: "#EF444412", borderColor: "#EF444430" }]}>
                    <Feather name="alert-circle" size={12} color="#EF4444" />
                    <Text style={[styles.statusNoteText, { color: "#EF4444" }]}>
                      Not approved. Contact support or revise and resubmit.
                    </Text>
                  </View>
                )}

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

                {item.status === "approved" && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.muted }]}
                      onPress={() => router.push(`/listing/${item.listingId}` as any)}
                    >
                      <Feather name="eye" size={13} color={colors.foreground} />
                      <Text style={[styles.actionBtnText, { color: colors.foreground }]}>View</Text>
                    </TouchableOpacity>
                    {/* Manage Tour — opens the shared tour builder scoped to this listing */}
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#7C3AED" }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(`/(seller)/tours?listingId=${item.listingId}` as any);
                      }}
                    >
                      <Feather name="rotate-ccw" size={13} color="#fff" />
                      <Text style={[styles.actionBtnText, { color: "#fff" }]}>Tour</Text>
                    </TouchableOpacity>
                    {demo && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                        onPress={() => router.push(`/tour/${demo.id}` as any)}
                      >
                        <Feather name="play" size={13} color="#fff" />
                        <Text style={[styles.actionBtnText, { color: "#fff" }]}>Preview</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          );

          if (item.status === "approved") {
            return (
              <TouchableOpacity onPress={() => router.push(`/listing/${item.listingId}` as any)}>
                {card}
              </TouchableOpacity>
            );
          }
          return card;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title:         { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle:      { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn:        { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  list:          { padding: 16, gap: 12 },
  empty:         { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle:    { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyHint:     { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  card:          { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardHero:      { height: 90, padding: 14, justifyContent: "flex-end", gap: 2 },
  statusPill:    { position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  deleteIcon:    { position: "absolute", top: 10, right: 10 },
  statusPillText:{ color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  heroName:      { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  heroPrice:     { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  cardBody:      { padding: 12, gap: 8 },
  meta:          { fontSize: 12, fontFamily: "Inter_400Regular" },
  metricsRow:    { flexDirection: "row", gap: 20 },
  metric:        {},
  metricVal:     { fontSize: 16, fontFamily: "Inter_700Bold" },
  metricLbl:     { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  statusNote:    { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  statusNoteText:{ flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  actionRow:     { flexDirection: "row", gap: 8 },
  actionBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
