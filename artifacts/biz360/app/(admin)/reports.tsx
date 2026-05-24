import { Feather } from "@expo/vector-icons";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const REPORTS = [
  { id: "1", type: "Misleading financials", listing: "The Daily Press", reporter: "Anonymous buyer", severity: "medium", time: "2h ago" },
  { id: "2", type: "Spam / fake listing", listing: "ABC Cafe (test)", reporter: "System", severity: "high", time: "1d ago" },
];

const SEV_COLORS: Record<string, string> = { high: "#EF4444", medium: "#F59E0B", low: "#3B82F6" };

export default function AdminReports() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Reported Listings</Text>
      </View>
      <FlatList
        data={REPORTS}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.top}>
              <View style={[styles.sevTag, { backgroundColor: SEV_COLORS[item.severity] + "20" }]}>
                <Text style={[styles.sevText, { color: SEV_COLORS[item.severity] }]}>{item.severity.toUpperCase()}</Text>
              </View>
              <Text style={[styles.time, { color: colors.mutedForeground }]}>{item.time}</Text>
            </View>
            <Text style={[styles.type, { color: colors.foreground }]}>{item.type}</Text>
            <Text style={[styles.listing, { color: colors.primary }]}>{item.listing}</Text>
            <Text style={[styles.reporter, { color: colors.mutedForeground }]}>Reported by: {item.reporter}</Text>
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.muted }]}>
                <Text style={[styles.actionText, { color: colors.foreground }]}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#EF444420", borderWidth: 1, borderColor: "#EF4444" }]}>
                <Text style={[styles.actionText, { color: "#EF4444" }]}>Suspend Listing</Text>
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
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  list: { padding: 16, gap: 12 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 8 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sevTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sevText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  type: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  listing: { fontSize: 13, fontFamily: "Inter_500Medium" },
  reporter: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  actionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
