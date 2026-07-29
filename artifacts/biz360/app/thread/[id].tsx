import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";
import {
  formatMessageTime,
  markRead,
  sendMessage,
  StoredMessage,
  Thread,
  useThreadDetail,
} from "@/lib/messageStore";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

export default function ThreadScreen() {
  const { id, listingName, sellerName, buyerName, listingId: listingIdParam, buyerId: buyerIdParam } = useLocalSearchParams<{
    id: string;
    listingName?: string;
    sellerName?: string;
    buyerName?: string;
    listingId?: string;
    buyerId?: string;
  }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedCafe } = useValuation();
  const flatRef = useRef<FlatList>(null);

  const { thread, loading, reload } = useThreadDetail(id);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Grant report access modal (seller view only)
  const [showGrant, setShowGrant] = useState(false);
  const [granting, setGranting] = useState(false);
  const [grantDone, setGrantDone] = useState(false);

  // admin and broker sit on the platform/seller side of conversations
  const role = (
    user?.role === "seller" || user?.role === "admin" || user?.role === "broker"
      ? "seller"
      : "buyer"
  ) as "buyer" | "seller";

  const roleBadgeLabel =
    user?.role === "admin"  ? "Admin view"  :
    user?.role === "broker" ? "Broker view" :
    role === "seller"       ? "Seller view" : "Buyer view";

  const meta = {
    listingId: thread?.listingId || (listingIdParam ? decodeURIComponent(listingIdParam) : "") || id,
    listingName: thread?.listingName ?? decodeURIComponent(listingName ?? "Listing"),
    sellerName: thread?.sellerName ?? decodeURIComponent(sellerName ?? "Seller"),
    buyerName: thread?.buyerName ?? (buyerName ? decodeURIComponent(buyerName) : user?.displayName ?? user?.name ?? "Buyer"),
    buyerId: thread?.buyerId || (buyerIdParam ? decodeURIComponent(buyerIdParam) : ""),
  };

  const rawCounter  = role === "buyer" ? meta.sellerName : meta.buyerName;
  const isRawId     = /^u-\d|^\+?61\d{7,}/.test(rawCounter ?? "");
  const counterName = isRawId || !rawCounter ? "Agent" : rawCounter;
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

  async function handleGrantAccess() {
    if (!selectedCafe) {
      Alert.alert("No business selected", "Please select a business from the Valuation tab first.");
      return;
    }
    // Derive buyer phone from buyerId (which is stored as E.164 or u-<phone digits>)
    let buyerPhone: string | null = meta.buyerId ?? null;
    if (buyerPhone?.startsWith("u-")) {
      // u-61412345678 → +61412345678
      buyerPhone = "+" + buyerPhone.slice(2);
    }
    if (!buyerPhone) {
      Alert.alert("Cannot grant access", "Buyer phone number not available. Ask them to register via the EXIT360 website first.");
      return;
    }

    setGranting(true);
    try {
      const token = await AsyncStorage.getItem("biz360_auth_token");
      const res = await fetch(`${API_BASE}/api/buyer-portal/quick-grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          cafeId: selectedCafe.id,
          phone: buyerPhone,
          name: meta.buyerName && !/^u-\d/.test(meta.buyerName) ? meta.buyerName : undefined,
        }),
      });
      if (res.ok) {
        setGrantDone(true);
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err.error ?? "Could not grant access");
        setShowGrant(false);
      }
    } catch { Alert.alert("Error", "Network error — please try again"); setShowGrant(false); }
    setGranting(false);
  }

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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[styles.roleBadge, { backgroundColor: role === "seller" ? "#16A34A18" : colors.primary + "18" }]}>
            <Text style={[styles.roleBadgeText, { color: role === "seller" ? "#16A34A" : colors.primary }]}>
              {roleBadgeLabel}
            </Text>
          </View>
          {/* Grant portal access button — seller view only */}
          {role === "seller" && (
            <TouchableOpacity
              style={[styles.grantBtn, { backgroundColor: "#1E3A5C" }]}
              onPress={() => { setGrantDone(false); setShowGrant(true); }}
            >
              <Feather name="share-2" size={14} color="#3B82F6" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Grant Access Modal ──────────────────────────────────────────────── */}
      <Modal visible={showGrant} transparent animationType="fade" onRequestClose={() => setShowGrant(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {grantDone ? (
              <>
                <View style={styles.modalSuccessIcon}>
                  <Feather name="check-circle" size={32} color="#10B981" />
                </View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Access Granted</Text>
                <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
                  {counterName} can now log in at exit360.com.au/buyers with their verified mobile to view the report.
                </Text>
                <TouchableOpacity
                  style={[styles.modalPrimaryBtn, { backgroundColor: colors.primary }]}
                  onPress={() => { setShowGrant(false); router.push("/(seller)/buyer-groups" as any); }}
                >
                  <Feather name="users" size={14} color="#fff" />
                  <Text style={styles.modalPrimaryBtnText}>Manage Access Groups</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowGrant(false)} style={styles.modalSecondaryBtn}>
                  <Text style={[styles.modalSecondaryBtnText, { color: colors.mutedForeground }]}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.modalIconWrap, { backgroundColor: "#1E3A5C" }]}>
                  <Feather name="share-2" size={22} color="#3B82F6" />
                </View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Grant Portal Access</Text>
                <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
                  Give <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>{counterName}</Text> access
                  to view reports for <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>{selectedCafe?.name ?? "your business"}</Text> via the EXIT360 buyer portal.
                  {"\n\n"}They'll log in at exit360.com.au/buyers using their verified mobile number.
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border }]} onPress={() => setShowGrant(false)} disabled={granting}>
                    <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: "#3B82F6", borderWidth: 0, opacity: granting ? 0.6 : 1 }]}
                    onPress={handleGrantAccess}
                    disabled={granting}
                  >
                    {granting
                      ? <Feather name="loader" size={14} color="#fff" />
                      : <Text style={[styles.modalBtnText, { color: "#fff" }]}>Grant Access</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

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
            placeholder="Message agent…"
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
  grantBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  // Grant access modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 380, borderRadius: 20, borderWidth: 1, padding: 24, gap: 12, alignItems: "center" },
  modalIconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  modalSuccessIcon: { marginBottom: 4 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  modalDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, textAlign: "center" },
  modalActions: { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  modalBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalPrimaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 13, paddingHorizontal: 20, borderRadius: 12, width: "100%" },
  modalPrimaryBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalSecondaryBtn: { paddingVertical: 8 },
  modalSecondaryBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
