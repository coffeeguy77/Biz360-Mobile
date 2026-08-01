import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEMO_USERS, useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getSavedIds } from "@/lib/savedStore";

const FAQ = [
  { q: "How do I contact a seller?", a: "Tap 'Message Seller' on any listing detail page." },
  { q: "Are the financials verified?", a: "Listings with a Verified badge have had their financials reviewed by our team or a licensed accountant." },
  { q: "How do NDAs work?", a: "Some listings require an NDA before viewing financials. You'll be prompted when you request confidential documents." },
  { q: "What is SDE?", a: "Seller's Discretionary Earnings — the business's profit before owner's salary, depreciation, and one-off expenses." },
  { q: "Can I get a refund?", a: "Contact support at support@biz360.com.au for billing queries." },
];

type Section = "alerts" | "documents" | "ndas" | "settings" | "help" | null;

export default function ProfileScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user, realUser, login, restoreReal, logout, updateProfile } = useAuth();

  const [savedCount,    setSavedCount]    = useState(0);
  const [expanded,      setExpanded]      = useState<Section>(null);
  const [expandedFaq,   setExpandedFaq]   = useState<number | null>(null);
  const [editVisible,   setEditVisible]   = useState(false);
  const [draftName,        setDraftName]        = useState("");
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [saving,           setSaving]           = useState(false);

  const openEdit = () => {
    setDraftName(user?.name ?? "");
    setDraftDisplayName(user?.displayName ?? user?.name?.split(" ")[0] ?? "");
    setEditVisible(true);
  };

  const saveProfile = async () => {
    const trimmed        = draftName.trim();
    const trimmedDisplay = draftDisplayName.trim();
    if (!trimmed) return;
    setSaving(true);
    await updateProfile({
      name: trimmed,
      displayName: trimmedDisplay || trimmed.split(" ")[0],
    });
    setSaving(false);
    setEditVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const isDemo = realUser && user?.id !== realUser.id;

  useFocusEffect(
    useCallback(() => {
      getSavedIds().then((ids) => setSavedCount(ids.length));
    }, []),
  );

  const toggle = (section: Section) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded((prev) => (prev === section ? null : section));
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await logout();
    router.replace("/(tabs)/discover" as any);
  };

  const handleRestoreReal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await restoreReal();
  };

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "?";

  // ── Unauthenticated gate ────────────────────────────────────────────────────
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
            <Feather name="user" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground, textAlign: "center" }]}>Your Profile</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 }}>
            Sign in to save listings, message sellers, and manage your enquiries.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, width: "100%", alignItems: "center" }}
            onPress={() => router.push("/(auth)/login" as any)}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" }}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(auth)/register" as any)}>
            <Text style={{ color: colors.primary, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>

        {/* ── Demo session banner ── */}
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

        {/* ── User card ── */}
        <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: isDemo ? "#F59E0B" : colors.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name ?? "—"}</Text>
            <Text style={[styles.userEmail, { color: colors.mutedForeground }]} numberOfLines={1}>
              {user?.email ?? ""}
            </Text>
            <View style={[styles.rolePill, { backgroundColor: (isDemo ? "#F59E0B" : colors.primary) + "20" }]}>
              <Text style={[styles.roleText, { color: isDemo ? "#F59E0B" : colors.primary }]}>
                {isDemo ? "Demo · " : ""}{user?.role?.charAt(0).toUpperCase()}{user?.role?.slice(1)} Account
              </Text>
            </View>
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          {[
            [String(savedCount), "Saved"],
            ["0",                "NDAs"],
            ["0",                "Views"],
          ].map(([val, lbl]) => (
            <View key={lbl} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statVal, { color: colors.foreground }]}>{val}</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{lbl}</Text>
            </View>
          ))}
        </View>

        {/* ── My Portal (buyer access to granted reports) ── */}
        <TouchableOpacity
          style={[styles.portalCard, { backgroundColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/buyer-portal" as any); }}
        >
          <View style={styles.portalIcon}>
            <Feather name="folder" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.portalTitle}>My Portal</Text>
            <Text style={styles.portalSub}>Reports &amp; walkthroughs shared with you</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#fff" />
        </TouchableOpacity>

        {/* ── Dev role switcher (owner only) ── */}
        {realUser?.email === "+61414631463" && (
          <View style={[styles.devCard, { backgroundColor: "#130A2A", borderColor: "#6B21A8" }]}>
            <View style={styles.devHeader}>
              <Feather name="zap" size={13} color="#A855F7" />
              <Text style={[styles.devTitle, { color: "#A855F7" }]}>Dev · Switch Role</Text>
              {isDemo && (
                <View style={[styles.devActivePill, { backgroundColor: "#6B21A820", borderColor: "#A855F740" }]}>
                  <Text style={[styles.devActivePillText, { color: "#A855F7" }]}>Demo mode</Text>
                </View>
              )}
            </View>
            <View style={styles.devRoles}>
              {([
                { key: "buyer"  as UserRole, label: "Buyer",     icon: "search"    },
                { key: "seller" as UserRole, label: "My Seller", icon: "tag"       },
                { key: "broker" as UserRole, label: "Broker",    icon: "briefcase" },
                { key: "admin"  as UserRole, label: "Admin",     icon: "shield"    },
              ]).map(({ key, label, icon }) => {
                const isMySeller = key === "seller";
                const active = isMySeller
                  ? user?.id === realUser?.id
                  : isDemo && user?.role === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.devRole, { backgroundColor: active ? "#6B21A8" : "#1E0A4A", borderColor: active ? "#A855F7" : "#3B1A7A" }]}
                    onPress={async () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      if (isMySeller) {
                        await restoreReal();
                        router.replace("/(seller)/dashboard" as any);
                      } else {
                        await login(DEMO_USERS[key]);
                        if (key === "buyer")  router.replace("/(tabs)/discover" as any);
                        if (key === "broker") router.replace("/(broker)/dashboard" as any);
                        if (key === "admin")  router.replace("/(admin)/listings" as any);
                      }
                    }}
                  >
                    <Feather name={icon as any} size={14} color={active ? "#fff" : "#C084FC"} />
                    <Text style={[styles.devRoleLabel, { color: active ? "#fff" : "#C084FC" }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Menu sections ── */}
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>

          {/* Saved Listings */}
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/saved" as any); }}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.muted }]}>
              <Feather name="bookmark" size={16} color={colors.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>Saved Listings</Text>
              <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>
                {savedCount > 0 ? `${savedCount} saved` : "No saved listings yet"}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Alerts */}
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            onPress={() => toggle("alerts")}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.muted }]}>
              <Feather name="bell" size={16} color={colors.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>Search Alerts</Text>
              <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>Get notified of new matches</Text>
            </View>
            <Feather name={expanded === "alerts" ? "chevron-down" : "chevron-right"} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {expanded === "alerts" && (
            <View style={[styles.expansion, { borderBottomColor: colors.border }]}>
              <View style={styles.emptyState}>
                <Feather name="bell-off" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>No active alerts</Text>
                <Text style={[styles.emptyStateSub, { color: colors.mutedForeground }]}>
                  Set up a search alert and we'll notify you when new listings match your criteria.
                </Text>
                <TouchableOpacity
                  style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
                  onPress={() => Alert.alert("Coming Soon", "Search alerts will be available in the next update.")}
                >
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={styles.ctaBtnText}>Set Up Alert</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Document Requests */}
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            onPress={() => toggle("documents")}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.muted }]}>
              <Feather name="file-text" size={16} color={colors.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>Document Requests</Text>
              <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>Information memoranda, financials</Text>
            </View>
            <Feather name={expanded === "documents" ? "chevron-down" : "chevron-right"} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {expanded === "documents" && (
            <View style={[styles.expansion, { borderBottomColor: colors.border }]}>
              <View style={styles.emptyState}>
                <Feather name="file" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>No document requests</Text>
                <Text style={[styles.emptyStateSub, { color: colors.mutedForeground }]}>
                  When you request an information memorandum or financial documents from a listing, they'll appear here.
                </Text>
              </View>
            </View>
          )}

          {/* NDA Requests */}
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            onPress={() => toggle("ndas")}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.muted }]}>
              <Feather name="shield" size={16} color={colors.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>NDA Requests</Text>
              <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>Non-disclosure agreements</Text>
            </View>
            <Feather name={expanded === "ndas" ? "chevron-down" : "chevron-right"} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {expanded === "ndas" && (
            <View style={[styles.expansion, { borderBottomColor: colors.border }]}>
              <View style={styles.emptyState}>
                <Feather name="lock" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>No NDAs signed</Text>
                <Text style={[styles.emptyStateSub, { color: colors.mutedForeground }]}>
                  Some sellers require an NDA before sharing confidential information. Any you've signed will appear here.
                </Text>
              </View>
            </View>
          )}

          {/* Account Settings */}
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            onPress={() => toggle("settings")}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.muted }]}>
              <Feather name="settings" size={16} color={colors.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>Account Settings</Text>
              <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>Profile, notifications, security</Text>
            </View>
            <Feather name={expanded === "settings" ? "chevron-down" : "chevron-right"} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {expanded === "settings" && (
            <View style={[styles.expansion, { borderBottomColor: colors.border }]}>
              <View style={styles.settingsSection}>
                <SettingsRow label="Name"  value={user?.name  ?? "—"} colors={colors} />
                <SettingsRow label="Phone" value={user?.email ?? "—"} colors={colors} />
                <SettingsRow label="Role"  value={user?.role  ?? "—"} colors={colors} last />
              </View>
              <TouchableOpacity
                style={[styles.ctaBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
                onPress={openEdit}
              >
                <Feather name="edit-2" size={14} color="#fff" />
                <Text style={[styles.ctaBtnText, { color: "#fff" }]}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Help & Support */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => toggle("help")}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.muted }]}>
              <Feather name="help-circle" size={16} color={colors.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>Help & Support</Text>
              <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>FAQ, contact us</Text>
            </View>
            <Feather name={expanded === "help" ? "chevron-down" : "chevron-right"} size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {expanded === "help" && (
            <View style={styles.expansion}>
              {FAQ.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.faqRow, { borderTopColor: colors.border }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpandedFaq(expandedFaq === idx ? null : idx); }}
                >
                  <View style={styles.faqQ}>
                    <Text style={[styles.faqQuestion, { color: colors.foreground }]}>{item.q}</Text>
                    <Feather
                      name={expandedFaq === idx ? "chevron-up" : "chevron-down"}
                      size={14}
                      color={colors.mutedForeground}
                    />
                  </View>
                  {expandedFaq === idx && (
                    <Text style={[styles.faqAnswer, { color: colors.mutedForeground }]}>{item.a}</Text>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.ctaBtn, { backgroundColor: colors.muted, margin: 14, marginTop: 4 }]}
                onPress={() => Alert.alert("Contact Support", "Email us at support@biz360.com.au")}
              >
                <Feather name="mail" size={14} color={colors.foreground} />
                <Text style={[styles.ctaBtnText, { color: colors.foreground }]}>Contact Support</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Switch demo role ── */}
        <TouchableOpacity
          style={[styles.switchRole, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.replace("/(auth)/welcome" as any)}
        >
          <Feather name="refresh-cw" size={16} color={colors.primary} />
          <Text style={[styles.switchRoleText, { color: colors.primary }]}>
            {realUser ? "Switch demo role (testing)" : "Switch Role / Demo User"}
          </Text>
        </TouchableOpacity>

        {/* ── Real user badge ── */}
        {realUser && !isDemo && (
          <View style={[styles.realUserBadge, { backgroundColor: colors.card, borderColor: "#16A34A40" }]}>
            <Feather name="check-circle" size={14} color="#16A34A" />
            <Text style={[styles.realUserText, { color: colors.mutedForeground }]}>
              Signed in as{" "}
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>{realUser.name}</Text>
              {" · "}{realUser.email}
            </Text>
          </View>
        )}

        {/* ── Sign out ── */}
        <TouchableOpacity style={[styles.logoutBtn, { borderColor: colors.border }]} onPress={handleLogout}>
          <Feather name="log-out" size={16} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <Pressable style={styles.editBackdrop} onPress={() => setEditVisible(false)} />
        <View style={[styles.editSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.editHandle} />
          <View style={styles.editHeader}>
            <Text style={[styles.editTitle, { color: colors.foreground }]}>Edit Profile</Text>
            <TouchableOpacity
              style={[styles.editCloseBtn, { backgroundColor: colors.muted }]}
              onPress={() => setEditVisible(false)}
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Name field */}
          <View style={styles.editFields}>
            <Text style={[styles.editFieldLabel, { color: colors.mutedForeground }]}>Full Name</Text>
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Your full name"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              returnKeyType="next"
            />
            <Text style={[styles.editFieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>Messaging Name</Text>
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
              value={draftDisplayName}
              onChangeText={setDraftDisplayName}
              placeholder={user?.role === "broker" ? "e.g. your firm name" : "e.g. your first name"}
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
              onSubmitEditing={saveProfile}
            />
            <Text style={[styles.editFieldHint, { color: colors.mutedForeground }]}>
              {user?.role === "broker"
                ? "Shown to buyers in messages. Use your firm name to protect your privacy."
                : "Shown to buyers in messages. Your first name is recommended — your phone number is never shared."}
            </Text>
            <Text style={[styles.editFieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>Phone (read-only)</Text>
            <View style={[styles.editInputReadOnly, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.editInputReadOnlyText, { color: colors.mutedForeground }]}>{user?.email ?? "—"}</Text>
            </View>
            <Text style={[styles.editFieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>Role</Text>
            <View style={[styles.editInputReadOnly, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.editInputReadOnlyText, { color: colors.mutedForeground }]}>{user?.role ?? "—"}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.editSaveBtn, { backgroundColor: draftName.trim() ? colors.primary : colors.muted, opacity: saving ? 0.7 : 1 }]}
            onPress={saveProfile}
            disabled={saving || !draftName.trim()}
          >
            <Feather name="check" size={16} color={draftName.trim() ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.editSaveBtnText, { color: draftName.trim() ? "#fff" : colors.mutedForeground }]}>
              {saving ? "Saving…" : "Save Changes"}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function SettingsRow({ label, value, colors, last }: { label: string; value: string; colors: any; last?: boolean }) {
  return (
    <View style={[styles.settingsRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[styles.settingsLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.settingsValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1 },
  scroll:           { paddingHorizontal: 16, gap: 16 },
  title:            { fontSize: 26, fontFamily: "Inter_700Bold" },
  demoBanner:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  demoBannerLeft:   { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  demoBannerTitle:  { color: "#F59E0B", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  demoBannerSub:    { color: "#92400E", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  demoBannerBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  demoBannerBtnText:{ color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  userCard:         { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1 },
  avatar:           { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  avatarText:       { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  userInfo:         { flex: 1, gap: 4 },
  userName:         { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  userEmail:        { fontSize: 13, fontFamily: "Inter_400Regular" },
  rolePill:         { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4 },
  roleText:         { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statsRow:         { flexDirection: "row", gap: 10 },
  statBox:          { flex: 1, padding: 14, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  statVal:          { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLbl:          { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  portalCard:       { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 14, marginTop: 14 },
  portalIcon:       { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  portalTitle:      { color: "#fff", fontSize: 15, fontWeight: "700" },
  portalSub:        { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  menuCard:         { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  devCard:          { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16 },
  devHeader:        { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  devTitle:         { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, flex: 1 },
  devActivePill:    { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  devActivePillText:{ fontSize: 10, fontFamily: "Inter_600SemiBold" },
  devRoles:         { flexDirection: "row", gap: 8 },
  devRole:          { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 4, alignItems: "center", gap: 5 },
  devRoleLabel:     { fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  menuRow:          { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  menuIcon:         { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuText:         { flex: 1 },
  menuLabel:        { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  menuSub:          { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  expansion:        { borderTopWidth: 1 },
  emptyState:       { alignItems: "center", gap: 8, padding: 24, paddingTop: 20 },
  emptyStateTitle:  { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyStateSub:    { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18, opacity: 0.8 },
  ctaBtn:           { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  ctaBtnText:       { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  settingsSection:  { margin: 14, borderRadius: 10, overflow: "hidden" },
  settingsRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  settingsLabel:    { fontSize: 13, fontFamily: "Inter_400Regular", width: 60 },
  settingsValue:    { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  faqRow:           { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  faqQ:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  faqQuestion:      { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  faqAnswer:        { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 6, lineHeight: 18, opacity: 0.85 },
  switchRole:            { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  switchRoleText:        { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  realUserBadge:         { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  realUserText:          { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  logoutBtn:             { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  logoutText:            { color: "#EF4444", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // ── Edit Profile Modal ──
  editBackdrop:          { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" },
  editSheet:             { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, borderTopWidth: 1, borderColor: "#1E3A5C" },
  editHandle:            { width: 36, height: 4, borderRadius: 2, backgroundColor: "#2D4A6A", alignSelf: "center", marginBottom: 16 },
  editHeader:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 20 },
  editTitle:             { fontSize: 18, fontFamily: "Inter_700Bold" },
  editCloseBtn:          { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  editFields:            { paddingHorizontal: 20 },
  editFieldLabel:        { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  editFieldHint:         { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6, lineHeight: 17, opacity: 0.75 },
  editInput:             { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  editInputReadOnly:     { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  editInputReadOnlyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  editSaveBtn:           { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 20, marginTop: 24, paddingVertical: 14, borderRadius: 14 },
  editSaveBtnText:       { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
