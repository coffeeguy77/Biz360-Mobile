import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/context/AuthContext";
import { getUsers, saveUsers } from "@/lib/adminStore";
import type { AdminUser } from "@/lib/adminStore";

const domain   = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}/api` : "/api";

const CODE_LEN = 6;

function maskPhone(phone: string): string {
  if (phone.length <= 5) return phone;
  return phone.slice(0, 4) + " ••• " + phone.slice(-3);
}

function defaultPlanForRole(role: string): string | undefined {
  if (role === "seller") return "Seller Starter";
  if (role === "broker") return "Broker Lite";
  return undefined;
}

export default function VerifyPhoneScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { phone, name, role } = useLocalSearchParams<{ phone: string; name: string; role: string }>();

  const [digits,    setDigits]    = useState<string[]>(Array(CODE_LEN).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error,     setError]     = useState("");
  const [countdown, setCountdown] = useState(30);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleDigit = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next  = [...digits];
    next[idx]   = digit;
    setDigits(next);
    setError("");
    if (digit && idx < CODE_LEN - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
    if (digit && idx === CODE_LEN - 1) {
      const code = [...next].join("");
      if (code.length === CODE_LEN) verify(code);
    }
  };

  const handleKeyPress = (idx: number, key: string) => {
    if (key === "Backspace") {
      if (digits[idx] === "" && idx > 0) {
        const next    = [...digits];
        next[idx - 1] = "";
        setDigits(next);
        inputRefs.current[idx - 1]?.focus();
      }
    }
  };

  // After OTP approval, upsert this user into the admin users list so revenue stats reflect them
  async function registerInAdminStore(userId: string) {
    try {
      const existing = await getUsers();
      const already  = existing.some((u) => u.email === phone || u.id === userId);
      if (!already) {
        const adminUser: AdminUser = {
          id:     userId,
          name:   name ?? "User",
          email:  phone ?? "",
          role:   role ?? "buyer",
          status: "active",
          joined: new Date().toLocaleDateString("en-AU", { month: "short", year: "numeric" }),
          plan:   defaultPlanForRole(role ?? ""),
        };
        await saveUsers([adminUser, ...existing]);
      }
    } catch {
      // Non-critical — don't block login if this fails
    }
  }

  const verify = async (codeOverride?: string) => {
    const code = codeOverride ?? digits.join("");
    if (code.length < CODE_LEN) { setError("Enter all 6 digits"); return; }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVerifying(true);
    setError("");

    try {
      const res  = await fetch(`${API_BASE}/biz360/auth/verify-otp`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone, code }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok || !json.ok) {
        setError(json.error ?? "Incorrect code. Please try again.");
        setDigits(Array(CODE_LEN).fill(""));
        inputRefs.current[0]?.focus();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setVerifying(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Stable ID: reuse existing user's ID for this phone, or derive one from phone only
      const allUsers   = await getUsers().catch(() => [] as AdminUser[]);
      const prevUser   = allUsers.find((u) => u.email === phone);
      const userId     = prevUser?.id ?? `u-${phone?.replace(/\D/g, "")}`;

      // Register in admin store (non-blocking)
      registerInAdminStore(userId);

      await login({
        id:    userId,
        name:  name ?? "User",
        email: phone ?? "",
        role:  (role as UserRole) ?? "buyer",
      });
      setVerifying(false);
      router.replace("/");
    } catch {
      setError("Network error. Please try again.");
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (countdown > 0) return;
    setResending(true);
    setError("");
    setDigits(Array(CODE_LEN).fill(""));
    try {
      await fetch(`${API_BASE}/biz360/auth/send-otp`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCountdown(30);
    } catch {
      setError("Failed to resend. Please try again.");
    }
    setResending(false);
    inputRefs.current[0]?.focus();
  };

  const filled = digits.filter(Boolean).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 16 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Feather name="arrow-left" size={22} color="#fff" />
      </TouchableOpacity>

      <View style={styles.iconWrap}>
        <Feather name="message-square" size={32} color="#3B82F6" />
      </View>

      <Text style={styles.heading}>Check your phone</Text>
      <Text style={styles.sub}>
        We sent a 6-digit code to{"\n"}
        <Text style={styles.phoneHighlight}>{maskPhone(phone ?? "")}</Text>
      </Text>

      <View style={styles.codeRow}>
        {digits.map((d, idx) => (
          <TextInput
            key={idx}
            ref={(r) => { inputRefs.current[idx] = r; }}
            style={[
              styles.codeBox,
              d ? styles.codeBoxFilled : null,
              error ? styles.codeBoxError : null,
            ]}
            value={d}
            onChangeText={(val) => handleDigit(idx, val)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(idx, nativeEvent.key)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            caretHidden
            autoFocus={idx === 0}
          />
        ))}
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={13} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.verifyBtn, { opacity: verifying || filled < CODE_LEN ? 0.6 : 1 }]}
        onPress={() => verify()}
        disabled={verifying || filled < CODE_LEN}
      >
        {verifying ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.verifyBtnText}>Verify & Create Account</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.resendRow}>
        <Text style={styles.resendLabel}>Didn't receive it? </Text>
        <TouchableOpacity onPress={resend} disabled={countdown > 0 || resending}>
          {resending ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : countdown > 0 ? (
            <Text style={styles.resendCooldown}>Resend in {countdown}s</Text>
          ) : (
            <Text style={styles.resendLink}>Resend code</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        Wrong number?{" "}
        <Text style={styles.hintLink} onPress={() => router.back()}>Go back</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#071221", paddingHorizontal: 24 },
  backBtn:         { marginBottom: 32 },
  iconWrap:        { width: 64, height: 64, borderRadius: 20, backgroundColor: "#0F2040", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  heading:         { color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 10 },
  sub:             { color: "#8B9CB8", fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22, marginBottom: 36 },
  phoneHighlight:  { color: "#fff", fontFamily: "Inter_600SemiBold" },
  codeRow:         { flexDirection: "row", gap: 10, marginBottom: 20 },
  codeBox:         { flex: 1, aspectRatio: 1, borderRadius: 14, borderWidth: 1.5, borderColor: "#1E3A5C", backgroundColor: "#0F2040", color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  codeBoxFilled:   { borderColor: "#3B82F6", backgroundColor: "#1E3A5C" },
  codeBoxError:    { borderColor: "#EF4444" },
  errorRow:        { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  errorText:       { color: "#EF4444", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  verifyBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#2563EB", borderRadius: 14, paddingVertical: 16, marginBottom: 20 },
  verifyBtnText:   { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  resendRow:       { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  resendLabel:     { color: "#8B9CB8", fontSize: 14, fontFamily: "Inter_400Regular" },
  resendLink:      { color: "#3B82F6", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  resendCooldown:  { color: "#475569", fontSize: 14, fontFamily: "Inter_400Regular" },
  hint:            { textAlign: "center", color: "#475569", fontSize: 13, fontFamily: "Inter_400Regular" },
  hintLink:        { color: "#8B9CB8", fontFamily: "Inter_600SemiBold" },
});
