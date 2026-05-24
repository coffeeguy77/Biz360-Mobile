import { Feather } from "@expo/vector-icons";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const LEADS = [
  { id: "1", name: "Michael Reynolds", listing: "Iron Republic Gym", action: "Tour completed · 6:12 avg", assignedTo: "James H.", quality: "hot", time: "30m ago" },
  { id: "2", name: "Angela Torres", listing: "Ember & Stone Restaurant", action: "Financials requested", assignedTo: "Emma K.", quality: "hot", time: "2h ago" },
  { id: "3", name: "Sam Wu", listing: "Iron Republic Gym", action: "Saved listing", assignedTo: "James H.", quality: "warm", time: "1d ago" },
  { id: "4", name: "Rebecca Lane", listing: "Ember & Stone Restaurant", action: "Listing viewed × 3", assignedTo: "Unassigned", quality: "cold", time: "3d ago" },
];

const QC: Record<string, string> = { hot: "#EF4444", warm: "#F59E0B", cold: "#3B82F6" };

export default function BrokerLeads() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Leads</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Route and manage buyer enquiries</Text>
      </View>
      <FlatList
        data={LEADS}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.top}>
              <View style={[styles.qDot, { backgroundColor: QC[item.quality] }]} />
              <Text style={[styles.leadName, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.time, { color: colors.mutedForeground }]}>{item.time}</Text>
            </View>
            <Text style={[styles.listing, { color: colors.primary }]}>{item.listing}</Text>
            <Text style={[styles.action, { color: colors.mutedForeground }]}>{item.action}</Text>
            <View style={styles.bottom}>
              <View style={[styles.assignedTag, { backgroundColor: colors.muted }]}>
                <Feather name="user" size={11} color={colors.mutedForeground} />
                <Text style={[styles.assignedText, { color: colors.mutedForeground }]}>{item.assignedTo}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="message-circle" size={14} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent + "18" }]}>
                  <Feather name="user-check" size={14} color={colors.accent} />
                </TouchableOpacity>
              </View>
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
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  list: { padding: 16, gap: 10 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 6 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  qDot: { width: 8, height: 8, borderRadius: 4 },
  leadName: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  listing: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  action: { fontSize: 13, fontFamily: "Inter_400Regular" },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  assignedTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  assignedText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
