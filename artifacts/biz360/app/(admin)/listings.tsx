import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { DEMO_LISTINGS } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { CleanupSettings, DEFAULT_CLEANUP_SETTINGS, getCleanupSettings, PendingListing, useAdminPending } from "@/lib/adminStore";

const domain   = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}/api` : "/api";

type Tab = "pending" | "active" | "sold";

function formatPrice(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
}

function formatAge(ts: number) {
  const diff = Date.now() - ts;
  const h = Math.round(diff / 3600000);
  if (h < 1)   return "Just now";
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function retentionLabel(soldAt: number | undefined, retentionDays: number): string {
  if (!soldAt) return "Photos pending cleanup";
  const expiresAt  = soldAt + retentionDays * 86_400_000;
  const remaining  = expiresAt - Date.now();
  if (remaining <= 0) return "Photos eligible for deletion";
  const daysLeft   = Math.ceil(remaining / 86_400_000);
  return `Photos retained until ${formatDate(expiresAt)} (${daysLeft}d)`;
}

function resolveDisplay(item: PendingListing) {
  const demo = DEMO_LISTINGS.find((l) => l.id === item.listingId);
  if (demo) {
    return {
      businessName:  demo.businessName,
      suburb:        demo.suburb,
      state:         demo.state,
      category:      demo.category,
      askingPrice:   demo.askingPrice,
      weeklyRevenue: demo.weeklyRevenue,
      heroColor:     demo.heroColor,
      demoId:        demo.id,
    };
  }
  return {
    businessName:  item.businessName  ?? "Unnamed Business",
    suburb:        item.suburb        ?? "Unknown",
    state:         item.state         ?? "",
    category:      item.category      ?? "Uncategorized",
    askingPrice:   item.askingPrice   ?? 0,
    weeklyRevenue: item.weeklyRevenue ?? 0,
    heroColor:     item.heroColor     ?? "#2563EB",
    demoId:        null,
  };
}

async function deleteCloudinaryFolder(submittedBy: string, listingId: string) {
  const safeUser = submittedBy.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeLid  = listingId.replace(/[^a-zA-Z0-9_-]/g, "_");
  await fetch(`${API_BASE}/biz360/img/folder`, {
    method:  "DELETE",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ prefix: `biz360/${safeUser}/${safeLid}` }),
  });
}

export default function AdminListings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: pending, setData: setPending } = useAdminPending();
  const [tab, setTab]                       = useState<Tab>("pending");
  const [cleanupSettings, setCleanupSettings] = useState<CleanupSettings>(DEFAULT_CLEANUP_SETTINGS);

  useEffect(() => {
    getCleanupSettings().then(setCleanupSettings).catch(() => {});
  }, []);

  const queue  = pending.filter((p) => p.status === "pending");
  const active = pending.filter((p) => p.status === "approved");
  const sold   = pending.filter((p) => p.status === "sold");

  const listData: PendingListing[] =
    tab === "pending" ? queue :
    tab === "active"  ? active :
    sold;

  const showAccountMenu = () => {
    Alert.alert(user?.name ?? "Admin", user?.email ?? "", [
      { text: "Switch Account", onPress: () => router.replace("/(auth)/welcome" as any) },
      {
        text: "Sign Out", style: "destructive", onPress: async () => {
          await logout();
          router.replace("/(auth)/welcome" as any);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const approve = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPending((prev) => prev.map((p) => p.id === id ? { ...p, status: "approved" } : p));
  };

  const reject = (id: string, name: string) => {
    Alert.alert("Reject Listing", `Reject "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject", style: "destructive", onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setPending((prev) => prev.map((p) => p.id === id ? { ...p, status: "rejected" } : p));
        },
      },
    ]);
  };

  const deletePending = (id: string, name: string) => {
    Alert.alert("Delete Listing", `Permanently delete "${name}" from the queue?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setPending((prev) => prev.filter((p) => p.id !== id));
        },
      },
    ]);
  };

  const markSold = (item: PendingListing, name: string) => {
    const days = cleanupSettings.soldRetentionDays;
    Alert.alert(
      "Mark as Sold",
      `Mark "${name}" as sold?\n\nTour photos will be kept for ${days} days then automatically removed. You can override this in the Sold tab.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Sold", style: "destructive", onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setPending((prev) => prev.map((p) =>
              p.id === item.id ? { ...p, status: "sold", soldAt: Date.now() } : p,
            ));
          },
        },
      ],
    );
  };

  const deleteNow = (item: PendingListing, name: string) => {
    Alert.alert(
      "Delete Photos Now",
      `Override the retention period and delete all 360° tour photos for "${name}" immediately? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Now", style: "destructive", onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            try {
              await deleteCloudinaryFolder(item.submittedBy, item.listingId);
              Alert.alert("Done", "Tour photos have been deleted.");
            } catch {
              Alert.alert("Error", "Could not delete photos. Try again.");
            }
          },
        },
      ],
    );
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: queue.length  },
    { key: "active",  label: "Active",  count: active.length },
    { key: "sold",    label: "Sold",    count: sold.length   },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Listings</Text>
          {queue.length > 0 && (
            <View style={[styles.badge, { backgroundColor: "#EF4444" }]}>
              <Text style={styles.badgeText}>{queue.length}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.avatarBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={showAccountMenu}
        >
          <Text style={[styles.avatarText, { color: colors.foreground }]}>{user?.name?.charAt(0) ?? "A"}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && { borderBottomColor: "#3B82F6", borderBottomWidth: 2 }]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, { color: tab === t.key ? "#3B82F6" : colors.mutedForeground }]}>
              {t.label}
            </Text>
            {t.count > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: tab === t.key ? "#3B82F6" : colors.border }]}>
                <Text style={[styles.tabBadgeText, { color: tab === t.key ? "#fff" : colors.mutedForeground }]}>
                  {t.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={listData}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather
              name={tab === "pending" ? "check-circle" : tab === "active" ? "list" : "tag"}
              size={40}
              color={colors.accent}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {tab === "pending" ? "All caught up!" : tab === "active" ? "No active listings" : "No sold listings"}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {tab === "pending"
                ? "No pending listings to review."
                : tab === "active"
                ? "Approved listings appear here."
                : "Listings marked as sold appear here."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const d = resolveDisplay(item);
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.cardTop, { backgroundColor: d.heroColor }]}>
                {tab !== "sold" && (
                  <TouchableOpacity
                    style={styles.deleteIcon}
                    onPress={() => deletePending(item.id, d.businessName)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="trash-2" size={14} color="rgba(255,255,255,0.8)" />
                  </TouchableOpacity>
                )}
                <View style={[styles.waitTag, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
                  <Feather name="clock" size={10} color="#fff" />
                  <Text style={styles.waitText}>
                    {tab === "sold"
                      ? (item.soldAt ? `Sold ${formatDate(item.soldAt)}` : "Sold")
                      : formatAge(item.submittedAt)}
                  </Text>
                </View>
                <View style={[styles.rolePill, { backgroundColor: "rgba(0,0,0,0.35)" }]}>
                  <Text style={styles.roleText}>{item.submittedByRole ?? "seller"}</Text>
                </View>
                <Text style={styles.cardName}>{d.businessName}</Text>
                <Text style={styles.cardPrice}>
                  {d.askingPrice > 0 ? formatPrice(d.askingPrice) : "Price TBC"} · {d.suburb}{d.state ? `, ${d.state}` : ""}
                </Text>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  {[
                    { label: "Category",    val: d.category },
                    { label: "State",       val: d.state || "—" },
                    { label: "Weekly Rev.", val: d.weeklyRevenue > 0 ? `$${d.weeklyRevenue.toLocaleString()}` : "—" },
                  ].map(({ label, val }) => (
                    <View key={label}>
                      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
                      <Text style={[styles.infoVal,   { color: colors.foreground }]}>{val}</Text>
                    </View>
                  ))}
                </View>

                {tab === "pending" && (
                  <View style={styles.actions}>
                    {d.demoId ? (
                      <TouchableOpacity
                        style={[styles.previewBtn, { borderColor: colors.border }]}
                        onPress={() => router.push(`/listing/${d.demoId}` as any)}
                      >
                        <Feather name="eye" size={14} color={colors.foreground} />
                        <Text style={[styles.previewText, { color: colors.foreground }]}>Preview</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.previewBtn, { borderColor: colors.border, opacity: 0.4 }]}>
                        <Feather name="eye-off" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.previewText, { color: colors.mutedForeground }]}>No Preview</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.rejectBtn, { borderColor: "#EF4444" }]}
                      onPress={() => reject(item.id, d.businessName)}
                    >
                      <Feather name="x" size={16} color="#EF4444" />
                      <Text style={styles.rejectText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveBtn, { backgroundColor: colors.accent }]}
                      onPress={() => approve(item.id)}
                    >
                      <Feather name="check" size={16} color="#fff" />
                      <Text style={styles.approveText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {tab === "active" && (
                  <View style={styles.actions}>
                    {d.demoId ? (
                      <TouchableOpacity
                        style={[styles.previewBtn, { borderColor: colors.border }]}
                        onPress={() => router.push(`/listing/${d.demoId}` as any)}
                      >
                        <Feather name="eye" size={14} color={colors.foreground} />
                        <Text style={[styles.previewText, { color: colors.foreground }]}>View</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.previewBtn, { borderColor: colors.border, opacity: 0.4 }]}>
                        <Feather name="eye-off" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.previewText, { color: colors.mutedForeground }]}>No Preview</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.soldBtn}
                      onPress={() => markSold(item, d.businessName)}
                    >
                      <Feather name="tag" size={16} color="#fff" />
                      <Text style={styles.soldBtnText}>Mark Sold</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {tab === "sold" && (
                  <View style={styles.soldFooter}>
                    <View style={[styles.retentionTag, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Feather name="clock" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.retentionText, { color: colors.mutedForeground }]}>
                        {retentionLabel(item.soldAt, cleanupSettings.soldRetentionDays)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.deleteNowBtn, { borderColor: "#EF4444" }]}
                      onPress={() => deleteNow(item, d.businessName)}
                    >
                      <Feather name="trash-2" size={13} color="#EF4444" />
                      <Text style={styles.deleteNowText}>Delete Now</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 8 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  list: { padding: 16, gap: 14 },
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cardTop: { minHeight: 90, padding: 14, justifyContent: "flex-end", gap: 2 },
  deleteIcon: { position: "absolute", top: 10, right: 10, zIndex: 1 },
  waitTag: { position: "absolute", top: 10, right: 34, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  waitText: { color: "#fff", fontSize: 10, fontFamily: "Inter_500Medium" },
  rolePill: { position: "absolute", top: 10, left: 10, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  roleText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  cardName: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cardPrice: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cardBody: { padding: 14, gap: 12 },
  infoRow: { flexDirection: "row", justifyContent: "space-between" },
  infoLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase" },
  infoVal: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  actions: { flexDirection: "row", gap: 8 },
  previewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  previewText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10, borderWidth: 1 },
  rejectText: { color: "#EF4444", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10 },
  approveText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  soldBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: "#16A34A" },
  soldBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  soldFooter: { gap: 8 },
  retentionTag: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  retentionText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  deleteNowBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  deleteNowText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
