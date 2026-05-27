import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLeads } from "@/lib/brokerStore";

const TEAM = [
  { id: "1", name: "James Harrington", role: "Senior Broker",    color: "#2563EB" },
  { id: "2", name: "Emma Kavanaugh",   role: "Associate Broker",  color: "#8B5CF6" },
  { id: "3", name: "Ryan Brooks",      role: "Junior Agent",      color: "#F59E0B" },
];

export default function TeamScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { leads } = useLeads();

  const getStats = (name: string) => {
    const firstName = name.split(" ")[0];
    const shortName = `${firstName} ${name.split(" ")[1]?.[0] ?? ""}.`;
    const memberLeads = leads.filter((l) => l.assignedTo.startsWith(firstName[0] + name.split(" ")[1]?.[0]) || l.assignedTo === shortName);
    return {
      leads: leads.filter((l) => l.assignedTo.includes(firstName)).length,
    };
  };

  const showMemberMenu = (member: typeof TEAM[0]) => {
    Alert.alert(member.name, member.role, [
      { text: "View Performance", onPress: () => Alert.alert("Performance", `${member.name} has handled ${getStats(member.name).leads} leads this period.`) },
      { text: "Reassign All Leads", onPress: () => Alert.alert("Coming Soon", "Lead bulk-reassignment will be available in a future update.") },
      { text: "Remove from Team", style: "destructive", onPress: () => Alert.alert("Remove Team Member", `Remove ${member.name} from the team?\n\nThis action cannot be undone.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => Alert.alert("Not available", "Cannot remove demo team members in this version.") },
      ]) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleInvite = () => {
    Alert.alert("Invite Team Member", "Enter the email address of the person you want to invite to your team.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send Invite", onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Invite Sent", "An invitation email has been sent. They'll appear here once they accept.");
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Team</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{TEAM.length} members · Premium Business Brokers</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={handleInvite}>
          <Feather name="user-plus" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        showsVerticalScrollIndicator={false}
      >
        {TEAM.map((member) => {
          const leadCount = leads.filter((l) => l.assignedTo.includes(member.name.split(" ")[0])).length;
          return (
            <View key={member.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: member.color }]}>
                <Text style={styles.avatarText}>{member.name.split(" ").map((n) => n[0]).join("")}</Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, { color: colors.foreground }]}>{member.name}</Text>
                <Text style={[styles.role, { color: colors.mutedForeground }]}>{member.role}</Text>
                <View style={styles.statsRow}>
                  <View style={[styles.statChip, { backgroundColor: colors.primary + "18" }]}>
                    <Feather name="users" size={10} color={colors.primary} />
                    <Text style={[styles.statText, { color: colors.primary }]}>{leadCount} leads</Text>
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
        })}

        <View style={[styles.inviteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.inviteIcon, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="user-plus" size={22} color={colors.primary} />
          </View>
          <View style={styles.inviteInfo}>
            <Text style={[styles.inviteTitle, { color: colors.foreground }]}>Add a team member</Text>
            <Text style={[styles.inviteHint, { color: colors.mutedForeground }]}>Invite brokers and agents to collaborate on listings</Text>
          </View>
          <TouchableOpacity style={[styles.inviteBtn, { backgroundColor: colors.primary }]} onPress={handleInvite}>
            <Text style={styles.inviteBtnText}>Invite</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  moreBtn: { padding: 4 },
  inviteCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1, borderStyle: "dashed" },
  inviteIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  inviteInfo: { flex: 1, gap: 3 },
  inviteTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  inviteHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  inviteBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  inviteBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
