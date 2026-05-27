import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AdminBroker, useAdminBrokers } from "@/lib/adminStore";

const PLANS = ["Broker Lite", "Broker Growth", "Broker Pro", "Enterprise"];

export default function AdminBrokers() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: brokers, setData: setBrokers } = useAdminBrokers();

  const approve = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBrokers((prev) => prev.map((b) => b.id === id ? { ...b, status: "approved" } : b));
  };

  const showMenu = (broker: AdminBroker) => {
    Alert.alert(broker.name, `${broker.firm}\n${broker.plan} · ${broker.listings} listings`, [
      {
        text: broker.status === "approved" ? "Suspend Account" : "Approve Account",
        style: broker.status === "approved" ? "destructive" : "default",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setBrokers((prev) => prev.map((b) => b.id === broker.id ? { ...b, status: broker.status === "approved" ? "pending" : "approved" } : b));
        },
      },
      {
        text: "Change Plan",
        onPress: () => {
          Alert.alert("Change Plan", `Current: ${broker.plan}`, [
            ...PLANS.map((plan) => ({
              text: plan,
              onPress: () => setBrokers((prev) => prev.map((b) => b.id === broker.id ? { ...b, plan } : b)),
            })),
            { text: "Cancel", style: "cancel" as const },
          ]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const pendingCount   = brokers.filter((b) => b.status === "pending").length;
  const approvedCount  = brokers.filter((b) => b.status === "approved").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Brokers</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {approvedCount} approved · {pendingCount} pending review
          </Text>
        </View>
        {pendingCount > 0 && (
          <View style={[styles.badge, { backgroundColor: "#F59E0B" }]}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>
      <FlatList
        data={brokers}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: item.status === "pending" ? "#F59E0B60" : colors.border }]}>
            <View style={styles.top}>
              <View style={styles.nameBox}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.firm, { color: colors.mutedForeground }]}>{item.firm}</Text>
              </View>
              <View style={[styles.planTag, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.planText, { color: colors.primary }]}>{item.plan}</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{item.listings} active listings</Text>
              <View style={[styles.statusTag, { backgroundColor: item.status === "approved" ? "#16A34A20" : "#F59E0B20" }]}>
                <Text style={[styles.statusText, { color: item.status === "approved" ? "#16A34A" : "#F59E0B" }]}>
                  {item.status === "approved" ? "Approved" : "Pending Review"}
                </Text>
              </View>
            </View>
            <View style={styles.actions}>
              {item.status === "pending" && (
                <TouchableOpacity style={[styles.approveBtn, { backgroundColor: colors.accent }]} onPress={() => approve(item.id)}>
                  <Feather name="check" size={14} color="#fff" />
                  <Text style={styles.approveTxt}>Approve Broker Account</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.moreBtn, { backgroundColor: colors.muted }]} onPress={() => showMenu(item)}>
                <Feather name="more-horizontal" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  list: { padding: 16, gap: 12 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 10 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  nameBox: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  firm: { fontSize: 12, fontFamily: "Inter_400Regular" },
  planTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  planText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  actions: { flexDirection: "row", gap: 8 },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10 },
  approveTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  moreBtn: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
