import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  pickMemberColor,
  TeamMember,
  TEAM_ROLES,
  useLeads,
  useTeamMembers,
} from "@/lib/brokerStore";

export default function TeamScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { members, setMembers } = useTeamMembers();
  const { leads } = useLeads();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState(TEAM_ROLES[0]);

  const openAdd = () => {
    setEditTarget(null);
    setDraftName("");
    setDraftRole(TEAM_ROLES[0]);
    setShowModal(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditTarget(member);
    setDraftName(member.name);
    setDraftRole(member.role);
    setShowModal(true);
  };

  const handleSave = () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Please enter the team member's name.");
      return;
    }
    if (editTarget) {
      setMembers((prev) =>
        prev.map((m) => m.id === editTarget.id ? { ...m, name: trimmed, role: draftRole } : m),
      );
    } else {
      const newMember: TeamMember = {
        id: `tm-${Date.now()}`,
        name: trimmed,
        role: draftRole,
        color: pickMemberColor(members.length),
      };
      setMembers((prev) => [...prev, newMember]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowModal(false);
  };

  const handleRemove = (member: TeamMember) => {
    const memberLeadCount = leads.filter((l) => l.assignedTo.includes(member.name.split(" ")[0])).length;
    Alert.alert(
      "Remove Team Member",
      memberLeadCount > 0
        ? `${member.name} has ${memberLeadCount} assigned lead${memberLeadCount > 1 ? "s" : ""}. Removing them will leave those leads unassigned.`
        : `Remove ${member.name} from the team?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setMembers((prev) => prev.filter((m) => m.id !== member.id));
          },
        },
      ],
    );
  };

  const showMemberMenu = (member: TeamMember) => {
    const leadCount = leads.filter((l) => l.assignedTo.includes(member.name.split(" ")[0])).length;
    Alert.alert(member.name, `${member.role} · ${leadCount} lead${leadCount !== 1 ? "s" : ""}`, [
      { text: "Edit Details",       onPress: () => openEdit(member) },
      { text: "View Performance",   onPress: () => Alert.alert("Performance", `${member.name} currently has ${leadCount} assigned lead${leadCount !== 1 ? "s" : ""}.`) },
      { text: "Remove from Team",   style: "destructive", onPress: () => handleRemove(member) },
      { text: "Cancel",             style: "cancel" },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Team</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {members.length} member{members.length !== 1 ? "s" : ""} · Premium Business Brokers
          </Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
          <Feather name="user-plus" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        showsVerticalScrollIndicator={false}
      >
        {members.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="users" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No team members yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tap the + button to add your first team member</Text>
          </View>
        ) : (
          members.map((member) => {
            const leadCount = leads.filter((l) => l.assignedTo.includes(member.name.split(" ")[0])).length;
            return (
              <View key={member.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: member.color }]}>
                  <Text style={styles.avatarText}>
                    {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{member.name}</Text>
                  <Text style={[styles.role, { color: colors.mutedForeground }]}>{member.role}</Text>
                  <View style={styles.statsRow}>
                    <View style={[styles.statChip, { backgroundColor: colors.primary + "18" }]}>
                      <Feather name="users" size={10} color={colors.primary} />
                      <Text style={[styles.statText, { color: colors.primary }]}>{leadCount} lead{leadCount !== 1 ? "s" : ""}</Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: "#16A34A18" }]}>
                      <View style={[styles.onlineDot, { backgroundColor: "#16A34A" }]} />
                      <Text style={[styles.statusText, { color: "#16A34A" }]}>Active</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={styles.moreBtn} onPress={() => showMemberMenu(member)}>
                  <Feather name="more-horizontal" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* Invite card */}
        <View style={[styles.inviteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.inviteIcon, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="user-plus" size={22} color={colors.primary} />
          </View>
          <View style={styles.inviteInfo}>
            <Text style={[styles.inviteTitle, { color: colors.foreground }]}>Add a team member</Text>
            <Text style={[styles.inviteHint, { color: colors.mutedForeground }]}>Brokers and agents who collaborate on listings</Text>
          </View>
          <TouchableOpacity style={[styles.inviteBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
            <Text style={styles.inviteBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editTarget ? "Edit Team Member" : "Add Team Member"}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>
                {editTarget ? "Save" : "Add"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>FULL NAME</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. Jane Smith"
              placeholderTextColor={colors.mutedForeground}
              value={draftName}
              onChangeText={setDraftName}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>ROLE</Text>
            <View style={styles.roleGrid}>
              {TEAM_ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, { backgroundColor: draftRole === r ? colors.primary : colors.card, borderColor: draftRole === r ? colors.primary : colors.border }]}
                  onPress={() => setDraftRole(r)}
                >
                  <Text style={[styles.roleChipText, { color: draftRole === r ? "#fff" : colors.foreground }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!editTarget && (
              <View style={[styles.infoBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
                <Feather name="info" size={14} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.foreground }]}>
                  The team member will appear in your leads assignment list and team overview immediately.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, gap: 12 },
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  role: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  statChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  onlineDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  moreBtn: { padding: 6 },
  inviteCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1, borderStyle: "dashed" },
  inviteIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  inviteInfo: { flex: 1, gap: 3 },
  inviteTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  inviteHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  inviteBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  inviteBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalCancel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  modalSave: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalScroll: { padding: 20, gap: 12 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  nameInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 4 },
  roleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  roleChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  roleChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
