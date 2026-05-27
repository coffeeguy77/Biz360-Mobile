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
import { DEMO_USERS, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getUsers } from "@/lib/adminStore";

const domain   = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}/api` : "/api";

function toE164(raw: string): string {
  const stripped = raw.replace(/[\s\-().]/g, "");
  if (stripped.startsWith("+")) return stripped;
  if (stripped.startsWith("0")) return "+61" + stripped.slice(1);
  return "+61" + stripped;
}

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [mode,     setMode]     = useState<"email" | "phone">("email");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [phone,    setPhone]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const switchMode = (m: "email" | "phone") => {
    setMode(m);
    setError("");
  };

  // ── Email sign-in ──────────────────────────────────────────────────────────

  const handleEmailLogin = async () => {
    if (!email || !password) { setError("Please fill in all fields"); return; }
    setError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));

    const match = Object.values(DEMO_USERS).find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (match) {
      await login(match);
      setLoading(false);
      router.replace("/");
      return;
    }

    // Also check real users in admin KV
    try {
      const allUsers = await getUsers();
      const real = allUsers.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
      );
      if (real) {
        await login({ id: real.id, name: real.name, email: real.email, role: real.role as any });
        setLoading(false);
        router.replace("/");
        return;
      }
    } catch { /* non-critical */ }

    setError("No account found with that email. Try signing in with your phone instead.");
    setLoading(false);
  };

  // ── Phone sign-in ──────────────────────────────────────────────────────────

  const handlePhoneLogin = async () => {
    const trimmed = phone.trim();
    if (!trimmed) { setError("Please enter your mobile number"); return; }
    const e164 = toE164(trimmed);
    if (e164.length < 10) { setError("Please enter a valid Australian mobile number"); return; }

    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Look up existing account by phone
      const allUsers   = await getUsers();
      const existing   = allUsers.find((u) => u.email === e164 || u.email === trimmed);

      // Send OTP regardless — verify-phone handles new vs returning
      const res = await fetch(`${API_BASE}/biz360/auth/send-otp`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone: e164 }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Could not send code. Please try again.");
        setLoading(false);
        return;
      }

      setLoading(false);
      router.push(
        `/(auth)/verify-phone?phone=${encodeURIComponent(e164)}&name=${encodeURIComponent(existing?.name ?? "")}&role=${existing?.role ?? "buyer"}` as any,
      );
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: "#071221" }]}>
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

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to your Biz360 account</Text>

        {/* ── Mode toggle ── */}
        <View style={[styles.toggle, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === "email" && { backgroundColor: "#2563EB" }]}
            onPress={() => switchMode("email")}
          >
            <Feather name="mail" size={14} color={mode === "email" ? "#fff" : "#8B9CB8"} />
            <Text style={[styles.toggleLabel, { color: mode === "email" ? "#fff" : "#8B9CB8" }]}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === "phone" && { backgroundColor: "#2563EB" }]}
            onPress={() => switchMode("phone")}
          >
            <Feather name="smartphone" size={14} color={mode === "phone" ? "#fff" : "#8B9CB8"} />
            <Text style={[styles.toggleLabel, { color: mode === "phone" ? "#fff" : "#8B9CB8" }]}>Phone</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {mode === "email" ? (
            <>
              <View style={[styles.inputGroup, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
                <Feather name="mail" size={16} color="#8B9CB8" />
                <TextInput
                  style={[styles.input, { color: "#fff" }]}
                  placeholder="Email address"
                  placeholderTextColor="#8B9CB8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              <View style={[styles.inputGroup, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
                <Feather name="lock" size={16} color="#8B9CB8" />
                <TextInput
                  style={[styles.input, { color: "#fff" }]}
                  placeholder="Password"
                  placeholderTextColor="#8B9CB8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { opacity: loading ? 0.7 : 1 }]}
                onPress={handleEmailLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.inputGroup, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
                <Feather name="smartphone" size={16} color="#8B9CB8" />
                <TextInput
                  style={[styles.input, { color: "#fff" }]}
                  placeholder="Mobile number (e.g. 0412 345 678)"
                  placeholderTextColor="#8B9CB8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { opacity: loading ? 0.7 : 1 }]}
                onPress={handlePhoneLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="message-circle" size={16} color="#fff" />
                    <Text style={styles.primaryBtnText}>Send Code</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={[styles.phoneHint, { color: "#8B9CB8" }]}>
                We'll send a 6-digit code to verify your number.
              </Text>
            </>
          )}
        </View>

        {/* ── Demo logins (email mode only) ── */}
        {mode === "email" && (
          <>
            <View style={[styles.divider, { borderColor: "#1E3A5C" }]}>
              <Text style={[styles.dividerText, { color: "#8B9CB8" }]}>Demo logins</Text>
            </View>

            <View style={styles.demoGrid}>
              {(["buyer", "seller", "broker", "admin"] as const).map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.demoBtn,
                    {
                      backgroundColor: email === DEMO_USERS[role].email ? "#1E3A5C" : "#0F2040",
                      borderColor:     email === DEMO_USERS[role].email ? "#3B82F6"  : "#1E3A5C",
                    },
                  ]}
                  onPress={() => { setEmail(DEMO_USERS[role].email); setPassword("demo"); setError(""); }}
                >
                  <View style={styles.demoBtnInner}>
                    <Text style={[styles.demoRole, { color: "#3B82F6" }]}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                    <Text style={[styles.demoEmail, { color: "#8B9CB8" }]}>
                      {DEMO_USERS[role].email}
                    </Text>
                  </View>
                  <Text style={[styles.demoBtnTap, { color: "#3B82F6" }]}>Tap to fill →</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={styles.signupRow}>
          <Text style={[styles.signupText, { color: "#8B9CB8" }]}>New to Biz360? </Text>
          <TouchableOpacity onPress={() => router.replace("/(auth)/register")}>
            <Text style={[styles.signupLink, { color: "#3B82F6" }]}>Create account</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  scroll:         { paddingHorizontal: 20 },
  backBtn:        { marginBottom: 24 },
  heading:        { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 8 },
  sub:            { color: "#8B9CB8", fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 24 },
  toggle:         { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 4, marginBottom: 20, gap: 4 },
  toggleBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 10, borderRadius: 10 },
  toggleLabel:    { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  form:           { gap: 12, marginBottom: 24 },
  errorBox:       { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EF444418", padding: 12, borderRadius: 10 },
  errorText:      { color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  inputGroup:     { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  input:          { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  primaryBtn:     { backgroundColor: "#2563EB", borderRadius: 12, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  phoneHint:      { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: -4 },
  divider:        { borderTopWidth: 1, paddingTop: 20, marginBottom: 16, alignItems: "center" },
  dividerText:    { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  demoGrid:       { gap: 10, marginBottom: 24 },
  demoBtn:        { padding: 14, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  demoBtnInner:   { gap: 2 },
  demoRole:       { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  demoEmail:      { fontSize: 12, fontFamily: "Inter_400Regular" },
  demoBtnTap:     { fontSize: 11, fontFamily: "Inter_500Medium" },
  signupRow:      { flexDirection: "row", justifyContent: "center" },
  signupText:     { fontSize: 14, fontFamily: "Inter_400Regular" },
  signupLink:     { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
