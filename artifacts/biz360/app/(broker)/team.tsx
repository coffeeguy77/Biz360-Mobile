import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const TEAM = [
  { id: "1", name: "James Harrington", role: "Senior Broker", listings: 2, leads: 34, color: "#2563EB" },
  { id: "2", name: "Emma Kavanaugh", role: "Associate Broker", listings: 1, leads: 18, color: "#8B5CF6" },
  { id: "3", name: "Ryan Brooks", role: "Junior Agent", listings: 0, leads: 7, color: "#F59E0B" },
];

export default function TeamScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Team</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]}>
          <Feather name="user-plus" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        showsVerticalScrollIndicator={false}
      >
        {TEAM.map((member) => (
          <View key={member.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: member.color }]}>
              <Text style={styles.avatarText}>{member.name.split(" ").map((n) => n[0]).join("")}</Text>
            </View>
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.foreground }]}>{member.name}</Text>
              <Text style={[styles.role, { color: colors.mutedForeground }]}>{member.role}</Text>
              <View style={styles.statsRow}>
                <Text style={[styles.stat, { color: colors.primary }]}>{member.listings} listings</Text>
                <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
                <Text style={[styles.stat, { color: colors.primary }]}>{member.leads} leads</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.moreBtn}>
              <Feather name="more-horizontal" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, gap: 12 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  info: { flex: 1 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  role: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  stat: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  dot: { fontSize: 12 },
  moreBtn: { padding: 4 },
});
