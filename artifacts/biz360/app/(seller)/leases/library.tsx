import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLease } from "@/context/LeaseContext";
import { ClauseCard } from "@/components/lease/ClauseCard";
import { RiskLevel, ClauseRating, Clause } from "@/context/leaseTypes";
import { LEASE_SEED_CLAUSES } from "@/data/leaseSeedClauses";

const domain   = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

function serverRowToClause(row: Record<string, unknown>): Clause {
  return {
    id:                 String(row.id ?? ""),
    title:              String(row.title ?? ""),
    category:           String(row.category ?? "Other"),
    rating:             (row.rating as Clause["rating"]) ?? "balanced",
    riskLevel:          (row.riskLevel as Clause["riskLevel"]) ?? "medium",
    plainEnglish:       String(row.plainEnglish ?? ""),
    originalText:       String(row.originalText ?? ""),
    suggestedText:      row.suggestedText ? String(row.suggestedText) : undefined,
    jurisdictions:      row.jurisdiction ? [String(row.jurisdiction) as any] : [],
    cafeRelevanceScore: Number(row.cafeRelevanceScore ?? 3),
    negotiationScore:   Number(row.negotiationScore ?? 3),
    isSeed:             Boolean(row.isSeed ?? false),
  };
}

const RISK_FILTERS: Array<{ label: string; value: RiskLevel | "all" }> = [
  { label: "All",      value: "all" },
  { label: "Critical", value: "critical" },
  { label: "High",     value: "high" },
  { label: "Medium",   value: "medium" },
  { label: "Low",      value: "low" },
];

const RATING_FILTERS: Array<{ label: string; value: ClauseRating | "all" }> = [
  { label: "All",        value: "all" },
  { label: "Favourable", value: "tenant-friendly" },
  { label: "Balanced",   value: "balanced" },
  { label: "Unfav.",     value: "landlord-friendly" },
];

const CATEGORIES = [
  "All",
  "Rent & Outgoings",
  "Lease Term & Options",
  "Use & Exclusivity",
  "Assignment & Subletting",
  "Make-Good",
  "Services & Infrastructure",
  "Signage & Marketing",
  "Rent Review",
  "Termination & Security",
  "Licence Areas",
  "Incentives",
  "Rent Commencement",
];

export default function ClauseLibrary() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { clauses: localClauses, leases } = useLease();
  // leaseId is passed when navigating from a lease-detail screen
  const { leaseId } = useLocalSearchParams<{ leaseId?: string }>();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [ratingFilter, setRatingFilter] = useState<ClauseRating | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showOnlySeed, setShowOnlySeed] = useState(false);
  const [serverClauses, setServerClauses] = useState<Clause[]>([]);
  const [serverFetched, setServerFetched] = useState(false);

  // Fetch shared master clauses from the server on mount
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/lease-clauses`);
        if (!resp.ok) return;
        const data = await resp.json() as { clauses: Record<string, unknown>[] };
        if (Array.isArray(data.clauses) && data.clauses.length > 0) {
          setServerClauses(data.clauses.map(serverRowToClause));
        }
      } catch { /* offline — seed data used as fallback */ }
      finally { setServerFetched(true); }
    })();
  }, []);

  // When leaseId is provided, find which clause IDs belong to that lease
  const leaseClauseIds = useMemo((): Set<string> | null => {
    if (!leaseId) return null;
    const lease = leases.find(l => l.id === leaseId);
    if (!lease?.extractedClauseIds?.length) return new Set();
    return new Set(lease.extractedClauseIds);
  }, [leaseId, leases]);

  // Merge: seeds first, then unique server clauses, then user-extracted clauses.
  // When leaseId is set, restrict to only that lease's extracted clauses.
  const clauses = useMemo((): Clause[] => {
    const seedIds     = new Set(LEASE_SEED_CLAUSES.map(s => s.id));
    const seedTitles  = new Set(LEASE_SEED_CLAUSES.map(s => s.title.toLowerCase()));
    const serverUniq  = serverClauses.filter(c => !seedTitles.has(c.title.toLowerCase()));
    const userExtracted = localClauses.filter(c => !seedIds.has(c.id) && !c.isSeed);

    if (leaseClauseIds !== null) {
      // Per-lease view: only show that lease's extracted clauses
      return userExtracted.filter(c => leaseClauseIds.has(c.id));
    }
    return [...LEASE_SEED_CLAUSES, ...serverUniq, ...userExtracted];
  }, [localClauses, serverClauses, leaseClauseIds]);

  const serverCount = serverClauses.filter(c =>
    !LEASE_SEED_CLAUSES.some(s => s.title.toLowerCase() === c.title.toLowerCase())
  ).length;

  const filtered = useMemo(() => {
    return clauses.filter(c => {
      if (showOnlySeed && !c.isSeed) return false;
      if (riskFilter !== "all" && c.riskLevel !== riskFilter) return false;
      if (ratingFilter !== "all" && c.rating !== ratingFilter) return false;
      if (categoryFilter !== "All" && c.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.title.toLowerCase().includes(q) && !c.plainEnglish.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [clauses, riskFilter, ratingFilter, categoryFilter, search, showOnlySeed]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {leaseId ? "Analysed Clauses" : "Clause Library"}
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {leaseId
                ? `${filtered.length} of ${clauses.length} clause${clauses.length !== 1 ? "s" : ""} from this lease`
                : `${filtered.length} of ${clauses.length} clauses`}
            </Text>
          </View>
          {/* Hide seed toggle when in per-lease view — all clauses are user-extracted */}
          {!leaseId && (
            <TouchableOpacity
              style={[styles.seedToggle, { backgroundColor: showOnlySeed ? "#1E3A5C" : colors.card, borderColor: showOnlySeed ? "#3B82F6" : colors.border }]}
              onPress={() => setShowOnlySeed(s => !s)}
            >
              <Feather name="star" size={12} color={showOnlySeed ? "#3B82F6" : colors.mutedForeground} />
              <Text style={[styles.seedToggleText, { color: showOnlySeed ? "#3B82F6" : colors.mutedForeground }]}>Templates</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Server clause indicator — only shown in global library view */}
        {!leaseId && serverFetched && serverCount > 0 && (
          <View style={[styles.serverBanner, { backgroundColor: "#052E16", borderColor: "#16A34A40" }]}>
            <Feather name="cloud" size={12} color="#16A34A" />
            <Text style={[styles.serverBannerText, { color: "#86EFAC" }]}>
              {serverCount} community clause{serverCount !== 1 ? "s" : ""} loaded from shared library
            </Text>
          </View>
        )}

        {/* Search */}
        <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search clauses…"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Risk filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {RISK_FILTERS.map(f => (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterChip, { borderColor: riskFilter === f.value ? "#3B82F6" : colors.border, backgroundColor: riskFilter === f.value ? "#1E3A5C" : colors.card }]}
                onPress={() => setRiskFilter(f.value)}
              >
                <Text style={[styles.filterText, { color: riskFilter === f.value ? "#93C5FD" : colors.mutedForeground }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Rating filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {RATING_FILTERS.map(f => (
              <TouchableOpacity
                key={f.value}
                style={[styles.filterChip, { borderColor: ratingFilter === f.value ? "#8B5CF6" : colors.border, backgroundColor: ratingFilter === f.value ? "#2D1B69" : colors.card }]}
                onPress={() => setRatingFilter(f.value)}
              >
                <Text style={[styles.filterText, { color: ratingFilter === f.value ? "#C4B5FD" : colors.mutedForeground }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, { borderColor: categoryFilter === cat ? "#F59E0B" : colors.border, backgroundColor: categoryFilter === cat ? "#431407" : colors.card }]}
                onPress={() => setCategoryFilter(cat)}
              >
                <Text style={[styles.filterText, { color: categoryFilter === cat ? "#FCD34D" : colors.mutedForeground }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Clauses */}
        {filtered.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No clauses match your filters</Text>
          </View>
        ) : (
          filtered.map(clause => {
            // Server-only clauses (not in local AsyncStorage or seed data) carry their
            // data as a JSON param so clause-detail can render them without a local lookup.
            const isLocalOrSeed =
              LEASE_SEED_CLAUSES.some(s => s.id === clause.id) ||
              localClauses.some(c => c.id === clause.id);
            return (
              <ClauseCard
                key={clause.id}
                clause={clause}
                onPress={() =>
                  router.push({
                    pathname: "/(seller)/leases/clause-detail/[id]",
                    params: {
                      id: clause.id,
                      ...(isLocalOrSeed ? {} : { clauseJson: JSON.stringify(clause) }),
                    },
                  } as any)
                }
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  scroll:         { paddingHorizontal: 16, gap: 12 },
  headerRow:      { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:        { padding: 4 },
  title:          { fontSize: 20, fontFamily: "Inter_700Bold" },
  sub:            { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  seedToggle:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  seedToggleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  serverBanner:     { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 10, borderWidth: 1 },
  serverBannerText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  searchRow:      { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 10, borderWidth: 1 },
  searchInput:    { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  filterRow:      { flexDirection: "row", gap: 8, paddingRight: 16 },
  filterChip:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterText:     { fontSize: 12, fontFamily: "Inter_500Medium" },
  emptyCard:      { borderRadius: 14, padding: 32, borderWidth: 1, alignItems: "center", gap: 10 },
  emptyText:      { fontSize: 14, fontFamily: "Inter_400Regular" },
});
