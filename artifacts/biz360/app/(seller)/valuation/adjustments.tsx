import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useValuation, ValAdjustment } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

const TYPES = ["owner_salary", "personal_expense", "rent", "one_off", "other"] as const;
const TYPE_LABELS: Record<string, string> = {
  owner_salary: "Owner Salary", personal_expense: "Personal Expense", rent: "Rent", one_off: "One-off", other: "Other",
};

export default function AdjustmentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { adjustments, fetchAdjustments, selectedCafe, businessUnits, fetchUnits, authToken } = useValuation();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editItem, setEditItem] = useState<ValAdjustment | null>(null);
  const [form, setForm] = useState({ label: "", annualAmount: "", type: "other" });

  useFocusEffect(useCallback(() => {
    fetchAdjustments(selectedUnitId ?? undefined);
    fetchUnits();
  }, [selectedCafe?.id, selectedUnitId]));

  const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${authToken}` });

  const handleAdd = async () => {
    if (!selectedCafe || !form.label.trim()) { Alert.alert("Error", "Label is required"); return; }
    const res = await fetch(`${API_BASE}/api/valuation/cafes/${selectedCafe.id}/adjustments`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ label: form.label.trim(), annualAmount: parseFloat(form.annualAmount) || 0, type: form.type, unit_id: selectedUnitId }),
    });
    if (res.ok) { await fetchAdjustments(selectedUnitId ?? undefined); setAdding(false); setForm({ label: "", annualAmount: "", type: "other" }); }
    else { const e = await res.json(); Alert.alert("Error", e.error); }
  };

  const handleEdit = async () => {
    if (!selectedCafe || !editItem) return;
    await fetch(`${API_BASE}/api/valuation/cafes/${selectedCafe.id}/adjustments/${editItem.id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ label: form.label, annualAmount: parseFloat(form.annualAmount), type: form.type }),
    });
    await fetchAdjustments(selectedUnitId ?? undefined); setEditItem(null);
  };

  const handleDelete = (item: ValAdjustment) => {
    Alert.alert("Delete", `Remove "${item.label}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        if (!selectedCafe) return;
        await fetch(`${API_BASE}/api/valuation/cafes/${selectedCafe.id}/adjustments/${item.id}`, { method: "DELETE", headers: authHeaders() });
        fetchAdjustments(selectedUnitId ?? undefined);
      }},
    ]);
  };

  const totalAnnual = adjustments.reduce((s, a) => s + Number(a.annualAmount ?? 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Add-backs</Text>
        </View>

        {businessUnits.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitPicker}>
            <TouchableOpacity style={[styles.unitChip, !selectedUnitId && { backgroundColor: colors.primary }]} onPress={() => setSelectedUnitId(null)}>
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
          <Text style={styles.summaryLabel}>Total Annual Add-backs</Text>
          <Text style={styles.summaryVal}>${totalAnnual.toLocaleString()}</Text>
        </View>

        {adjustments.map((item) => (
          <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {editItem?.id === item.id ? (
              <>
                <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} value={form.label} onChangeText={(t) => setForm((f) => ({ ...f, label: t }))} placeholder="Description" placeholderTextColor={colors.mutedForeground} />
                <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} value={form.annualAmount} onChangeText={(t) => setForm((f) => ({ ...f, annualAmount: t }))} keyboardType="decimal-pad" placeholder="Annual amount ($)" placeholderTextColor={colors.mutedForeground} />
                <View style={styles.editBtns}>
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleEdit}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setEditItem(null)}><Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text></TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: colors.foreground }]}>{item.label}</Text>
                  <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>{TYPE_LABELS[item.type] ?? "Other"} · ${Number(item.annualAmount).toLocaleString()}/yr</Text>
                </View>
                <TouchableOpacity onPress={() => { setEditItem(item); setForm({ label: item.label, annualAmount: item.annualAmount, type: item.type }); }} style={styles.iconBtn}><Feather name="edit-2" size={16} color={colors.primary} /></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}><Feather name="trash-2" size={16} color="#EF4444" /></TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {adding ? (
          <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} value={form.label} onChangeText={(t) => setForm((f) => ({ ...f, label: t }))} placeholder="e.g. Owner salary drawn" placeholderTextColor={colors.mutedForeground} autoFocus />
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} value={form.annualAmount} onChangeText={(t) => setForm((f) => ({ ...f, annualAmount: t }))} keyboardType="decimal-pad" placeholder="Annual amount ($)" placeholderTextColor={colors.mutedForeground} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.typeChip, form.type === t && { backgroundColor: colors.primary }]} onPress={() => setForm((f) => ({ ...f, type: t }))}>
                  <Text style={[styles.typeChipText, form.type === t && { color: "#fff" }]}>{TYPE_LABELS[t]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.editBtns}>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAdd}><Text style={styles.saveBtnText}>Add</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setAdding(false)}><Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={[styles.addBtn, { borderColor: colors.border }]} onPress={() => { setAdding(true); setForm({ label: "", annualAmount: "", type: "other" }); }}>
            <Feather name="plus" size={18} color={colors.primary} />
            <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Add-back</Text>
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
  typeChip:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#1E3A5C" },
  typeChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#8B9CB8" },
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
