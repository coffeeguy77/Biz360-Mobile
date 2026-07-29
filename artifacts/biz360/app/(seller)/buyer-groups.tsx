/**
 * Buyer Access Groups — Seller Management Screen
 *
 * Sellers create named groups, add buyers by phone number, then control
 * exactly what each group can see in the EXIT360 buyer portal.
 * Route: /(seller)/buyer-groups
 */
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("biz360_auth_token");
}

type PermKey = "canViewImReport" | "canViewWalkthrough" | "canViewFinancials" | "canViewEquipment";

interface Member {
  id: string;
  phone: string;
  name: string | null;
  addedAt: string | null;
}

interface Permissions {
  id?: string;
  canViewImReport: boolean;
  canViewWalkthrough: boolean;
  canViewFinancials: boolean;
  canViewEquipment: boolean;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  members: Member[];
  permissions: Permissions | null;
  createdAt: string | null;
}

const PERM_LABELS: { key: PermKey; label: string; desc: string; icon: string }[] = [
  { key: "canViewImReport",    label: "IM Report",          desc: "Full Information Memorandum",        icon: "file-text"  },
  { key: "canViewWalkthrough", label: "360° Walkthrough",   desc: "Virtual tour of the premises",       icon: "video"      },
  { key: "canViewFinancials",  label: "Financial Charts",   desc: "Revenue, EBITDA and chart data",     icon: "bar-chart-2"},
  { key: "canViewEquipment",   label: "Equipment List",     desc: "Full asset register with values",    icon: "tool"       },
];

export default function BuyerGroupsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe } = useValuation();
  const { cafeId: cafeIdParam } = useLocalSearchParams<{ cafeId?: string }>();

  const cafeId = cafeIdParam ?? selectedCafe?.id ?? "";

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Create group modal
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Add member modal
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // Permissions saving state
  const [savingPerms, setSavingPerms] = useState(false);

  const portalUrl = domain ? `https://${domain}/buyers` : "your EXIT360 buyer portal";

  async function fetchGroups() {
    if (!cafeId) { setLoading(false); return; }
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/buyer-portal/groups?cafeId=${cafeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setGroups(d.groups ?? []);
      }
    } catch {}
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { fetchGroups(); }, [cafeId]));

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/buyer-portal/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cafeId, name: newGroupName.trim(), description: newGroupDesc.trim() || null }),
      });
      if (res.ok) {
        const d = await res.json();
        setGroups((prev) => [d.group, ...prev]);
        setSelectedGroup(d.group);
        setShowCreate(false);
        setNewGroupName(""); setNewGroupDesc("");
      } else {
        const err = await res.json();
        Alert.alert("Error", err.error ?? "Could not create group");
      }
    } catch { Alert.alert("Error", "Network error"); }
    setCreating(false);
  }

  async function handleDeleteGroup(groupId: string) {
    Alert.alert("Delete Group", "This will remove all buyers in this group. They will lose access immediately.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            const token = await getToken();
            await fetch(`${API_BASE}/api/buyer-portal/groups/${groupId}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            setGroups((prev) => prev.filter((g) => g.id !== groupId));
            if (selectedGroup?.id === groupId) setSelectedGroup(null);
          } catch {}
        },
      },
    ]);
  }

  async function handleAddMember() {
    if (!newMemberPhone.trim() || !selectedGroup) return;
    setAddingMember(true);
    try {
      const token = await getToken();
      // Normalise: ensure +61 prefix if Australian
      let phone = newMemberPhone.trim().replace(/\s/g, "");
      if (phone.startsWith("0")) phone = "+61" + phone.slice(1);
      else if (!phone.startsWith("+")) phone = "+" + phone;

      const res = await fetch(`${API_BASE}/api/buyer-portal/groups/${selectedGroup.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone, name: newMemberName.trim() || null }),
      });
      if (res.ok) {
        const d = await res.json();
        const updated = { ...selectedGroup, members: [...selectedGroup.members, d.member] };
        setSelectedGroup(updated);
        setGroups((prev) => prev.map((g) => g.id === updated.id ? updated : g));
        setShowAddMember(false);
        setNewMemberPhone(""); setNewMemberName("");
      } else {
        const err = await res.json();
        Alert.alert("Error", err.error ?? "Could not add member");
      }
    } catch { Alert.alert("Error", "Network error"); }
    setAddingMember(false);
  }

  async function handleRemoveMember(memberId: string) {
    if (!selectedGroup) return;
    Alert.alert("Remove Buyer", "This buyer will immediately lose access to the portal.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          try {
            const token = await getToken();
            await fetch(`${API_BASE}/api/buyer-portal/groups/${selectedGroup.id}/members/${memberId}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            const updated = { ...selectedGroup, members: selectedGroup.members.filter((m) => m.id !== memberId) };
            setSelectedGroup(updated);
            setGroups((prev) => prev.map((g) => g.id === updated.id ? updated : g));
          } catch {}
        },
      },
    ]);
  }

  async function handleTogglePerm(key: PermKey, value: boolean) {
    if (!selectedGroup) return;
    const current = selectedGroup.permissions ?? {
      canViewImReport: false, canViewWalkthrough: false,
      canViewFinancials: false, canViewEquipment: false,
    };
    const updated = { ...current, [key]: value };
    const optimistic: Group = { ...selectedGroup, permissions: updated };
    setSelectedGroup(optimistic);
    setGroups((prev) => prev.map((g) => g.id === optimistic.id ? optimistic : g));

    setSavingPerms(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/buyer-portal/groups/${selectedGroup.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cafeId, ...updated }),
      });
      if (!res.ok) {
        // Revert on error
        const reverted = { ...selectedGroup, permissions: current };
        setSelectedGroup(reverted);
        setGroups((prev) => prev.map((g) => g.id === reverted.id ? reverted : g));
        Alert.alert("Error", "Could not save permissions");
      }
    } catch {
      const reverted = { ...selectedGroup, permissions: current };
      setSelectedGroup(reverted);
    }
    setSavingPerms(false);
  }

  function handleSharePortalLink() {
    Alert.alert(
      "Buyer Portal Link",
      `Share this link with buyers so they can log in:\n\n${portalUrl}\n\nBuyers enter their verified phone number to access the reports you've shared with them.`,
      [{ text: "OK" }]
    );
  }

  if (!cafeId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Buyer Access</Text>
        </View>
        <View style={styles.empty}>
          <Feather name="users" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No business selected</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Set up your valuation first to manage buyer access.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Group detail / main list ─────────────────────────────────────── */}
      {selectedGroup ? (
        // ── GROUP DETAIL ──────────────────────────────────────────────────
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setSelectedGroup(null)} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>{selectedGroup.name}</Text>
              {selectedGroup.description ? (
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{selectedGroup.description}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => handleDeleteGroup(selectedGroup.id)} style={styles.deleteBtn}>
              <Feather name="trash-2" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* Portal link info banner */}
          <TouchableOpacity
            style={[styles.infoBanner, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}
            onPress={handleSharePortalLink}
          >
            <Feather name="link" size={14} color="#3B82F6" />
            <Text style={styles.infoBannerText}>Buyers log in at exit360.com.au/buyers — tap to see the link</Text>
            <Feather name="chevron-right" size={14} color="#8B9CB8" />
          </TouchableOpacity>

          {/* ── Permissions ─────────────────────────────────────────────── */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>What can they see?</Text>
              {savingPerms && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              Toggle which sections of the report buyers in this group can access.
            </Text>
            {PERM_LABELS.map(({ key, label, desc, icon }) => {
              const value = selectedGroup.permissions?.[key] ?? false;
              return (
                <View key={key} style={[styles.permRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.permIcon, { backgroundColor: value ? "#1E3A5C" : colors.background }]}>
                    <Feather name={icon as any} size={16} color={value ? "#3B82F6" : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.permLabel, { color: colors.foreground }]}>{label}</Text>
                    <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>{desc}</Text>
                  </View>
                  <Switch
                    value={value}
                    onValueChange={(v) => handleTogglePerm(key, v)}
                    trackColor={{ false: colors.border, true: "#3B82F6" }}
                    thumbColor="#fff"
                  />
                </View>
              );
            })}
          </View>

          {/* ── Members ─────────────────────────────────────────────────── */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Buyers ({selectedGroup.members.length})
              </Text>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowAddMember(true)}
              >
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.addBtnText}>Add Buyer</Text>
              </TouchableOpacity>
            </View>

            {selectedGroup.members.length === 0 ? (
              <View style={styles.emptyMembers}>
                <Feather name="user-plus" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyMembersText, { color: colors.mutedForeground }]}>
                  No buyers added yet. Tap "Add Buyer" to give someone access.
                </Text>
              </View>
            ) : (
              selectedGroup.members.map((m) => (
                <View key={m.id} style={[styles.memberRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.memberAvatar, { backgroundColor: "#1E3A5C" }]}>
                    <Feather name="user" size={16} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    {m.name ? (
                      <Text style={[styles.memberName, { color: colors.foreground }]}>{m.name}</Text>
                    ) : null}
                    <Text style={[styles.memberPhone, { color: m.name ? colors.mutedForeground : colors.foreground }]}>
                      {m.phone}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveMember(m.id)} style={styles.removeBtn}>
                    <Feather name="x" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : (
        // ── GROUP LIST ────────────────────────────────────────────────────
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.foreground }]}>Buyer Access Groups</Text>
          </View>

          {/* How it works */}
          <View style={[styles.howItWorks, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
            <View style={styles.howItWorksRow}>
              <View style={[styles.howStep, { borderColor: "#1E3A5C" }]}>
                <Text style={styles.howStepNum}>1</Text>
                <Text style={styles.howStepText}>Create a group{"\n"}(e.g. "Serious Buyers")</Text>
              </View>
              <Feather name="arrow-right" size={14} color="#3B82F6" />
              <View style={[styles.howStep, { borderColor: "#1E3A5C" }]}>
                <Text style={styles.howStepNum}>2</Text>
                <Text style={styles.howStepText}>Add buyers by{"\n"}mobile number</Text>
              </View>
              <Feather name="arrow-right" size={14} color="#3B82F6" />
              <View style={[styles.howStep, { borderColor: "#1E3A5C" }]}>
                <Text style={styles.howStepNum}>3</Text>
                <Text style={styles.howStepText}>Choose what{"\n"}they can see</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.portalLinkBtn} onPress={handleSharePortalLink}>
              <Feather name="link" size={13} color="#3B82F6" />
              <Text style={styles.portalLinkText}>Buyers log in at exit360.com.au/buyers</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.createGroupBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowCreate(true)}
              >
                <Feather name="plus" size={18} color="#fff" />
                <Text style={styles.createGroupBtnText}>New Buyer Group</Text>
              </TouchableOpacity>

              {groups.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="users" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No groups yet</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Create your first buyer group to start sharing reports securely.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {groups.map((g) => {
                    const permCount = PERM_LABELS.filter(({ key }) => g.permissions?.[key]).length;
                    return (
                      <TouchableOpacity
                        key={g.id}
                        style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => setSelectedGroup(g)}
                      >
                        <View style={[styles.groupIcon, { backgroundColor: "#1E3A5C" }]}>
                          <Feather name="users" size={20} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.groupName, { color: colors.foreground }]}>{g.name}</Text>
                          <Text style={[styles.groupMeta, { color: colors.mutedForeground }]}>
                            {g.members.length} {g.members.length === 1 ? "buyer" : "buyers"} · {permCount} section{permCount !== 1 ? "s" : ""} shared
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Create Group Modal ────────────────────────────────────────────── */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Buyer Group</Text>
            <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
              Give the group a descriptive name — e.g. "Serious Buyers", "Stage 2 Access" or "Due Diligence".
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Group name"
              placeholderTextColor={colors.mutedForeground}
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={newGroupDesc}
              onChangeText={setNewGroupDesc}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border }]} onPress={() => setShowCreate(false)}>
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: colors.primary, opacity: !newGroupName.trim() || creating ? 0.5 : 1 }]}
                onPress={handleCreateGroup}
                disabled={!newGroupName.trim() || creating}
              >
                {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnPrimaryText}>Create Group</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add Member Modal ─────────────────────────────────────────────── */}
      <Modal visible={showAddMember} transparent animationType="fade" onRequestClose={() => setShowAddMember(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Buyer</Text>
            <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
              Enter the buyer's Australian mobile number. They'll use it to log into the portal.
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Mobile e.g. 0412 345 678"
              placeholderTextColor={colors.mutedForeground}
              value={newMemberPhone}
              onChangeText={setNewMemberPhone}
              keyboardType="phone-pad"
              autoFocus
            />
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Buyer's name (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={newMemberName}
              onChangeText={setNewMemberName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border }]} onPress={() => setShowAddMember(false)}>
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: colors.primary, opacity: !newMemberPhone.trim() || addingMember ? 0.5 : 1 }]}
                onPress={handleAddMember}
                disabled={!newMemberPhone.trim() || addingMember}
              >
                {addingMember ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnPrimaryText}>Add Buyer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  scroll:            { paddingHorizontal: 16, gap: 14 },
  header:            { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:           { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:             { fontSize: 20, fontFamily: "Inter_700Bold", flex: 1 },
  subtitle:          { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  deleteBtn:         { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  infoBanner:        { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  infoBannerText:    { flex: 1, color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  howItWorks:        { borderRadius: 16, padding: 16, borderWidth: 1, gap: 14 },
  howItWorksRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  howStep:           { flex: 1, alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 12, padding: 10 },
  howStepNum:        { color: "#3B82F6", fontSize: 16, fontFamily: "Inter_700Bold" },
  howStepText:       { color: "#8B9CB8", fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 14 },
  portalLinkBtn:     { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "rgba(59,130,246,0.08)", borderRadius: 10 },
  portalLinkText:    { color: "#3B82F6", fontSize: 12, fontFamily: "Inter_500Medium" },
  createGroupBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  createGroupBtnText:{ color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  groupCard:         { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 14, borderWidth: 1, gap: 14 },
  groupIcon:         { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  groupName:         { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  groupMeta:         { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  section:           { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  sectionHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  sectionTitle:      { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionDesc:       { paddingHorizontal: 16, paddingBottom: 12, fontSize: 13, fontFamily: "Inter_400Regular" },
  permRow:           { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },
  permIcon:          { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  permLabel:         { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  permDesc:          { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  memberRow:         { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  memberAvatar:      { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  memberName:        { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  memberPhone:       { fontSize: 13, fontFamily: "Inter_400Regular" },
  removeBtn:         { padding: 6 },
  addBtn:            { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  addBtnText:        { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyMembers:      { alignItems: "center", padding: 24, gap: 10 },
  emptyMembersText:  { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 280 },
  empty:             { alignItems: "center", paddingVertical: 50, gap: 10 },
  emptyTitle:        { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText:         { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, maxWidth: 300 },
  // Modals
  modalOverlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard:         { width: "100%", maxWidth: 400, borderRadius: 20, borderWidth: 1, padding: 24, gap: 14 },
  modalTitle:        { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalDesc:         { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  textInput:         { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  modalActions:      { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn:          { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  modalBtnText:      { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalBtnPrimary:   { borderWidth: 0 },
  modalBtnPrimaryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
