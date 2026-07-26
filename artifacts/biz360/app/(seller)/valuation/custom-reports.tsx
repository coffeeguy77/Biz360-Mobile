import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

interface CustomReport {
  id: string;
  name: string;
  description: string | null;
  dateRangeMonths: number;
  includeInIm: boolean;
  incomeCount: number;
  expenseCount: number;
  createdAt: string;
  updatedAt: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function CustomReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe, authToken } = useValuation();

  const [reports, setReports] = useState<CustomReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  });

  const fetchReports = useCallback(async () => {
    if (!selectedCafe || !authToken) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/valuation/custom-reports?cafeId=${selectedCafe.id}`,
        { headers: authHeaders() },
      );
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports ?? []);
      }
    } catch {}
    setLoading(false);
  }, [selectedCafe?.id, authToken]);

  useFocusEffect(useCallback(() => { fetchReports(); }, [fetchReports]));

  const handleCreate = async () => {
    if (!newName.trim() || !selectedCafe) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/valuation/custom-reports`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          cafeId: selectedCafe.id,
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          dateRangeMonths: 12,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowCreate(false);
        setNewName("");
        setNewDesc("");
        // Navigate directly to the editor
        router.push({
          pathname: "/(seller)/valuation/custom-report-editor" as any,
          params: { reportId: data.report.id, reportName: data.report.name },
        });
      } else {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        Alert.alert("Error", err.error || "Failed to create report");
      }
    } catch {
      Alert.alert("Error", "Network error");
    }
    setCreating(false);
  };

  const handleDelete = (report: CustomReport) => {
    Alert.alert(
      "Delete Report",
      `Delete "${report.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            await fetch(`${API_BASE}/api/valuation/custom-reports/${report.id}`, {
              method: "DELETE",
              headers: authHeaders(),
            });
            fetchReports();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Financial Reports</Text>
          <TouchableOpacity
            style={[styles.newBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowCreate(true)}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.newBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="bar-chart-2" size={14} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Build reports from your Square and Xero data. Reports are private — enable "Include in IM" to show a summary in your listing report.
          </Text>
        </View>

        {/* Report list */}
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : reports.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="bar-chart" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No reports yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Create a report to track income and expenses from your Square and Xero accounts.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowCreate(true)}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>Create First Report</Text>
            </TouchableOpacity>
          </View>
        ) : (
          reports.map((report) => (
            <TouchableOpacity
              key={report.id}
              style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() =>
                router.push({
                  pathname: "/(seller)/valuation/custom-report-detail" as any,
                  params: { reportId: report.id, reportName: report.name },
                })
              }
              activeOpacity={0.85}
            >
              <View style={styles.reportCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reportName, { color: colors.foreground }]}>{report.name}</Text>
                  {report.description ? (
                    <Text style={[styles.reportDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {report.description}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.reportActions}>
                  {report.includeInIm && (
                    <View style={[styles.imBadge, { backgroundColor: colors.primary + "20" }]}>
                      <Text style={[styles.imBadgeText, { color: colors.primary }]}>IM</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/(seller)/valuation/custom-report-editor" as any,
                        params: { reportId: report.id, reportName: report.name },
                      })
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="settings" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(report)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="trash-2" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.reportMeta, { borderTopColor: colors.border }]}>
                <View style={styles.metaItem}>
                  <Feather name="trending-up" size={12} color="#10B981" />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                    {report.incomeCount} income
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="trending-down" size={12} color="#EF4444" />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                    {report.expenseCount} expense
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="calendar" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                    {report.dateRangeMonths} months
                  </Text>
                </View>
                <Text style={[styles.metaDate, { color: colors.mutedForeground }]}>
                  Updated {formatDate(report.updatedAt)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Create modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Report</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Report Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            placeholder="e.g. Café Revenue"
            placeholderTextColor={colors.mutedForeground}
            value={newName}
            onChangeText={setNewName}
            autoFocus
          />

          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            placeholder="What does this report track?"
            placeholderTextColor={colors.mutedForeground}
            value={newDesc}
            onChangeText={setNewDesc}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: newName.trim() ? colors.primary : colors.border }]}
            onPress={handleCreate}
            disabled={!newName.trim() || creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.createBtnText}>Create & Configure</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  scroll:          { paddingHorizontal: 16, gap: 14 },
  header:          { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn:         { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:           { fontSize: 20, fontFamily: "Inter_700Bold", flex: 1 },
  newBtn:          { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  newBtnText:      { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  infoBox:         { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText:        { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  empty:           { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle:      { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText:       { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 280 },
  emptyBtn:        { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  emptyBtnText:    { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  reportCard:      { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  reportCardTop:   { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 10 },
  reportName:      { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  reportDesc:      { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 17 },
  reportActions:   { flexDirection: "row", alignItems: "center", gap: 12 },
  imBadge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  imBadgeText:     { fontSize: 10, fontFamily: "Inter_700Bold" },
  reportMeta:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, flexWrap: "wrap" },
  metaItem:        { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText:        { fontSize: 11, fontFamily: "Inter_400Regular" },
  metaDate:        { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: "auto" },
  modal:           { flex: 1, padding: 24, gap: 16 },
  modalHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  modalTitle:      { fontSize: 20, fontFamily: "Inter_700Bold" },
  fieldLabel:      { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  input:           { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  textArea:        { height: 80, textAlignVertical: "top" },
  createBtn:       { paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 8 },
  createBtnText:   { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
