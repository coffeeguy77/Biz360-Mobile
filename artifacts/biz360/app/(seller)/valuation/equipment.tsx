import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useValuation, ValEquipment, ValUnit } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

export default function EquipmentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { equipment, fetchEquipment, selectedCafe, businessUnits, fetchUnits, authToken } = useValuation();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editItem, setEditItem] = useState<ValEquipment | null>(null);
  const [form, setForm] = useState({ name: "", purchasePrice: "", currentValue: "", isLeased: false });

  useFocusEffect(useCallback(() => {
    fetchEquipment(selectedUnitId ?? undefined);
    fetchUnits();
  }, [selectedCafe?.id, selectedUnitId]));

  const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${authToken}` });

  const handleAdd = async () => {
    if (!selectedCafe || !form.name.trim()) { Alert.alert("Error", "Name is required"); return; }
    const res = await fetch(`${API_BASE}/api/valuation/cafes/${selectedCafe.id}/equipment`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name: form.name.trim(), purchasePrice: parseFloat(form.purchasePrice) || null, currentValue: parseFloat(form.currentValue) || null, isLeased: form.isLeased, unit_id: selectedUnitId }),
    });
    if (res.ok) { await fetchEquipment(selectedUnitId ?? undefined); setAdding(false); setForm({ name: "", purchasePrice: "", currentValue: "", isLeased: false }); }
    else { const e = await res.json(); Alert.alert("Error", e.error); }
  };

  const handleEdit = async () => {
    if (!selectedCafe || !editItem) return;
    await fetch(`${API_BASE}/api/valuation/cafes/${selectedCafe.id}/equipment/${editItem.id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ name: form.name, purchasePrice: parseFloat(form.purchasePrice) || null, currentValue: parseFloat(form.currentValue) || null, isLeased: form.isLeased }),
    });
    await fetchEquipment(selectedUnitId ?? undefined); setEditItem(null);
  };

  const handleDelete = (item: ValEquipment) => {
    Alert.alert("Delete", `Remove "${item.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        if (!selectedCafe) return;
        await fetch(`${API_BASE}/api/valuation/cafes/${selectedCafe.id}/equipment/${item.id}`, { method: "DELETE", headers: authHeaders() });
        fetchEquipment(selectedUnitId ?? undefined);
      }},
    ]);
  };

  const startEdit = (item: ValEquipment) => {
    setEditItem(item);
    setForm({ name: item.name, purchasePrice: item.purchasePrice ?? "", currentValue: item.currentValue ?? "", isLeased: item.isLeased ?? false });
  };

  const totalValue = equipment.filter((e) => !e.isLeased).reduce((s, e) => s + Number(e.currentValue ?? e.purchasePrice ?? 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Equipment</Text>
        </View>

        {businessUnits.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitPicker}>
            <TouchableOpacity style={[styles.unitChip, !selectedUnitId && { backgroundColor: colors.primary }]} onPress={() => { setSelectedUnitId(null); }}>
              <Text style={[styles.unitChipText, !selectedUnitId && { color: "#fff" }]}>All</Text>
            </TouchableOpacity>
            {businessUnits.map((u) => (
              <TouchableOpacity key={u.id} style={[styles.unitChip, selectedUnitId === u.id && { backgroundColor: colors.primary }]} onPress={() => setSelectedUnitId(u.id)}>
                <Text style={[styles.unitChipText, selectedUnitId === u.id && { color: "#fff" }]}>{u.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={[styles.summaryCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
          <Text style={styles.summaryLabel}>Total Equipment Value</Text>
          <Text style={styles.summaryVal}>${totalValue.toLocaleString()}</Text>
        </View>

        {equipment.map((item) => (
          <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {editItem?.id === item.id ? (
              <>
                <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} placeholder="Name" placeholderTextColor={colors.mutedForeground} />
                <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} value={form.currentValue} onChangeText={(t) => setForm((f) => ({ ...f, currentValue: t }))} keyboardType="decimal-pad" placeholder="Current value ($)" placeholderTextColor={colors.mutedForeground} />
                <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} value={form.purchasePrice} onChangeText={(t) => setForm((f) => ({ ...f, purchasePrice: t }))} keyboardType="decimal-pad" placeholder="Purchase price ($)" placeholderTextColor={colors.mutedForeground} />
                <View style={styles.editBtns}>
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleEdit}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setEditItem(null)}><Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text></TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                    {item.isLeased ? "Leased" : `$${Number(item.currentValue ?? item.purchasePrice ?? 0).toLocaleString()}`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => startEdit(item)} style={styles.iconBtn}><Feather name="edit-2" size={16} color={colors.primary} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}><Feather name="trash-2" size={16} color="#EF4444" /></TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {adding ? (
          <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} placeholder="e.g. Espresso Machine" placeholderTextColor={colors.mutedForeground} autoFocus />
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} value={form.currentValue} onChangeText={(t) => setForm((f) => ({ ...f, currentValue: t }))} keyboardType="decimal-pad" placeholder="Current value ($)" placeholderTextColor={colors.mutedForeground} />
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} value={form.purchasePrice} onChangeText={(t) => setForm((f) => ({ ...f, purchasePrice: t }))} keyboardType="decimal-pad" placeholder="Purchase price ($)" placeholderTextColor={colors.mutedForeground} />
            <View style={styles.editBtns}>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAdd}><Text style={styles.saveBtnText}>Add</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setAdding(false)}><Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={[styles.addBtn, { borderColor: colors.border }]} onPress={() => { setAdding(true); setForm({ name: "", purchasePrice: "", currentValue: "", isLeased: false }); }}>
            <Feather name="plus" size={18} color={colors.primary} />
            <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Equipment</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 16, gap: 12 },
  header:       { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:      { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:        { fontSize: 22, fontFamily: "Inter_700Bold" },
  unitPicker:   { gap: 8, paddingBottom: 4 },
  unitChip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1E3A5C" },
  unitChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8B9CB8" },
  summaryCard:  { borderRadius: 14, padding: 16, borderWidth: 1 },
  summaryLabel: { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  summaryVal:   { color: "#3B82F6", fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 4 },
  itemCard:     { padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  itemRow:      { flexDirection: "row", alignItems: "center" },
  itemName:     { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  itemMeta:     { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  iconBtn:      { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  input:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  editBtns:     { flexDirection: "row", gap: 10 },
  saveBtn:      { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  saveBtnText:  { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cancelBtn:    { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  cancelBtnText:{ fontSize: 14, fontFamily: "Inter_500Medium" },
  addBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" },
  addBtnText:   { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
