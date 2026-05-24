import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const METRICS = [
  { label: "Total Portfolio Views", value: "1,234", trend: "+22%", color: "#3B82F6" },
  { label: "Tour Completions", value: "446", trend: "+38%", color: "#8B5CF6" },
  { label: "Enquiries Generated", value: "89", trend: "+15%", color: "#F59E0B" },
  { label: "Conversion Rate", value: "7.2%", trend: "+1.4pp", color: "#16A34A" },
];

const BAR_DATA = [
  { label: "Mon", val: 45 }, { label: "Tue", val: 72 }, { label: "Wed", val: 89 },
  { label: "Thu", val: 61 }, { label: "Fri", val: 93 }, { label: "Sat", val: 38 }, { label: "Sun", val: 25 },
];
const MAX_BAR = 93;

export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Analytics</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Last 30 days</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          {METRICS.map((m) => (
            <View key={m.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statVal, { color: m.color }]}>{m.value}</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{m.label}</Text>
              <Text style={[styles.statTrend, { color: colors.accent }]}>{m.trend}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.chartTitle, { color: colors.foreground }]}>Daily Views — This Week</Text>
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.bars}>
            {BAR_DATA.map((b) => (
              <View key={b.label} style={styles.barItem}>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { height: `${(b.val / MAX_BAR) * 100}%` as any, backgroundColor: colors.primary }]} />
                </View>
                <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{b.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  scroll: { padding: 16, gap: 16 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", padding: 14, borderRadius: 14, borderWidth: 1, gap: 4 },
  statVal: { fontSize: 24, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statTrend: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  chartTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  chartCard: { padding: 16, borderRadius: 14, borderWidth: 1 },
  bars: { flexDirection: "row", height: 120, alignItems: "flex-end", gap: 8 },
  barItem: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 4 },
  barTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
});
