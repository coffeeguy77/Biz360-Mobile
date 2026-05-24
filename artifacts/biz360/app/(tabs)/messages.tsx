import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const DEMO_THREADS = [
  {
    id: "thread-001",
    name: "Sarah Mitchell (Seller)",
    listing: "The Daily Press Espresso Bar",
    lastMessage: "Thanks for your interest! The lease has 2 options remaining...",
    time: "2h ago",
    unread: 2,
    avatar: "SM",
  },
  {
    id: "thread-002",
    name: "James Harrington (Broker)",
    listing: "Iron Republic Gym",
    lastMessage: "I've forwarded your enquiry to the vendor. They'd like to arrange...",
    time: "Yesterday",
    unread: 0,
    avatar: "JH",
  },
  {
    id: "thread-003",
    name: "SpinCity Support",
    listing: "SpinCity Laundromat",
    lastMessage: "The financial statements from FY23 are now available for download.",
    time: "3d ago",
    unread: 0,
    avatar: "SC",
  },
];

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Messages</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>2</Text>
        </View>
      </View>

      <FlatList
        data={DEMO_THREADS}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.thread, { borderBottomColor: colors.border }]}
            onPress={() => router.push(`/thread/${item.id}` as any)}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{item.avatar}</Text>
            </View>
            <View style={styles.info}>
              <View style={styles.infoTop}>
                <Text style={[styles.threadName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>{item.time}</Text>
              </View>
              <Text style={[styles.listingName, { color: colors.primary }]} numberOfLines={1}>
                {item.listing}
              </Text>
              <Text style={[styles.preview, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            </View>
            {item.unread > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }}
        scrollEnabled={!!DEMO_THREADS.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="message-circle" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No messages yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  badge: {
    backgroundColor: "#2563EB", borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  thread: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  info: { flex: 1, gap: 2 },
  infoTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  threadName: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  listingName: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  preview: { fontSize: 13, fontFamily: "Inter_400Regular" },
  unreadBadge: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  unreadText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
});
