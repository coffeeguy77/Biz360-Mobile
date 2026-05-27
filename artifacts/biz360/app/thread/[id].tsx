import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  formatMessageTime,
  markRead,
  sendMessage,
  StoredMessage,
  Thread,
  useThreadDetail,
} from "@/lib/messageStore";

export default function ThreadScreen() {
  const { id, listingName, sellerName, buyerName } = useLocalSearchParams<{
    id: string;
    listingName?: string;
    sellerName?: string;
    buyerName?: string;
  }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const flatRef = useRef<FlatList>(null);

  const { thread, loading, reload } = useThreadDetail(id);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const role = (user?.role === "seller" ? "seller" : "buyer") as "buyer" | "seller";

  const meta = {
    listingId: thread?.listingId ?? "",
    listingName: thread?.listingName ?? decodeURIComponent(listingName ?? "Listing"),
    sellerName: thread?.sellerName ?? decodeURIComponent(sellerName ?? "Seller"),
    buyerName: thread?.buyerName ?? (buyerName ? decodeURIComponent(buyerName) : user?.name ?? "Buyer"),
  };

  const counterName = role === "buyer" ? meta.sellerName : meta.buyerName;
  const listingLabel = meta.listingName;

  useEffect(() => {
    if (!id) return;
    markRead(id, role).catch(() => {});
  }, [id, role]);

  const messages: StoredMessage[] = thread?.messages ?? [];

  const scrollToEnd = () => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  };

  useEffect(() => {
    if (messages.length > 0) scrollToEnd();
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");
    setSending(true);
    try {
      await sendMessage(id, text, role, meta);
      reload();
      scrollToEnd();
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>{counterName}</Text>
          <Text style={[styles.headerListing, { color: colors.primary }]} numberOfLines={1}>{listingLabel}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: role === "seller" ? "#16A34A18" : colors.primary + "18" }]}>
          <Text style={[styles.roleBadgeText, { color: role === "seller" ? "#16A34A" : colors.primary }]}>
            {role === "seller" ? "Seller view" : "Buyer view"}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        {loading ? (
          <View style={styles.center}>
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading messages…</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.center}>
            <Feather name="message-circle" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Start the conversation</Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Send a message to {counterName} about {listingLabel}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={[styles.list, { paddingBottom: 12 }]}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onLayout={scrollToEnd}
            renderItem={({ item, index }) => {
              const isMe = item.from === role;
              const showDate = index === 0 || new Date(messages[index - 1].timestamp).toDateString() !== new Date(item.timestamp).toDateString();
              return (
                <>
                  {showDate && (
                    <View style={styles.dateSep}>
                      <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
                      <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
                        {new Date(item.timestamp).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                      </Text>
                      <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
                    </View>
                  )}
                  <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
                    <View style={[
                      styles.bubble,
                      { backgroundColor: isMe ? colors.primary : colors.card, borderColor: colors.border },
                    ]}>
                      <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.foreground }]}>{item.text}</Text>
                      <Text style={[styles.bubbleTime, { color: isMe ? "rgba(255,255,255,0.55)" : colors.mutedForeground }]}>
                        {formatMessageTime(item.timestamp)}
                      </Text>
                    </View>
                  </View>
                </>
              );
            }}
          />
        )}

        <View style={[styles.inputBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 8 }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            placeholder={`Message ${counterName}…`}
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={send}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: input.trim() && !sending ? colors.primary : colors.muted }]}
            onPress={send}
            disabled={!input.trim() || sending}
          >
            <Feather name="send" size={18} color={input.trim() && !sending ? "#fff" : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  headerListing: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 1 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  roleBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  list: { paddingHorizontal: 16, paddingTop: 12, gap: 6 },
  dateSep: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 6 },
  dateLine: { flex: 1, height: 1 },
  dateLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  msgRow: { maxWidth: "78%" },
  msgRowMe: { alignSelf: "flex-end" },
  msgRowThem: { alignSelf: "flex-start" },
  bubble: { padding: 12, borderRadius: 16, borderWidth: 1, gap: 4 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bubbleTime: { fontSize: 10, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1 },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, fontSize: 14, fontFamily: "Inter_400Regular", maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});
