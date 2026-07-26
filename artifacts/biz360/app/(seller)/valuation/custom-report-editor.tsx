import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet,
  Switch, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

interface LineItem {
  id?: string;
  kind: "income" | "expense";
  label: string;
  source: "xero_pl" | "square";
  xeroAccountId?: string | null;
  xeroAccountName?: string | null;
  sortOrder?: number;
}

interface XeroAccount {
  name: string;
  amount: number;
  section: string;
  isIncome: boolean;
}

const DATE_RANGE_OPTIONS = [
  { label: "3 months", value: 3 },
  { label: "6 months", value: 6 },
  { label: "12 months", value: 12 },
  { label: "24 months", value: 24 },
];

export default function CustomReportEditorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe, authToken } = useValuation();
  const { reportId, reportName } = useLocalSearchParams<{ reportId: string; reportName: string }>();

  const [name, setName] = useState(reportName ?? "");
  const [description, setDescription] = useState("");
  const [dateRangeMonths, setDateRangeMonths] = useState(12);
  const [includeInIm, setIncludeInIm] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [xeroAccounts, setXeroAccounts] = useState<XeroAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [squareConnected, setSquareConnected] = useState(false);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  });

  useFocusEffect(useCallback(() => {
    if (!selectedCafe || !authToken || !reportId) return;
    loadData();
  }, [selectedCafe?.id, authToken, reportId]));

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportRes, itemsRes, xeroRes] = await Promise.all([
        fetch(`${API_BASE}/api/valuation/custom-reports?cafeId=${selectedCafe!.id}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/valuation/custom-reports/${reportId}/line-items`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/valuation/xero/reports?cafeId=${selectedCafe!.id}&months=12`, { headers: authHeaders() }),
      ]);

      if (reportRes.ok) {
        const data = await reportRes.json();
        const report = data.reports?.find((r: any) => r.id === reportId);
        if (report) {
          setName(report.name);
          setDescription(report.description ?? "");
          setDateRangeMonths(report.dateRangeMonths ?? 12);
          setIncludeInIm(report.includeInIm ?? false);
        }
      }

      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setLineItems(data.items ?? []);
      }

      if (xeroRes.ok) {
        const data = await xeroRes.json();
        const accounts: XeroAccount[] = [];
        for (const section of data.sections ?? []) {
          for (const row of section.rows ?? []) {
            accounts.push({
              name: row.name,
              amount: row.amount,
              section: section.title,
              isIncome: section.isIncome,
            });
          }
        }
        setXeroAccounts(accounts);
      } else {
        // Xero not connected — check if square is available
      }

      // Check if square is connected
      try {
        const squareRes = await fetch(
          `${API_BASE}/api/valuation/cafes/${selectedCafe!.id}/snapshots`,
          { headers: authHeaders() },
        );
        if (squareRes.ok) {
          const snap = await squareRes.json();
          setSquareConnected(Number(snap?.snapshot?.squareRevenue ?? 0) > 0);
        }
      } catch {}
    } catch {}
    setLoading(false);
  };

  const isAccountSelected = (accountName: string, kind: "income" | "expense"): boolean =>
    lineItems.some((li) => li.source === "xero_pl" && li.xeroAccountName === accountName && li.kind === kind);

  const toggleAccount = (account: XeroAccount, kind: "income" | "expense") => {
    setLineItems((prev) => {
      const existing = prev.findIndex(
        (li) => li.source === "xero_pl" && li.xeroAccountName === account.name && li.kind === kind,
      );
      if (existing >= 0) {
        return prev.filter((_, i) => i !== existing);
      }
      return [
        ...prev,
        {
          kind,
          label: account.name,
          source: "xero_pl",
          xeroAccountName: account.name,
          sortOrder: prev.length,
        },
      ];
    });
  };

  const squareEnabled = lineItems.some((li) => li.source === "square" && li.kind === "income");

  const toggleSquare = () => {
    if (squareEnabled) {
      setLineItems((prev) => prev.filter((li) => !(li.source === "square" && li.kind === "income")));
    } else {
      setLineItems((prev) => [
        ...prev,
        { kind: "income", label: "Square Revenue", source: "square", sortOrder: prev.length },
      ]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("Error", "Report name is required"); return; }
    setSaving(true);
    try {
      // Save report metadata
      await fetch(`${API_BASE}/api/valuation/custom-reports/${reportId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, dateRangeMonths, includeInIm }),
      });

      // Save line items
      await fetch(`${API_BASE}/api/valuation/custom-reports/${reportId}/line-items`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          items: lineItems.map((li, idx) => ({ ...li, sortOrder: idx })),
        }),
      });

      Alert.alert("Saved", "Report configuration saved.", [
        { text: "View Report", onPress: () => router.replace({ pathname: "/(seller)/valuation/custom-report-detail" as any, params: { reportId, reportName: name.trim() } }) },
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to save report");
    }
    setSaving(false);
  };

  const incomeAccounts = xeroAccounts.filter((a) => a.isIncome);
  const expenseAccounts = xeroAccounts.filter((a) => !a.isIncome);

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
          <Text style={[styles.title, { color: colors.foreground }]}>Configure Report</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Report details */}
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Report Details</Text>

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={name}
                onChangeText={setName}
                placeholder="Report name"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={2}
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Date Range</Text>
              <View style={styles.rangeRow}>
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.rangeChip,
                      {
                        backgroundColor: dateRangeMonths === opt.value ? colors.primary : colors.background,
                        borderColor: dateRangeMonths === opt.value ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setDateRangeMonths(opt.value)}
                  >
                    <Text style={[styles.rangeChipText, { color: dateRangeMonths === opt.value ? "#fff" : colors.foreground }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Include in IM Report</Text>
                  <Text style={[styles.toggleDesc, { color: colors.mutedForeground }]}>
                    Show a summary in Financial Performance
                  </Text>
                </View>
                <Switch
                  value={includeInIm}
                  onValueChange={setIncludeInIm}
                  trackColor={{ true: colors.primary }}
                />
              </View>
            </View>

            {/* Square income */}
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Square</Text>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Square Revenue (Income)</Text>
                  <Text style={[styles.toggleDesc, { color: colors.mutedForeground }]}>
                    {squareConnected ? "Uses cached Square order data" : "Connect Square to use this source"}
                  </Text>
                </View>
                <Switch
                  value={squareEnabled}
                  onValueChange={toggleSquare}
                  trackColor={{ true: colors.primary }}
                  disabled={!squareConnected}
                />
              </View>
            </View>

            {/* Xero income accounts */}
            {incomeAccounts.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Xero Income</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                  Select accounts to include as income
                </Text>
                {incomeAccounts.map((account) => {
                  const selected = isAccountSelected(account.name, "income");
                  return (
                    <TouchableOpacity
                      key={account.name}
                      style={[
                        styles.accountRow,
                        {
                          backgroundColor: selected ? "#10B98110" : colors.background,
                          borderColor: selected ? "#10B981" : colors.border,
                        },
                      ]}
                      onPress={() => toggleAccount(account, "income")}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.checkbox, { borderColor: selected ? "#10B981" : colors.border, backgroundColor: selected ? "#10B981" : "transparent" }]}>
                        {selected && <Feather name="check" size={12} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.accountName, { color: colors.foreground }]}>{account.name}</Text>
                        <Text style={[styles.accountSection, { color: colors.mutedForeground }]}>{account.section}</Text>
                      </View>
                      <Text style={[styles.accountAmount, { color: "#10B981" }]}>
                        ${account.amount.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Xero expense accounts */}
            {expenseAccounts.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Xero Expenses</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                  Select accounts to include as expenses
                </Text>
                {expenseAccounts.map((account) => {
                  const selected = isAccountSelected(account.name, "expense");
                  return (
                    <TouchableOpacity
                      key={account.name}
                      style={[
                        styles.accountRow,
                        {
                          backgroundColor: selected ? "#EF444410" : colors.background,
                          borderColor: selected ? "#EF4444" : colors.border,
                        },
                      ]}
                      onPress={() => toggleAccount(account, "expense")}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.checkbox, { borderColor: selected ? "#EF4444" : colors.border, backgroundColor: selected ? "#EF4444" : "transparent" }]}>
                        {selected && <Feather name="check" size={12} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.accountName, { color: colors.foreground }]}>{account.name}</Text>
                        <Text style={[styles.accountSection, { color: colors.mutedForeground }]}>{account.section}</Text>
                      </View>
                      <Text style={[styles.accountAmount, { color: "#EF4444" }]}>
                        ${account.amount.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {xeroAccounts.length === 0 && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="link" size={24} color={colors.mutedForeground} style={{ alignSelf: "center" }} />
                <Text style={[styles.noXeroTitle, { color: colors.foreground }]}>Xero not connected</Text>
                <Text style={[styles.noXeroText, { color: colors.mutedForeground }]}>
                  Connect Xero on the Connections screen to select income and expense accounts.
                </Text>
                <TouchableOpacity
                  style={[styles.connectBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push("/(seller)/valuation/profile" as any)}
                >
                  <Text style={styles.connectBtnText}>Go to Connections</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Selected items summary */}
            {lineItems.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Selected ({lineItems.length})
                </Text>
                {lineItems.map((li, idx) => (
                  <View key={idx} style={styles.selectedItem}>
                    <View style={[styles.kindDot, { backgroundColor: li.kind === "income" ? "#10B981" : "#EF4444" }]} />
                    <Text style={[styles.selectedLabel, { color: colors.foreground }]}>{li.label}</Text>
                    <Text style={[styles.selectedSource, { color: colors.mutedForeground }]}>
                      {li.source === "square" ? "Square" : "Xero"}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setLineItems((prev) => prev.filter((_, i) => i !== idx))}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Feather name="x" size={14} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Save footer */}
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={saving || loading}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save & View Report</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1 },
  scroll:           { paddingHorizontal: 16, gap: 14 },
  header:           { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:          { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:            { fontSize: 20, fontFamily: "Inter_700Bold", flex: 1 },
  section:          { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  sectionTitle:     { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionSubtitle:  { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -6 },
  label:            { fontSize: 12, fontFamily: "Inter_500Medium" },
  input:            { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  textArea:         { height: 64, textAlignVertical: "top" },
  rangeRow:         { flexDirection: "row", gap: 8 },
  rangeChip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  rangeChipText:    { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  toggleRow:        { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel:      { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleDesc:       { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  accountRow:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  checkbox:         { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  accountName:      { fontSize: 13, fontFamily: "Inter_500Medium" },
  accountSection:   { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  accountAmount:    { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  selectedItem:     { flexDirection: "row", alignItems: "center", gap: 8 },
  kindDot:          { width: 8, height: 8, borderRadius: 4 },
  selectedLabel:    { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  selectedSource:   { fontSize: 11, fontFamily: "Inter_400Regular" },
  noXeroTitle:      { fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  noXeroText:       { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  connectBtn:       { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, alignSelf: "center" },
  connectBtnText:   { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  footer:           { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  saveBtn:          { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  saveBtnText:      { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
