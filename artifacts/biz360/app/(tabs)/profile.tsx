import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const MENU_ITEMS = [
  { icon: "bookmark",    label: "Saved Listings",    sub: "2 saved"          },
  { icon: "bell",        label: "Alerts",             sub: "Manage search alerts" },
  { icon: "file-text",   label: "Document Requests",  sub: "Pending documents" },
  { icon: "shield",      label: "NDA Requests",       sub: "3 signed NDAs"    },
  { icon: "settings",    label: "Account Settings",   sub: "Profile, security" },
  { icon: "help-circle", label: "Help & Support",     sub: "FAQ, contact us"  },
];

export default function ProfileScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { user, realUser, restoreReal, logout } = useAuth();

  // A demo session is active when there's a phone-verified real user stored
  // but the current session is a different (demo) account
  const isDemo = realUser && user?.id !== realUser.id;

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await logout();
    router.replace("/(auth)/welcome");
  };

  const handleRestoreReal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await restoreReal();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>

        {/* ── Demo session banner ─────────────────────────────────────── */}
        {isDemo && (
          <TouchableOpacity
            style={[styles.demoBanner, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B40" }]}
            onPress={handleRestoreReal}
            activeOpacity={0.8}
          >
            <View style={styles.demoBannerLeft}>
              <Feather name="alert-circle" size={16} color="#F59E0B" />
              <View>
                <Text style={styles.demoBannerTitle}>Testing as {user?.role}</Text>
                <Text style={styles.demoBannerSub}>Tap to switch back to {realUser!.name}</Text>
              </View>
            </View>
            <View style={[styles.demoBannerBtn, { backgroundColor: "#F59E0B" }]}>
              <Text style={styles.demoBannerBtnText}>Switch back</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── User card ───────────────────────────────────────────────── */}
        <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: isDemo ? "#F59E0B" : colors.primary }]}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0) ?? "?"}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name}</Text>
            <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
            <View style={[styles.rolePill, { backgroundColor: (isDemo ? "#F59E0B" : colors.primary) + "20" }]}>
              <Text style={[styles.roleText, { color: isDemo ? "#F59E0B" : colors.primary }]}>
                {isDemo ? "Demo · " : ""}{user?.role?.charAt(0).toUpperCase()}{user?.role?.slice(1)} Account
              </Text>
            </View>
          </View>
          <TouchableOpacity>
            <Feather name="edit-2" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          {[["2", "Saved"], ["3", "NDAs"], ["12", "Views"]].map(([val, lbl]) => (
            <View key={lbl} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statVal, { color: colors.foreground }]}>{val}</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{lbl}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {MENU_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                idx < MENU_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.muted }]}>
                <Feather name={item.icon as any} size={16} color={colors.primary} />
              </View>
              <View style={styles.menuText}>
                <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
                <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>{item.sub}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Switch role (for testing) ────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.switchRole, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.replace("/(auth)/welcome" as any)}
        >
          <Feather name="refresh-cw" size={16} color={colors.primary} />
          <Text style={[styles.switchRoleText, { color: colors.primary }]}>
            {realUser ? "Switch demo role (testing)" : "Switch Role / Demo User"}
          </Text>
        </TouchableOpacity>

        {/* ── Real user quick-restore ──────────────────────────────────── */}
        {realUser && !isDemo && (
          <View style={[styles.realUserBadge, { backgroundColor: colors.card, borderColor: "#16A34A40" }]}>
            <Feather name="check-circle" size={14} color="#16A34A" />
            <Text style={[styles.realUserText, { color: colors.mutedForeground }]}>
              Signed in as <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>{realUser.name}</Text> · {realUser.email}
            </Text>
          </View>
        )}

        <TouchableOpacity style={[styles.logoutBtn, { borderColor: colors.border }]} onPress={handleLogout}>
          <Feather name="log-out" size={16} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  scroll:             { paddingHorizontal: 16, gap: 16 },
  title:              { fontSize: 26, fontFamily: "Inter_700Bold" },
  demoBanner:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  demoBannerLeft:     { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  demoBannerTitle:    { color: "#F59E0B", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  demoBannerSub:      { color: "#92400E", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  demoBannerBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  demoBannerBtnText:  { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  userCard:           { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1 },
  avatar:             { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  avatarText:         { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  userInfo:           { flex: 1, gap: 4 },
  userName:           { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  userEmail:          { fontSize: 13, fontFamily: "Inter_400Regular" },
  rolePill:           { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  roleText:           { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statsRow:           { flexDirection: "row", gap: 10 },
  statBox:            { flex: 1, padding: 14, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  statVal:            { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLbl:            { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  menuCard:           { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  menuItem:           { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  menuIcon:           { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuText:           { flex: 1 },
  menuLabel:          { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  menuSub:            { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  switchRole:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  switchRoleText:     { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  realUserBadge:      { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  realUserText:       { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  logoutBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  logoutText:         { color: "#EF4444", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
