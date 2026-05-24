import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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

const STEPS = ["Basic Info", "Financials", "Contact", "Review"];
const CATEGORIES = ["Food & Beverage", "Health & Beauty", "Services", "Health & Fitness", "Retail", "Professional Services"];
const AU_STATES = ["VIC", "NSW", "QLD", "WA", "SA", "ACT", "TAS", "NT"];

export default function CreateListing() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    businessName: "",
    category: "",
    state: "",
    suburb: "",
    askingPrice: "",
    weeklyRevenue: "",
    adjustedProfit: "",
    rent: "",
    staffCount: "",
    ownerHours: "",
    reasonForSale: "",
    contactPreference: "message",
    confidential: false,
  });

  const update = (key: string, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const submit = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Create Listing</Text>
        <Text style={[styles.stepIndicator, { color: colors.mutedForeground }]}>{step + 1}/{STEPS.length}</Text>
      </View>

      <View style={styles.stepBar}>
        {STEPS.map((s, idx) => (
          <View key={s} style={[styles.stepItem, { backgroundColor: idx <= step ? colors.primary : colors.muted }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>{STEPS[step]}</Text>

        {step === 0 && (
          <View style={styles.fields}>
            {[
              { key: "businessName", label: "Business Name", placeholder: "e.g. The Daily Press Cafe" },
              { key: "suburb", label: "Suburb", placeholder: "e.g. Fitzroy" },
            ].map(({ key, label, placeholder }) => (
              <View key={key} style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder={placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={(form as any)[key]}
                  onChangeText={(v) => update(key, v)}
                />
              </View>
            ))}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
              <View style={styles.chipGrid}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, { backgroundColor: form.category === c ? colors.primary : colors.muted }]}
                    onPress={() => update("category", c)}
                  >
                    <Text style={[styles.chipText, { color: form.category === c ? "#fff" : colors.foreground }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>State</Text>
              <View style={styles.chipGrid}>
                {AU_STATES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, { backgroundColor: form.state === s ? colors.primary : colors.muted }]}
                    onPress={() => update("state", s)}
                  >
                    <Text style={[styles.chipText, { color: form.state === s ? "#fff" : colors.foreground }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.toggleRow, { backgroundColor: form.confidential ? colors.primary + "18" : colors.card, borderColor: form.confidential ? colors.primary : colors.border }]}
              onPress={() => update("confidential", !form.confidential)}
            >
              <Feather name={form.confidential ? "eye-off" : "eye"} size={16} color={form.confidential ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.toggleLabel, { color: form.confidential ? colors.primary : colors.foreground }]}>Confidential Listing</Text>
              <View style={[styles.toggleSwitch, { backgroundColor: form.confidential ? colors.primary : colors.muted }]}>
                <View style={[styles.toggleKnob, { transform: [{ translateX: form.confidential ? 18 : 0 }] }]} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {step === 1 && (
          <View style={styles.fields}>
            {[
              { key: "askingPrice", label: "Asking Price ($)", placeholder: "185000" },
              { key: "weeklyRevenue", label: "Weekly Revenue ($)", placeholder: "18500" },
              { key: "adjustedProfit", label: "Adjusted Profit / SDE ($)", placeholder: "72000" },
              { key: "rent", label: "Monthly Rent ($)", placeholder: "4200" },
              { key: "staffCount", label: "Staff Count", placeholder: "4" },
              { key: "ownerHours", label: "Owner Hours/Week", placeholder: "40" },
            ].map(({ key, label, placeholder }) => (
              <View key={key} style={styles.field}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder={placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={(form as any)[key]}
                  onChangeText={(v) => update(key, v)}
                  keyboardType="numeric"
                />
              </View>
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={styles.fields}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Contact Preference</Text>
            {[
              { val: "message", label: "Message Only", icon: "message-circle" },
              { val: "call", label: "Message + Call", icon: "phone" },
              { val: "broker_only", label: "Broker Only", icon: "shield" },
            ].map(({ val, label, icon }) => (
              <TouchableOpacity
                key={val}
                style={[styles.radioRow, { backgroundColor: form.contactPreference === val ? colors.primary + "18" : colors.card, borderColor: form.contactPreference === val ? colors.primary : colors.border }]}
                onPress={() => update("contactPreference", val)}
              >
                <Feather name={icon as any} size={18} color={form.contactPreference === val ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.radioLabel, { color: form.contactPreference === val ? colors.primary : colors.foreground }]}>{label}</Text>
                {form.contactPreference === val && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={styles.fields}>
            <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { label: "Business Name", value: form.businessName || "—" },
                { label: "Category", value: form.category || "—" },
                { label: "Location", value: `${form.suburb || "—"}, ${form.state || "—"}` },
                { label: "Asking Price", value: form.askingPrice ? `$${parseInt(form.askingPrice).toLocaleString()}` : "—" },
                { label: "Weekly Revenue", value: form.weeklyRevenue ? `$${parseInt(form.weeklyRevenue).toLocaleString()}` : "—" },
                { label: "Contact", value: form.contactPreference },
                { label: "Confidential", value: form.confidential ? "Yes" : "No" },
              ].map(({ label, value }) => (
                <View key={label} style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <Text style={[styles.reviewValue, { color: colors.foreground }]}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.infoBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
              <Feather name="info" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                Your listing will be reviewed by the Biz360 team before going live. Approval typically takes 1 business day.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 12 }]}>
        {step > 0 && (
          <TouchableOpacity style={[styles.backStepBtn, { backgroundColor: colors.muted }]} onPress={() => setStep((s) => s - 1)}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.primary }]} onPress={step < STEPS.length - 1 ? next : submit}>
          <Text style={styles.nextBtnText}>{step < STEPS.length - 1 ? "Continue" : "Submit Listing"}</Text>
          <Feather name={step < STEPS.length - 1 ? "arrow-right" : "check"} size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  stepIndicator: { fontSize: 14, fontFamily: "Inter_500Medium" },
  stepBar: { flexDirection: "row", gap: 4, paddingHorizontal: 16, paddingVertical: 12 },
  stepItem: { flex: 1, height: 4, borderRadius: 2 },
  scroll: { padding: 16, gap: 16 },
  stepTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  fields: { gap: 14 },
  field: { gap: 8 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  toggleLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleSwitch: { width: 42, height: 24, borderRadius: 12, padding: 3 },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  radioLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  reviewCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  reviewLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  reviewValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  infoBox: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  backStepBtn: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  nextBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  nextBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
