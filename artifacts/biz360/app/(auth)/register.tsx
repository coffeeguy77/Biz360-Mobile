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
import type { UserRole } from "@/context/AuthContext";

const ROLES: { key: UserRole; label: string; icon: string }[] = [
  { key: "buyer", label: "Buyer", icon: "search" },
  { key: "seller", label: "Seller", icon: "trending-up" },
  { key: "broker", label: "Broker", icon: "briefcase" },
];

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("buyer");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    await login({ id: Date.now().toString(), name, email, role: selectedRole });
    setLoading(false);
    router.replace("/");
  };

  return (
    <View style={[styles.container]}>
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

        <Text style={styles.heading}>Create account</Text>
        <Text style={styles.sub}>Join Australia's immersive business marketplace</Text>

        <View style={styles.form}>
          {[
            { label: "Full name", value: name, setter: setName, icon: "user", type: "default" },
            { label: "Email address", value: email, setter: setEmail, icon: "mail", type: "email-address" },
          ].map(({ label, value, setter, icon, type }) => (
            <View key={label} style={styles.inputGroup}>
              <Feather name={icon as any} size={16} color="#8B9CB8" />
              <TextInput
                style={styles.input}
                placeholder={label}
                placeholderTextColor="#8B9CB8"
                value={value}
                onChangeText={setter}
                keyboardType={type as any}
                autoCapitalize={type === "default" ? "words" : "none"}
              />
            </View>
          ))}

          <Text style={styles.roleLabel}>I am a</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[
                  styles.roleBtn,
                  { backgroundColor: selectedRole === r.key ? "#2563EB" : "#0F2040", borderColor: selectedRole === r.key ? "#3B82F6" : "#1E3A5C" },
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
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>{loading ? "Creating..." : "Create Account"}</Text>
          </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: "#071221" },
  scroll: { paddingHorizontal: 20 },
  backBtn: { marginBottom: 24 },
  heading: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 8 },
  sub: { color: "#8B9CB8", fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 28 },
  form: { gap: 12, marginBottom: 24 },
  inputGroup: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, backgroundColor: "#0F2040", borderColor: "#1E3A5C",
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" },
  roleLabel: { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  roleRow: { flexDirection: "row", gap: 8 },
  roleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  roleBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  primaryBtn: {
    backgroundColor: "#2563EB", borderRadius: 12,
    paddingVertical: 15, alignItems: "center", marginTop: 8,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  loginRow: { flexDirection: "row", justifyContent: "center" },
  loginText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#8B9CB8" },
  loginLink: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#3B82F6" },
});
