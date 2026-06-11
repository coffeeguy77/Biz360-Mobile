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
  const { leaseId } = useLocalSearchParams<{ leaseId?: string }>();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [ratingFilter, setRatingFilter] = useState<ClauseRating | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showOnlySeed, setShowOnlySeed] = useState(false);
  const [serverClauses, setServerClauses] = useState<Clause[]>([]);
  const [serverFetched, setServerFetched] = useState(false);

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

  // Find the lease name for the scope banner
  const scopedLease = useMemo(() => {
    if (!leaseId) return null;
    return leases.find(l => l.id === leaseId) ?? null;
  }, [leaseId, leases]);

  const leaseClauseIds = useMemo((): Set<string> | null => {
    if (!leaseId) return null;
    if (!scopedLease?.extractedClauseIds?.length) return new Set();
    return new Set(scopedLease.extractedClauseIds);
  }, [leaseId, scopedLease]);

  const clauses = useMemo((): Clause[] => {
    const seedIds     = new Set(LEASE_SEED_CLAUSES.map(s => s.id));
    const seedTitles  = new Set(LEASE_SEED_CLAUSES.map(s => s.title.toLowerCase()));
    const serverUniq  = serverClauses.filter(c => !seedTitles.has(c.title.toLowerCase()));
    const userExtracted = localClauses.filter(c => !seedIds.has(c.id) && !c.isSeed);

    if (leaseClauseIds !== null) {
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

  // Pre-compute which filter values would yield 0 results in the current scope.
  // Only computed when in per-lease mode; in the full library we never dim chips.
  const { disabledRisk, disabledRating, disabledCategory } = useMemo(() => {
    if (!leaseId) return { disabledRisk: new Set<string>(), disabledRating: new Set<string>(), disabledCategory: new Set<string>() };

    function passesOtherFilters(c: Clause, skipFilter: "risk" | "rating" | "category"): boolean {
      if (skipFilter !== "risk"     && riskFilter !== "all"     && c.riskLevel !== riskFilter)   return false;
      if (skipFilter !== "rating"   && ratingFilter !== "all"   && c.rating    !== ratingFilter) return false;
      if (skipFilter !== "category" && categoryFilter !== "All" && c.category  !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.title.toLowerCase().includes(q) && !c.plainEnglish.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false;
      }
      return true;
    }

    const disabledRisk = new Set(
      RISK_FILTERS
        .filter(f => f.value !== "all" && !clauses.some(c => c.riskLevel === f.value && passesOtherFilters(c, "risk")))
        .map(f => f.value)
    );

    const disabledRating = new Set(
      RATING_FILTERS
        .filter(f => f.value !== "all" && !clauses.some(c => c.rating === f.value && passesOtherFilters(c, "rating")))
        .map(f => f.value)
    );

    const disabledCategory = new Set(
      CATEGORIES
        .filter(cat => cat !== "All" && !clauses.some(c => c.category === cat && passesOtherFilters(c, "category")))
    );

    return { disabledRisk, disabledRating, disabledCategory };
  }, [leaseId, clauses, riskFilter, ratingFilter, categoryFilter, search]);

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

        {/* Per-lease scope banner */}
        {leaseId && (
          <View style={styles.scopeBanner}>
            <View style={styles.scopeBannerLeft}>
              <Feather name="file-text" size={14} color="#93C5FD" />
              <View style={{ flex: 1 }}>
                <Text style={styles.scopeBannerLabel}>Viewing clauses from</Text>
                <Text style={styles.scopeBannerName} numberOfLines={1}>
                  {scopedLease?.name ?? "this lease"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.scopeBannerLink}
              onPress={() => router.replace("/(seller)/leases/library" as any)}
            >
              <Text style={styles.scopeBannerLinkText}>Full library</Text>
              <Feather name="arrow-right" size={12} color="#93C5FD" />
            </TouchableOpacity>
          </View>
        )}

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
            {RISK_FILTERS.map(f => {
              const isActive   = riskFilter === f.value;
              const isDisabled = leaseId ? (f.value !== "all" && disabledRisk.has(f.value)) : false;
              return (
                <TouchableOpacity
                  key={f.value}
                  disabled={isDisabled}
                  style={[
                    styles.filterChip,
                    {
                      borderColor:     isActive ? "#3B82F6" : colors.border,
                      backgroundColor: isActive ? "#1E3A5C" : colors.card,
                      opacity:         isDisabled ? 0.35 : 1,
                    },
                  ]}
                  onPress={() => setRiskFilter(f.value)}
                >
                  <Text style={[styles.filterText, { color: isActive ? "#93C5FD" : colors.mutedForeground }]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Rating filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {RATING_FILTERS.map(f => {
              const isActive   = ratingFilter === f.value;
              const isDisabled = leaseId ? (f.value !== "all" && disabledRating.has(f.value)) : false;
              return (
                <TouchableOpacity
                  key={f.value}
                  disabled={isDisabled}
                  style={[
                    styles.filterChip,
                    {
                      borderColor:     isActive ? "#8B5CF6" : colors.border,
                      backgroundColor: isActive ? "#2D1B69" : colors.card,
                      opacity:         isDisabled ? 0.35 : 1,
                    },
                  ]}
                  onPress={() => setRatingFilter(f.value)}
                >
                  <Text style={[styles.filterText, { color: isActive ? "#C4B5FD" : colors.mutedForeground }]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {CATEGORIES.map(cat => {
              const isActive   = categoryFilter === cat;
              const isDisabled = leaseId ? (cat !== "All" && disabledCategory.has(cat)) : false;
              return (
                <TouchableOpacity
                  key={cat}
                  disabled={isDisabled}
                  style={[
                    styles.filterChip,
                    {
                      borderColor:     isActive ? "#F59E0B" : colors.border,
                      backgroundColor: isActive ? "#431407" : colors.card,
                      opacity:         isDisabled ? 0.35 : 1,
                    },
                  ]}
                  onPress={() => setCategoryFilter(cat)}
                >
                  <Text style={[styles.filterText, { color: isActive ? "#FCD34D" : colors.mutedForeground }]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
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
                      ...(leaseId ? { leaseId } : {}),
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
  scopeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0F2A4A",
    borderColor: "#1E3A5C",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  scopeBannerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  scopeBannerLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#8B9CB8", marginBottom: 1 },
  scopeBannerName:  { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#E2E8F0" },
  scopeBannerLink:  { flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 8 },
  scopeBannerLinkText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#93C5FD" },
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
