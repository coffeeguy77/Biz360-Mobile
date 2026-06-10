import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert, FlatList, Modal, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useValuation, ValEquipment } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

interface CsvRow {
  name: string; category?: string; brand?: string; purchaseDate?: string;
  purchasePrice?: number; condition?: string; depreciationYears?: number;
  valuationMode?: string; secondhandValue?: number; replacementCost?: number;
  manualValue?: number; ownership?: string; notes?: string;
  displayValue: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] ?? ""; });

    const name = obj["name"] ?? "";
    if (!name) continue;

    const num = (k: string) => { const v = parseFloat(obj[k] ?? ""); return isNaN(v) ? undefined : v; };
    const str = (k: string) => obj[k] || undefined;

    const valuationMode = str("valuation_mode") ?? "purchase";
    const secondhandValue = num("secondhand_value");
    const replacementCost = num("replacement_cost");
    const manualValue = num("manual_value");
    const purchasePrice = num("purchase_price");

    // Determine the "effective" value for display
    let effectiveVal: number | undefined;
    if (valuationMode === "secondhand") effectiveVal = secondhandValue;
    else if (valuationMode === "replacement") effectiveVal = replacementCost;
    else if (valuationMode === "manual") effectiveVal = manualValue;
    else effectiveVal = purchasePrice;

    rows.push({
      name,
      category: str("category"),
      brand: str("brand"),
      purchaseDate: str("purchase_date"),
      purchasePrice,
      condition: str("condition"),
      depreciationYears: num("depreciation_years"),
      valuationMode,
      secondhandValue,
      replacementCost,
      manualValue,
      ownership: str("ownership"),
      notes: str("notes"),
      displayValue: effectiveVal != null ? `$${effectiveVal.toLocaleString()}` : "—",
    });
  }
  return rows;
}

// ─── Import preview modal ─────────────────────────────────────────────────────

function ImportPreviewModal({
  visible, rows, unitId, businessUnits, onClose, onImported, authToken, cafeId,
}: {
  visible: boolean;
  rows: CsvRow[];
  unitId: string | null;
  businessUnits: { id: string; name: string }[];
  onClose: () => void;
  onImported: () => void;
  authToken: string | null;
  cafeId: string;
}) {
  const colors = useColors();
  const [importing, setImporting] = useState(false);
  const [chosenUnitId, setChosenUnitId] = useState<string | null>(unitId);

  // Sync when the modal opens with a fresh unitId
  React.useEffect(() => { if (visible) setChosenUnitId(unitId); }, [visible, unitId]);

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/valuation/cafes/${cafeId}/equipment/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          unit_id: chosenUnitId,
          items: rows.map(({ displayValue: _dv, ...rest }) => rest),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onImported();
        Alert.alert("Import complete", `${data.imported} item${data.imported !== 1 ? "s" : ""} added to your equipment list.`);
      } else {
        const e = await res.json().catch(() => ({ error: "Unknown error" }));
        Alert.alert("Import failed", e.error ?? "Server error");
      }
    } catch {
      Alert.alert("Import failed", "Network error — please try again.");
    } finally {
      setImporting(false);
    }
  };

  const totalValue = rows.reduce((sum, r) => {
    const num = (v: number | undefined) => v ?? 0;
    let val = 0;
    if (r.valuationMode === "secondhand") val = num(r.secondhandValue);
    else if (r.valuationMode === "replacement") val = num(r.replacementCost);
    else if (r.valuationMode === "manual") val = num(r.manualValue);
    else val = num(r.purchasePrice);
    return sum + val;
  }, 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[previewStyles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={previewStyles.header}>
          <Text style={[previewStyles.title, { color: colors.foreground }]}>Preview Import</Text>
          <TouchableOpacity onPress={onClose} style={previewStyles.closeBtn}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Summary bar */}
        <View style={[previewStyles.summaryBar, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
          <View style={previewStyles.summaryItem}>
            <Text style={previewStyles.summaryNum}>{rows.length}</Text>
            <Text style={previewStyles.summaryLabel}>Items</Text>
          </View>
          <View style={previewStyles.summaryDivider} />
          <View style={previewStyles.summaryItem}>
            <Text style={previewStyles.summaryNum}>${totalValue.toLocaleString()}</Text>
            <Text style={previewStyles.summaryLabel}>Total Value</Text>
          </View>
        </View>

        {/* Unit assignment — only shown when there are business units */}
        {businessUnits.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
            <Text style={[previewStyles.unitLabel, { color: colors.mutedForeground }]}>
              Import into
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 6 }}>
              <TouchableOpacity
                style={[previewStyles.unitChip, !chosenUnitId && previewStyles.unitChipActive]}
                onPress={() => setChosenUnitId(null)}
              >
                <Text style={[previewStyles.unitChipText, !chosenUnitId && previewStyles.unitChipTextActive]}>
                  No specific unit
                </Text>
              </TouchableOpacity>
              {businessUnits.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={[previewStyles.unitChip, chosenUnitId === u.id && previewStyles.unitChipActive]}
                  onPress={() => setChosenUnitId(u.id)}
                >
                  <Text style={[previewStyles.unitChipText, chosenUnitId === u.id && previewStyles.unitChipTextActive]}>
                    {u.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Row list */}
        <FlatList
          data={rows}
          keyExtractor={(_, i) => String(i)}
          style={{ flex: 1 }}
          contentContainerStyle={previewStyles.list}
          ItemSeparatorComponent={() => <View style={[previewStyles.sep, { backgroundColor: colors.border }]} />}
          renderItem={({ item }) => (
            <View style={previewStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[previewStyles.rowName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[previewStyles.rowMeta, { color: colors.mutedForeground }]}>
                  {[item.category, item.brand].filter(Boolean).join(" · ") || "No category"}
                </Text>
              </View>
              <Text style={[previewStyles.rowVal, { color: "#3B82F6" }]}>{item.displayValue}</Text>
            </View>
          )}
        />

        {/* Actions */}
        <View style={[previewStyles.footer, { borderTopColor: colors.border, paddingBottom: 24 }]}>
          <TouchableOpacity
            style={[previewStyles.cancelBtn, { borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[previewStyles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[previewStyles.importBtn, importing && { opacity: 0.6 }]}
            onPress={handleImport}
            disabled={importing}
          >
            <Feather name={importing ? "loader" : "upload"} size={16} color="#fff" />
            <Text style={previewStyles.importText}>
              {importing ? "Importing…" : `Import ${rows.length} Item${rows.length !== 1 ? "s" : ""}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const previewStyles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title:        { fontSize: 20, fontFamily: "Inter_700Bold" },
  closeBtn:     { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  summaryBar:   { flexDirection: "row", marginHorizontal: 16, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  summaryItem:  { flex: 1, alignItems: "center", paddingVertical: 14 },
  summaryNum:   { color: "#3B82F6", fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryLabel: { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: "#1E3A5C", marginVertical: 10 },
  list:         { paddingHorizontal: 16 },
  sep:          { height: 1, marginLeft: 16 },
  row:          { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 8 },
  rowName:      { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowMeta:      { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  rowVal:       { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  footer:            { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1 },
  cancelBtn:         { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  cancelText:        { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  importBtn:         { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12, backgroundColor: "#2563EB" },
  importText:        { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  unitLabel:         { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  unitChip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1E3A5C" },
  unitChipActive:    { backgroundColor: "#2563EB" },
  unitChipText:      { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8B9CB8" },
  unitChipTextActive:{ color: "#fff" },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function EquipmentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { equipment, fetchEquipment, selectedCafe, businessUnits, fetchUnits, authToken } = useValuation();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editItem, setEditItem] = useState<ValEquipment | null>(null);
  const [form, setForm] = useState({ name: "", purchasePrice: "", currentValue: "", isLeased: false });

  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchEquipment(selectedUnitId ?? undefined);
    fetchUnits();
  }, [selectedCafe?.id, selectedUnitId]));

  const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${authToken}` });

  // ── Handlers ────────────────────────────────────────────────────────────────

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

  // ── CSV import ───────────────────────────────────────────────────────────────

  const handlePickCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === "ios"
          ? ["public.comma-separated-values-text", "public.text", "public.plain-text", "public.data"]
          : ["text/csv", "text/comma-separated-values", "application/csv", "text/plain", "*/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const uri = asset.uri;

      let text: string;
      try {
        text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      } catch {
        // Fallback: fetch the file directly
        const resp = await fetch(uri);
        text = await resp.text();
      }

      const rows = parseCsv(text);
      if (rows.length === 0) {
        Alert.alert("No data found", "The CSV file appears to be empty or in an unrecognised format.\n\nExpected columns: name, category, brand, purchase_price, valuation_mode, secondhand_value, replacement_cost");
        return;
      }

      setCsvRows(rows);
      setShowPreview(true);
    } catch (err) {
      Alert.alert("Error reading file", "Could not read the selected file. Please try again.");
    }
  };

  const handleImported = async () => {
    setShowPreview(false);
    setCsvRows([]);
    await fetchEquipment(selectedUnitId ?? undefined);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const totalValue = equipment.filter((e) => !e.isLeased).reduce((s, e) => s + Number(e.currentValue ?? e.purchasePrice ?? 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Equipment</Text>
        </View>

        {/* Unit filter tabs */}
        {businessUnits.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitPicker}>
            <TouchableOpacity
              style={[styles.unitChip, !selectedUnitId && { backgroundColor: colors.primary }]}
              onPress={() => setSelectedUnitId(null)}
            >
              <Text style={[styles.unitChipText, !selectedUnitId && { color: "#fff" }]}>All</Text>
            </TouchableOpacity>
            {businessUnits.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={[styles.unitChip, selectedUnitId === u.id && { backgroundColor: colors.primary }]}
                onPress={() => setSelectedUnitId(u.id)}
              >
                <Text style={[styles.unitChipText, selectedUnitId === u.id && { color: "#fff" }]}>{u.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Total Equipment Value</Text>
            <Text style={styles.summaryVal}>${totalValue.toLocaleString()}</Text>
          </View>
          <View style={[styles.itemCountBadge, { backgroundColor: "#1E3A5C" }]}>
            <Text style={styles.itemCountText}>{equipment.length} item{equipment.length !== 1 ? "s" : ""}</Text>
          </View>
        </View>

        {/* Equipment list */}
        {equipment.map((item) => (
          <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {editItem?.id === item.id ? (
              <>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={form.name}
                  onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                  placeholder="Name"
                  placeholderTextColor={colors.mutedForeground}
                />
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={form.currentValue}
                  onChangeText={(t) => setForm((f) => ({ ...f, currentValue: t }))}
                  keyboardType="decimal-pad"
                  placeholder="Current value ($)"
                  placeholderTextColor={colors.mutedForeground}
                />
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={form.purchasePrice}
                  onChangeText={(t) => setForm((f) => ({ ...f, purchasePrice: t }))}
                  keyboardType="decimal-pad"
                  placeholder="Purchase price ($)"
                  placeholderTextColor={colors.mutedForeground}
                />
                <View style={styles.editBtns}>
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleEdit}>
                    <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setEditItem(null)}>
                    <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                    {item.isLeased
                      ? "Leased"
                      : `$${Number(item.currentValue ?? item.purchasePrice ?? 0).toLocaleString()}`}
                    {item.category ? ` · ${item.category}` : ""}
                    {item.brand ? ` · ${item.brand}` : ""}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => startEdit(item)} style={styles.iconBtn}>
                  <Feather name="edit-2" size={16} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                  <Feather name="trash-2" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {/* Add form or Add button */}
        {adding ? (
          <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={form.name}
              onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
              placeholder="e.g. Espresso Machine"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={form.currentValue}
              onChangeText={(t) => setForm((f) => ({ ...f, currentValue: t }))}
              keyboardType="decimal-pad"
              placeholder="Current value ($)"
              placeholderTextColor={colors.mutedForeground}
            />
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={form.purchasePrice}
              onChangeText={(t) => setForm((f) => ({ ...f, purchasePrice: t }))}
              keyboardType="decimal-pad"
              placeholder="Purchase price ($)"
              placeholderTextColor={colors.mutedForeground}
            />
            <View style={styles.editBtns}>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleAdd}>
                <Text style={styles.saveBtnText}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setAdding(false)}>
                <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.addBtn, { borderColor: colors.border, flex: 1 }]}
              onPress={() => { setAdding(true); setForm({ name: "", purchasePrice: "", currentValue: "", isLeased: false }); }}
            >
              <Feather name="plus" size={17} color={colors.primary} />
              <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Item</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.csvBtn, { borderColor: "#2563EB", backgroundColor: "rgba(37,99,235,0.08)" }]}
              onPress={handlePickCsv}
            >
              <Feather name="upload" size={17} color="#3B82F6" />
              <Text style={[styles.addBtnText, { color: "#3B82F6" }]}>Import CSV</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* CSV preview modal */}
      {selectedCafe && (
        <ImportPreviewModal
          visible={showPreview}
          rows={csvRows}
          unitId={selectedUnitId}
          businessUnits={businessUnits}
          onClose={() => setShowPreview(false)}
          onImported={handleImported}
          authToken={authToken}
          cafeId={selectedCafe.id}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  scroll:         { paddingHorizontal: 16, gap: 12 },
  header:         { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:        { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:          { fontSize: 22, fontFamily: "Inter_700Bold" },
  unitPicker:     { gap: 8, paddingBottom: 4 },
  unitChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1E3A5C" },
  unitChipText:   { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8B9CB8" },
  summaryCard:    { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 16, borderWidth: 1 },
  summaryLabel:   { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  summaryVal:     { color: "#3B82F6", fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 4 },
  itemCountBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  itemCountText:  { color: "#8B9CB8", fontSize: 13, fontFamily: "Inter_500Medium" },
  itemCard:       { padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  itemRow:        { flexDirection: "row", alignItems: "center" },
  itemName:       { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  itemMeta:       { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  iconBtn:        { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  input:          { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  editBtns:       { flexDirection: "row", gap: 10 },
  saveBtn:        { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  saveBtnText:    { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cancelBtn:      { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  cancelBtnText:  { fontSize: 14, fontFamily: "Inter_500Medium" },
  actionRow:      { flexDirection: "row", gap: 10 },
  addBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" },
  csvBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, paddingHorizontal: 18 },
  addBtnText:     { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
