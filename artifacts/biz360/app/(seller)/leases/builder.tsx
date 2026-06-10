import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLease } from "@/context/LeaseContext";
import { BuilderState, Jurisdiction, LeaseType, PremisesType, LeasePosition } from "@/context/leaseTypes";
import { generateDraft } from "@/utils/leaseDraftGenerator";

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

const JURISDICTIONS: Jurisdiction[] = ["ACT","NSW","VIC","QLD","SA","WA","TAS","NT"];
const LEASE_TYPES: Array<{ value: LeaseType; label: string }> = [
  { value: "commercial", label: "Commercial" },
  { value: "retail",     label: "Retail" },
  { value: "licence",    label: "Licence" },
  { value: "mixed",      label: "Mixed" },
];
const PREMISES_TYPES: Array<{ value: PremisesType; label: string }> = [
  { value: "cafe",                  label: "Café (General)" },
  { value: "kiosk",                 label: "Kiosk" },
  { value: "restaurant",            label: "Restaurant" },
  { value: "office-foyer-cafe",     label: "Office Foyer Café" },
  { value: "shopping-centre-cafe",  label: "Shopping Centre Café" },
  { value: "street-front-cafe",     label: "Street Front Café" },
  { value: "outdoor-seating-cafe",  label: "Outdoor Seating Café" },
];
const POSITIONS: Array<{ value: LeasePosition; label: string; desc: string }> = [
  { value: "tenant-friendly",   label: "Tenant Friendly",   desc: "Maximum protections — best for negotiation" },
  { value: "balanced",          label: "Balanced",           desc: "Reasonable protections on both sides" },
  { value: "landlord-friendly", label: "Landlord Friendly",  desc: "Use only as a reference" },
];
const LICENCE_AREAS = [
  { key: "outdoor-seating-licence", label: "Outdoor Seating Area" },
  { key: "foyer-licence",           label: "Building Foyer" },
  { key: "storage-licence",         label: "Storage Area" },
  { key: "peppercorn-common-areas", label: "Common Areas" },
];
const TENANT_PROTECTIONS = [
  { key: "rent-reduction-occupancy", label: "Occupancy Rent Reduction",   risk: "high" },
  { key: "rent-abatement-works",     label: "Rent Abatement During Works", risk: "high" },
  { key: "no-rent-approvals",        label: "No Rent Until DA Approved",   risk: "critical" },
  { key: "no-rent-services",         label: "No Rent — No Services",       risk: "critical" },
  { key: "outgoings-cap",            label: "Outgoings Cap",               risk: "medium" },
  { key: "exclude-vacant-outgoings", label: "Exclude Vacant Outgoings",    risk: "medium" },
  { key: "cafe-exclusivity",         label: "Café Exclusivity",            risk: "high" },
  { key: "assignment-purchaser",     label: "Assignment to Buyer",         risk: "medium" },
  { key: "limited-makegood",         label: "Limited Make-Good",           risk: "medium" },
  { key: "option-to-renew",          label: "Option to Renew",             risk: "high" },
  { key: "market-rent-dispute",      label: "Market Rent Dispute",         risk: "medium" },
  { key: "signage-rights",           label: "Signage Rights",              risk: "low" },
  { key: "delivery-access",          label: "24-Hour Delivery Access",     risk: "low" },
  { key: "grease-trap",              label: "Grease Trap — Landlord",      risk: "high" },
  { key: "landlord-base-building",   label: "Landlord Base Building",      risk: "medium" },
  { key: "landlord-maintenance",     label: "Landlord Maintenance",        risk: "medium" },
  { key: "disruption-compensation",  label: "Disruption Compensation",     risk: "high" },
  { key: "termination-approvals",    label: "No Termination — Approvals",  risk: "high" },
];

const RISK_COLORS: Record<string, string> = {
  critical: "#FCA5A5",
  high:     "#FCD34D",
  medium:   "#93C5FD",
  low:      "#86EFAC",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={sectionStyles.container}>
      <Text style={[sectionStyles.title, { color: colors.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}
const sectionStyles = StyleSheet.create({
  container: { gap: 10 },
  title:     { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});

function Chip({ label, selected, onPress, color = "#3B82F6" }: { label: string; selected: boolean; onPress: () => void; color?: string }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[chipStyles.chip, { borderColor: selected ? color : colors.border, backgroundColor: selected ? color + "20" : colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[chipStyles.label, { color: selected ? color : colors.mutedForeground }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const chipStyles = StyleSheet.create({
  chip:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
});

export default function LeaseBuilder() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addDraft } = useLease();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<BuilderState>({
    jurisdiction:        "NSW",
    leaseType:           "commercial",
    premisesType:        "cafe",
    position:            "tenant-friendly",
    rentStructure:       "",
    outgoingsStructure:  "",
    licenceAreas:        [],
    selectedProtections: TENANT_PROTECTIONS.filter(p => ["rent-reduction-occupancy","no-rent-approvals","option-to-renew","limited-makegood","assignment-purchaser","cafe-exclusivity","grease-trap"].includes(p.key)).map(p => p.key),
    occupancyThreshold:  70,
  });

  const toggle = (key: string, field: "licenceAreas" | "selectedProtections") => {
    setState(s => ({
      ...s,
      [field]: s[field].includes(key) ? s[field].filter(k => k !== key) : [...s[field], key],
    }));
  };

  const handleGenerate = async () => {
    const id = genId();
    const draft = generateDraft(state, id);
    await addDraft(draft);
    Alert.alert(
      "Draft Created",
      `"${draft.name}" is ready.`,
      [
        { text: "View Draft", onPress: () => router.push(`draft-detail/${id}` as any) },
        { text: "Done",       onPress: () => router.back() },
      ],
    );
  };

  const steps = [
    { title: "Jurisdiction & Type",   icon: "map-pin" },
    { title: "Premises & Position",   icon: "home" },
    { title: "Licence Areas",         icon: "layers" },
    { title: "Tenant Protections",    icon: "shield" },
    { title: "Rent & Outgoings",      icon: "dollar-sign" },
  ];

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
          <TouchableOpacity onPress={() => { if (step > 0) setStep(s => s - 1); else router.back(); }} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Lease Builder</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>Step {step + 1} of {steps.length}: {steps[step].title}</Text>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressRow}>
          {steps.map((s, i) => (
            <TouchableOpacity key={i} onPress={() => setStep(i)} style={{ flex: 1 }}>
              <View style={[styles.progressBar, { backgroundColor: i <= step ? "#2563EB" : "#1E3A5C" }]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Step 0: Jurisdiction & Type */}
        {step === 0 && (
          <>
            <Section title="Jurisdiction">
              <View style={styles.wrapRow}>
                {JURISDICTIONS.map(j => (
                  <Chip key={j} label={j} selected={state.jurisdiction === j} onPress={() => setState(s => ({ ...s, jurisdiction: j }))} />
                ))}
              </View>
            </Section>
            <Section title="Lease Type">
              <View style={styles.wrapRow}>
                {LEASE_TYPES.map(lt => (
                  <Chip key={lt.value} label={lt.label} selected={state.leaseType === lt.value} onPress={() => setState(s => ({ ...s, leaseType: lt.value }))} color="#8B5CF6" />
                ))}
              </View>
            </Section>
          </>
        )}

        {/* Step 1: Premises & Position */}
        {step === 1 && (
          <>
            <Section title="Premises Type">
              <View style={styles.wrapRow}>
                {PREMISES_TYPES.map(pt => (
                  <Chip key={pt.value} label={pt.label} selected={state.premisesType === pt.value} onPress={() => setState(s => ({ ...s, premisesType: pt.value }))} color="#F59E0B" />
                ))}
              </View>
            </Section>
            <Section title="Drafting Position">
              {POSITIONS.map(pos => (
                <TouchableOpacity
                  key={pos.value}
                  style={[styles.posCard, { borderColor: state.position === pos.value ? "#3B82F6" : colors.border, backgroundColor: state.position === pos.value ? "#1E3A5C" : colors.card }]}
                  onPress={() => setState(s => ({ ...s, position: pos.value }))}
                >
                  <View style={styles.posLeft}>
                    <Text style={[styles.posLabel, { color: state.position === pos.value ? "#93C5FD" : colors.foreground }]}>{pos.label}</Text>
                    <Text style={[styles.posDesc, { color: colors.mutedForeground }]}>{pos.desc}</Text>
                  </View>
                  {state.position === pos.value && <Feather name="check-circle" size={18} color="#3B82F6" />}
                </TouchableOpacity>
              ))}
            </Section>
          </>
        )}

        {/* Step 2: Licence Areas */}
        {step === 2 && (
          <Section title="Licence Areas (peppercorn rent)">
            <Text style={[styles.stepHint, { color: colors.mutedForeground }]}>Select any areas you need licenced. These will be added at peppercorn rent ($1/year).</Text>
            {LICENCE_AREAS.map(la => (
              <TouchableOpacity
                key={la.key}
                style={[styles.checkRow, { borderColor: state.licenceAreas.includes(la.key) ? "#16A34A" : colors.border, backgroundColor: state.licenceAreas.includes(la.key) ? "#052E16" : colors.card }]}
                onPress={() => toggle(la.key, "licenceAreas")}
              >
                <View style={[styles.checkbox, { borderColor: state.licenceAreas.includes(la.key) ? "#16A34A" : "#1E3A5C", backgroundColor: state.licenceAreas.includes(la.key) ? "#16A34A" : "transparent" }]}>
                  {state.licenceAreas.includes(la.key) && <Feather name="check" size={12} color="#fff" />}
                </View>
                <Text style={[styles.checkLabel, { color: colors.foreground }]}>{la.label}</Text>
              </TouchableOpacity>
            ))}
          </Section>
        )}

        {/* Step 3: Tenant Protections */}
        {step === 3 && (
          <Section title={`Tenant Protections (${state.selectedProtections.length} selected)`}>
            <Text style={[styles.stepHint, { color: colors.mutedForeground }]}>Select clauses to include. Recommended protections are pre-selected.</Text>
            {TENANT_PROTECTIONS.map(tp => (
              <TouchableOpacity
                key={tp.key}
                style={[styles.checkRow, { borderColor: state.selectedProtections.includes(tp.key) ? "#3B82F6" : colors.border, backgroundColor: state.selectedProtections.includes(tp.key) ? "#1E3A5C" : colors.card }]}
                onPress={() => toggle(tp.key, "selectedProtections")}
              >
                <View style={[styles.checkbox, { borderColor: state.selectedProtections.includes(tp.key) ? "#3B82F6" : "#1E3A5C", backgroundColor: state.selectedProtections.includes(tp.key) ? "#3B82F6" : "transparent" }]}>
                  {state.selectedProtections.includes(tp.key) && <Feather name="check" size={12} color="#fff" />}
                </View>
                <Text style={[styles.checkLabel, { color: colors.foreground }]}>{tp.label}</Text>
                <View style={[styles.riskPip, { backgroundColor: RISK_COLORS[tp.risk] + "30" }]}>
                  <Text style={[styles.riskPipText, { color: RISK_COLORS[tp.risk] }]}>{tp.risk}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Section>
        )}

        {/* Step 4: Rent & Outgoings */}
        {step === 4 && (
          <>
            <Section title="Rent Structure">
              <TextInput
                style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                multiline
                numberOfLines={3}
                placeholder="e.g. $2,500/week base + annual CPI review, market review at each option"
                placeholderTextColor={colors.mutedForeground}
                value={state.rentStructure}
                onChangeText={v => setState(s => ({ ...s, rentStructure: v }))}
              />
            </Section>
            <Section title="Outgoings Structure">
              <TextInput
                style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                multiline
                numberOfLines={3}
                placeholder="e.g. Gross lease, all outgoings included. OR Net + proportionate share of building outgoings, capped at $15,000/year"
                placeholderTextColor={colors.mutedForeground}
                value={state.outgoingsStructure}
                onChangeText={v => setState(s => ({ ...s, outgoingsStructure: v }))}
              />
            </Section>
            <Section title={`Occupancy Threshold: ${state.occupancyThreshold}%`}>
              <Text style={[styles.stepHint, { color: colors.mutedForeground }]}>Rent reduction triggers if building occupancy falls below this level.</Text>
              <View style={styles.threshRow}>
                {[50, 60, 70, 75, 80].map(t => (
                  <Chip key={t} label={`${t}%`} selected={state.occupancyThreshold === t} onPress={() => setState(s => ({ ...s, occupancyThreshold: t }))} color="#F59E0B" />
                ))}
              </View>
            </Section>
          </>
        )}

        {/* Navigation */}
        <View style={styles.navRow}>
          {step < steps.length - 1 ? (
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: "#2563EB" }]}
              onPress={() => setStep(s => s + 1)}
            >
              <Text style={styles.nextBtnText}>Next: {steps[step + 1].title}</Text>
              <Feather name="arrow-right" size={16} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: "#16A34A" }]}
              onPress={handleGenerate}
            >
              <Feather name="file-text" size={16} color="#fff" />
              <Text style={styles.nextBtnText}>Generate Draft</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  scroll:      { paddingHorizontal: 16, gap: 20 },
  headerRow:   { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:     { padding: 4 },
  title:       { fontSize: 20, fontFamily: "Inter_700Bold" },
  sub:         { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  progressRow: { flexDirection: "row", gap: 4 },
  progressBar: { height: 4, borderRadius: 2 },
  stepHint:    { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  wrapRow:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  posCard:     { borderRadius: 12, padding: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  posLeft:     { flex: 1, gap: 2 },
  posLabel:    { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  posDesc:     { fontSize: 12, fontFamily: "Inter_400Regular" },
  checkRow:    { borderRadius: 12, padding: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  checkbox:    { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  checkLabel:  { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  riskPip:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  riskPipText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  textArea:    { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  threshRow:   { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  navRow:      { marginTop: 4 },
  nextBtn:     { borderRadius: 14, padding: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  nextBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
