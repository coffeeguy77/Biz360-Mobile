// ChartComponents.tsx — React Native chart components using react-native-svg.
// Each component renders using the shared SVG generator (chart-svg.ts) via SvgXml,
// keeping the mobile chart output consistent with PDF charts (same SVG pipeline).

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SvgXml } from "react-native-svg";
import { generateChartSvg } from "./chart-svg";

interface ChartProps {
  sectionKey: string;
  data: Array<Record<string, unknown>>;
  width?: number;
  height?: number;
}

/** Renders any of the 8 IM chart types in React Native via react-native-svg. */
export function MobileChart({ sectionKey, data, width = 300, height = 160 }: ChartProps) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  try {
    const svgStr = generateChartSvg(sectionKey, data, width, height);
    return (
      <View style={[styles.container, { width, height }]}>
        <SvgXml xml={svgStr} width={width} height={height} />
      </View>
    );
  } catch {
    return null;
  }
}

/** Section-key to chart component mapping — mirrors SECTION_CHART_MAP on web. */
export const MOBILE_CHART_KEYS = new Set([
  "app_valuation_summary",
  "revenue_stream_breakdown",
  "division_breakdown",
  "plant_equipment_summary",
  "buyer_access_confidentiality",
  "lease_premises_summary",
  "verified_revenue_sources",
  "business_health_score",
]);

/** Inline chart card for report section display in mobile (matches web SectionContent). */
export function SectionChart({
  sectionKey,
  chartData,
  width = 300,
}: {
  sectionKey: string;
  chartData: unknown;
  width?: number;
}) {
  if (!MOBILE_CHART_KEYS.has(sectionKey)) return null;
  const parsed: Array<Record<string, unknown>> | null =
    chartData == null
      ? null
      : typeof chartData === "string"
      ? (() => { try { return JSON.parse(chartData); } catch { return null; } })()
      : Array.isArray(chartData)
      ? (chartData as Array<Record<string, unknown>>)
      : null;
  if (!parsed || parsed.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Chart</Text>
      <MobileChart sectionKey={sectionKey} data={parsed} width={width} height={150} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden" },
  card: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#070F1C",
    borderWidth: 1,
    borderColor: "#1E3A5C",
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: "#8B9CB8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
});
