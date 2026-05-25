import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError("Please fill in all fields"); return; }
    setError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const match = Object.values(DEMO_USERS).find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (!match) {
      setError("No account found with that email. Use one of the demo logins below.");
      setLoading(false);
      return;
    }
    await login(match);
    setLoading(false);
    router.replace("/");
  };

  const quickLogin = async (role: keyof typeof DEMO_USERS) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    await login(DEMO_USERS[role]);
    setLoading(false);
    router.replace("/");
  };

  return (
    <View style={[styles.container, { backgroundColor: "#071221" }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 16,
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

        <View style={styles.form}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "#EF444418" }]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

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
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { opacity: loading ? 0.7 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>{loading ? "Signing in..." : "Sign In"}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { borderColor: "#1E3A5C" }]}>
          <Text style={[styles.dividerText, { color: "#8B9CB8" }]}>Demo logins</Text>
        </View>

        <View style={styles.demoGrid}>
          {(["buyer", "seller", "broker", "admin"] as const).map((role) => (
            <TouchableOpacity
              key={role}
              style={[styles.demoBtn, { backgroundColor: email === DEMO_USERS[role].email ? "#1E3A5C" : "#0F2040", borderColor: email === DEMO_USERS[role].email ? "#3B82F6" : "#1E3A5C" }]}
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
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  backBtn: { marginBottom: 24 },
  heading: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 8 },
  sub: { color: "#8B9CB8", fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 28 },
  form: { gap: 12, marginBottom: 24 },
  errorBox: { padding: 12, borderRadius: 10 },
  errorText: { color: "#EF4444", fontSize: 14, fontFamily: "Inter_500Medium" },
  inputGroup: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  primaryBtn: {
    backgroundColor: "#2563EB", borderRadius: 12,
    paddingVertical: 15, alignItems: "center", marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  divider: {
    borderTopWidth: 1, paddingTop: 20, marginBottom: 16, alignItems: "center",
  },
  dividerText: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  demoGrid: { gap: 10, marginBottom: 24 },
  demoBtn: {
    padding: 14, borderRadius: 12, borderWidth: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  demoBtnInner: { gap: 2 },
  demoRole: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  demoEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  demoBtnTap: { fontSize: 11, fontFamily: "Inter_500Medium" },
  signupRow: { flexDirection: "row", justifyContent: "center" },
  signupText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  signupLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
