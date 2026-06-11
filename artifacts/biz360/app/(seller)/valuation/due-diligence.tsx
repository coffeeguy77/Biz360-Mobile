import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem("biz360_auth_token");
}

type AccessLevel = "all" | "verified_buyer" | "nda_signed";

interface DocumentItem {
  key: string;
  label: string;
  description: string;
  category: string;
  available: boolean;
  accessLevel: AccessLevel;
  notes: string;
  fileLink: string;
}

const DEFAULT_DOCUMENTS: Omit<DocumentItem, "available" | "accessLevel" | "notes" | "fileLink">[] = [
  { key: "financials_3yr",         label: "3 Years Financial Statements",    description: "Profit & loss, balance sheet, cash flow",       category: "Financial" },
  { key: "tax_returns_3yr",        label: "3 Years Tax Returns",             description: "Business tax returns signed by accountant",     category: "Financial" },
  { key: "bgl_report",             label: "BGL / Xero Reconciliation",       description: "Source-of-truth accounting report",             category: "Financial" },
  { key: "pos_sales_data",         label: "POS Sales Data (12 months)",      description: "Square, Lightspeed or equivalent export",       category: "Financial" },
  { key: "supplier_invoices",      label: "Key Supplier Invoices",           description: "Top 5 suppliers, last 12 months",               category: "Financial" },
  { key: "lease_agreement",        label: "Lease Agreement",                 description: "Current signed lease and any renewals",         category: "Legal" },
  { key: "lease_disclosure",       label: "Lease Disclosure Statement",      description: "Required under franchise & retail legislation",  category: "Legal" },
  { key: "business_registration",  label: "Business Registration",          description: "ABN/ACN registration documents",                category: "Legal" },
  { key: "franchise_agreement",    label: "Franchise Agreement (if any)",   description: "Signed franchise disclosure & agreement",       category: "Legal" },
  { key: "employment_contracts",   label: "Employment Contracts",            description: "Current contracts for all staff",               category: "Legal" },
  { key: "equipment_list",         label: "Equipment List",                  description: "Valuation report or itemised list with values", category: "Assets" },
  { key: "ip_trademarks",          label: "IP / Trademarks",                 description: "Any registered IP, trademarks, or licences",   category: "Assets" },
  { key: "fitout_condition",       label: "Fitout Condition Report",         description: "Photos or inspection report for premises",      category: "Assets" },
  { key: "licenses_permits",       label: "Licences & Permits",              description: "Food handling, liquor, council permits",        category: "Compliance" },
  { key: "council_approvals",      label: "Council Approvals & DA",          description: "Development approvals, building certificates",  category: "Compliance" },
  { key: "insurance_policies",     label: "Insurance Policies",              description: "Public liability, assets, workers comp",        category: "Compliance" },
  { key: "staff_summary",          label: "Staff & Roster Summary",          description: "Headcount, roles, hours, entitlements",         category: "Operations" },
  { key: "supplier_contracts",     label: "Supplier & Service Contracts",   description: "Ongoing service and supply agreements",         category: "Operations" },
  { key: "customer_data",          label: "Customer Data / CRM Export",     description: "Loyalty programme or mailing list summary",     category: "Operations" },
  { key: "sop_manuals",            label: "SOPs & Training Manuals",         description: "Documented processes for daily operations",     category: "Operations" },
];

const CATEGORIES = ["Financial", "Legal", "Assets", "Compliance", "Operations"];

const ACCESS_LABELS: Record<AccessLevel, string> = {
  all: "All Buyers",
  verified_buyer: "Verified Buyer",
  nda_signed: "NDA Signed",
};

const ACCESS_COLORS: Record<AccessLevel, string> = {
  all: "#16A34A",
  verified_buyer: "#3B82F6",
  nda_signed: "#A78BFA",
};

const SECTION_KEY = "due_diligence_documents_available";

function initDocuments(saved: Record<string, Partial<DocumentItem>> | null): DocumentItem[] {
  return DEFAULT_DOCUMENTS.map((def) => {
    const s = saved?.[def.key];
    return {
      ...def,
      available: s?.available ?? false,
      accessLevel: s?.accessLevel ?? "nda_signed",
      notes: s?.notes ?? "",
      fileLink: s?.fileLink ?? "",
    };
  });
}

export default function DueDiligenceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe } = useValuation();
  const [documents, setDocuments] = useState<DocumentItem[]>(initDocuments(null));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editNoteKey, setEditNoteKey] = useState<string | null>(null);
  const [editAccess, setEditAccess] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Financial");

  const listingId = selectedCafe?.listingId ?? selectedCafe?.listing_id;

  const loadData = useCallback(async () => {
    if (!listingId) return;
    const token = await getAuthToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/report-sections/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const sections = data.sections ?? [];
        const ddSection = sections.find((s: { sectionKey: string }) => s.sectionKey === SECTION_KEY);
        if (ddSection) {
          setSectionId(ddSection.id);
          try {
            const parsed = JSON.parse(ddSection.body ?? "{}") as Record<string, Partial<DocumentItem>>;
            setDocuments(initDocuments(parsed));
          } catch {
            setDocuments(initDocuments(null));
          }
        } else {
          setSectionId(null);
          setDocuments(initDocuments(null));
        }
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [listingId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleSave() {
    if (!listingId) return;
    const token = await getAuthToken();
    if (!token) return;
    setSaving(true);
    try {
      const payload: Record<string, Omit<DocumentItem, "key" | "label" | "description" | "category">> = {};
      documents.forEach((d) => {
        payload[d.key] = { available: d.available, accessLevel: d.accessLevel, notes: d.notes, fileLink: d.fileLink };
      });
      const bodyJson = JSON.stringify(payload);
      const available = documents.filter((d) => d.available).length;
      const total = documents.length;

      if (sectionId) {
        const res = await fetch(`${API_BASE}/api/report-sections/${sectionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ body: bodyJson, subtitle: `${available} of ${total} documents available` }),
        });
        if (!res.ok) { Alert.alert("Error", "Failed to save checklist"); return; }
      } else {
        const res = await fetch(`${API_BASE}/api/report-sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            listingId,
            sectionKey: SECTION_KEY,
            title: "Due Diligence Pack",
            subtitle: `${available} of ${total} documents available`,
            body: bodyJson,
            visibility: "nda_signed",
            includeInPdf: true,
            includeInApp: true,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setSectionId(data.section?.id ?? null);
        } else {
          Alert.alert("Error", "Failed to save checklist");
          return;
        }
      }
      Alert.alert("Saved", `Due diligence pack updated. ${available} of ${total} documents marked available.`);
    } catch { Alert.alert("Error", "Network error. Please try again."); }
    finally { setSaving(false); }
  }

  function toggleAvailable(key: string) {
    setDocuments((prev) => prev.map((d) => d.key === key ? { ...d, available: !d.available } : d));
  }

  function setAccess(key: string, level: AccessLevel) {
    setDocuments((prev) => prev.map((d) => d.key === key ? { ...d, accessLevel: level } : d));
    setEditAccess(null);
  }

  function setNotes(key: string, notes: string) {
    setDocuments((prev) => prev.map((d) => d.key === key ? { ...d, notes } : d));
  }

  function setFileLink(key: string, fileLink: string) {
    setDocuments((prev) => prev.map((d) => d.key === key ? { ...d, fileLink } : d));
  }

  const filteredDocs = documents.filter((d) => d.category === activeCategory);
  const totalAvailable = documents.filter((d) => d.available).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Due Diligence Pack</Text>
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
        </View>

        {/* Summary card */}
        <View style={[styles.summaryCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Documents Available</Text>
              <Text style={styles.summaryVal}>{totalAvailable} / {documents.length}</Text>
            </View>
            <View style={[styles.progressBg, { flex: 1, marginLeft: 16 }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round((totalAvailable / documents.length) * 100)}%` as any,
                    backgroundColor: totalAvailable >= 15 ? "#16A34A" : totalAvailable >= 8 ? "#F59E0B" : "#3B82F6",
                  },
                ]}
              />
            </View>
          </View>
          <Text style={styles.summaryHint}>
            Mark each document as available and set who can see it. This checklist appears in the buyer's due diligence view.
          </Text>
        </View>

        {/* Category tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATEGORIES.map((cat) => {
            const catDocs = documents.filter((d) => d.category === cat);
            const catAvail = catDocs.filter((d) => d.available).length;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, activeCategory === cat && { backgroundColor: colors.primary }]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[styles.catText, activeCategory === cat && { color: "#fff" }]}>
                  {cat} {catAvail > 0 ? `(${catAvail}/${catDocs.length})` : ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Document cards */}
        {filteredDocs.map((doc) => (
          <View key={doc.key} style={[styles.docCard, { backgroundColor: colors.card, borderColor: doc.available ? colors.primary + "60" : colors.border }]}>
            <TouchableOpacity style={styles.docTop} onPress={() => toggleAvailable(doc.key)}>
              <View style={[styles.checkbox, { borderColor: doc.available ? colors.primary : colors.border, backgroundColor: doc.available ? colors.primary : "transparent" }]}>
                {doc.available && <Feather name="check" size={12} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.docLabel, { color: colors.foreground }]}>{doc.label}</Text>
                <Text style={[styles.docDesc, { color: colors.mutedForeground }]}>{doc.description}</Text>
              </View>
            </TouchableOpacity>

            {doc.available && (
              <View style={[styles.docExtra, { borderTopColor: colors.border }]}>
                {/* Access level */}
                <View style={styles.docExtraRow}>
                  <Text style={[styles.docExtraLabel, { color: colors.mutedForeground }]}>Access</Text>
                  <TouchableOpacity
                    style={[styles.accessChip, { backgroundColor: ACCESS_COLORS[doc.accessLevel] + "22" }]}
                    onPress={() => setEditAccess(editAccess === doc.key ? null : doc.key)}
                  >
                    <View style={[styles.accessDot, { backgroundColor: ACCESS_COLORS[doc.accessLevel] }]} />
                    <Text style={[styles.accessLabel, { color: ACCESS_COLORS[doc.accessLevel] }]}>{ACCESS_LABELS[doc.accessLevel]}</Text>
                    <Feather name="chevron-down" size={12} color={ACCESS_COLORS[doc.accessLevel]} />
                  </TouchableOpacity>
                </View>

                {editAccess === doc.key && (
                  <View style={[styles.accessDropdown, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    {(Object.keys(ACCESS_LABELS) as AccessLevel[]).map((level) => (
                      <TouchableOpacity
                        key={level}
                        style={[styles.accessOption, { borderBottomColor: colors.border }]}
                        onPress={() => setAccess(doc.key, level)}
                      >
                        <View style={[styles.accessDot, { backgroundColor: ACCESS_COLORS[level] }]} />
                        <Text style={[styles.accessLabel, { color: colors.foreground }]}>{ACCESS_LABELS[level]}</Text>
                        {doc.accessLevel === level && <Feather name="check" size={13} color={ACCESS_COLORS[level]} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* File link */}
                <View style={styles.docExtraRow}>
                  <Text style={[styles.docExtraLabel, { color: colors.mutedForeground }]}>File link</Text>
                </View>
                <TextInput
                  style={[styles.fileLinkInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={doc.fileLink}
                  onChangeText={(t) => setFileLink(doc.key, t)}
                  placeholder="https://drive.google.com/… (optional)"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                {/* Notes */}
                {editNoteKey === doc.key ? (
                  <TextInput
                    style={[styles.notesInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={doc.notes}
                    onChangeText={(t) => setNotes(doc.key, t)}
                    placeholder="e.g. Available on request, last updated June 2026"
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    autoFocus
                    onBlur={() => setEditNoteKey(null)}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.notesBtn}
                    onPress={() => setEditNoteKey(doc.key)}
                  >
                    <Feather name="message-square" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.notesText, { color: doc.notes ? colors.foreground : colors.mutedForeground }]}>
                      {doc.notes || "Add note…"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ))}

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, { opacity: saving ? 0.6 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="save" size={16} color="#fff" />}
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Checklist"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  scroll:         { paddingHorizontal: 16, gap: 12 },
  header:         { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:        { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:          { fontSize: 22, fontFamily: "Inter_700Bold", flex: 1 },
  summaryCard:    { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  summaryRow:     { flexDirection: "row", alignItems: "center" },
  summaryLabel:   { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  summaryVal:     { color: "#3B82F6", fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 2 },
  summaryHint:    { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  progressBg:     { height: 8, borderRadius: 4, backgroundColor: "#1E3A5C", overflow: "hidden" },
  progressFill:   { height: 8, borderRadius: 4 },
  catRow:         { gap: 8, paddingBottom: 2 },
  catChip:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1E3A5C" },
  catText:        { fontSize: 13, fontFamily: "Inter_500Medium", color: "#8B9CB8" },
  docCard:        { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  docTop:         { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  checkbox:       { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  docLabel:       { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  docDesc:        { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 },
  docExtra:       { paddingHorizontal: 14, paddingBottom: 12, paddingTop: 10, borderTopWidth: 1, gap: 10 },
  docExtraRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  docExtraLabel:  { fontSize: 12, fontFamily: "Inter_500Medium" },
  accessChip:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  accessDot:      { width: 7, height: 7, borderRadius: 4 },
  accessLabel:    { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  accessDropdown: { borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  accessOption:   { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1 },
  fileLinkInput:  { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontFamily: "Inter_400Regular" },
  notesBtn:       { flexDirection: "row", alignItems: "center", gap: 6 },
  notesText:      { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  notesInput:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontFamily: "Inter_400Regular", minHeight: 60 },
  saveBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#2563EB", paddingVertical: 16, borderRadius: 14 },
  saveBtnText:    { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
