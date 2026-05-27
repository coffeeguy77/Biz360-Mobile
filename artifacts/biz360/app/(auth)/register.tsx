import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { UserRole } from "@/context/AuthContext";

const ROLES: { key: UserRole; label: string; icon: string }[] = [
  { key: "buyer",  label: "Buyer",  icon: "search"      },
  { key: "seller", label: "Seller", icon: "trending-up"  },
  { key: "broker", label: "Broker", icon: "briefcase"    },
];

const domain   = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}/api` : "/api";

function toE164(raw: string): string {
  const stripped = raw.replace(/[\s\-().]/g, "");
  if (stripped.startsWith("+")) return stripped;
  if (stripped.startsWith("0")) return "+61" + stripped.slice(1);
  return "+61" + stripped;
}

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [name,         setName]         = useState("");
  const [phone,        setPhone]        = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("buyer");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  const handleSendCode = async () => {
    setError("");
    const trimmedName  = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) { setError("Please enter your full name"); return; }
    if (!trimmedPhone) { setError("Please enter your mobile number"); return; }

    const e164 = toE164(trimmedPhone);
    if (e164.length < 10) { setError("Please enter a valid mobile number"); return; }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      const res  = await fetch(`${API_BASE}/biz360/auth/send-otp`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone: e164 }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to send code. Please try again.");
        setLoading(false);
        return;
      }

      setLoading(false);
      router.push({
        pathname: "/(auth)/verify-phone" as any,
        params:   { phone: e164, name: trimmedName, role: selectedRole },
      });
    } catch {
      setError("Network error. Please check your connection.");
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop:    insets.top + (Platform.OS === "web" ? 67 : 0) + 16,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        bottomOffset={20}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.heading}>Create account</Text>
        <Text style={styles.sub}>Join Australia's immersive business marketplace</Text>

        <View style={styles.form}>
          {/* Name */}
          <View style={styles.inputGroup}>
            <Feather name="user" size={16} color="#8B9CB8" />
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="#8B9CB8"
              value={name}
              onChangeText={(t) => { setName(t); setError(""); }}
              autoCapitalize="words"
            />
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Feather name="phone" size={16} color="#8B9CB8" />
            <Text style={styles.prefix}>+61</Text>
            <TextInput
              style={styles.input}
              placeholder="4XX XXX XXX"
              placeholderTextColor="#8B9CB8"
              value={phone}
              onChangeText={(t) => { setPhone(t); setError(""); }}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={13} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Role */}
          <Text style={styles.roleLabel}>I am a</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[
                  styles.roleBtn,
                  {
                    backgroundColor: selectedRole === r.key ? "#2563EB" : "#0F2040",
                    borderColor:     selectedRole === r.key ? "#3B82F6" : "#1E3A5C",
                  },
                ]}
                onPress={() => { setSelectedRole(r.key); Haptics.selectionAsync(); }}
              >
                <Feather name={r.icon as any} size={16} color={selectedRole === r.key ? "#fff" : "#3B82F6"} />
                <Text style={[styles.roleBtnText, { color: selectedRole === r.key ? "#fff" : "#E2E8F0" }]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { opacity: loading ? 0.7 : 1 }]}
            onPress={handleSendCode}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="send" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Send Verification Code</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.smsNote}>
            A 6-digit code will be sent to your mobile via SMS.
          </Text>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.loginLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#071221" },
  scroll:        { paddingHorizontal: 20 },
  backBtn:       { marginBottom: 24 },
  heading:       { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 8 },
  sub:           { color: "#8B9CB8", fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 28 },
  form:          { gap: 12, marginBottom: 24 },
  inputGroup:    {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, backgroundColor: "#0F2040", borderColor: "#1E3A5C",
  },
  prefix:        { color: "#8B9CB8", fontSize: 15, fontFamily: "Inter_400Regular" },
  input:         { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" },
  errorRow:      { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText:     { color: "#EF4444", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  roleLabel:     { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  roleRow:       { flexDirection: "row", gap: 8 },
  roleBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  roleBtnText:   { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  primaryBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#2563EB", borderRadius: 12, paddingVertical: 15, marginTop: 8 },
  primaryBtnText:{ color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  smsNote:       { textAlign: "center", color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  loginRow:      { flexDirection: "row", justifyContent: "center" },
  loginText:     { fontSize: 14, fontFamily: "Inter_400Regular", color: "#8B9CB8" },
  loginLink:     { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#3B82F6" },
});
