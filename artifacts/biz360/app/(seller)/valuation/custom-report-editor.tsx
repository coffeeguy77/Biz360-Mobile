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

// ── Types ──────────────────────────────────────────────────────────────────────

interface LineItem {
  id?: string;
  kind: "income" | "expense";
  label: string;
  source: "xero_pl" | "square" | "square_category";
  xeroAccountId?: string | null;
  xeroAccountName?: string | null;  // also holds Square category name for square_category source
  sortOrder?: number;
}

interface XeroAccount {
  name: string;
  amount: number;
  section: string;
  isIncome: boolean;
}

interface SquareCategory {
  name: string;
  total: number;
}

const DATE_RANGE_OPTIONS = [
  { label: "3 months", value: 3 },
  { label: "6 months", value: 6 },
  { label: "12 months", value: 12 },
  { label: "24 months", value: 24 },
];

// Xero section titles that represent COGS / direct costs
const COGS_SECTION_KEYWORDS = [
  "cost of sale",
  "cost of goods",
  "direct cost",
  "cogs",
  "supplier",
  "purchases",
  "food cost",
  "beverage cost",
];

function isCOGSSection(title: string): boolean {
  const t = title.toLowerCase();
  return COGS_SECTION_KEYWORDS.some((kw) => t.includes(kw));
}

// ── Component ──────────────────────────────────────────────────────────────────

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
  const [squareCategories, setSquareCategories] = useState<SquareCategory[]>([]);
  const [squareConnected, setSquareConnected] = useState(false);
  const [hasCategoryData, setHasCategoryData] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Collapsible section state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    xero_income: true,
    xero_cogs: true,
    xero_expenses: false,
    square_categories: true,
    square_total: false,
  });

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  });

  const toggleSection = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  useFocusEffect(useCallback(() => {
    if (!selectedCafe || !authToken || !reportId) return;
    loadData();
  }, [selectedCafe?.id, authToken, reportId]));

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportRes, itemsRes, xeroRes, squareCatsRes, squareSnapRes] = await Promise.all([
        fetch(`${API_BASE}/api/valuation/custom-reports?cafeId=${selectedCafe!.id}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/valuation/custom-reports/${reportId}/line-items`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/valuation/xero/reports?cafeId=${selectedCafe!.id}&months=12`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/valuation/square/categories?cafeId=${selectedCafe!.id}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/valuation/cafes/${selectedCafe!.id}/snapshots`, { headers: authHeaders() }),
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
      }

      if (squareCatsRes.ok) {
        const data = await squareCatsRes.json();
        setSquareCategories(data.categories ?? []);
        setHasCategoryData(data.hasCategoryData ?? false);
      }

      if (squareSnapRes.ok) {
        const snap = await squareSnapRes.json();
        setSquareConnected(Number(snap?.snapshot?.squareRevenue ?? 0) > 0);
      }
    } catch {}
    setLoading(false);
  };

  // ── Line item helpers ────────────────────────────────────────────────────────

  const isXeroSelected = (accountName: string, kind: "income" | "expense"): boolean =>
    lineItems.some((li) => li.source === "xero_pl" && li.xeroAccountName === accountName && li.kind === kind);

  const toggleXeroAccount = (account: XeroAccount, kind: "income" | "expense") => {
    setLineItems((prev) => {
      const idx = prev.findIndex(
        (li) => li.source === "xero_pl" && li.xeroAccountName === account.name && li.kind === kind,
      );
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, { kind, label: account.name, source: "xero_pl", xeroAccountName: account.name, sortOrder: prev.length }];
    });
  };

  const isCategorySelected = (categoryName: string, kind: "income" | "expense"): boolean =>
    lineItems.some((li) => li.source === "square_category" && li.xeroAccountName === categoryName && li.kind === kind);

  const toggleSquareCategory = (category: SquareCategory, kind: "income" | "expense") => {
    setLineItems((prev) => {
      const idx = prev.findIndex(
        (li) => li.source === "square_category" && li.xeroAccountName === category.name && li.kind === kind,
      );
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      return [...prev, {
        kind,
        label: category.name,
        source: "square_category",
        xeroAccountName: category.name,
        sortOrder: prev.length,
      }];
    });
  };

  const squareTotalEnabled = lineItems.some((li) => li.source === "square" && li.kind === "income");
  const toggleSquareTotal = () => {
    if (squareTotalEnabled) {
      setLineItems((prev) => prev.filter((li) => !(li.source === "square" && li.kind === "income")));
    } else {
      // Clear any existing category selections first to avoid double-counting
      setLineItems((prev) => [
        ...prev.filter((li) => li.source !== "square_category"),
        { kind: "income", label: "Square Revenue (All)", source: "square", sortOrder: prev.length },
      ]);
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("Error", "Report name is required"); return; }
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/valuation/custom-reports/${reportId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, dateRangeMonths, includeInIm }),
      });
      await fetch(`${API_BASE}/api/valuation/custom-reports/${reportId}/line-items`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ items: lineItems.map((li, idx) => ({ ...li, sortOrder: idx })) }),
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

  // ── Derived data ─────────────────────────────────────────────────────────────

  const incomeAccounts = xeroAccounts.filter((a) => a.isIncome);

  // Group expense accounts into COGS and Other Expenses
  const cogsAccounts = xeroAccounts.filter((a) => !a.isIncome && isCOGSSection(a.section));
  // Unique non-COGS section titles
  const otherExpenseSections = [...new Set(
    xeroAccounts.filter((a) => !a.isIncome && !isCOGSSection(a.section)).map((a) => a.section)
  )];

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderSectionHeader = (label: string, sectionKey: string, count?: number) => (
    <TouchableOpacity
      style={styles.accordionHeader}
      onPress={() => toggleSection(sectionKey)}
      activeOpacity={0.7}
    >
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {label}
        {count != null && count > 0 ? <Text style={{ color: colors.primary }}> ({count})</Text> : null}
      </Text>
      <Feather
        name={expandedSections[sectionKey] ? "chevron-up" : "chevron-down"}
        size={16}
        color={colors.mutedForeground}
      />
    </TouchableOpacity>
  );

  const renderXeroAccountRow = (account: XeroAccount, kind: "income" | "expense") => {
    const selected = isXeroSelected(account.name, kind);
    const dotColor = kind === "income" ? "#10B981" : "#EF4444";
    return (
      <TouchableOpacity
        key={`${account.name}-${kind}`}
        style={[styles.accountRow, { backgroundColor: selected ? `${dotColor}10` : colors.background, borderColor: selected ? dotColor : colors.border }]}
        onPress={() => toggleXeroAccount(account, kind)}
        activeOpacity={0.8}
      >
        <View style={[styles.checkbox, { borderColor: selected ? dotColor : colors.border, backgroundColor: selected ? dotColor : "transparent" }]}>
          {selected && <Feather name="check" size={12} color="#fff" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.accountName, { color: colors.foreground }]}>{account.name}</Text>
          <Text style={[styles.accountSection, { color: colors.mutedForeground }]}>{account.section}</Text>
        </View>
        <Text style={[styles.accountAmount, { color: dotColor }]}>
          ${account.amount.toLocaleString("en-AU", { maximumFractionDigits: 0 })}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderSquareCategoryRow = (cat: SquareCategory, kind: "income" | "expense") => {
    const selected = isCategorySelected(cat.name, kind);
    const dotColor = kind === "income" ? "#10B981" : "#EF4444";
    return (
      <TouchableOpacity
        key={`${cat.name}-${kind}`}
        style={[styles.accountRow, { backgroundColor: selected ? `${dotColor}10` : colors.background, borderColor: selected ? dotColor : colors.border }]}
        onPress={() => toggleSquareCategory(cat, kind)}
        activeOpacity={0.8}
      >
        <View style={[styles.checkbox, { borderColor: selected ? dotColor : colors.border, backgroundColor: selected ? dotColor : "transparent" }]}>
          {selected && <Feather name="check" size={12} color="#fff" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.accountName, { color: colors.foreground }]}>{cat.name}</Text>
          <Text style={[styles.accountSection, { color: colors.mutedForeground }]}>Square category</Text>
        </View>
        <Text style={[styles.accountAmount, { color: dotColor }]}>
          ${cat.total.toLocaleString("en-AU", { maximumFractionDigits: 0 })}
        </Text>
      </TouchableOpacity>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────

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
            {/* ── Report Details ─────────────────────────────────────────── */}
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Report Details</Text>

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Kitchen Revenue"
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
                    style={[styles.rangeChip, { backgroundColor: dateRangeMonths === opt.value ? colors.primary : colors.background, borderColor: dateRangeMonths === opt.value ? colors.primary : colors.border }]}
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
                <Switch value={includeInIm} onValueChange={setIncludeInIm} trackColor={{ true: colors.primary }} />
              </View>
            </View>

            {/* ── Square Section ─────────────────────────────────────────── */}
            {squareConnected && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Square</Text>

                {/* Per-category selection */}
                {hasCategoryData && squareCategories.length > 0 && (
                  <>
                    {renderSectionHeader(
                      "Categories (Income)",
                      "square_categories",
                      lineItems.filter((li) => li.source === "square_category" && li.kind === "income").length,
                    )}
                    <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground, marginTop: -4 }]}>
                      Select individual categories — e.g. Hot Food only, excluding Coffee
                    </Text>
                    {expandedSections.square_categories && (
                      <View style={{ gap: 8, marginTop: 4 }}>
                        {squareCategories.map((cat) => renderSquareCategoryRow(cat, "income"))}
                      </View>
                    )}

                    {/* Divider */}
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  </>
                )}

                {/* Whole-Square total toggle */}
                {renderSectionHeader("All Square Revenue (Total)", "square_total")}
                {expandedSections.square_total && (
                  <>
                    <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground, marginTop: -4 }]}>
                      {hasCategoryData
                        ? "Adds all Square revenue as a single line — clears any category selections above"
                        : squareConnected
                        ? "Run a Square sync to unlock per-category breakdown"
                        : "Connect Square to use this source"}
                    </Text>
                    <View style={[styles.toggleRow, { marginTop: 4 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Include all Square revenue</Text>
                      </View>
                      <Switch
                        value={squareTotalEnabled}
                        onValueChange={toggleSquareTotal}
                        trackColor={{ true: colors.primary }}
                      />
                    </View>
                  </>
                )}
              </View>
            )}

            {/* ── Xero Income Accounts ───────────────────────────────────── */}
            {incomeAccounts.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {renderSectionHeader(
                  "Xero Income",
                  "xero_income",
                  lineItems.filter((li) => li.source === "xero_pl" && li.kind === "income").length,
                )}
                <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground, marginTop: -4 }]}>
                  Select income accounts from your Xero P&L
                </Text>
                {expandedSections.xero_income && (
                  <View style={{ gap: 8, marginTop: 4 }}>
                    {incomeAccounts.map((a) => renderXeroAccountRow(a, "income"))}
                  </View>
                )}
              </View>
            )}

            {/* ── Xero COGS / Suppliers ──────────────────────────────────── */}
            {cogsAccounts.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {renderSectionHeader(
                  "Xero COGS & Suppliers",
                  "xero_cogs",
                  lineItems.filter((li) => li.source === "xero_pl" && li.kind === "expense" && cogsAccounts.some((a) => a.name === li.xeroAccountName)).length,
                )}
                <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground, marginTop: -4 }]}>
                  Cost of Goods Sold, direct costs and supplier accounts
                </Text>
                {expandedSections.xero_cogs && (
                  <View style={{ gap: 8, marginTop: 4 }}>
                    {cogsAccounts.map((a) => renderXeroAccountRow(a, "expense"))}
                  </View>
                )}
              </View>
            )}

            {/* ── Xero Other Expenses (grouped by section) ──────────────── */}
            {otherExpenseSections.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {renderSectionHeader(
                  "Xero Other Expenses",
                  "xero_expenses",
                  lineItems.filter((li) => {
                    if (li.source !== "xero_pl" || li.kind !== "expense") return false;
                    return xeroAccounts.some((a) => a.name === li.xeroAccountName && !a.isIncome && !isCOGSSection(a.section));
                  }).length,
                )}
                <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground, marginTop: -4 }]}>
                  Operating expenses, overheads and other costs
                </Text>
                {expandedSections.xero_expenses && (
                  <View style={{ gap: 8, marginTop: 4 }}>
                    {otherExpenseSections.map((sectionTitle) => {
                      const accts = xeroAccounts.filter((a) => !a.isIncome && !isCOGSSection(a.section) && a.section === sectionTitle);
                      return (
                        <View key={sectionTitle}>
                          <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>{sectionTitle}</Text>
                          {accts.map((a) => renderXeroAccountRow(a, "expense"))}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* No Xero connected */}
            {xeroAccounts.length === 0 && !squareConnected && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="link" size={24} color={colors.mutedForeground} style={{ alignSelf: "center" }} />
                <Text style={[styles.noDataTitle, { color: colors.foreground }]}>No data sources connected</Text>
                <Text style={[styles.noDataText, { color: colors.mutedForeground }]}>
                  Connect Xero and/or Square on the Connections screen to select income and expense accounts.
                </Text>
                <TouchableOpacity
                  style={[styles.connectBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push("/(seller)/valuation/profile" as any)}
                >
                  <Text style={styles.connectBtnText}>Go to Connections</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Selected Items Summary ─────────────────────────────────── */}
            {lineItems.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Selected ({lineItems.length})
                </Text>
                {lineItems.map((li, idx) => {
                  const dotColor = li.kind === "income" ? "#10B981" : "#EF4444";
                  const sourceLabel =
                    li.source === "square" ? "Square (all)" :
                    li.source === "square_category" ? "Square category" : "Xero";
                  return (
                    <View key={idx} style={styles.selectedItem}>
                      <View style={[styles.kindDot, { backgroundColor: dotColor }]} />
                      <Text style={[styles.selectedLabel, { color: colors.foreground }]}>{li.label}</Text>
                      <Text style={[styles.selectedSource, { color: colors.mutedForeground }]}>{sourceLabel}</Text>
                      <TouchableOpacity
                        onPress={() => setLineItems((prev) => prev.filter((_, i) => i !== idx))}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Feather name="x" size={14} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
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
  container:       { flex: 1 },
  scroll:          { paddingHorizontal: 16, gap: 14 },
  header:          { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:         { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:           { fontSize: 20, fontFamily: "Inter_700Bold", flex: 1 },

  section:         { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  sectionTitle:    { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  groupLabel:      { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6, marginBottom: 2 },

  accordionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 },
  divider:         { height: 1, marginVertical: 6 },

  label:           { fontSize: 12, fontFamily: "Inter_500Medium" },
  input:           { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  textArea:        { height: 64, textAlignVertical: "top" },
  rangeRow:        { flexDirection: "row", gap: 8 },
  rangeChip:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  rangeChipText:   { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  toggleRow:       { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel:     { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleDesc:      { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  accountRow:      { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  checkbox:        { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  accountName:     { fontSize: 13, fontFamily: "Inter_500Medium" },
  accountSection:  { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  accountAmount:   { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  selectedItem:    { flexDirection: "row", alignItems: "center", gap: 8 },
  kindDot:         { width: 8, height: 8, borderRadius: 4 },
  selectedLabel:   { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  selectedSource:  { fontSize: 11, fontFamily: "Inter_400Regular" },

  noDataTitle:     { fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  noDataText:      { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  connectBtn:      { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, alignSelf: "center" },
  connectBtnText:  { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  footer:          { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  saveBtn:         { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  saveBtnText:     { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
