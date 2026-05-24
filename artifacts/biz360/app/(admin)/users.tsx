import { Feather } from "@expo/vector-icons";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const USERS = [
  { id: "1", name: "Alex Chen", email: "alex@example.com", role: "buyer", status: "active", joined: "Jan 2024" },
  { id: "2", name: "Sarah Mitchell", email: "sarah@example.com", role: "seller", status: "active", joined: "Mar 2024" },
  { id: "3", name: "James Harrington", email: "james@premiumbiz.com.au", role: "broker", status: "active", joined: "Feb 2024" },
  { id: "4", name: "Unknown User", email: "spam@example.com", role: "buyer", status: "suspended", joined: "May 2024" },
];

const ROLE_COLORS: Record<string, string> = { buyer: "#3B82F6", seller: "#8B5CF6", broker: "#F59E0B", admin: "#EF4444" };

export default function AdminUsers() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Users</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{USERS.length} registered</Text>
      </View>
      <FlatList
        data={USERS}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[item.role] + "22" }]}>
              <Text style={[styles.avatarText, { color: ROLE_COLORS[item.role] }]}>{item.name.split(" ").map((n) => n[0]).join("")}</Text>
            </View>
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.email, { color: colors.mutedForeground }]}>{item.email}</Text>
              <View style={styles.tagsRow}>
                <View style={[styles.tag, { backgroundColor: ROLE_COLORS[item.role] + "20" }]}>
                  <Text style={[styles.tagText, { color: ROLE_COLORS[item.role] }]}>{item.role}</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: item.status === "active" ? "#16A34A20" : "#EF444420" }]}>
                  <Text style={[styles.tagText, { color: item.status === "active" ? "#16A34A" : "#EF4444" }]}>{item.status}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.more}>
              <Feather name="more-vertical" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
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
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  email: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tagsRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  more: { padding: 4 },
});
