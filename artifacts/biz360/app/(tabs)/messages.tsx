import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { formatThreadTime, Thread, useThreadList } from "@/lib/messageStore";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function ThreadRow({
  item,
  colors,
  onDelete,
}: {
  item: Thread;
  colors: ReturnType<typeof useColors>;
  onDelete: () => void;
}) {
  const last = item.messages[item.messages.length - 1];
  const preview = last ? last.text : "No messages yet";
  const timeLabel = item.updatedAt ? formatThreadTime(item.updatedAt) : "";
  const unread = item.unreadBuyer ?? 0;

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Conversation",
      `Remove your conversation about "${item.listingName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={[styles.thread, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/thread/${item.id}?listingName=${encodeURIComponent(item.listingName)}&sellerName=${encodeURIComponent(item.sellerName)}` as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>{initials(item.sellerName)}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.infoTop}>
          <Text style={[styles.threadName, { color: colors.foreground }]} numberOfLines={1}>{item.sellerName}</Text>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeLabel}</Text>
        </View>
        <Text style={[styles.listingName, { color: colors.primary }]} numberOfLines={1}>{item.listingName}</Text>
        <Text style={[styles.preview, { color: unread > 0 ? colors.foreground : colors.mutedForeground, fontFamily: unread > 0 ? "Inter_600SemiBold" : "Inter_400Regular" }]} numberOfLines={1}>
          {last?.from === "buyer" ? `You: ${preview}` : preview}
        </Text>
      </View>
      {unread > 0 && (
        <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.unreadText}>{unread}</Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.trashBtn}
        onPress={handleDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="trash-2" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { threads, loading, remove } = useThreadList();

  const myThreads   = threads.filter((t) => !t.buyerId || t.buyerId === user?.id);
  const totalUnread = myThreads.reduce((sum, t) => sum + (t.unreadBuyer ?? 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Messages</Text>
        {totalUnread > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{totalUnread}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={myThreads}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <ThreadRow
              item={item}
              colors={colors}
              onDelete={() => remove(item.id)}
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="message-circle" size={44} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No messages yet</Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                Tap "Message Seller" on any listing to start a conversation.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  badge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  thread: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  info: { flex: 1, gap: 2 },
  infoTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  threadName: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  listingName: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  preview: { fontSize: 13 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  unreadText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  trashBtn: { padding: 4, marginLeft: 4 },
  empty: { alignItems: "center", paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyHint: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
