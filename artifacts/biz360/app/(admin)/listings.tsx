import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { DEMO_LISTINGS, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { useAdminPending } from "@/lib/adminStore";

export default function AdminListings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: pending, setData: setPending, loading } = useAdminPending();

  const queue = pending.filter((p) => p.status === "pending");

  const showAccountMenu = () => {
    Alert.alert(user?.name ?? "Admin", user?.email ?? "", [
      { text: "Switch Account", onPress: () => router.replace("/(auth)/welcome" as any) },
      { text: "Sign Out", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/welcome" as any); } },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const approve = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPending((prev) => prev.map((p) => p.id === id ? { ...p, status: "approved" } : p));
  };

  const reject = (id: string) => {
    Alert.alert("Reject Listing", "Are you sure you want to reject this listing?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject", style: "destructive", onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setPending((prev) => prev.map((p) => p.id === id ? { ...p, status: "rejected" } : p));
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Listing Approvals</Text>
          {queue.length > 0 && (
            <View style={[styles.badge, { backgroundColor: "#EF4444" }]}>
              <Text style={styles.badgeText}>{queue.length}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={[styles.avatarBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={showAccountMenu}>
          <Text style={[styles.avatarText, { color: colors.foreground }]}>{user?.name?.charAt(0) ?? "A"}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={queue}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="check-circle" size={40} color={colors.accent} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>All caught up!</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pending listings to review.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const listing = DEMO_LISTINGS.find((l) => l.id === item.listingId);
          if (!listing) return null;
          const waitHours = Math.round((Date.now() - item.submittedAt) / 3600000);
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.cardTop, { backgroundColor: listing.heroColor }]}>
                <View style={[styles.waitTag, { backgroundColor: "rgba(0,0,0,0.4)" }]}>
                  <Feather name="clock" size={10} color="#fff" />
                  <Text style={styles.waitText}>Waiting {waitHours}h</Text>
                </View>
                <Text style={styles.cardName}>{listing.businessName}</Text>
                <Text style={styles.cardPrice}>{formatPrice(listing.askingPrice)} · {listing.suburb}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  {[
                    { label: "Category",    val: listing.category },
                    { label: "State",       val: listing.state },
                    { label: "Weekly Rev.", val: `$${listing.weeklyRevenue.toLocaleString()}` },
                  ].map(({ label, val }) => (
                    <View key={label}>
                      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
                      <Text style={[styles.infoVal,   { color: colors.foreground }]}>{val}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={[styles.previewBtn, { borderColor: colors.border }]} onPress={() => router.push(`/listing/${listing.id}` as any)}>
                    <Feather name="eye" size={14} color={colors.foreground} />
                    <Text style={[styles.previewText, { color: colors.foreground }]}>Preview</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.rejectBtn, { borderColor: "#EF4444" }]} onPress={() => reject(item.id)}>
                    <Feather name="x" size={16} color="#EF4444" />
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.approveBtn, { backgroundColor: colors.accent }]} onPress={() => approve(item.id)}>
                    <Feather name="check" size={16} color="#fff" />
                    <Text style={styles.approveText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  list: { padding: 16, gap: 14 },
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cardTop: { height: 90, padding: 14, justifyContent: "flex-end", gap: 2 },
  waitTag: { position: "absolute", top: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  waitText: { color: "#fff", fontSize: 10, fontFamily: "Inter_500Medium" },
  cardName: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cardPrice: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cardBody: { padding: 14, gap: 12 },
  infoRow: { flexDirection: "row", justifyContent: "space-between" },
  infoLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase" },
  infoVal: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  actions: { flexDirection: "row", gap: 8 },
  previewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  previewText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10, borderWidth: 1 },
  rejectText: { color: "#EF4444", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10 },
  approveText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
