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

interface PLRow {
  name: string;
  amount: number;
  included: boolean;
  section?: string;
  assignedToUnitId?: string | null;
  assignedToUnitName?: string | null;
}
interface PLSection { title: string; rows: PLRow[]; total: number }

export default function PLMappingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe, authToken } = useValuation();
  const { unitId, unitName } = useLocalSearchParams<{ unitId?: string; unitName?: string }>();
  const [sections, setSections] = useState<PLSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${authToken}` });

  useFocusEffect(useCallback(() => {
    if (!selectedCafe) return;
    setLoading(true);
    const url = unitId
      ? `${API_BASE}/api/valuation/xero/reports?cafeId=${selectedCafe.id}&months=12&unit_id=${unitId}`
      : `${API_BASE}/api/valuation/xero/reports?cafeId=${selectedCafe.id}&months=12`;
    fetch(url, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.sections) setSections(data.sections); })
      .finally(() => setLoading(false));
  }, [selectedCafe?.id, unitId]));

  const toggleRow = (sectionIdx: number, rowIdx: number) => {
    setSections((prev) => {
      const next = prev.map((s, si) => si !== sectionIdx ? s : {
        ...s,
        rows: s.rows.map((r, ri) => ri !== rowIdx ? r : { ...r, included: !r.included }),
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedCafe) return;
    setSaving(true);
    const mappings = sections.flatMap((s) =>
      s.rows
        .filter((r) => !r.assignedToUnitId)
        .map((r) => ({ name: r.name, included: r.included, section: s.title }))
    );
    await fetch(`${API_BASE}/api/valuation/xero/pl-mappings`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ cafeId: selectedCafe.id, mappings, ...(unitId ? { unit_id: unitId } : {}) }),
    });
    setSaving(false);
    router.back();
  };

  const screenTitle = unitId ? `${unitName ?? "Division"} — Income` : "P&L Mapping";
  const hasAnyRows = sections.some(s => s.rows.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{screenTitle}</Text>
        </View>

        {unitId && (
          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Toggle on the Xero income accounts that belong to this division. Accounts claimed by another division are shown greyed out.
            </Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : sections.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="book-open" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Xero not connected</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Connect Xero on the Connections screen to see your P&L report.</Text>
            <TouchableOpacity style={[styles.connectBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/(seller)/valuation/profile" as any)}>
              <Text style={styles.connectBtnText}>Go to Connections</Text>
            </TouchableOpacity>
          </View>
        ) : (
          sections.map((section, si) => (
            <View key={si} style={{ gap: 8 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{section.title || "Other"}</Text>
              {section.rows.map((row, ri) => {
                const isLockedByOther = !!row.assignedToUnitId;
                return (
                  <View
                    key={ri}
                    style={[
                      styles.rowCard,
                      { backgroundColor: isLockedByOther ? colors.card + "80" : colors.card, borderColor: row.included ? colors.primary + "60" : colors.border, opacity: isLockedByOther ? 0.6 : 1 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: colors.foreground }]}>{row.name}</Text>
                      <Text style={[styles.rowAmount, { color: colors.mutedForeground }]}>${row.amount.toLocaleString()}</Text>
                      {isLockedByOther && (
                        <Text style={[styles.assignedLabel, { color: "#F59E0B" }]}>
                          Assigned to: {row.assignedToUnitName}
                        </Text>
                      )}
                    </View>
                    <Switch
                      value={row.included}
                      onValueChange={() => !isLockedByOther && toggleRow(si, ri)}
                      disabled={isLockedByOther}
                      trackColor={{ true: colors.primary }}
                    />
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {hasAnyRows && (
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
  container:     { flex: 1 },
  scroll:        { paddingHorizontal: 16, gap: 16 },
  header:        { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:       { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:         { fontSize: 20, fontFamily: "Inter_700Bold", flex: 1 },
  infoBox:       { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText:      { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  sectionTitle:  { fontSize: 15, fontFamily: "Inter_700Bold" },
  rowCard:       { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1 },
  rowName:       { fontSize: 13, fontFamily: "Inter_500Medium" },
  rowAmount:     { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  assignedLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 3 },
  empty:         { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle:    { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText:     { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 280 },
  connectBtn:    { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  connectBtnText:{ color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  footer:        { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  saveBtn:       { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  saveBtnText:   { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
