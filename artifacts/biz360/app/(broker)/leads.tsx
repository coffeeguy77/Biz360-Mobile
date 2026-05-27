import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { formatLeadTime, Lead, TEAM_MEMBERS, useLeads } from "@/lib/brokerStore";

const QC: Record<string, string> = { hot: "#EF4444", warm: "#F59E0B", cold: "#3B82F6" };
const QC_LABEL: Record<string, string> = { hot: "HOT", warm: "WARM", cold: "COLD" };

function LeadCard({ item, colors, onMessage, onAssign, onDelete }: {
  item: Lead;
  colors: ReturnType<typeof useColors>;
  onMessage: () => void;
  onAssign: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: item.quality === "hot" ? QC.hot + "40" : colors.border }]}>
      <View style={styles.top}>
        <View style={[styles.qTag, { backgroundColor: QC[item.quality] + "20" }]}>
          <View style={[styles.qDot, { backgroundColor: QC[item.quality] }]} />
          <Text style={[styles.qLabel, { color: QC[item.quality] }]}>{QC_LABEL[item.quality]}</Text>
        </View>
        <Text style={[styles.leadName, { color: colors.foreground }]}>{item.name}</Text>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>{formatLeadTime(item.timestamp)}</Text>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="trash-2" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.listing, { color: colors.primary }]}>{item.listing}</Text>
      <Text style={[styles.action,  { color: colors.mutedForeground }]}>{item.action}</Text>
      <View style={styles.bottom}>
        <View style={[styles.assignedTag, { backgroundColor: colors.muted }]}>
          <Feather name="user" size={11} color={colors.mutedForeground} />
          <Text style={[styles.assignedText, { color: colors.mutedForeground }]}>{item.assignedTo}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary + "18" }]} onPress={onMessage}>
            <Feather name="message-circle" size={14} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent + "18" }]} onPress={onAssign}>
            <Feather name="user-check" size={14} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>
      {item.status !== "open" && (
        <View style={[styles.statusBar, { backgroundColor: colors.accent + "18" }]}>
          <Feather name="check-circle" size={12} color={colors.accent} />
          <Text style={[styles.statusBarText, { color: colors.accent }]}>
            {item.status === "contacted" ? "Contacted" : item.status === "qualified" ? "Qualified" : "Closed"}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function BrokerLeads() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { leads, setLeads, deleteLead } = useLeads();

  const hotCount  = leads.filter((l) => l.quality === "hot"  && l.status === "open").length;
  const openCount = leads.filter((l) => l.status === "open").length;

  const handleMessage = (lead: Lead) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const threadId = `broker-lead-${lead.id}`;
    router.push(`/thread/${threadId}?listingName=${encodeURIComponent(lead.listing)}&sellerName=${encodeURIComponent(lead.name)}&buyerName=Broker` as any);
    setLeads((prev) => prev.map((l) => l.id === lead.id && l.status === "open" ? { ...l, status: "contacted" } : l));
  };

  const handleAssign = (lead: Lead) => {
    Alert.alert("Assign Lead", `Assign ${lead.name} to:`, [
      ...TEAM_MEMBERS.map((member) => ({
        text: member,
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, assignedTo: member } : l));
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const handleDelete = (lead: Lead) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Remove Lead", `Remove ${lead.name} from your leads?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          deleteLead(lead.id);
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Leads</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {openCount} open · {hotCount > 0 ? `${hotCount} hot 🔥` : "no hot leads"}
          </Text>
        </View>
        {hotCount > 0 && (
          <View style={[styles.hotBadge, { backgroundColor: "#EF4444" }]}>
            <Text style={styles.hotBadgeText}>{hotCount}</Text>
          </View>
        )}
      </View>
      <FlatList
        data={leads}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="users" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No leads yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <LeadCard
            item={item}
            colors={colors}
            onMessage={() => handleMessage(item)}
            onAssign={() => handleAssign(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  hotBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  hotBadgeText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  list: { padding: 16, gap: 10 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 6 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  qTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  qDot: { width: 6, height: 6, borderRadius: 3 },
  qLabel: { fontSize: 10, fontFamily: "Inter_700Bold" },
  leadName: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  listing: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  action: { fontSize: 13, fontFamily: "Inter_400Regular" },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  assignedTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  assignedText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  statusBar: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 2 },
  statusBarText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
});
