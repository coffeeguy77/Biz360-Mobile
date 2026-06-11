import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLease } from "@/context/LeaseContext";
import { LeaseCard } from "@/components/lease/LeaseCard";
import { RiskBadge } from "@/components/lease/RiskBadge";
import { DisclaimerBanner } from "@/components/lease/DisclaimerBanner";
import { PortfolioInsights } from "@/components/lease/PortfolioInsights";

const ACTIONS = [
  { icon: "upload-cloud", label: "Upload & Analyse",   route: "/(seller)/leases/upload",    color: "#3B82F6", bg: "#1E3A5C" },
  { icon: "book-open",    label: "Clause Library",     route: "/(seller)/leases/library",   color: "#8B5CF6", bg: "#2D1B69" },
  { icon: "edit-3",       label: "Lease Builder",      route: "/(seller)/leases/builder",   color: "#F59E0B", bg: "#431407" },
  { icon: "file-text",    label: "My Drafts",          route: "/(seller)/leases/reports",   color: "#16A34A", bg: "#052E16" },
  { icon: "copy",         label: "Templates",          route: "/(seller)/leases/templates", color: "#EC4899", bg: "#4A0020" },
] as const;

export default function LeasesHub() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { leases, clauses, drafts, deleteLease } = useLease();
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(useCallback(() => { setRefreshKey(k => k + 1); }, []));

  const handleDelete = (id: string) => {
    Alert.alert("Delete Lease", "Remove this lease and its analysis?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteLease(id) },
    ]);
  };

  // Count clauses that are actually associated with existing leases, not orphaned ones.
  const userClauseCount = leases.reduce((sum, l) => sum + (l.extractedClauseIds?.length ?? 0), 0);

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
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Leases</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>AI-powered lease analysis & tools</Text>
          </View>
          <TouchableOpacity
            style={[styles.uploadBtn, { backgroundColor: "#2563EB" }]}
            onPress={() => router.push("/(seller)/leases/upload" as any)}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.uploadBtnText}>Upload</Text>
          </TouchableOpacity>
        </View>

        {/* Stats strip */}
        <View style={[styles.statsRow, { backgroundColor: "#0F1F35", borderColor: "#1E3A5C" }]}>
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.foreground }]}>{leases.length}</Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Leases</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: "#1E3A5C" }]} />
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: "#93C5FD" }]}>{userClauseCount}</Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Clauses</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: "#1E3A5C" }]} />
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: "#86EFAC" }]}>{drafts.length}</Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Drafts</Text>
          </View>
        </View>

        {/* Portfolio Insights — shown when ≥1 lease has been analysed */}
        <PortfolioInsights leases={leases} clauses={clauses} />

        {/* Quick Actions */}
        <View style={styles.actionsGrid}>
          {ACTIONS.map(action => (
            <TouchableOpacity
              key={action.label}
              style={[styles.actionCard, { backgroundColor: action.bg, borderColor: action.color + "40" }]}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.color + "22" }]}>
                <Feather name={action.icon as any} size={20} color={action.color} />
              </View>
              <Text style={[styles.actionLabel, { color: "#fff" }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Featured seed clause */}
        <View style={[styles.featuredCard, { backgroundColor: "#0F1F35", borderColor: "#1E3A5C" }]}>
          <View style={styles.featuredHeader}>
            <Feather name="star" size={14} color="#F59E0B" />
            <Text style={[styles.featuredLabel, { color: "#F59E0B" }]}>Clause of the Day</Text>
          </View>
          <Text style={styles.featuredTitle}>Café Exclusivity Clause</Text>
          <Text style={[styles.featuredText, { color: "#8B9CB8" }]}>
            Prevents the landlord from leasing any other space to a competing café. Critical for protecting foot traffic in office buildings and shopping centres.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(seller)/leases/library" as any)}
            style={styles.featuredBtn}
          >
            <Text style={[styles.featuredBtnText, { color: "#3B82F6" }]}>View in Library →</Text>
          </TouchableOpacity>
        </View>

        {/* My Leases */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Leases</Text>
          {leases.length > 0 && (
            <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>{leases.length}</Text>
          )}
        </View>

        {leases.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="upload-cloud" size={28} color="#3B82F6" />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No leases yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Upload a PDF or Word lease document and our AI will analyse it for risks, tenant protections, and improvement suggestions.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: "#2563EB" }]}
              onPress={() => router.push("/(seller)/leases/upload" as any)}
            >
              <Text style={styles.emptyBtnText}>Upload Lease</Text>
            </TouchableOpacity>
          </View>
        ) : (
          leases.map(lease => (
            <LeaseCard
              key={lease.id}
              lease={lease}
              onPress={() => router.push({ pathname: "/(seller)/leases/lease-detail/[id]", params: { id: lease.id } } as any)}
              onDelete={() => handleDelete(lease.id)}
            />
          ))
        )}

        {/* Drafts section */}
        {drafts.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Drafts</Text>
              <TouchableOpacity onPress={() => router.push("/(seller)/leases/reports" as any)}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>
            {drafts.slice(0, 2).map(draft => (
              <TouchableOpacity
                key={draft.id}
                style={[styles.draftCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: "/(seller)/leases/draft-detail/[id]", params: { id: draft.id } } as any)}
                activeOpacity={0.85}
              >
                <View style={[styles.draftIcon, { backgroundColor: "#052E16" }]}>
                  <Feather name="edit-3" size={16} color="#16A34A" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.draftName, { color: colors.foreground }]} numberOfLines={1}>{draft.name}</Text>
                  <Text style={[styles.draftMeta, { color: colors.mutedForeground }]}>
                    {draft.jurisdiction} · {new Date(draft.createdAt).toLocaleDateString("en-AU")}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </>
        )}

        <DisclaimerBanner text="Lease analysis is for informational purposes only. Always seek independent legal advice before signing or negotiating any commercial lease." />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  scroll:         { paddingHorizontal: 16, gap: 16 },
  headerRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title:          { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub:            { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  uploadBtn:      { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  uploadBtnText:  { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statsRow:       { flexDirection: "row", borderRadius: 14, padding: 14, borderWidth: 1, justifyContent: "space-between" },
  stat:           { alignItems: "center", flex: 1, gap: 2 },
  statVal:        { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLbl:        { fontSize: 11, fontFamily: "Inter_400Regular" },
  statDivider:    { width: 1, alignSelf: "stretch" },
  actionsGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionCard:     { width: "47.5%", padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  actionIcon:     { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionLabel:    { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  featuredCard:   { borderRadius: 14, padding: 16, borderWidth: 1, gap: 8 },
  featuredHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  featuredLabel:  { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  featuredTitle:  { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  featuredText:   { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  featuredBtn:    { alignSelf: "flex-start" },
  featuredBtnText:{ fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sectionHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle:   { fontSize: 16, fontFamily: "Inter_700Bold" },
  sectionCount:   { fontSize: 13, fontFamily: "Inter_400Regular" },
  seeAll:         { fontSize: 13, fontFamily: "Inter_500Medium" },
  emptyCard:      { borderRadius: 14, padding: 24, borderWidth: 1, alignItems: "center", gap: 10 },
  emptyTitle:     { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyText:      { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  emptyBtn:       { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 4 },
  emptyBtnText:   { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  draftCard:      { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  draftIcon:      { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  draftName:      { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  draftMeta:      { fontSize: 11, fontFamily: "Inter_400Regular" },
});
