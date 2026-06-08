import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
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

interface PLRow { name: string; amount: number; included: boolean; section?: string }
interface PLSection { title: string; rows: PLRow[]; total: number }

export default function PLMappingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe, authToken } = useValuation();
  const [sections, setSections] = useState<PLSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${authToken}` });

  useFocusEffect(useCallback(() => {
    if (!selectedCafe) return;
    setLoading(true);
    fetch(`${API_BASE}/api/valuation/xero/reports?cafeId=${selectedCafe.id}&months=12`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.sections) setSections(data.sections); })
      .finally(() => setLoading(false));
  }, [selectedCafe?.id]));

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
    const mappings = sections.flatMap((s) => s.rows.map((r) => ({ name: r.name, included: r.included, section: s.title })));
    await fetch(`${API_BASE}/api/valuation/xero/pl-mappings`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ cafeId: selectedCafe.id, mappings }),
    });
    setSaving(false);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>P&L Mapping</Text>
        </View>

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
              {section.rows.map((row, ri) => (
                <View key={ri} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: colors.foreground }]}>{row.name}</Text>
                    <Text style={[styles.rowAmount, { color: colors.mutedForeground }]}>${row.amount.toLocaleString()}</Text>
                  </View>
                  <Switch
                    value={row.included}
                    onValueChange={() => toggleRow(si, ri)}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {sections.length > 0 && (
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
  scroll:       { paddingHorizontal: 16, gap: 16 },
  header:       { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:      { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:        { fontSize: 22, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  rowCard:      { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1 },
  rowName:      { fontSize: 13, fontFamily: "Inter_500Medium" },
  rowAmount:    { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty:        { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle:   { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText:    { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 280 },
  connectBtn:   { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  connectBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  footer:       { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  saveBtn:      { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  saveBtnText:  { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
