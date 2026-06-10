import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLease } from "@/context/LeaseContext";
import { ClauseCard } from "@/components/lease/ClauseCard";

const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default function LeaseDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { leases, clauses } = useLease();

  const lease = leases.find(l => l.id === id);
  const leaseClauses = useMemo(() => {
    if (!lease?.extractedClauseIds?.length) return [];
    return clauses
      .filter(c => lease.extractedClauseIds!.includes(c.id))
      .sort((a, b) => (RISK_ORDER[a.riskLevel] ?? 3) - (RISK_ORDER[b.riskLevel] ?? 3));
  }, [clauses, lease]);

  if (!lease) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, marginTop: 8, fontFamily: "Inter_400Regular" }}>Lease not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const critical   = leaseClauses.filter(c => c.riskLevel === "critical").length;
  const high       = leaseClauses.filter(c => c.riskLevel === "high").length;
  const tenantFav  = leaseClauses.filter(c => c.rating === "tenant-friendly").length;

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
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{lease.name}</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {lease.fileType?.toUpperCase()}
              {lease.jurisdiction ? ` · ${lease.jurisdiction}` : ""}
              {lease.leaseType ? ` · ${lease.leaseType}` : ""}
            </Text>
          </View>
        </View>

        {/* Summary card */}
        <View style={[styles.summaryCard, { backgroundColor: "#0F1F35", borderColor: "#1E3A5C" }]}>
          {lease.parties?.tenant && (
            <View style={styles.summaryRow}><Text style={styles.summaryKey}>Tenant</Text><Text style={styles.summaryVal}>{lease.parties.tenant}</Text></View>
          )}
          {lease.parties?.landlord && (
            <View style={styles.summaryRow}><Text style={styles.summaryKey}>Landlord</Text><Text style={styles.summaryVal}>{lease.parties.landlord}</Text></View>
          )}
          {lease.premises && (
            <View style={styles.summaryRow}><Text style={styles.summaryKey}>Premises</Text><Text style={styles.summaryVal}>{lease.premises}</Text></View>
          )}
          {lease.term && (
            <View style={styles.summaryRow}><Text style={styles.summaryKey}>Term</Text><Text style={styles.summaryVal}>{lease.term}</Text></View>
          )}
          {lease.rentAmount && (
            <View style={styles.summaryRow}><Text style={styles.summaryKey}>Rent</Text><Text style={[styles.summaryVal, { color: "#93C5FD" }]}>{lease.rentAmount}</Text></View>
          )}
        </View>

        {/* Risk stats */}
        <View style={[styles.statsRow, { backgroundColor: "#0F1F35", borderColor: "#1E3A5C" }]}>
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: "#FCA5A5" }]}>{critical}</Text>
            <Text style={[styles.statLbl, { color: "#8B9CB8" }]}>Critical</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: "#1E3A5C" }]} />
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: "#FCD34D" }]}>{high}</Text>
            <Text style={[styles.statLbl, { color: "#8B9CB8" }]}>High Risk</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: "#1E3A5C" }]} />
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: "#86EFAC" }]}>{tenantFav}</Text>
            <Text style={[styles.statLbl, { color: "#8B9CB8" }]}>Favourable</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: "#1E3A5C" }]} />
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.foreground }]}>{leaseClauses.length}</Text>
            <Text style={[styles.statLbl, { color: "#8B9CB8" }]}>Clauses</Text>
          </View>
        </View>

        {/* View in Library */}
        <TouchableOpacity
          style={[styles.libBtn, { backgroundColor: "#1E3A5C", borderColor: "#3B82F6" }]}
          onPress={() => router.push("/(seller)/leases/library" as any)}
        >
          <Feather name="book-open" size={14} color="#93C5FD" />
          <Text style={[styles.libBtnText, { color: "#93C5FD" }]}>View all clauses in the Library</Text>
          <Feather name="arrow-right" size={14} color="#93C5FD" />
        </TouchableOpacity>

        {/* Clauses */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Analysed Clauses ({leaseClauses.length})
        </Text>

        {leaseClauses.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
              {lease.status === "analysing" ? "Analysis in progress…" : "No clauses extracted."}
            </Text>
          </View>
        ) : (
          leaseClauses.map(clause => (
            <ClauseCard
              key={clause.id}
              clause={clause}
              onPress={() => router.push(`/clause-detail/${clause.id}` as any)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  scroll:      { paddingHorizontal: 16, gap: 14 },
  headerRow:   { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:     { padding: 4 },
  title:       { fontSize: 20, fontFamily: "Inter_700Bold" },
  sub:         { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  summaryCard: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 8 },
  summaryRow:  { flexDirection: "row", gap: 10 },
  summaryKey:  { width: 70, fontSize: 12, fontFamily: "Inter_500Medium", color: "#8B9CB8" },
  summaryVal:  { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#fff" },
  statsRow:    { flexDirection: "row", borderRadius: 14, padding: 14, borderWidth: 1, justifyContent: "space-between" },
  stat:        { alignItems: "center", flex: 1, gap: 2 },
  statVal:     { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLbl:     { fontSize: 11, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1, alignSelf: "stretch" },
  libBtn:      { borderRadius: 12, padding: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  libBtnText:  { fontSize: 13, fontFamily: "Inter_500Medium" },
  sectionTitle:{ fontSize: 15, fontFamily: "Inter_700Bold" },
  emptyCard:   { borderRadius: 14, padding: 24, alignItems: "center", borderWidth: 1 },
});
