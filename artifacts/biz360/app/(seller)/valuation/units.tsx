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
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useFocusEffect(useCallback(() => { fetchUnits(); }, [selectedCafe?.id]));

  const handleAdd = async () => {
    if (!newName.trim()) { Alert.alert("Error", "Division name is required"); return; }
    await createUnit({ name: newName.trim(), revenue_share_pct: 0 });
    setNewName(""); setAdding(false);
  };

  const handleSaveEdit = async (unit: ValUnit) => {
    await updateUnit(unit.id, { name: editName.trim() || unit.name, revenue_share_pct: Number(unit.revenueSharePct) });
    setEditId(null);
  };

  const handleDelete = (unit: ValUnit) => {
    Alert.alert("Delete Division", `Remove "${unit.name}"? Its income account assignments, equipment, and add-backs will be unlinked.`, [
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
          <Text style={[styles.title, { color: colors.foreground }]}>Divisions</Text>
        </View>

        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Each division claims its own Xero income accounts and COGS suppliers for a fully independent valuation.
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
                  placeholder="Division name"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                />
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
              <>
                <View style={styles.unitHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.unitName, { color: colors.foreground }]}>{unit.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setEditId(unit.id); setEditName(unit.name); }} style={styles.iconBtn}>
                    <Feather name="edit-2" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(unit)} style={styles.iconBtn}>
                    <Feather name="trash-2" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}
                    onPress={() => router.push({ pathname: "/(seller)/valuation/pl-mappings" as any, params: { unitId: unit.id, unitName: unit.name } })}
                  >
                    <Feather name="bar-chart-2" size={15} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>Income Accounts</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#16A34A15", borderColor: "#16A34A40" }]}
                    onPress={() => router.push({ pathname: "/(seller)/valuation/supplier-mappings" as any, params: { unitId: unit.id, unitName: unit.name } })}
                  >
                    <Feather name="package" size={15} color="#16A34A" />
                    <Text style={[styles.actionBtnText, { color: "#16A34A" }]}>COGS Suppliers</Text>
                  </TouchableOpacity>
                </View>
              </>
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
            <View style={styles.editBtns}>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAdd}>
                <Text style={styles.saveBtnText}>Add Division</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setAdding(false)}>
                <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : businessUnits.length < 8 ? (
          <TouchableOpacity style={[styles.addBtn, { borderColor: colors.border }]} onPress={() => setAdding(true)}>
            <Feather name="plus" size={18} color={colors.primary} />
            <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Division</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 16, gap: 14 },
  header:       { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:      { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:        { fontSize: 22, fontFamily: "Inter_700Bold" },
  infoBox:      { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText:     { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  unitCard:     { padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  unitHeader:   { flexDirection: "row", alignItems: "center" },
  unitName:     { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  iconBtn:      { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  actionRow:    { flexDirection: "row", gap: 10 },
  actionBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  actionBtnText:{ fontSize: 12, fontFamily: "Inter_600SemiBold" },
  input:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  editBtns:     { flexDirection: "row", gap: 10 },
  saveBtn:      { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  saveBtnText:  { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cancelBtn:    { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  cancelBtnText:{ fontSize: 14, fontFamily: "Inter_500Medium" },
  addBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" },
  addBtnText:   { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
