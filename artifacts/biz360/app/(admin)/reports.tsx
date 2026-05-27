import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { suspendListing, useAdminReports } from "@/lib/adminStore";

const SEV_COLORS: Record<string, string> = { high: "#EF4444", medium: "#F59E0B", low: "#3B82F6" };

type Filter = "open" | "all";

function formatAge(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function AdminReports() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: reports, setData: setReports, loading } = useAdminReports();
  const [filter, setFilter] = useState<Filter>("open");

  const visible = filter === "open" ? reports.filter((r) => r.status === "open") : reports;
  const openCount = reports.filter((r) => r.status === "open").length;

  const dismiss = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: "dismissed" } : r));
  };

  const suspend = (id: string, listing: string, listingId?: string) => {
    Alert.alert("Suspend Listing", `This will remove "${listing}" from the marketplace. Continue?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Suspend", style: "destructive", onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: "suspended" } : r));
          if (listingId) suspendListing(listingId).catch(() => {});
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Reports</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Loading…</Text>
          </View>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Reports</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{openCount} open · {reports.length} total</Text>
        </View>
        <View style={styles.filterRow}>
          {(["open", "all"] as Filter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, { backgroundColor: filter === f ? colors.primary : colors.muted }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, { color: filter === f ? "#fff" : colors.mutedForeground }]}>
                {f === "open" ? "Open" : "All"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="shield" size={40} color={colors.accent} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No open reports</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>All reports have been resolved.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: item.status !== "open" ? 0.55 : 1 }]}>
            <View style={styles.top}>
              <View style={[styles.sevTag, { backgroundColor: SEV_COLORS[item.severity] + "20" }]}>
                <Text style={[styles.sevText, { color: SEV_COLORS[item.severity] }]}>{item.severity.toUpperCase()}</Text>
              </View>
              {item.status !== "open" && (
                <View style={[styles.resolvedTag, { backgroundColor: item.status === "dismissed" ? "#6B728020" : "#EF444420" }]}>
                  <Text style={[styles.resolvedText, { color: item.status === "dismissed" ? "#6B7280" : "#EF4444" }]}>
                    {item.status === "dismissed" ? "Dismissed" : "Suspended"}
                  </Text>
                </View>
              )}
              <Text style={[styles.time, { color: colors.mutedForeground }]}>{formatAge(item.createdAt)}</Text>
            </View>
            <Text style={[styles.type, { color: colors.foreground }]}>{item.type}</Text>
            <Text style={[styles.listing, { color: colors.primary }]}>{item.listing}</Text>
            <Text style={[styles.reporter, { color: colors.mutedForeground }]}>Reported by: {item.reporter}</Text>
            {item.status === "open" && (
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.muted }]} onPress={() => dismiss(item.id)}>
                  <Text style={[styles.actionText, { color: colors.foreground }]}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#EF444420", borderWidth: 1, borderColor: "#EF4444" }]} onPress={() => suspend(item.id, item.listing, item.listingId)}>
                  <Text style={[styles.actionText, { color: "#EF4444" }]}>Suspend Listing</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  filterRow: { flexDirection: "row", gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  filterText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 8 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  sevTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sevText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  resolvedTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  resolvedText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  time: { fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: "auto" },
  type: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  listing: { fontSize: 13, fontFamily: "Inter_500Medium" },
  reporter: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  actionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
