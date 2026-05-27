import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AdminUser, saveUsers, useAdminUsers } from "@/lib/adminStore";

const ROLE_COLORS: Record<string, string> = {
  buyer: "#3B82F6", seller: "#8B5CF6", broker: "#F59E0B", admin: "#EF4444",
};

export default function AdminUsers() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: users, setData: setUsers, loading } = useAdminUsers();

  const showMenu = (user: AdminUser) => {
    const isSuspended = user.status === "suspended";
    Alert.alert(user.name, `${user.email}\nRole: ${user.role} · Joined ${user.joined}`, [
      {
        text: isSuspended ? "Activate Account" : "Suspend Account",
        style: isSuspended ? "default" : "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: isSuspended ? "active" : "suspended" } : u));
        },
      },
      {
        text: "Change Role",
        onPress: () => {
          Alert.alert("Change Role", `Set role for ${user.name}`, [
            { text: "Buyer",  onPress: () => setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: "buyer"  } : u)) },
            { text: "Seller", onPress: () => setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: "seller" } : u)) },
            { text: "Broker", onPress: () => setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: "broker" } : u)) },
            { text: "Cancel", style: "cancel" },
          ]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const activeCount    = users.filter((u) => u.status === "active").length;
  const suspendedCount = users.filter((u) => u.status === "suspended").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Users</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {users.length} registered · {activeCount} active · {suspendedCount} suspended
          </Text>
        </View>
      </View>

      <FlatList
        data={users}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No users found.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: (ROLE_COLORS[item.role] ?? "#6B7280") + "22" }]}>
              <Text style={[styles.avatarText, { color: ROLE_COLORS[item.role] ?? "#6B7280" }]}>
                {item.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </Text>
            </View>
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.email, { color: colors.mutedForeground }]}>{item.email}</Text>
              <View style={styles.tagsRow}>
                <View style={[styles.tag, { backgroundColor: (ROLE_COLORS[item.role] ?? "#6B7280") + "20" }]}>
                  <Text style={[styles.tagText, { color: ROLE_COLORS[item.role] ?? "#6B7280" }]}>{item.role}</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: item.status === "active" ? "#16A34A20" : "#EF444420" }]}>
                  <Text style={[styles.tagText, { color: item.status === "active" ? "#16A34A" : "#EF4444" }]}>{item.status}</Text>
                </View>
                <Text style={[styles.joined, { color: colors.mutedForeground }]}>Joined {item.joined}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.more} onPress={() => showMenu(item)}>
              <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
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
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  list: { padding: 16, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  email: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tagsRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  joined: { fontSize: 10, fontFamily: "Inter_400Regular" },
  more: { padding: 4 },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
