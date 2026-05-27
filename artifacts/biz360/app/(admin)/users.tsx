import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AdminUser, useAdminUsers } from "@/lib/adminStore";

const ROLE_COLORS: Record<string, string> = {
  buyer: "#3B82F6", seller: "#8B5CF6", broker: "#F59E0B", admin: "#EF4444",
};

const ROLES = ["buyer", "seller", "broker", "admin"] as const;
type Role = typeof ROLES[number];

const DEMO_IDS = ["u1", "u2", "u3", "u4", "u5", "u6"];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function today() {
  return new Date().toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}

export default function AdminUsers() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: users, setData: setUsers, loading } = useAdminUsers();

  const [showAdd, setShowAdd]   = useState(false);
  const [newName, setNewName]   = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole]   = useState<Role>("buyer");
  const [nameErr, setNameErr]   = useState(false);
  const [emailErr, setEmailErr] = useState(false);

  const openAdd = () => {
    setNewName(""); setNewEmail(""); setNewRole("buyer");
    setNameErr(false); setEmailErr(false);
    setShowAdd(true);
  };

  const addUser = () => {
    const nameOk  = newName.trim().length > 0;
    const emailOk = /\S+@\S+\.\S+/.test(newEmail.trim());
    setNameErr(!nameOk);
    setEmailErr(!emailOk);
    if (!nameOk || !emailOk) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const user: AdminUser = {
      id:     `u-${Date.now()}`,
      name:   newName.trim(),
      email:  newEmail.trim().toLowerCase(),
      role:   newRole,
      status: "active",
      joined: today(),
    };
    setUsers((prev) => [user, ...prev]);
    setShowAdd(false);
  };

  const showMenu = (user: AdminUser) => {
    const isSuspended = user.status === "suspended";
    Alert.alert(user.name, `${user.email}\nRole: ${user.role} · Joined ${user.joined}`, [
      {
        text: isSuspended ? "Activate Account" : "Suspend Account",
        style: isSuspended ? "default" : "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setUsers((prev) =>
            prev.map((u) => u.id === user.id ? { ...u, status: isSuspended ? "active" : "suspended" } : u),
          );
        },
      },
      {
        text: "Change Role",
        onPress: () => {
          Alert.alert("Change Role", `Set role for ${user.name}`, [
            { text: "Buyer",  onPress: () => setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: "buyer"  } : u)) },
            { text: "Seller", onPress: () => setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: "seller" } : u)) },
            { text: "Broker", onPress: () => setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: "broker" } : u)) },
            { text: "Admin",  onPress: () => setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: "admin"  } : u)) },
            { text: "Cancel", style: "cancel" },
          ]);
        },
      },
      {
        text: "Delete User",
        style: "destructive",
        onPress: () => {
          Alert.alert("Delete User", `Permanently remove ${user.name} from the platform?`, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete", style: "destructive", onPress: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setUsers((prev) => prev.filter((u) => u.id !== user.id));
              },
            },
          ]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const clearDemoUsers = () => {
    const demoCount = users.filter((u) => DEMO_IDS.includes(u.id)).length;
    if (demoCount === 0) {
      Alert.alert("No Demo Users", "All demo users have already been removed.");
      return;
    }
    Alert.alert(
      "Clear Demo Users",
      `Remove all ${demoCount} demo user${demoCount !== 1 ? "s" : ""}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Remove ${demoCount} Users`,
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setUsers((prev) => prev.filter((u) => !DEMO_IDS.includes(u.id)));
          },
        },
      ],
    );
  };

  const activeCount    = users.filter((u) => u.status === "active").length;
  const suspendedCount = users.filter((u) => u.status === "suspended").length;
  const hasDemoUsers   = users.some((u) => DEMO_IDS.includes(u.id));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.foreground }]}>Users</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {users.length} registered · {activeCount} active{suspendedCount > 0 ? ` · ${suspendedCount} suspended` : ""}
          </Text>
        </View>
        <View style={styles.headerBtns}>
          {hasDemoUsers && (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: "#EF444418", borderColor: "#EF444440" }]}
              onPress={clearDemoUsers}
            >
              <Feather name="trash-2" size={14} color="#EF4444" />
              <Text style={[styles.headerBtnText, { color: "#EF4444" }]}>Demo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={openAdd}
          >
            <Feather name="plus" size={14} color="#fff" />
            <Text style={[styles.headerBtnText, { color: "#fff" }]}>Add User</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── User List ───────────────────────────────────────────────────── */}
      <FlatList
        data={users}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No users yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tap Add User to create the first account.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const roleColor = ROLE_COLORS[item.role] ?? "#6B7280";
          const isDemo    = DEMO_IDS.includes(item.id);
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: roleColor + "22" }]}>
                <Text style={[styles.avatarText, { color: roleColor }]}>{initials(item.name)}</Text>
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                  {isDemo && (
                    <View style={[styles.demoTag, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.demoTagText, { color: colors.mutedForeground }]}>demo</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.email, { color: colors.mutedForeground }]}>{item.email}</Text>
                <View style={styles.tagsRow}>
                  <View style={[styles.tag, { backgroundColor: roleColor + "20" }]}>
                    <Text style={[styles.tagText, { color: roleColor }]}>{item.role}</Text>
                  </View>
                  <View style={[styles.tag, { backgroundColor: item.status === "active" ? "#16A34A20" : "#EF444420" }]}>
                    <Text style={[styles.tagText, { color: item.status === "active" ? "#16A34A" : "#EF4444" }]}>
                      {item.status}
                    </Text>
                  </View>
                  <Text style={[styles.joined, { color: colors.mutedForeground }]}>Joined {item.joined}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.more} onPress={() => showMenu(item)}>
                <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* ─── Add User Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={showAdd}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAdd(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowAdd(false)} />

          <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
            {/* Sheet handle */}
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Add New User</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Name */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Full Name</Text>
            <View style={[
              styles.inputWrap,
              { backgroundColor: colors.background, borderColor: nameErr ? "#EF4444" : colors.border },
            ]}>
              <Feather name="user" size={15} color={nameErr ? "#EF4444" : colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="e.g. Jane Smith"
                placeholderTextColor={colors.mutedForeground}
                value={newName}
                onChangeText={(t) => { setNewName(t); setNameErr(false); }}
                autoCapitalize="words"
              />
            </View>
            {nameErr && <Text style={styles.errText}>Name is required</Text>}

            {/* Email */}
            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 14 }]}>Email Address</Text>
            <View style={[
              styles.inputWrap,
              { backgroundColor: colors.background, borderColor: emailErr ? "#EF4444" : colors.border },
            ]}>
              <Feather name="mail" size={15} color={emailErr ? "#EF4444" : colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="e.g. jane@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={newEmail}
                onChangeText={(t) => { setNewEmail(t); setEmailErr(false); }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            {emailErr && <Text style={styles.errText}>Enter a valid email</Text>}

            {/* Role */}
            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 14 }]}>Role</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => {
                const active = newRole === r;
                const c      = ROLE_COLORS[r];
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleBtn,
                      {
                        backgroundColor: active ? c + "22" : colors.background,
                        borderColor:     active ? c        : colors.border,
                      },
                    ]}
                    onPress={() => setNewRole(r)}
                  >
                    <Text style={[styles.roleBtnText, { color: active ? c : colors.mutedForeground }]}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
              onPress={addUser}
            >
              <Feather name="user-plus" size={16} color="#fff" />
              <Text style={styles.submitText}>Create User</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerLeft:     { flex: 1, gap: 3 },
  title:          { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle:       { fontSize: 12, fontFamily: "Inter_400Regular" },
  headerBtns:     { flexDirection: "row", gap: 8, alignItems: "center" },
  headerBtn:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  headerBtnText:  { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  list:           { padding: 16, gap: 10 },
  card:           { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  avatar:         { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText:     { fontSize: 14, fontFamily: "Inter_700Bold" },
  info:           { flex: 1, gap: 3 },
  nameRow:        { flexDirection: "row", alignItems: "center", gap: 6 },
  name:           { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  demoTag:        { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  demoTagText:    { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  email:          { fontSize: 12, fontFamily: "Inter_400Regular" },
  tagsRow:        { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 },
  tag:            { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagText:        { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  joined:         { fontSize: 10, fontFamily: "Inter_400Regular" },
  more:           { padding: 4 },
  empty:          { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle:     { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText:      { fontSize: 14, fontFamily: "Inter_400Regular" },
  modalOverlay:   { flex: 1, justifyContent: "flex-end" },
  modalBackdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet:          { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, gap: 0 },
  sheetHandle:    { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sheetTitle:     { fontSize: 18, fontFamily: "Inter_700Bold" },
  label:          { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  inputWrap:      { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  input:          { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  errText:        { fontSize: 11, fontFamily: "Inter_400Regular", color: "#EF4444", marginTop: 4, marginLeft: 2 },
  roleRow:        { flexDirection: "row", gap: 8 },
  roleBtn:        { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  roleBtnText:    { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  submitBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  submitText:     { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
