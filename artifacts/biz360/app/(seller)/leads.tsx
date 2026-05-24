import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const LEADS = [
  { id: "l1", name: "David Park", action: "Requested financials", time: "1h ago", quality: "hot", message: true },
  { id: "l2", name: "Emma Thompson", action: "Completed 360 Tour (4:32)", time: "3h ago", quality: "warm", message: false },
  { id: "l3", name: "Mike Johnson", action: "Saved listing", time: "Yesterday", quality: "warm", message: true },
  { id: "l4", name: "Lisa Chen", action: "Viewed listing", time: "2 days ago", quality: "cold", message: false },
  { id: "l5", name: "Tom Wilson", action: "Requested NDA", time: "3 days ago", quality: "hot", message: true },
];

const QUALITY_COLORS: Record<string, string> = { hot: "#EF4444", warm: "#F59E0B", cold: "#3B82F6" };

export default function LeadsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? LEADS : LEADS.filter((l) => l.quality === filter);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Leads</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{LEADS.length} total</Text>
      </View>
      <View style={styles.filterRow}>
        {["all", "hot", "warm", "cold"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, { backgroundColor: filter === f ? colors.primary : colors.muted }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, { color: filter === f ? "#fff" : colors.foreground }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled={!!filtered.length}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.leadCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.leadAvatar, { backgroundColor: QUALITY_COLORS[item.quality] + "20" }]}>
              <Text style={[styles.leadAvatarText, { color: QUALITY_COLORS[item.quality] }]}>
                {item.name.split(" ").map((n) => n[0]).join("")}
              </Text>
            </View>
            <View style={styles.leadInfo}>
              <View style={styles.leadTop}>
                <Text style={[styles.leadName, { color: colors.foreground }]}>{item.name}</Text>
                <View style={[styles.qualityDot, { backgroundColor: QUALITY_COLORS[item.quality] }]} />
              </View>
              <Text style={[styles.leadAction, { color: colors.mutedForeground }]}>{item.action}</Text>
              <Text style={[styles.leadTime, { color: colors.mutedForeground }]}>{item.time}</Text>
            </View>
            {item.message && (
              <TouchableOpacity style={[styles.msgBtn, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="message-circle" size={16} color={colors.primary} />
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
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  filterText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  list: { paddingHorizontal: 16, gap: 10 },
  leadCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  leadAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  leadAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  leadInfo: { flex: 1 },
  leadTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  leadName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  qualityDot: { width: 7, height: 7, borderRadius: 4 },
  leadAction: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  leadTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  msgBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
