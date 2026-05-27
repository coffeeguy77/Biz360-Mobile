import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  AdminUser,
  CleanupSettings,
  DEFAULT_CLEANUP_SETTINGS,
  getCleanupSettings,
  getUsers,
  saveCleanupSettings,
} from "@/lib/adminStore";

const domain   = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}/api` : "/api";

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 10, gap: 2 }}>
      <Text style={[sStyles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {subtitle && <Text style={[sStyles.sectionSub, { color: colors.mutedForeground }]}>{subtitle}</Text>}
    </View>
  );
}

export default function AdminCleanupSettings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [cleanupResult,  setCleanupResult]  = useState<{ users: number; listings: number } | null>(null);

  const [settings,  setSettings]  = useState<CleanupSettings>(DEFAULT_CLEANUP_SETTINGS);
  const [allUsers,  setAllUsers]  = useState<AdminUser[]>([]);
  const [soldDays,  setSoldDays]  = useState(String(DEFAULT_CLEANUP_SETTINGS.soldRetentionDays));
  const [inactDays, setInactDays] = useState(String(DEFAULT_CLEANUP_SETTINGS.inactivityDays));
  const [manualId,  setManualId]  = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([getCleanupSettings(), getUsers()]).then(([s, u]) => {
        if (!active) return;
        setSettings(s);
        setSoldDays(String(s.soldRetentionDays));
        setInactDays(String(s.inactivityDays));
        setAllUsers(u);
        setLoading(false);
      });
      return () => { active = false; };
    }, []),
  );

  const toggleWhitelist = (uid: string) => {
    setSettings((prev) => ({
      ...prev,
      whitelist: prev.whitelist.includes(uid)
        ? prev.whitelist.filter((x) => x !== uid)
        : [...prev.whitelist, uid],
    }));
  };

  const addManualId = () => {
    const trimmed = manualId.trim();
    if (!trimmed) return;
    if (settings.whitelist.includes(trimmed)) {
      Alert.alert("Already added", `"${trimmed}" is already on the whitelist.`);
      return;
    }
    setSettings((prev) => ({ ...prev, whitelist: [...prev.whitelist, trimmed] }));
    setManualId("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeManualId = (uid: string) => {
    setSettings((prev) => ({ ...prev, whitelist: prev.whitelist.filter((x) => x !== uid) }));
  };

  const handleSave = async () => {
    setSaving(true);
    const parsedSold  = Math.max(1, parseInt(soldDays,  10) || DEFAULT_CLEANUP_SETTINGS.soldRetentionDays);
    const parsedInact = Math.max(1, parseInt(inactDays, 10) || DEFAULT_CLEANUP_SETTINGS.inactivityDays);
    const updated: CleanupSettings = {
      ...settings,
      soldRetentionDays: parsedSold,
      inactivityDays:    parsedInact,
    };
    await saveCleanupSettings(updated);
    setSettings(updated);
    setSoldDays(String(parsedSold));
    setInactDays(String(parsedInact));
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved", "Cleanup settings have been updated.");
  };

  const handleRunCleanup = async () => {
    Alert.alert(
      "Run Cleanup Now",
      "This will scan all users and listings against the current settings and delete any eligible Cloudinary assets. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Run", onPress: async () => {
            setRunningCleanup(true);
            setCleanupResult(null);
            try {
              const res  = await fetch(`${API_BASE}/biz360/cleanup`, { method: "POST" });
              const json = await res.json() as { purgedUsers?: string[]; purgedListings?: string[] };
              const u    = json.purgedUsers?.length    ?? 0;
              const l    = json.purgedListings?.length ?? 0;
              setCleanupResult({ users: u, listings: l });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (u === 0 && l === 0) {
                Alert.alert("Cleanup Complete", "Nothing to clean up — all assets are within their retention period.");
              } else {
                Alert.alert("Cleanup Complete", `Removed assets for ${u} user${u !== 1 ? "s" : ""} and ${l} listing${l !== 1 ? "s" : ""}.`);
              }
            } catch {
              Alert.alert("Error", "Cleanup failed. Check your connection.");
            } finally {
              setRunningCleanup(false);
            }
          },
        },
      ],
    );
  };

  // Users on whitelist that aren't in the loaded admin users list (manually added IDs)
  const knownIds    = new Set(allUsers.map((u) => u.id));
  const manualIds   = settings.whitelist.filter((id) => !knownIds.has(id));

  if (loading) {
    return (
      <View style={[sStyles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[sStyles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[sStyles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name="sliders" size={20} color={colors.primary} />
            <Text style={[sStyles.title, { color: colors.foreground }]}>Storage Settings</Text>
          </View>
          <View style={[sStyles.avatarBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[sStyles.avatarText, { color: colors.foreground }]}>{user?.name?.charAt(0) ?? "A"}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[sStyles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Retention Periods ───────────────────────────────────────── */}
          <SectionHeader
            title="Retention Periods"
            subtitle="How long to keep Cloudinary assets before automatic deletion."
          />
          <View style={[sStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={sStyles.settingRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[sStyles.settingLabel, { color: colors.foreground }]}>Sold listing photos</Text>
                <Text style={[sStyles.settingHint, { color: colors.mutedForeground }]}>
                  Days after a listing is marked sold before tour photos are removed
                </Text>
              </View>
              <View style={[sStyles.dayInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput
                  value={soldDays}
                  onChangeText={setSoldDays}
                  keyboardType="number-pad"
                  style={[sStyles.dayInputText, { color: colors.foreground }]}
                  maxLength={4}
                  selectTextOnFocus
                />
                <Text style={[sStyles.dayLabel, { color: colors.mutedForeground }]}>days</Text>
              </View>
            </View>

            <View style={[sStyles.divider, { backgroundColor: colors.border }]} />

            <View style={sStyles.settingRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[sStyles.settingLabel, { color: colors.foreground }]}>Inactive user photos</Text>
                <Text style={[sStyles.settingHint, { color: colors.mutedForeground }]}>
                  Days since last login before all of a user's photos are removed
                </Text>
              </View>
              <View style={[sStyles.dayInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <TextInput
                  value={inactDays}
                  onChangeText={setInactDays}
                  keyboardType="number-pad"
                  style={[sStyles.dayInputText, { color: colors.foreground }]}
                  maxLength={4}
                  selectTextOnFocus
                />
                <Text style={[sStyles.dayLabel, { color: colors.mutedForeground }]}>days</Text>
              </View>
            </View>
          </View>

          {/* ── Whitelist ───────────────────────────────────────────────── */}
          <View style={{ marginTop: 24 }}>
            <SectionHeader
              title="Cleanup Whitelist"
              subtitle="Users on this list are exempt from all automatic cleanup — their photos are never deleted."
            />
          </View>
          <View style={[sStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {allUsers.length === 0 && (
              <Text style={[sStyles.emptyHint, { color: colors.mutedForeground }]}>No users in the system yet.</Text>
            )}
            {allUsers.map((u, idx) => {
              const isLast      = idx === allUsers.length - 1 && manualIds.length === 0;
              const whitelisted = settings.whitelist.includes(u.id);
              return (
                <View key={u.id}>
                  <View style={sStyles.userRow}>
                    <View style={[sStyles.userAvatar, { backgroundColor: whitelisted ? "#16A34A22" : colors.background, borderColor: whitelisted ? "#16A34A" : colors.border }]}>
                      <Text style={[sStyles.userAvatarText, { color: whitelisted ? "#16A34A" : colors.mutedForeground }]}>
                        {u.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[sStyles.userName, { color: colors.foreground }]}>{u.name}</Text>
                      <Text style={[sStyles.userId, { color: colors.mutedForeground }]}>{u.role} · {u.id}</Text>
                    </View>
                    <Switch
                      value={whitelisted}
                      onValueChange={() => toggleWhitelist(u.id)}
                      trackColor={{ false: colors.border, true: "#16A34A55" }}
                      thumbColor={whitelisted ? "#16A34A" : colors.mutedForeground}
                    />
                  </View>
                  {!isLast && <View style={[sStyles.divider, { backgroundColor: colors.border }]} />}
                </View>
              );
            })}

            {/* Manually added IDs not in users list */}
            {manualIds.length > 0 && (
              <>
                {allUsers.length > 0 && <View style={[sStyles.divider, { backgroundColor: colors.border }]} />}
                {manualIds.map((uid, idx) => (
                  <View key={uid}>
                    <View style={sStyles.userRow}>
                      <View style={[sStyles.userAvatar, { backgroundColor: "#3B82F622", borderColor: "#3B82F6" }]}>
                        <Feather name="user" size={14} color="#3B82F6" />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[sStyles.userName, { color: colors.foreground }]}>Manual ID</Text>
                        <Text style={[sStyles.userId, { color: colors.mutedForeground }]}>{uid}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeManualId(uid)}
                        style={[sStyles.removeBtn, { borderColor: "#EF4444" }]}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="x" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                    {idx < manualIds.length - 1 && <View style={[sStyles.divider, { backgroundColor: colors.border }]} />}
                  </View>
                ))}
              </>
            )}
          </View>

          {/* Manual ID add */}
          <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
            <TextInput
              value={manualId}
              onChangeText={setManualId}
              placeholder="Add user ID manually…"
              placeholderTextColor={colors.mutedForeground}
              style={[sStyles.manualInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, flex: 1 }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={addManualId}
            />
            <TouchableOpacity
              style={[sStyles.addBtn, { backgroundColor: colors.primary }]}
              onPress={addManualId}
            >
              <Feather name="plus" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* ── Actions ─────────────────────────────────────────────────── */}
          <View style={{ marginTop: 28, gap: 10 }}>
            <TouchableOpacity
              style={[sStyles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Feather name="save" size={16} color="#fff" /><Text style={sStyles.saveBtnText}>Save Settings</Text></>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={[sStyles.cleanupBtn, { borderColor: colors.border, backgroundColor: colors.card, opacity: runningCleanup ? 0.6 : 1 }]}
              onPress={handleRunCleanup}
              disabled={runningCleanup}
            >
              {runningCleanup
                ? <><ActivityIndicator color={colors.foreground} size="small" /><Text style={[sStyles.cleanupBtnText, { color: colors.foreground }]}>Running…</Text></>
                : <><Feather name="trash-2" size={16} color={colors.foreground} /><Text style={[sStyles.cleanupBtnText, { color: colors.foreground }]}>Run Cleanup Now</Text></>
              }
            </TouchableOpacity>
          </View>

          {cleanupResult && (
            <View style={[sStyles.resultCard, { backgroundColor: "#16A34A15", borderColor: "#16A34A44" }]}>
              <Feather name="check-circle" size={16} color="#16A34A" />
              <Text style={[sStyles.resultText, { color: "#16A34A" }]}>
                Last run removed assets for {cleanupResult.users} user{cleanupResult.users !== 1 ? "s" : ""} and {cleanupResult.listings} listing{cleanupResult.listings !== 1 ? "s" : ""}.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const sStyles = StyleSheet.create({
  center:        { flex: 1, alignItems: "center", justifyContent: "center" },
  container:     { flex: 1 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title:         { fontSize: 22, fontFamily: "Inter_700Bold" },
  avatarBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  avatarText:    { fontSize: 15, fontFamily: "Inter_700Bold" },
  scroll:        { padding: 16, gap: 0 },
  sectionTitle:  { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionSub:    { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  card:          { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  settingRow:    { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  settingLabel:  { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  settingHint:   { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  dayInput:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, minWidth: 80 },
  dayInputText:  { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center", minWidth: 40 },
  dayLabel:      { fontSize: 12, fontFamily: "Inter_500Medium" },
  divider:       { height: 1, marginHorizontal: 14 },
  userRow:       { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  userAvatar:    { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  userAvatarText:{ fontSize: 14, fontFamily: "Inter_700Bold" },
  userName:      { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  userId:        { fontSize: 11, fontFamily: "Inter_400Regular" },
  removeBtn:     { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  emptyHint:     { fontSize: 13, fontFamily: "Inter_400Regular", padding: 14, textAlign: "center" },
  manualInput:   { height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  addBtn:        { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  saveBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  saveBtnText:   { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cleanupBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  cleanupBtnText:{ fontSize: 15, fontFamily: "Inter_600SemiBold" },
  resultCard:    { marginTop: 12, flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  resultText:    { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 19 },
});
