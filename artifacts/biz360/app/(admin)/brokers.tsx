import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const BROKERS = [
  { id: "1", name: "James Harrington", firm: "Premium Business Brokers", listings: 2, status: "approved", plan: "Broker Pro" },
  { id: "2", name: "Rachel Kim", firm: "EXIT Strategies Australia", listings: 0, status: "pending", plan: "Broker Lite" },
];

export default function AdminBrokers() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [brokers, setBrokers] = useState(BROKERS);

  const approve = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBrokers((p) => p.map((b) => b.id === id ? { ...b, status: "approved" } : b));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Brokers</Text>
      </View>
      <FlatList
        data={brokers}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
            {item.status === "pending" && (
              <TouchableOpacity style={[styles.approveBtn, { backgroundColor: colors.accent }]} onPress={() => approve(item.id)}>
                <Feather name="check" size={14} color="#fff" />
                <Text style={styles.approveText}>Approve Broker Account</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
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
  approveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10 },
  approveText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
