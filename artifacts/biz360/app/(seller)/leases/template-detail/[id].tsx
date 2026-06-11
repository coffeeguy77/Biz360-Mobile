import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { ClauseCard } from "@/components/lease/ClauseCard";
import type { Clause } from "@/context/leaseTypes";

const domain   = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

interface TemplateDetail {
  id:              string;
  name:            string;
  jurisdiction:    string | null;
  leaseType:       string | null;
  premisesType:    string | null;
  isMaster:        boolean;
  templateContent: string;
  variableMap:     Record<string, string>;
  createdAt:       string | null;
}

const JURISDICTION_COLORS: Record<string, string> = {
  NSW: "#3B82F6", VIC: "#8B5CF6", QLD: "#F59E0B", WA: "#10B981",
  SA:  "#EF4444", TAS: "#06B6D4", ACT: "#EC4899", NT: "#F97316",
};

const VARIABLE_LABELS: Record<string, string> = {
  TENANT_NAME:     "Tenant Name",
  LANDLORD_NAME:   "Landlord Name",
  BUSINESS_NAME:   "Business / Trading Name",
  PREMISES_ADDRESS:"Premises Address",
  LEASE_DATE:      "Lease Commencement Date",
  RENT_AMOUNT:     "Rent Amount",
  LEASE_TERM:      "Lease Term",
  TENANT_ABN:      "Tenant ABN",
};

function VariableRow({ varKey, value }: { varKey: string; value: string }) {
  const colors = useColors();
  const label = VARIABLE_LABELS[varKey] ?? varKey.replace(/_/g, " ");
  return (
    <View style={[varStyles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={varStyles.keyCol}>
        <Text style={[varStyles.key, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[varStyles.placeholder, { color: "#3B82F6" }]}>{`{{${varKey}}}`}</Text>
      </View>
      <Text style={[varStyles.value, { color: colors.foreground }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const varStyles = StyleSheet.create({
  row:         { borderRadius: 10, padding: 12, borderWidth: 1, gap: 4 },
  keyCol:      { flexDirection: "row", alignItems: "center", gap: 8 },
  key:         { fontSize: 11, fontFamily: "Inter_400Regular" },
  placeholder: { fontSize: 10, fontFamily: "Inter_500Medium" },
  value:       { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});

export default function TemplateDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [clauses,  setClauses]  = useState<Clause[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const authToken = await AsyncStorage.getItem("biz360_auth_token");
        const resp = await fetch(`${API_BASE}/api/lease-templates/${id}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        if (!resp.ok) throw new Error(`Server error ${resp.status}`);
        const data = await resp.json() as { template: TemplateDetail };
        const tpl = data.template;
        setTemplate(tpl);

        // Parse clause list from templateContent (JSON array of clause objects)
        try {
          const rawClauses = JSON.parse(tpl.templateContent) as Array<Record<string, unknown>>;
          const mapped: Clause[] = rawClauses.map((c, i) => ({
            id:                 `tpl-${tpl.id}-${i}`,
            title:              String(c.title ?? "Clause"),
            category:           String(c.category ?? "Other"),
            rating:             (c.rating as Clause["rating"]) ?? "balanced",
            riskLevel:          (c.riskLevel as Clause["riskLevel"]) ?? "medium",
            plainEnglish:       String(c.plainEnglish ?? ""),
            originalText:       String(c.originalText ?? ""),
            suggestedText:      c.suggestedText ? String(c.suggestedText) : undefined,
            jurisdictions:      tpl.jurisdiction ? [tpl.jurisdiction as any] : [],
            cafeRelevanceScore: Number(c.cafeRelevanceScore ?? 3),
            negotiationScore:   Number(c.negotiationScore ?? 3),
          }));
          setClauses(mapped);
        } catch { /* non-critical */ }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load template");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleUseTemplate = () => {
    if (!template) return;
    const jurisdiction = template.jurisdiction;

    const proceed = () => {
      router.push({
        pathname: "/(seller)/leases/builder",
        params:   jurisdiction ? { jurisdiction, leaseType: template.leaseType ?? undefined } : {},
      } as any);
    };

    if (jurisdiction) {
      Alert.alert(
        "Jurisdiction Notice",
        `This template was extracted from a ${jurisdiction} lease. Make sure this matches your business location before generating a draft.\n\nDo you want to continue?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: proceed },
        ],
      );
    } else {
      proceed();
    }
  };

  const variableEntries = template ? Object.entries(template.variableMap ?? {}) : [];
  const jurColor = template?.jurisdiction ? (JURISDICTION_COLORS[template.jurisdiction] ?? "#6B7280") : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 100) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.screenLabel, { color: colors.mutedForeground }]}>Template</Text>
        </View>

        {loading ? (
          <View style={styles.centred}>
            <ActivityIndicator color="#3B82F6" />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading template…</Text>
          </View>
        ) : error ? (
          <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="alert-circle" size={28} color="#EF4444" />
            <Text style={[styles.errorText, { color: colors.foreground }]}>{error}</Text>
            <TouchableOpacity style={[styles.backLink]} onPress={() => router.back()}>
              <Text style={{ color: "#3B82F6", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : template ? (
          <>
            {/* Title card */}
            <View style={[styles.titleCard, { backgroundColor: "#0F1F35", borderColor: "#1E3A5C" }]}>
              <View style={[styles.titleIcon, { backgroundColor: "#1E3A5C" }]}>
                <Feather name="file-text" size={22} color="#3B82F6" />
              </View>
              <Text style={[styles.title, { color: colors.foreground }]}>{template.name}</Text>
              <View style={styles.badgeRow}>
                {jurColor && (
                  <View style={[styles.badge, { backgroundColor: jurColor + "22", borderColor: jurColor + "55" }]}>
                    <Text style={[styles.badgeText, { color: jurColor }]}>{template.jurisdiction}</Text>
                  </View>
                )}
                {template.leaseType && (
                  <View style={[styles.badge, { backgroundColor: "#1E3A5C", borderColor: "#3B82F640" }]}>
                    <Text style={[styles.badgeText, { color: "#93C5FD" }]}>{template.leaseType}</Text>
                  </View>
                )}
                {template.isMaster && (
                  <View style={[styles.badge, { backgroundColor: "#431407", borderColor: "#F59E0B40" }]}>
                    <Feather name="star" size={9} color="#F59E0B" />
                    <Text style={[styles.badgeText, { color: "#F59E0B" }]}>Master</Text>
                  </View>
                )}
              </View>
              {template.createdAt && (
                <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                  Added {new Date(template.createdAt).toLocaleDateString("en-AU")}
                </Text>
              )}
            </View>

            {/* Variables */}
            {variableEntries.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Template Variables</Text>
                  <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                    Extracted from the original document
                  </Text>
                </View>
                <View style={styles.variableList}>
                  {variableEntries.map(([k, v]) => (
                    <VariableRow key={k} varKey={k} value={v} />
                  ))}
                </View>
              </>
            )}

            {/* Clauses */}
            {clauses.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Included Clauses ({clauses.length})
                  </Text>
                  <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                    Clauses extracted from this lease
                  </Text>
                </View>
                {clauses.map(c => (
                  <ClauseCard key={c.id} clause={c} />
                ))}
              </>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Use Template CTA */}
      {!loading && !error && template && (
        <View style={[styles.ctaBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: "#2563EB" }]}
            onPress={handleUseTemplate}
            activeOpacity={0.85}
          >
            <Feather name="edit-3" size={16} color="#fff" />
            <Text style={styles.ctaBtnText}>Use This Template</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 16, gap: 16 },
  headerRow:    { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:      { padding: 4 },
  screenLabel:  { fontSize: 13, fontFamily: "Inter_400Regular" },
  centred:      { alignItems: "center", gap: 10, paddingVertical: 60 },
  loadingText:  { fontSize: 13, fontFamily: "Inter_400Regular" },
  errorCard:    { borderRadius: 14, padding: 24, borderWidth: 1, alignItems: "center", gap: 10 },
  errorText:    { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  backLink:     { marginTop: 4 },
  titleCard:    { borderRadius: 16, padding: 18, borderWidth: 1, gap: 10, alignItems: "flex-start" },
  titleIcon:    { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title:        { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 22 },
  badgeRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge:        { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  badgeText:    { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  dateText:     { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionHeader:{ gap: 2 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionSub:   { fontSize: 12, fontFamily: "Inter_400Regular" },
  variableList: { gap: 8 },
  ctaBar:       { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: Platform.OS === "ios" ? 32 : 16, borderTopWidth: 1 },
  ctaBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16 },
  ctaBtnText:   { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
