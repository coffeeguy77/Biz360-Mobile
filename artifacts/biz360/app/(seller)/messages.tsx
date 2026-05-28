import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, router } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getPendingListings } from "@/lib/adminStore";
import { deleteThread, formatThreadTime, Thread, useThreadList } from "@/lib/messageStore";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function ThreadRow({
  item, colors, onDelete,
}: {
  item: Thread;
  colors: ReturnType<typeof useColors>;
  onDelete: () => void;
}) {
  const last    = item.messages[item.messages.length - 1];
  const preview = last ? last.text : "No messages yet";
  const unread  = item.unreadSeller ?? 0;

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Conversation", `Remove the conversation about "${item.listingName}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.thread, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/thread/${item.id}?listingName=${encodeURIComponent(item.listingName)}&sellerName=${encodeURIComponent(item.sellerName)}&buyerName=${encodeURIComponent(item.buyerName)}` as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: "#16A34A22" }]}>
        <Text style={[styles.avatarText, { color: "#16A34A" }]}>{initials(item.buyerName)}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{item.buyerName}</Text>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>{formatThreadTime(item.updatedAt)}</Text>
        </View>
        <Text style={[styles.listing, { color: colors.primary }]} numberOfLines={1}>{item.listingName}</Text>
        <Text
          style={[styles.preview, { color: unread > 0 ? colors.foreground : colors.mutedForeground, fontFamily: unread > 0 ? "Inter_600SemiBold" : "Inter_400Regular" }]}
          numberOfLines={1}
        >
          {last?.from === "seller" ? `You: ${preview}` : preview}
        </Text>
      </View>
      {unread > 0 && (
        <View style={[styles.unread, { backgroundColor: "#16A34A" }]}>
          <Text style={styles.unreadText}>{unread}</Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.trashBtn}
        onPress={handleDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="trash-2" size={15} color={colors.mutedForeground} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function SellerMessages() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { threads, loading, remove, refresh } = useThreadList();
  const [myListingIds, setMyListingIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      if (!user?.id) return;
      getPendingListings().then((all) => {
        setMyListingIds(all.filter((p) => p.submittedBy === user.id).map((p) => p.listingId));
      });
    }, [user?.id, refresh]),
  );

  const myThreads    = threads.filter((t) => myListingIds.includes(t.listingId));
  const totalUnread  = myThreads.reduce((sum, t) => sum + (t.unreadSeller ?? 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Messages</Text>
        {totalUnread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalUnread}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#16A34A" />
        </View>
      ) : (
        <FlatList
          data={myThreads}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ThreadRow item={item} colors={colors} onDelete={() => remove(item.id)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="message-circle" size={44} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No enquiries yet</Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                Buyer messages about your listings will appear here.
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
  header:    { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title:     { fontSize: 26, fontFamily: "Inter_700Bold" },
  badge:     { backgroundColor: "#16A34A", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  center:    { flex: 1, alignItems: "center", justifyContent: "center" },
  list:      {},
  thread:    { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  avatar:    { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarText:{ fontSize: 15, fontFamily: "Inter_700Bold" },
  info:      { flex: 1, gap: 2 },
  topRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name:      { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  time:      { fontSize: 12, fontFamily: "Inter_400Regular" },
  listing:   { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  preview:   { fontSize: 13, lineHeight: 18 },
  unread:    { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  unreadText:{ color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  trashBtn:  { padding: 4, marginLeft: 4 },
  empty:     { alignItems: "center", paddingTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyTitle:{ fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyHint: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, marginTop: 4 },
});
