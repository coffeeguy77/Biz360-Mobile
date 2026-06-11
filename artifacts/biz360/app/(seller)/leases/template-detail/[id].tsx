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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useLease } from "@/context/LeaseContext";
import type { Clause, DraftLease, DraftSection, Jurisdiction, LeaseType, PremisesType } from "@/context/leaseTypes";

const domain   = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

// AsyncStorage keys for seller business profile
const KEY_SELLER_STATE   = "biz360_seller_state";
const KEY_BUSINESS_NAME  = "biz360_business_name";
const KEY_ABN            = "biz360_abn";
const KEY_BUSINESS_ADDR  = "biz360_business_address";

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

const AU_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];

const VARIABLE_LABELS: Record<string, string> = {
  TENANT_NAME:      "Tenant / Buyer Name",
  LANDLORD_NAME:    "Landlord Name",
  BUSINESS_NAME:    "Business / Trading Name",
  PREMISES_ADDRESS: "Premises Address",
  LEASE_DATE:       "Lease Commencement Date",
  RENT_AMOUNT:      "Rent Amount",
  LEASE_TERM:       "Lease Term",
  TENANT_ABN:       "Tenant ABN",
};

// ─── {{PLACEHOLDER}} highlighter ─────────────────────────────────────────────
function HighlightedText({ text, style }: { text: string; style?: object }) {
  const parts = text.split(/({{[A-Z_]+}})/g);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        /^{{[A-Z_]+}}$/.test(part) ? (
          <Text key={i} style={hlStyles.token}>{part}</Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

const hlStyles = StyleSheet.create({
  token: { color: "#3B82F6", fontFamily: "Inter_600SemiBold" },
});

function applyVariables(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    if (value) result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

export default function TemplateDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();
  const { addDraft } = useLease();

  const [template,    setTemplate]    = useState<TemplateDetail | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [clauses,     setClauses]     = useState<Clause[]>([]);
  const [editedVars,  setEditedVars]  = useState<Record<string, string>>({});
  const [userState,   setUserState]   = useState<string | null>(null);
  const [generating,  setGenerating]  = useState(false);
  const [showClauses, setShowClauses] = useState(false);

  useEffect(() => {
    (async () => {
      // Load seller business profile from AsyncStorage
      const [sellerState, businessName, abn, businessAddr] = await Promise.all([
        AsyncStorage.getItem(KEY_SELLER_STATE),
        AsyncStorage.getItem(KEY_BUSINESS_NAME),
        AsyncStorage.getItem(KEY_ABN),
        AsyncStorage.getItem(KEY_BUSINESS_ADDR),
      ]);
      if (sellerState) setUserState(sellerState);

      try {
        const authToken = await AsyncStorage.getItem("biz360_auth_token");
        const resp = await fetch(`${API_BASE}/api/lease-templates/${id}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        if (!resp.ok) throw new Error(`Server error ${resp.status}`);
        const data = await resp.json() as { template: TemplateDetail };
        const tpl = data.template;
        setTemplate(tpl);

        // Pre-fill variables: start from Claude-extracted variableMap, then overlay seller profile
        const initial: Record<string, string> = { ...(tpl.variableMap ?? {}) };
        if (user?.name)    initial.TENANT_NAME      ||= user.name;
        if (businessName)  initial.BUSINESS_NAME    ||= businessName;
        if (abn)           initial.TENANT_ABN       ||= abn;
        if (businessAddr)  initial.PREMISES_ADDRESS ||= businessAddr;
        setEditedVars(initial);

        try {
          const rawClauses = JSON.parse(tpl.templateContent) as Array<Record<string, unknown>>;
          setClauses(rawClauses.map((c, i) => ({
            id:                 `tpl-${tpl.id}-${i}`,
            title:              String(c.title ?? "Clause"),
            category:           String(c.category ?? "Other"),
            rating:             (c.rating as Clause["rating"]) ?? "balanced",
            riskLevel:          (c.riskLevel as Clause["riskLevel"]) ?? "medium",
            plainEnglish:       String(c.plainEnglish ?? ""),
            originalText:       String(c.originalText ?? ""),
            suggestedText:      c.suggestedText ? String(c.suggestedText) : undefined,
            jurisdictions:      tpl.jurisdiction ? [tpl.jurisdiction as Jurisdiction] : [],
            cafeRelevanceScore: Number(c.cafeRelevanceScore ?? 3),
            negotiationScore:   Number(c.negotiationScore ?? 3),
          })));
        } catch { /* non-critical */ }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load template");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user?.name]);

  const pickState = () => {
    Alert.alert(
      "Your Business State",
      "Select the Australian state or territory where your business operates.",
      [
        ...AU_STATES.map(s => ({
          text: s,
          onPress: async () => {
            setUserState(s);
            await AsyncStorage.setItem(KEY_SELLER_STATE, s);
          },
        })),
        { text: "Cancel", style: "cancel" as const },
      ],
    );
  };

  const generateDraft = async () => {
    if (!template) return;
    setGenerating(true);

    // Persist any updated profile fields the user may have typed
    const updates: Promise<void>[] = [];
    if (editedVars.BUSINESS_NAME)  updates.push(AsyncStorage.setItem(KEY_BUSINESS_NAME, editedVars.BUSINESS_NAME));
    if (editedVars.TENANT_ABN)     updates.push(AsyncStorage.setItem(KEY_ABN,           editedVars.TENANT_ABN));
    if (editedVars.PREMISES_ADDRESS) updates.push(AsyncStorage.setItem(KEY_BUSINESS_ADDR, editedVars.PREMISES_ADDRESS));
    await Promise.all(updates).catch(() => {});

    try {
      const tplJur = template.jurisdiction as Jurisdiction | null;
      const sections: DraftSection[] = clauses.map((c, i) => ({
        id:      `sec-${Date.now()}-${i}`,
        title:   c.title,
        content: applyVariables(c.suggestedText ?? c.originalText, editedVars),
        type:    "special-conditions" as const,
      }));

      const draft: DraftLease = {
        id:                  `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name:                `${editedVars.BUSINESS_NAME || editedVars.TENANT_NAME || "My Business"} — ${template.name}`,
        createdAt:           new Date().toISOString(),
        jurisdiction:        tplJur ?? "NSW",
        leaseType:           (template.leaseType as LeaseType)   ?? "commercial",
        premisesType:        (template.premisesType as PremisesType) ?? "cafe",
        position:            "tenant-friendly",
        rentStructure:       editedVars.RENT_AMOUNT ?? "",
        outgoingsStructure:  "",
        licenceAreas:        [],
        selectedProtections: [],
        sections,
      };

      await addDraft(draft);
      router.replace({ pathname: "/(seller)/leases/draft-detail/[id]", params: { id: draft.id } } as any);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateDraft = () => {
    if (!template) return;
    const tplJur = template.jurisdiction;

    if (tplJur && userState && tplJur !== userState) {
      // Jurisdiction mismatch — show specific mismatch warning
      Alert.alert(
        "Jurisdiction Mismatch",
        `This template was created under ${tplJur} law, but your business operates in ${userState}.\n\nThe legal terms may differ significantly between states. You should seek advice from a ${tplJur} solicitor before using this template.\n\nProceed anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Proceed with Caution", onPress: generateDraft },
        ],
      );
    } else if (tplJur && !userState) {
      // User state not set — ask them to confirm before proceeding
      Alert.alert(
        `Confirm Jurisdiction`,
        `This template was created under ${tplJur} law. Does your business operate in ${tplJur}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "No — set my state",
            onPress: pickState,
          },
          { text: `Yes — I'm in ${tplJur}`, onPress: generateDraft },
        ],
      );
    } else {
      // Jurisdictions match (or template has no jurisdiction) — proceed immediately
      generateDraft();
    }
  };

  const variableKeys = Object.keys(editedVars);
  const jurColor = template?.jurisdiction ? (JURISDICTION_COLORS[template.jurisdiction] ?? "#6B7280") : null;
  const jurisdictionMatch =
    !template?.jurisdiction || !userState || template.jurisdiction === userState;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 110) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
            <TouchableOpacity onPress={() => router.back()}>
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
                  Created {new Date(template.createdAt).toLocaleDateString("en-AU")}
                </Text>
              )}
            </View>

            {/* ── Your business state pill ── */}
            <TouchableOpacity
              style={[
                styles.statePill,
                {
                  backgroundColor: jurisdictionMatch ? "#052E16" : "#431407",
                  borderColor:     jurisdictionMatch ? "#16A34A40" : "#F59E0B40",
                },
              ]}
              onPress={pickState}
              activeOpacity={0.8}
            >
              <Feather
                name={jurisdictionMatch ? "check-circle" : "alert-triangle"}
                size={13}
                color={jurisdictionMatch ? "#16A34A" : "#F59E0B"}
              />
              <Text style={[styles.stateText, { color: jurisdictionMatch ? "#86EFAC" : "#FCD34D" }]}>
                {userState
                  ? jurisdictionMatch
                    ? `Your state: ${userState} — matches template`
                    : `Your state: ${userState} — does not match template (${template.jurisdiction})`
                  : "Tap to set your business state"}
              </Text>
              <Feather name="chevron-right" size={13} color={jurisdictionMatch ? "#86EFAC" : "#FCD34D"} />
            </TouchableOpacity>

            {/* ── Variable fill-in form ── */}
            {variableKeys.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your Business Details</Text>
                  <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                    Edit these — they replace <Text style={{ color: "#3B82F6" }}>{"{{PLACEHOLDERS}}"}</Text> in the draft
                  </Text>
                </View>
                {variableKeys.map(key => (
                  <View key={key} style={[styles.varField, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.varFieldHeader}>
                      <Text style={[styles.varLabel, { color: colors.mutedForeground }]}>
                        {VARIABLE_LABELS[key] ?? key.replace(/_/g, " ")}
                      </Text>
                      <Text style={[styles.varToken, { color: "#3B82F6" }]}>{`{{${key}}}`}</Text>
                    </View>
                    <TextInput
                      style={[styles.varInput, { color: colors.foreground, borderColor: colors.border }]}
                      value={editedVars[key] ?? ""}
                      onChangeText={v => setEditedVars(prev => ({ ...prev, [key]: v }))}
                      placeholder={`Enter ${(VARIABLE_LABELS[key] ?? key).toLowerCase()}…`}
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                ))}
              </>
            )}

            {/* ── Clause preview with {{}} highlighting ── */}
            {clauses.length > 0 && (
              <>
                <TouchableOpacity
                  style={[styles.clauseToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setShowClauses(s => !s)}
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                      Clause Preview ({clauses.length})
                    </Text>
                    <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                      {showClauses ? "Tap to collapse" : "Tap to expand — placeholders highlighted in blue"}
                    </Text>
                  </View>
                  <Feather name={showClauses ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                </TouchableOpacity>

                {showClauses && clauses.map(c => {
                  const previewText = c.suggestedText ?? c.originalText;
                  const isTemplated = /{{[A-Z_]+}}/.test(previewText);
                  return (
                    <View key={c.id} style={[styles.clauseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.clauseTitle, { color: colors.foreground }]}>{c.title}</Text>
                      <Text style={[styles.clauseMeta, { color: colors.mutedForeground }]}>
                        {c.category} · {c.riskLevel} risk
                      </Text>
                      {isTemplated ? (
                        <HighlightedText
                          text={previewText}
                          style={[styles.clauseText, { color: colors.mutedForeground }]}
                        />
                      ) : (
                        <Text style={[styles.clauseText, { color: colors.mutedForeground }]} numberOfLines={4}>
                          {previewText}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Generate Draft CTA */}
      {!loading && !error && template && (
        <View style={[styles.ctaBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: generating ? "#1D4ED8" : "#2563EB" }]}
            onPress={handleGenerateDraft}
            activeOpacity={0.85}
            disabled={generating}
          >
            {generating
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="edit-3" size={16} color="#fff" />
            }
            <Text style={styles.ctaBtnText}>
              {generating ? "Generating Draft…" : "Generate Draft from Template"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  scroll:         { paddingHorizontal: 16, gap: 16 },
  headerRow:      { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:        { padding: 4 },
  screenLabel:    { fontSize: 13, fontFamily: "Inter_400Regular" },
  centred:        { alignItems: "center", gap: 10, paddingVertical: 60 },
  loadingText:    { fontSize: 13, fontFamily: "Inter_400Regular" },
  errorCard:      { borderRadius: 14, padding: 24, borderWidth: 1, alignItems: "center", gap: 10 },
  errorText:      { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  titleCard:      { borderRadius: 16, padding: 18, borderWidth: 1, gap: 10, alignItems: "flex-start" },
  titleIcon:      { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title:          { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 22 },
  badgeRow:       { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge:          { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  badgeText:      { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  dateText:       { fontSize: 11, fontFamily: "Inter_400Regular" },
  statePill:      { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 10, borderWidth: 1 },
  stateText:      { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  sectionHeader:  { gap: 2 },
  sectionTitle:   { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionSub:     { fontSize: 12, fontFamily: "Inter_400Regular" },
  varField:       { borderRadius: 12, padding: 12, borderWidth: 1, gap: 8 },
  varFieldHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  varLabel:       { fontSize: 11, fontFamily: "Inter_400Regular" },
  varToken:       { fontSize: 10, fontFamily: "Inter_500Medium" },
  varInput:       { borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 14, fontFamily: "Inter_500Medium" },
  clauseToggle:   { borderRadius: 12, padding: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  clauseCard:     { borderRadius: 12, padding: 14, borderWidth: 1, gap: 6 },
  clauseTitle:    { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  clauseMeta:     { fontSize: 11, fontFamily: "Inter_400Regular" },
  clauseText:     { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  ctaBar:         { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: Platform.OS === "ios" ? 32 : 16, borderTopWidth: 1 },
  ctaBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16 },
  ctaBtnText:     { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
