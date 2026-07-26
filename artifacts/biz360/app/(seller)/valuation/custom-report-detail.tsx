import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
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

interface MonthRow { month: string; income: number; expenses: number; net: number; }
interface ReportData {
  months: MonthRow[];
  totals: { income: number; expenses: number; net: number };
  growth: { momPct: number | null; popPct: number | null };
  period: { fromDate: string; toDate: string; months: number };
}

function fmt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

function shortMonth(ym: string): string {
  // "2025-01" → "Jan"
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = parseInt(ym.split("-")[1], 10) - 1;
  return months[m] ?? ym;
}

/** Simple bar chart using View bars (no external chart lib required) */
function BarChart({ data, colors }: { data: MonthRow[]; colors: any }) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map((r) => Math.max(r.income, r.expenses, 1)));
  const BAR_MAX_H = 80;

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.bars}>
        {data.map((row, i) => {
          const incomeH = Math.max(2, (row.income / maxVal) * BAR_MAX_H);
          const expenseH = Math.max(2, (row.expenses / maxVal) * BAR_MAX_H);
          const netPositive = row.net >= 0;
          return (
            <View key={i} style={chartStyles.barGroup}>
              <View style={chartStyles.barsRow}>
                <View style={[chartStyles.bar, { height: incomeH, backgroundColor: "#10B981" }]} />
                <View style={[chartStyles.bar, { height: expenseH, backgroundColor: "#EF4444" }]} />
              </View>
              {/* Net indicator line */}
              <View
                style={[
                  chartStyles.netDot,
                  { backgroundColor: netPositive ? "#3B82F6" : "#F59E0B" },
                ]}
              />
              <Text style={[chartStyles.monthLabel, { color: colors.mutedForeground }]}>
                {shortMonth(row.month)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={chartStyles.legend}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: "#10B981" }]} />
          <Text style={[chartStyles.legendText, { color: colors.mutedForeground }]}>Income</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: "#EF4444" }]} />
          <Text style={[chartStyles.legendText, { color: colors.mutedForeground }]}>Expenses</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: "#3B82F6" }]} />
          <Text style={[chartStyles.legendText, { color: colors.mutedForeground }]}>Net</Text>
        </View>
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container:   { gap: 10 },
  bars:        { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 110, paddingBottom: 20 },
  barGroup:    { flex: 1, alignItems: "center", gap: 2 },
  barsRow:     { flexDirection: "row", alignItems: "flex-end", gap: 1, flex: 1 },
  bar:         { flex: 1, borderRadius: 3, minHeight: 2 },
  netDot:      { width: 5, height: 5, borderRadius: 3 },
  monthLabel:  { fontSize: 9, fontFamily: "Inter_400Regular" },
  legend:      { flexDirection: "row", gap: 16, justifyContent: "center" },
  legendItem:  { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendText:  { fontSize: 11, fontFamily: "Inter_400Regular" },
});

export default function CustomReportDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe, authToken } = useValuation();
  const { reportId, reportName } = useLocalSearchParams<{ reportId: string; reportName: string }>();

  const [data, setData] = useState<ReportData | null>(null);
  const [reportMeta, setReportMeta] = useState<{ name: string; description: string | null; includeInIm: boolean; dateRangeMonths: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingIm, setTogglingIm] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      const [metaRes, dataRes] = await Promise.all([
        fetch(`${API_BASE}/api/valuation/custom-reports?cafeId=${selectedCafe!.id}`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/valuation/custom-reports/${reportId}/data`, { headers: authHeaders() }),
      ]);

      if (metaRes.ok) {
        const meta = await metaRes.json();
        const report = meta.reports?.find((r: any) => r.id === reportId);
        if (report) setReportMeta({ name: report.name, description: report.description, includeInIm: report.includeInIm, dateRangeMonths: report.dateRangeMonths });
      }

      if (dataRes.ok) {
        const d = await dataRes.json();
        setData(d);
      } else {
        setError("Failed to load report data. Make sure your Xero or Square is connected.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  const toggleIncludeInIm = async (value: boolean) => {
    if (!reportMeta) return;
    setTogglingIm(true);
    setReportMeta((prev) => prev ? { ...prev, includeInIm: value } : null);
    await fetch(`${API_BASE}/api/valuation/custom-reports/${reportId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ includeInIm: value }),
    }).catch(() => {});
    setTogglingIm(false);
  };

  const totalNet = data?.totals.net ?? 0;
  const momPct = data?.growth.momPct;
  const popPct = data?.growth.popPct;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {reportMeta?.name ?? reportName ?? "Report"}
            </Text>
            {reportMeta?.description ? (
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{reportMeta.description}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.editBtn, { borderColor: colors.border }]}
            onPress={() => router.push({ pathname: "/(seller)/valuation/custom-report-editor" as any, params: { reportId, reportName: reportMeta?.name ?? reportName } })}
          >
            <Feather name="settings" size={16} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={32} color="#F59E0B" />
            <Text style={[styles.errorTitle, { color: colors.foreground }]}>Data unavailable</Text>
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              onPress={loadData}
            >
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : data ? (
          <>
            {/* Period info */}
            <Text style={[styles.periodLabel, { color: colors.mutedForeground }]}>
              {data.period.fromDate} – {data.period.toDate} · {data.period.months} months
            </Text>

            {/* Totals row */}
            <View style={styles.totalsRow}>
              {[
                { label: "Total Income", value: data.totals.income, color: "#10B981" },
                { label: "Total Expenses", value: data.totals.expenses, color: "#EF4444" },
                { label: "Net", value: data.totals.net, color: totalNet >= 0 ? "#3B82F6" : "#F59E0B" },
              ].map(({ label, value, color }) => (
                <View key={label} style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <Text style={[styles.totalValue, { color }]}>{fmt(value)}</Text>
                </View>
              ))}
            </View>

            {/* Growth badges */}
            {(momPct !== null || popPct !== null) && (
              <View style={styles.growthRow}>
                {momPct !== null && (
                  <View style={[styles.growthBadge, { backgroundColor: momPct >= 0 ? "#10B98115" : "#EF444415" }]}>
                    <Feather
                      name={momPct >= 0 ? "trending-up" : "trending-down"}
                      size={14}
                      color={momPct >= 0 ? "#10B981" : "#EF4444"}
                    />
                    <Text style={[styles.growthText, { color: momPct >= 0 ? "#10B981" : "#EF4444" }]}>
                      {momPct >= 0 ? "+" : ""}{momPct}% MoM
                    </Text>
                  </View>
                )}
                {popPct !== null && (
                  <View style={[styles.growthBadge, { backgroundColor: popPct >= 0 ? "#10B98115" : "#EF444415" }]}>
                    <Feather
                      name={popPct >= 0 ? "trending-up" : "trending-down"}
                      size={14}
                      color={popPct >= 0 ? "#10B981" : "#EF4444"}
                    />
                    <Text style={[styles.growthText, { color: popPct >= 0 ? "#10B981" : "#EF4444" }]}>
                      {popPct >= 0 ? "+" : ""}{popPct}% period-over-period
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Chart */}
            <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.chartTitle, { color: colors.foreground }]}>Monthly Overview</Text>
              <BarChart data={data.months} colors={colors} />
            </View>

            {/* Monthly table */}
            <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.chartTitle, { color: colors.foreground }]}>Monthly Breakdown</Text>

              {/* Table header */}
              <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: colors.border }]}>
                <Text style={[styles.tableCell, styles.tableCellHeader, { color: colors.foreground, flex: 1.2 }]}>Month</Text>
                <Text style={[styles.tableCell, styles.tableCellHeader, { color: "#10B981" }]}>Income</Text>
                <Text style={[styles.tableCell, styles.tableCellHeader, { color: "#EF4444" }]}>Expenses</Text>
                <Text style={[styles.tableCell, styles.tableCellHeader, { color: "#3B82F6" }]}>Net</Text>
              </View>

              {[...data.months].reverse().map((row, i) => (
                <View
                  key={row.month}
                  style={[
                    styles.tableRow,
                    { backgroundColor: i % 2 === 0 ? colors.card : colors.background },
                  ]}
                >
                  <Text style={[styles.tableCell, { color: colors.foreground, flex: 1.2 }]}>
                    {shortMonth(row.month)} {row.month.split("-")[0]}
                  </Text>
                  <Text style={[styles.tableCell, { color: "#10B981" }]}>{fmt(row.income)}</Text>
                  <Text style={[styles.tableCell, { color: "#EF4444" }]}>{fmt(row.expenses)}</Text>
                  <Text style={[styles.tableCell, { color: row.net >= 0 ? "#3B82F6" : "#F59E0B" }]}>
                    {fmt(row.net)}
                  </Text>
                </View>
              ))}
            </View>

            {/* IM toggle */}
            <View style={[styles.imCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.imLabel, { color: colors.foreground }]}>Include in IM Report</Text>
                <Text style={[styles.imDesc, { color: colors.mutedForeground }]}>
                  Show a summary card in the Financial Performance chapter of your IM report
                </Text>
              </View>
              {togglingIm ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Switch
                  value={reportMeta?.includeInIm ?? false}
                  onValueChange={toggleIncludeInIm}
                  trackColor={{ true: colors.primary }}
                />
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 16, gap: 14 },
  header:       { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  backBtn:      { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:        { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle:     { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  editBtn:      { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  periodLabel:  { fontSize: 12, fontFamily: "Inter_400Regular" },
  totalsRow:    { flexDirection: "row", gap: 8 },
  totalCard:    { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, gap: 4 },
  totalLabel:   { fontSize: 10, fontFamily: "Inter_400Regular" },
  totalValue:   { fontSize: 15, fontFamily: "Inter_700Bold" },
  growthRow:    { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  growthBadge:  { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  growthText:   { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  chartCard:    { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  chartTitle:   { fontSize: 14, fontFamily: "Inter_700Bold" },
  tableCard:    { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  tableRow:     { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 9 },
  tableHeader:  { paddingVertical: 8 },
  tableCell:    { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "right" },
  tableCellHeader: { fontFamily: "Inter_600SemiBold" },
  imCard:       { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 16 },
  imLabel:      { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  imDesc:       { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 17 },
  errorBox:     { alignItems: "center", paddingVertical: 40, gap: 12 },
  errorTitle:   { fontSize: 16, fontFamily: "Inter_700Bold" },
  errorText:    { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 280 },
  retryBtn:     { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
});
