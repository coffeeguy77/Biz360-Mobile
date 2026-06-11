import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLease } from "@/context/LeaseContext";
import { ClauseCard } from "@/components/lease/ClauseCard";
import { DisclaimerBanner } from "@/components/lease/DisclaimerBanner";
import { DraftLease, DraftSection, Jurisdiction, LeaseType, PremisesType } from "@/context/leaseTypes";

const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export default function LeaseDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { leases, clauses, addDraft } = useLease();
  const [building, setBuilding] = useState(false);

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
  const tenantFavClauses = leaseClauses.filter(c => c.rating === "tenant-friendly");
  const tenantFav  = tenantFavClauses.length;

  const handleBuildDraft = async () => {
    if (tenantFavClauses.length === 0) {
      Alert.alert("No Favourable Clauses", "This lease has no tenant-friendly clauses to add to a draft.");
      return;
    }

    setBuilding(true);
    try {
      const sections: DraftSection[] = [];

      // Group tenant-friendly clauses by category
      const byCategory = tenantFavClauses.reduce<Record<string, typeof tenantFavClauses>>((acc, c) => {
        const cat = c.category ?? "Other";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(c);
        return acc;
      }, {});

      // One section per category
      for (const [category, cats] of Object.entries(byCategory)) {
        const content = cats
          .map(c => {
            const text = c.suggestedText ?? c.originalText;
            return `${c.title.toUpperCase()}\n${text}\n\n[Risk: ${c.riskLevel} · Negotiation score: ${c.negotiationScore}/5]`;
          })
          .join("\n\n---\n\n");

        sections.push({
          id: genId(),
          title: category,
          content,
          type: "tenant-protections",
        });
      }

      // Red flags section from critical / high landlord-friendly clauses
      const redFlags = leaseClauses.filter(
        c => c.rating === "landlord-friendly" && (c.riskLevel === "critical" || c.riskLevel === "high"),
      );
      if (redFlags.length > 0) {
        sections.push({
          id: genId(),
          title: "Red Flags — Landlord Clauses to Negotiate",
          content: redFlags
            .map(c => `${c.title.toUpperCase()}\n${c.plainEnglish}${c.suggestedText ? `\n\nSuggested replacement:\n${c.suggestedText}` : ""}`)
            .join("\n\n---\n\n"),
          type: "red-flags",
        });
      }

      // Summary section
      sections.push({
        id: genId(),
        title: "Lease Summary",
        content: [
          lease.parties?.tenant   ? `Tenant:     ${lease.parties.tenant}`   : null,
          lease.parties?.landlord ? `Landlord:   ${lease.parties.landlord}` : null,
          lease.premises          ? `Premises:   ${lease.premises}`          : null,
          lease.term              ? `Term:       ${lease.term}`              : null,
          lease.rentAmount        ? `Rent:       ${lease.rentAmount}`        : null,
          `\nExtracted ${tenantFavClauses.length} favourable clause${tenantFavClauses.length !== 1 ? "s" : ""} · ${redFlags.length} red flag${redFlags.length !== 1 ? "s" : ""}.`,
        ].filter(Boolean).join("\n"),
        type: "summary",
      });

      const draftId = genId();
      const draft: DraftLease = {
        id: draftId,
        name: `Draft from ${lease.name}`,
        createdAt: new Date().toISOString(),
        jurisdiction: (lease.jurisdiction as Jurisdiction) ?? "NSW",
        leaseType: (lease.leaseType as LeaseType) ?? "commercial",
        premisesType: "cafe" as PremisesType,
        position: "tenant-friendly",
        rentStructure: lease.rentAmount ?? "",
        outgoingsStructure: "",
        licenceAreas: [],
        selectedProtections: [],
        sections,
      };

      await addDraft(draft);

      Alert.alert(
        "Draft Created",
        `"${draft.name}" has been saved with ${tenantFavClauses.length} favourable clause${tenantFavClauses.length !== 1 ? "s" : ""}.`,
        [
          { text: "View Draft", onPress: () => router.push({ pathname: "/(seller)/leases/draft-detail/[id]", params: { id: draftId } } as any) },
          { text: "Done", style: "cancel" },
        ],
      );
    } finally {
      setBuilding(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
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

        {/* Build draft from good clauses */}
        {tenantFav > 0 && (
          <TouchableOpacity
            style={[styles.buildBtn, { backgroundColor: building ? "#052E16" : "#16A34A20", borderColor: "#16A34A" }]}
            onPress={handleBuildDraft}
            disabled={building}
            activeOpacity={0.8}
          >
            {building ? (
              <ActivityIndicator color="#86EFAC" size="small" />
            ) : (
              <Feather name="file-plus" size={16} color="#86EFAC" />
            )}
            <Text style={[styles.buildBtnText, { color: "#86EFAC" }]}>
              {building ? "Creating draft…" : `Build Draft from ${tenantFav} Favourable Clause${tenantFav !== 1 ? "s" : ""}`}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.libBtn, { backgroundColor: "#1E3A5C", borderColor: "#3B82F6" }]}
          onPress={() => router.push("library" as any)}
        >
          <Feather name="book-open" size={14} color="#93C5FD" />
          <Text style={[styles.libBtnText, { color: "#93C5FD" }]}>View all clauses in the Library</Text>
          <Feather name="arrow-right" size={14} color="#93C5FD" />
        </TouchableOpacity>

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
              onPress={() => router.push({ pathname: "/(seller)/leases/clause-detail/[id]", params: { id: clause.id } } as any)}
            />
          ))
        )}

        <DisclaimerBanner />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 16, gap: 14 },
  headerRow:    { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:      { padding: 4 },
  title:        { fontSize: 20, fontFamily: "Inter_700Bold" },
  sub:          { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  summaryCard:  { borderRadius: 14, padding: 14, borderWidth: 1, gap: 8 },
  summaryRow:   { flexDirection: "row", gap: 10 },
  summaryKey:   { width: 70, fontSize: 12, fontFamily: "Inter_500Medium", color: "#8B9CB8" },
  summaryVal:   { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#fff" },
  statsRow:     { flexDirection: "row", borderRadius: 14, padding: 14, borderWidth: 1, justifyContent: "space-between" },
  stat:         { alignItems: "center", flex: 1, gap: 2 },
  statVal:      { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLbl:      { fontSize: 11, fontFamily: "Inter_400Regular" },
  statDivider:  { width: 1, alignSelf: "stretch" },
  buildBtn:     { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  buildBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  libBtn:       { borderRadius: 12, padding: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  libBtnText:   { fontSize: 13, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  emptyCard:    { borderRadius: 14, padding: 24, alignItems: "center", borderWidth: 1 },
});
