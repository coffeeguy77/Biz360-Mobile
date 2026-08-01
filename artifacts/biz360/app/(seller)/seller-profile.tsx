import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";

interface Profile {
  displayName: string; company: string; bio: string; phone: string;
  email: string; emailVerified: boolean; showPhone: boolean; anonymous: boolean;
}

const EMPTY: Profile = { displayName: "", company: "", bio: "", phone: "", email: "", emailVerified: false, showPhone: true, anonymous: false };

export default function SellerProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [verifyNote, setVerifyNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("biz360_auth_token");
        const res = await fetch(`${API_BASE}/api/biz360/seller/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setProfile({ ...EMPTY, ...d });
        }
      } catch { /* keep defaults */ }
      setLoading(false);
    })();
  }, []);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => { setProfile((p) => ({ ...p, [k]: v })); setSaved(false); };

  async function save() {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("biz360_auth_token");
      const res = await fetch(`${API_BASE}/api/biz360/seller/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaved(true);
        if (d.verificationSent) { setVerifyNote("Verification email sent — check your inbox to confirm."); set("emailVerified", false); }
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  const field = (label: string, key: keyof Profile, opts?: { multiline?: boolean; placeholder?: string; keyboardType?: any }) => (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.input, opts?.multiline && { height: 96, textAlignVertical: "top" }, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        value={String(profile[key] ?? "")}
        onChangeText={(t) => set(key, t as any)}
        placeholder={opts?.placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={opts?.multiline}
        keyboardType={opts?.keyboardType}
        autoCapitalize={key === "email" ? "none" : "sentences"}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Seller Details</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            This is what buyers see on your listing. Your phone number stays hidden until a buyer verifies their own phone — and only if you allow it below.
          </Text>

          {field("Display name", "displayName", { placeholder: "e.g. Shaun Matthews" })}
          {field("Company / agency", "company", { placeholder: "Optional" })}
          {field("About you", "bio", { multiline: true, placeholder: "A short note buyers will see (optional)" })}
          {field("Contact phone", "phone", { placeholder: "04xx xxx xxx", keyboardType: "phone-pad" })}

          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Notification email</Text>
              {profile.email ? (
                profile.emailVerified ? (
                  <View style={[styles.pill, { backgroundColor: "#16A34A22" }]}>
                    <Feather name="check-circle" size={11} color="#16A34A" />
                    <Text style={[styles.pillText, { color: "#16A34A" }]}>Verified</Text>
                  </View>
                ) : (
                  <View style={[styles.pill, { backgroundColor: "#F59E0B22" }]}>
                    <Text style={[styles.pillText, { color: "#F59E0B" }]}>Pending verification</Text>
                  </View>
                )
              ) : null}
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={profile.email}
              onChangeText={(t) => { set("email", t); }}
              placeholder="you@email.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {verifyNote && <Text style={[styles.toggleSub, { color: "#F59E0B" }]}>{verifyNote}</Text>}
          </View>

          <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Show my phone to verified buyers</Text>
              <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>Buyers who verify their phone can reveal your number.</Text>
            </View>
            <Switch value={profile.showPhone} onValueChange={(v) => set("showPhone", v)} />
          </View>

          <View style={[styles.toggleRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Stay anonymous</Text>
              <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>Hide your name and phone; buyers reach you via messages only.</Text>
            </View>
            <Switch value={profile.anonymous} onValueChange={(v) => set("anonymous", v)} />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
            onPress={save}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{saved ? "Saved ✓" : "Save details"}</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, gap: 16 },
  hint: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: "Inter_400Regular" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  saveBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  saveText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  pillText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});
