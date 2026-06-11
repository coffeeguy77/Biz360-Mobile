import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { Clause, Lease, RiskLevel } from "@/context/leaseTypes";

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: "#EF4444",
  high:     "#F59E0B",
  medium:   "#3B82F6",
  low:      "#16A34A",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
};

const RISK_WEIGHTS: Record<RiskLevel, number> = {
  critical: 4,
  high:     3,
  medium:   2,
  low:      1,
};

const RISK_ORDER: RiskLevel[] = ["critical", "high", "medium", "low"];

function leaseRiskScore(leaseId: string, clauses: Clause[]): number | null {
  const lc = clauses.filter(c => c.sourceLeaseId === leaseId);
  if (!lc.length) return null;
  return lc.reduce((sum, c) => sum + RISK_WEIGHTS[c.riskLevel], 0) / lc.length;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number) {
  const gap = 0.5;
  const s = startDeg + gap;
  const e = endDeg - gap;
  const large = e - s > 180 ? 1 : 0;
  const o1 = polarToCartesian(cx, cy, outerR, s);
  const o2 = polarToCartesian(cx, cy, outerR, e);
  const i1 = polarToCartesian(cx, cy, innerR, e);
  const i2 = polarToCartesian(cx, cy, innerR, s);
  return `M ${o1.x} ${o1.y} A ${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y} L ${i1.x} ${i1.y} A ${innerR} ${innerR} 0 ${large} 0 ${i2.x} ${i2.y} Z`;
}

interface Props {
  leases:  Lease[];
  clauses: Clause[];
}

export function PortfolioInsights({ leases, clauses }: Props) {
  const colors = useColors();

  const completedLeases = useMemo(
    () => leases.filter(l => l.status === "complete"),
    [leases]
  );

  const portfolioClauses = useMemo(
    () => clauses.filter(c => c.sourceLeaseId && completedLeases.some(l => l.id === c.sourceLeaseId)),
    [clauses, completedLeases]
  );

  const riskCounts = useMemo(() => {
    const counts: Record<RiskLevel, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    portfolioClauses.forEach(c => counts[c.riskLevel]++);
    return counts;
  }, [portfolioClauses]);

  const totalClauses = portfolioClauses.length;

  const topCategories = useMemo(() => {
    const map: Record<string, number> = {};
    portfolioClauses
      .filter(c => c.riskLevel === "high" || c.riskLevel === "critical")
      .forEach(c => { map[c.category] = (map[c.category] ?? 0) + 1; });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cat, count]) => ({ cat, count }));
  }, [portfolioClauses]);

  const comparison = useMemo(() => {
    if (completedLeases.length < 2) return null;
    const sorted = [...completedLeases].sort(
      (a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    );
    const latestScore   = leaseRiskScore(sorted[0].id, clauses);
    const previousScore = leaseRiskScore(sorted[1].id, clauses);
    if (latestScore === null || previousScore === null) return null;
    const diff = latestScore - previousScore;
    return {
      latestName:   sorted[0].name,
      previousName: sorted[1].name,
      latestScore,
      previousScore,
      diff,
    };
  }, [completedLeases, clauses]);

  if (completedLeases.length === 0) return null;

  const SIZE = 120;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 54;
  const innerR = 34;

  let startAngle = 0;
  const segments = RISK_ORDER.map(level => {
    const count = riskCounts[level];
    const sweep = totalClauses > 0 ? (count / totalClauses) * 360 : 0;
    const seg = { level, count, startAngle, endAngle: startAngle + sweep };
    startAngle += sweep;
    return seg;
  }).filter(s => s.count > 0);

  const showDonut = totalClauses > 0;

  return (
    <View style={[styles.card, { backgroundColor: "#0F1F35", borderColor: "#1E3A5C" }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: "#1E3A5C" }]}>
          <Feather name="bar-chart-2" size={14} color="#93C5FD" />
        </View>
        <Text style={[styles.cardTitle, { color: "#fff" }]}>Portfolio Insights</Text>
        <Text style={[styles.cardSub, { color: "#8B9CB8" }]}>
          {completedLeases.length} {completedLeases.length === 1 ? "lease" : "leases"} analysed
        </Text>
      </View>

      {/* Risk Distribution */}
      <Text style={[styles.sectionLabel, { color: "#8B9CB8" }]}>Clause Risk Distribution</Text>
      <View style={styles.donutRow}>
        {showDonut ? (
          <Svg width={SIZE} height={SIZE}>
            {segments.map(seg => (
              <Path
                key={seg.level}
                d={arcPath(cx, cy, outerR, innerR, seg.startAngle, seg.endAngle)}
                fill={RISK_COLORS[seg.level]}
              />
            ))}
            <Circle cx={cx} cy={cy} r={innerR - 1} fill="#0F1F35" />
          </Svg>
        ) : (
          <View style={[styles.donutEmpty, { borderColor: "#1E3A5C" }]}>
            <Feather name="pie-chart" size={22} color="#1E3A5C" />
          </View>
        )}

        <View style={styles.legend}>
          {RISK_ORDER.map(level => {
            const count = riskCounts[level];
            const pct = totalClauses > 0 ? Math.round((count / totalClauses) * 100) : 0;
            return (
              <View key={level} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: RISK_COLORS[level] }]} />
                <Text style={[styles.legendLabel, { color: "#CBD5E1" }]}>{RISK_LABELS[level]}</Text>
                <Text style={[styles.legendCount, { color: "#8B9CB8" }]}>
                  {count} <Text style={styles.legendPct}>({pct}%)</Text>
                </Text>
              </View>
            );
          })}
          {totalClauses > 0 && (
            <Text style={[styles.totalLabel, { color: "#475569" }]}>
              {totalClauses} total clauses
            </Text>
          )}
        </View>
      </View>

      {/* Top At-Risk Categories */}
      {topCategories.length > 0 && (
        <>
          <View style={[styles.divider, { backgroundColor: "#1E3A5C" }]} />
          <Text style={[styles.sectionLabel, { color: "#8B9CB8" }]}>Top High-Risk Categories</Text>
          <View style={styles.catList}>
            {topCategories.map(({ cat, count }, i) => {
              const barPct = topCategories[0].count > 0 ? count / topCategories[0].count : 0;
              return (
                <View key={cat} style={styles.catRow}>
                  <View style={styles.catMeta}>
                    <Text style={[styles.catRank, { color: "#475569" }]}>#{i + 1}</Text>
                    <Text style={[styles.catName, { color: "#E2E8F0" }]} numberOfLines={1}>{cat}</Text>
                    <Text style={[styles.catCount, { color: "#F59E0B" }]}>{count}</Text>
                  </View>
                  <View style={[styles.barBg, { backgroundColor: "#1A2F4A" }]}>
                    <View style={[styles.barFill, { width: `${barPct * 100}%` as any, backgroundColor: "#F59E0B" }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Latest vs Previous */}
      {comparison && (
        <>
          <View style={[styles.divider, { backgroundColor: "#1E3A5C" }]} />
          <Text style={[styles.sectionLabel, { color: "#8B9CB8" }]}>Latest vs Previous</Text>
          <View style={[styles.compRow, { backgroundColor: "#0A1929", borderColor: "#1E3A5C" }]}>
            <View style={styles.compLease}>
              <Text style={[styles.compLeaseName, { color: "#CBD5E1" }]} numberOfLines={1}>
                {comparison.latestName}
              </Text>
              <ScorePill score={comparison.latestScore} label="latest" />
            </View>
            <TrendArrow diff={comparison.diff} />
            <View style={[styles.compLease, styles.compLeaseRight]}>
              <Text style={[styles.compLeaseName, { color: "#CBD5E1" }]} numberOfLines={1}>
                {comparison.previousName}
              </Text>
              <ScorePill score={comparison.previousScore} label="previous" />
            </View>
          </View>
          <Text style={[styles.compHint, { color: "#475569" }]}>
            {comparison.diff < -0.2
              ? "✅ Latest lease is lower risk than the previous one."
              : comparison.diff > 0.2
              ? "⚠️ Latest lease carries more risk than the previous one."
              : "≈ Latest lease has a similar risk profile to the previous one."}
          </Text>
        </>
      )}
    </View>
  );
}

function scoreToRiskLabel(score: number): { label: string; color: string } {
  if (score >= 3.5) return { label: "Critical", color: "#EF4444" };
  if (score >= 2.5) return { label: "High",     color: "#F59E0B" };
  if (score >= 1.5) return { label: "Medium",   color: "#3B82F6" };
  return                    { label: "Low",      color: "#16A34A" };
}

function ScorePill({ score, label }: { score: number; label: string }) {
  const { label: rLabel, color } = scoreToRiskLabel(score);
  return (
    <View style={[styles.scorePill, { backgroundColor: color + "22", borderColor: color + "55" }]}>
      <Text style={[styles.scorePillText, { color }]}>{rLabel}</Text>
    </View>
  );
}

function TrendArrow({ diff }: { diff: number }) {
  const better = diff < -0.2;
  const worse  = diff > 0.2;
  const icon   = better ? "arrow-down" : worse ? "arrow-up" : "minus";
  const color  = better ? "#16A34A"    : worse  ? "#EF4444" : "#6B7280";
  return (
    <View style={styles.trendArrow}>
      <Feather name={icon as any} size={18} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  card:         { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  cardHeader:   { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBox:      { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cardTitle:    { fontSize: 15, fontFamily: "Inter_700Bold", flex: 1 },
  cardSub:      { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 },
  donutRow:     { flexDirection: "row", alignItems: "center", gap: 16 },
  donutEmpty:   { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  legend:       { flex: 1, gap: 7 },
  legendRow:    { flexDirection: "row", alignItems: "center", gap: 7 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendLabel:  { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  legendCount:  { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  legendPct:    { fontSize: 11, fontFamily: "Inter_400Regular" },
  totalLabel:   { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  divider:      { height: 1 },
  catList:      { gap: 8 },
  catRow:       { gap: 4 },
  catMeta:      { flexDirection: "row", alignItems: "center", gap: 6 },
  catRank:      { fontSize: 11, fontFamily: "Inter_400Regular", width: 20 },
  catName:      { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  catCount:     { fontSize: 12, fontFamily: "Inter_700Bold" },
  barBg:        { height: 4, borderRadius: 2, overflow: "hidden" },
  barFill:      { height: 4, borderRadius: 2 },
  compRow:      { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, borderWidth: 1, gap: 8 },
  compLease:    { flex: 1, gap: 4 },
  compLeaseRight: { alignItems: "flex-end" },
  compLeaseName:{ fontSize: 11, fontFamily: "Inter_500Medium" },
  scorePill:    { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  scorePillText:{ fontSize: 11, fontFamily: "Inter_700Bold" },
  trendArrow:   { width: 32, height: 32, borderRadius: 16, backgroundColor: "#0F1F35", alignItems: "center", justifyContent: "center" },
  compHint:     { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
