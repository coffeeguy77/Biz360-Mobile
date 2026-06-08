import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useValuation, ValUnit } from "@/context/ValuationContext";

export default function UnitsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { businessUnits, fetchUnits, createUnit, updateUnit, deleteUnit, selectedCafe } = useValuation();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newShare, setNewShare] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editShare, setEditShare] = useState("");

  useFocusEffect(useCallback(() => { fetchUnits(); }, [selectedCafe?.id]));

  const totalShare = businessUnits.reduce((s, u) => s + Number(u.revenueSharePct ?? 0), 0);
  const isValid = Math.abs(totalShare - 100) < 0.01;

  const handleAdd = async () => {
    if (!newName.trim()) { Alert.alert("Error", "Unit name is required"); return; }
    await createUnit({ name: newName.trim(), revenue_share_pct: parseFloat(newShare) || 0 });
    setNewName(""); setNewShare(""); setAdding(false);
  };

  const handleSaveEdit = async (unit: ValUnit) => {
    await updateUnit(unit.id, { name: editName.trim() || unit.name, revenue_share_pct: parseFloat(editShare) || Number(unit.revenueSharePct) });
    setEditId(null);
  };

  const handleDelete = (unit: ValUnit) => {
    Alert.alert("Delete Unit", `Remove "${unit.name}"? Equipment and add-backs assigned to this unit will be unlinked.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteUnit(unit.id) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Business Units</Text>
        </View>

        <View style={[styles.splitBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.splitLabel, { color: colors.mutedForeground }]}>Total Revenue Split</Text>
          <View style={styles.splitBarTrack}>
            <View style={[styles.splitBarFill, { width: `${Math.min(totalShare, 100)}%` as any, backgroundColor: isValid ? "#16A34A" : totalShare > 100 ? "#EF4444" : "#F59E0B" }]} />
          </View>
          <Text style={[styles.splitPct, { color: isValid ? "#16A34A" : totalShare > 100 ? "#EF4444" : "#F59E0B" }]}>
            {totalShare.toFixed(0)}% {isValid ? "✓ Total = 100%" : totalShare > 100 ? "⚠ Exceeds 100%" : "— Must total 100%"}
          </Text>
        </View>

        {businessUnits.map((unit) => (
          <View key={unit.id} style={[styles.unitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {editId === unit.id ? (
              <>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Unit name"
                  placeholderTextColor={colors.mutedForeground}
                />
                <View style={styles.shareRow}>
                  <TextInput
                    style={[styles.shareInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={editShare}
                    onChangeText={setEditShare}
                    keyboardType="decimal-pad"
                    placeholder="Revenue %"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <Text style={[styles.pctLabel, { color: colors.mutedForeground }]}>%</Text>
                </View>
                <View style={styles.editBtns}>
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={() => handleSaveEdit(unit)}>
                    <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setEditId(null)}>
                    <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.unitRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.unitName, { color: colors.foreground }]}>{unit.name}</Text>
                  <Text style={[styles.unitShare, { color: colors.mutedForeground }]}>{unit.revenueSharePct}% of total revenue</Text>
                </View>
                <TouchableOpacity onPress={() => { setEditId(unit.id); setEditName(unit.name); setEditShare(String(unit.revenueSharePct)); }} style={styles.iconBtn}>
                  <Feather name="edit-2" size={16} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(unit)} style={styles.iconBtn}>
                  <Feather name="trash-2" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {adding ? (
          <View style={[styles.unitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Café, Roastery, Events"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
            <View style={styles.shareRow}>
              <TextInput
                style={[styles.shareInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={newShare}
                onChangeText={setNewShare}
                keyboardType="decimal-pad"
                placeholder="Revenue %"
                placeholderTextColor={colors.mutedForeground}
              />
              <Text style={[styles.pctLabel, { color: colors.mutedForeground }]}>%</Text>
            </View>
            <View style={styles.editBtns}>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAdd}>
                <Text style={styles.saveBtnText}>Add Unit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setAdding(false)}>
                <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : businessUnits.length < 8 ? (
          <TouchableOpacity style={[styles.addBtn, { borderColor: colors.border }]} onPress={() => setAdding(true)}>
            <Feather name="plus" size={18} color={colors.primary} />
            <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Business Unit</Text>
          </TouchableOpacity>
        ) : null}

        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Each unit gets a slice of total revenue based on its percentage. Equipment, add-backs, and COGS suppliers can be assigned per unit on their respective screens.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  scroll:      { paddingHorizontal: 16, gap: 14 },
  header:      { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:     { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:       { fontSize: 22, fontFamily: "Inter_700Bold" },
  splitBar:    { padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  splitLabel:  { fontSize: 12, fontFamily: "Inter_400Regular" },
  splitBarTrack: { height: 8, borderRadius: 4, backgroundColor: "#1E3A5C", overflow: "hidden" },
  splitBarFill:  { height: "100%", borderRadius: 4 },
  splitPct:    { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  unitCard:    { padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  unitRow:     { flexDirection: "row", alignItems: "center" },
  unitName:    { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  unitShare:   { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  iconBtn:     { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  input:       { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  shareRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  shareInput:  { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  pctLabel:    { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  editBtns:    { flexDirection: "row", gap: 10 },
  saveBtn:     { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cancelBtn:   { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  addBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" },
  addBtnText:  { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  infoBox:     { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText:    { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
