import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const THREADS = [
  { id: "thread-001", name: "Alex Chen (Buyer)", listing: "The Daily Press Espresso Bar", lastMessage: "Can you share more about the lease renewal options?", time: "1h ago", unread: 1 },
  { id: "thread-002", name: "David Park (Buyer)", listing: "The Daily Press Espresso Bar", lastMessage: "I'd like to request the financial statements.", time: "3h ago", unread: 0 },
];

export default function SellerMessages() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Messages</Text>
      </View>
      <FlatList
        data={THREADS}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.thread, { borderBottomColor: colors.border }]} onPress={() => router.push(`/thread/${item.id}` as any)}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{item.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</Text>
            </View>
            <View style={styles.info}>
              <View style={styles.topRow}>
                <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>{item.time}</Text>
              </View>
              <Text style={[styles.listing, { color: colors.primary }]} numberOfLines={1}>{item.listing}</Text>
              <Text style={[styles.preview, { color: colors.mutedForeground }]} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
            {item.unread > 0 && <View style={[styles.unread, { backgroundColor: colors.primary }]}><Text style={styles.unreadText}>{item.unread}</Text></View>}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  list: {},
  thread: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  info: { flex: 1, gap: 2 },
  topRow: { flexDirection: "row", justifyContent: "space-between" },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  listing: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  preview: { fontSize: 13, fontFamily: "Inter_400Regular" },
  unread: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  unreadText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
});
