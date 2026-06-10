import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLease } from "@/context/LeaseContext";
import { RiskBadge, RatingBadge } from "@/components/lease/RiskBadge";
import { ScoreBar } from "@/components/lease/ScoreBar";

export default function ClauseDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clauses } = useLease();

  const clause = clauses.find(c => c.id === id);

  if (!clause) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, marginTop: 8, fontFamily: "Inter_400Regular" }}>Clause not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>{clause.title}</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>{clause.category}</Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <RiskBadge level={clause.riskLevel} />
          <RatingBadge rating={clause.rating} />
          {clause.isSeed && (
            <View style={[styles.seedBadge, { backgroundColor: "#431407" }]}>
              <Feather name="star" size={11} color="#F59E0B" />
              <Text style={styles.seedText}>Template</Text>
            </View>
          )}
        </View>

        <View style={[styles.scoresCard, { backgroundColor: "#0F1F35", borderColor: "#1E3A5C" }]}>
          <ScoreBar label="Café Relevance" score={clause.cafeRelevanceScore} color="#3B82F6" />
          <ScoreBar label="Negotiation Priority" score={clause.negotiationScore} color="#F59E0B" />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="info" size={14} color="#93C5FD" />
            <Text style={[styles.sectionTitle, { color: "#93C5FD" }]}>Plain English</Text>
          </View>
          <Text style={[styles.sectionBody, { color: colors.foreground }]}>{clause.plainEnglish}</Text>
        </View>

        {clause.originalText ? (
          <View style={[styles.section, { backgroundColor: "#0F1F35", borderColor: "#1E3A5C" }]}>
            <View style={styles.sectionHeader}>
              <Feather name="file-text" size={14} color="#8B9CB8" />
              <Text style={[styles.sectionTitle, { color: "#8B9CB8" }]}>Original Clause Text</Text>
            </View>
            <Text style={[styles.quoteBody, { color: "#8B9CB8" }]}>{clause.originalText}</Text>
          </View>
        ) : null}

        {clause.suggestedText ? (
          <View style={[styles.section, { backgroundColor: "#052E16", borderColor: "#14532D" }]}>
            <View style={styles.sectionHeader}>
              <Feather name="edit-3" size={14} color="#86EFAC" />
              <Text style={[styles.sectionTitle, { color: "#86EFAC" }]}>Suggested Improvement</Text>
            </View>
            <Text style={[styles.quoteBody, { color: "#86EFAC" }]}>{clause.suggestedText}</Text>
          </View>
        ) : null}

        {clause.jurisdictions?.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Feather name="map-pin" size={14} color="#8B9CB8" />
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Applicable Jurisdictions</Text>
            </View>
            <View style={styles.jurisdictionRow}>
              {clause.jurisdictions.map(j => (
                <View key={j} style={[styles.juriChip, { backgroundColor: "#1E3A5C" }]}>
                  <Text style={styles.juriText}>{j}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
          This analysis is for informational purposes only and does not constitute legal advice. Always consult a qualified commercial lease solicitor before signing or negotiating any lease.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  scroll:         { paddingHorizontal: 16, gap: 14 },
  headerRow:      { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  backBtn:        { padding: 4, paddingTop: 2 },
  title:          { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 24 },
  sub:            { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  badgeRow:       { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  seedBadge:      { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  seedText:       { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#F59E0B" },
  scoresCard:     { borderRadius: 14, padding: 14, borderWidth: 1, gap: 12 },
  section:        { borderRadius: 14, padding: 14, borderWidth: 1, gap: 8 },
  sectionHeader:  { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle:   { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionBody:    { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  quoteBody:      { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  jurisdictionRow:{ flexDirection: "row", flexWrap: "wrap", gap: 6 },
  juriChip:       { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  juriText:       { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#93C5FD" },
  disclaimer:     { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16, textAlign: "center" },
});
