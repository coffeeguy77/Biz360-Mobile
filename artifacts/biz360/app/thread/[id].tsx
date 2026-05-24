import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
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
import { useColors } from "@/hooks/useColors";

const INITIAL_MESSAGES = [
  { id: "1", from: "seller", text: "Hello! Thanks for your enquiry about The Daily Press Espresso Bar.", time: "2:00 PM" },
  { id: "2", from: "buyer", text: "Hi Sarah! I'm very interested. Could you tell me more about the lease renewal options?", time: "2:05 PM" },
  { id: "3", from: "seller", text: "Of course! The current lease has two 3-year options to renew at CPI+1%. The landlord has been very cooperative and is open to assignment.", time: "2:08 PM" },
  { id: "4", from: "buyer", text: "That's great. I noticed from the 360 tour that there are 3 styling chairs — are all included in the sale?", time: "2:12 PM" },
  { id: "5", from: "seller", text: "Yes, all equipment is included. The La Marzocco is valued at $28,000 and was serviced 3 months ago.", time: "2:14 PM" },
];

type Message = { id: string; from: string; text: string; time: string };

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");

  const send = () => {
    if (!input.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")} ${now.getHours() >= 12 ? "PM" : "AM"}`;
    setMessages((p) => [...p, { id: Date.now().toString(), from: "buyer", text: input.trim(), time }]);
    setInput("");
    setTimeout(() => {
      setMessages((p) => [
        ...p,
        { id: (Date.now() + 1).toString(), from: "seller", text: "Thanks for your message! I'll get back to you shortly.", time },
      ]);
    }, 1500);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.foreground }]}>Sarah Mitchell</Text>
          <Text style={[styles.headerListing, { color: colors.primary }]}>The Daily Press Espresso Bar</Text>
        </View>
        <TouchableOpacity>
          <Feather name="phone" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <FlatList
          data={messages}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[styles.list, { paddingBottom: 12 }]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!!messages.length}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isMe = item.from === "buyer";
            return (
              <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
                <View style={[styles.bubble, { backgroundColor: isMe ? colors.primary : colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.bubbleText, { color: isMe ? "#fff" : colors.foreground }]}>{item.text}</Text>
                  <Text style={[styles.bubbleTime, { color: isMe ? "rgba(255,255,255,0.6)" : colors.mutedForeground }]}>{item.time}</Text>
                </View>
              </View>
            );
          }}
        />

        <View style={[styles.inputBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 8 }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.muted }]}
            onPress={send}
            disabled={!input.trim()}
          >
            <Feather name="send" size={18} color={input.trim() ? "#fff" : colors.mutedForeground} />
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
  list: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
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
