import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
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
import { AdminBroker, useAdminBrokers } from "@/lib/adminStore";

const PLANS = ["Broker Lite", "Broker Growth", "Broker Pro", "Enterprise"];

export default function AdminBrokers() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: brokers, setData: setBrokers } = useAdminBrokers();

  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState<AdminBroker | null>(null);
  const [draftName,  setDraftName]  = useState("");
  const [draftFirm,  setDraftFirm]  = useState("");
  const [draftPlan,  setDraftPlan]  = useState(PLANS[0]);

  const openAdd = () => {
    setEditTarget(null);
    setDraftName("");
    setDraftFirm("");
    setDraftPlan(PLANS[0]);
    setShowModal(true);
  };

  const openEdit = (broker: AdminBroker) => {
    setEditTarget(broker);
    setDraftName(broker.name);
    setDraftFirm(broker.firm);
    setDraftPlan(broker.plan);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!draftName.trim()) {
      Alert.alert("Name required", "Please enter the broker's full name.");
      return;
    }
    if (editTarget) {
      setBrokers((prev) =>
        prev.map((b) => b.id === editTarget.id ? { ...b, name: draftName.trim(), firm: draftFirm.trim(), plan: draftPlan } : b),
      );
    } else {
      const newBroker: AdminBroker = {
        id: `broker-${Date.now()}`,
        name: draftName.trim(),
        firm: draftFirm.trim() || "Independent",
        listings: 0,
        status: "pending",
        plan: draftPlan,
      };
      setBrokers((prev) => [...prev, newBroker]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowModal(false);
  };

  const approve = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBrokers((prev) => prev.map((b) => b.id === id ? { ...b, status: "approved" } : b));
  };

  const showMenu = (broker: AdminBroker) => {
    Alert.alert(broker.name, `${broker.firm}\n${broker.plan} · ${broker.listings} listings`, [
      { text: "Edit Details", onPress: () => openEdit(broker) },
      {
        text: broker.status === "approved" ? "Suspend Account" : "Approve Account",
        style: broker.status === "approved" ? "destructive" : "default",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setBrokers((prev) => prev.map((b) => b.id === broker.id ? { ...b, status: broker.status === "approved" ? "pending" : "approved" } : b));
        },
      },
      {
        text: "Change Plan",
        onPress: () => {
          Alert.alert("Change Plan", `Current: ${broker.plan}`, [
            ...PLANS.map((plan) => ({
              text: plan,
              onPress: () => setBrokers((prev) => prev.map((b) => b.id === broker.id ? { ...b, plan } : b)),
            })),
            { text: "Cancel", style: "cancel" as const },
          ]);
        },
      },
      {
        text: "Remove Broker",
        style: "destructive",
        onPress: () => {
          Alert.alert("Remove Broker", `Permanently remove ${broker.name} from the platform?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: "destructive", onPress: () => setBrokers((prev) => prev.filter((b) => b.id !== broker.id)) },
          ]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const pendingCount  = brokers.filter((b) => b.status === "pending").length;
  const approvedCount = brokers.filter((b) => b.status === "approved").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Brokers</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {approvedCount} approved · {pendingCount} pending review
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {pendingCount > 0 && (
            <View style={[styles.badge, { backgroundColor: "#F59E0B" }]}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          )}
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={brokers}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="briefcase" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No brokers yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Tap + to add the first broker account</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: item.status === "pending" ? "#F59E0B60" : colors.border }]}>
            <View style={styles.top}>
              <View style={[styles.brokerAvatar, { backgroundColor: item.status === "approved" ? colors.primary + "20" : "#F59E0B20" }]}>
                <Text style={[styles.brokerAvatarText, { color: item.status === "approved" ? colors.primary : "#F59E0B" }]}>
                  {item.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </Text>
              </View>
              <View style={styles.nameBox}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.firm, { color: colors.mutedForeground }]}>{item.firm}</Text>
              </View>
              <View style={[styles.planTag, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.planText, { color: colors.primary }]}>{item.plan}</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{item.listings} active listings</Text>
              <View style={[styles.statusTag, { backgroundColor: item.status === "approved" ? "#16A34A20" : "#F59E0B20" }]}>
                <Text style={[styles.statusText, { color: item.status === "approved" ? "#16A34A" : "#F59E0B" }]}>
                  {item.status === "approved" ? "Approved" : "Pending Review"}
                </Text>
              </View>
            </View>
            <View style={styles.actions}>
              {item.status === "pending" && (
                <TouchableOpacity style={[styles.approveBtn, { backgroundColor: colors.accent }]} onPress={() => approve(item.id)}>
                  <Feather name="check" size={14} color="#fff" />
                  <Text style={styles.approveTxt}>Approve</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.moreBtn, { backgroundColor: colors.muted }]} onPress={() => showMenu(item)}>
                <Feather name="more-horizontal" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Add / Edit Broker Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editTarget ? "Edit Broker" : "Add Broker"}
            </Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>
                {editTarget ? "Save" : "Add"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>FULL NAME *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. Jane Smith"
              placeholderTextColor={colors.mutedForeground}
              value={draftName}
              onChangeText={setDraftName}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>BROKERAGE / FIRM</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. Premium Business Brokers"
              placeholderTextColor={colors.mutedForeground}
              value={draftFirm}
              onChangeText={setDraftFirm}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>SUBSCRIPTION PLAN</Text>
            <View style={styles.planGrid}>
              {PLANS.map((plan) => (
                <TouchableOpacity
                  key={plan}
                  style={[styles.planChip, { backgroundColor: draftPlan === plan ? colors.primary : colors.card, borderColor: draftPlan === plan ? colors.primary : colors.border }]}
                  onPress={() => setDraftPlan(plan)}
                >
                  <Text style={[styles.planChipText, { color: draftPlan === plan ? "#fff" : colors.foreground }]}>{plan}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!editTarget && (
              <View style={[styles.infoBox, { backgroundColor: "#F59E0B12", borderColor: "#F59E0B30" }]}>
                <Feather name="info" size={14} color="#F59E0B" />
                <Text style={[styles.infoText, { color: colors.foreground }]}>
                  New brokers are added with "Pending Review" status. Approve them on this screen once verified.
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12 },
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 10 },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  brokerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  brokerAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  nameBox: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  firm: { fontSize: 12, fontFamily: "Inter_400Regular" },
  planTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  planText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  actions: { flexDirection: "row", gap: 8 },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 10 },
  approveTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  moreBtn: { height: 42, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalCancel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  modalSave: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalScroll: { padding: 20, gap: 14 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 4 },
  planGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  planChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  planChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
