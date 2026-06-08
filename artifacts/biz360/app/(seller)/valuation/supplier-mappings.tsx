import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet,
  Switch, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

interface Supplier { name: string; contactId: string; total: number; isCogs: boolean }

export default function SupplierMappingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe, businessUnits, fetchUnits, authToken } = useValuation();
  const { unitId: paramUnitId, unitName: paramUnitName } = useLocalSearchParams<{ unitId?: string; unitName?: string }>();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(paramUnitId ?? null);

  const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${authToken}` });

  const loadSuppliers = useCallback(async (unitId?: string | null) => {
    if (!selectedCafe) return;
    setLoading(true);
    const url = unitId
      ? `${API_BASE}/api/valuation/xero/suppliers?cafeId=${selectedCafe.id}&months=12&unit_id=${unitId}`
      : `${API_BASE}/api/valuation/xero/suppliers?cafeId=${selectedCafe.id}&months=12`;
    const r = await fetch(url, { headers: authHeaders() }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setSuppliers(d.suppliers ?? []); }
    setLoading(false);
  }, [selectedCafe?.id, authToken]);

  useFocusEffect(useCallback(() => {
    fetchUnits();
    loadSuppliers(selectedUnitId);
  }, [selectedCafe?.id, selectedUnitId]));

  const toggleSupplier = (idx: number) => {
    setSuppliers((prev) => prev.map((s, i) => i !== idx ? s : { ...s, isCogs: !s.isCogs }));
  };

  const handleSave = async () => {
    if (!selectedCafe) return;
    setSaving(true);
    await fetch(`${API_BASE}/api/valuation/xero/supplier-mappings`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ cafeId: selectedCafe.id, mappings: suppliers.map((s) => ({ name: s.name, contactId: s.contactId, isCogs: s.isCogs })), unit_id: selectedUnitId }),
    });
    setSaving(false);
    router.back();
  };

  const currentUnitName = selectedUnitId
    ? (paramUnitId === selectedUnitId ? paramUnitName : businessUnits.find(u => u.id === selectedUnitId)?.name) ?? "Division"
    : null;

  const screenTitle = paramUnitId && !businessUnits.length
    ? `${paramUnitName ?? "Division"} — COGS`
    : "COGS Suppliers";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{screenTitle}</Text>
        </View>

        {businessUnits.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitPicker}>
            <TouchableOpacity style={[styles.unitChip, !selectedUnitId && { backgroundColor: colors.primary }]} onPress={() => setSelectedUnitId(null)}>
              <Text style={[styles.unitChipText, !selectedUnitId && { color: "#fff" }]}>Whole Business</Text>
            </TouchableOpacity>
            {businessUnits.map((u) => (
              <TouchableOpacity key={u.id} style={[styles.unitChip, selectedUnitId === u.id && { backgroundColor: colors.primary }]} onPress={() => setSelectedUnitId(u.id)}>
                <Text style={[styles.unitChipText, selectedUnitId === u.id && { color: "#fff" }]}>{u.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Toggle on suppliers whose spend counts as Cost of Goods Sold for{" "}
            {selectedUnitId ? (currentUnitName ?? "this division") : "the whole business"}.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : suppliers.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="package" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No supplier data</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Connect Xero to see supplier spend from your bank transactions.</Text>
          </View>
        ) : (
          suppliers.map((s, i) => (
            <View key={i} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: s.isCogs ? "#16A34A40" : colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, { color: colors.foreground }]}>{s.name}</Text>
                <Text style={[styles.rowAmount, { color: colors.mutedForeground }]}>${s.total.toLocaleString()} spent</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                {s.isCogs && <Text style={styles.cogsBadge}>COGS</Text>}
                <Switch value={s.isCogs} onValueChange={() => toggleSupplier(i)} trackColor={{ true: "#16A34A" }} />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {suppliers.length > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Mappings</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 16, gap: 12 },
  header:       { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:      { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:        { fontSize: 20, fontFamily: "Inter_700Bold", flex: 1 },
  unitPicker:   { gap: 8, paddingBottom: 4 },
  unitChip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1E3A5C" },
  unitChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8B9CB8" },
  infoBox:      { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText:     { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  rowCard:      { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1 },
  rowName:      { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  rowAmount:    { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cogsBadge:    { backgroundColor: "#16A34A20", color: "#16A34A", fontSize: 10, fontFamily: "Inter_700Bold", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  empty:        { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle:   { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText:    { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 280 },
  footer:       { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  saveBtn:      { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  saveBtnText:  { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
