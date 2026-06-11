import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("biz360_auth_token");
}

type AccessMode = "public" | "users" | "password" | "users_and_password";
type NdaMode = "none" | "required" | "third_party";
type Tab = "settings" | "analytics" | "nda" | "im";

interface AccessSettings {
  id: string;
  listingId: string;
  accessMode: AccessMode;
  hasPassword: boolean;
  smsUnlockEnabled: boolean;
  updatedAt: string | null;
}

interface AccessGrant {
  id: string;
  phone: string;
  note: string | null;
  createdAt: string | null;
}

interface BuyerAnalytic {
  phone: string | null;
  viewCount: number;
  lastOpenedAt: string | null;
  documentType: string;
}

interface NdaSignature {
  id: string;
  buyerPhone: string;
  buyerIp: string | null;
  signedAt: string | null;
  ndaVersion: string;
}

interface ImSettings {
  public_report: boolean;
  require_login: boolean;
  require_seller_approval: boolean;
  nda_for_documents: boolean;
  hide_business_name: boolean;
  hide_exact_address: boolean;
  show_asking_price: boolean;
  show_valuation_range: boolean;
  show_equipment_value: boolean;
  show_lease_risk: boolean;
  show_360_tour: boolean;
  allow_pdf_download: boolean;
  allow_document_requests: boolean;
  notify_on_view: boolean;
  notify_on_access_request: boolean;
}

const DEFAULT_IM: ImSettings = {
  public_report: false,
  require_login: true,
  require_seller_approval: false,
  nda_for_documents: true,
  hide_business_name: false,
  hide_exact_address: false,
  show_asking_price: true,
  show_valuation_range: true,
  show_equipment_value: true,
  show_lease_risk: false,
  show_360_tour: true,
  allow_pdf_download: false,
  allow_document_requests: true,
  notify_on_view: true,
  notify_on_access_request: true,
};

const IM_TOGGLES: { key: keyof ImSettings; label: string; desc: string; group: string }[] = [
  { key: "public_report",           label: "Public Report",              desc: "Anyone can view the IM without login",         group: "ACCESS" },
  { key: "require_login",           label: "Require Login",              desc: "Buyers must register before viewing",          group: "ACCESS" },
  { key: "require_seller_approval", label: "Require Seller Approval",    desc: "Seller manually approves each buyer request",  group: "ACCESS" },
  { key: "nda_for_documents",       label: "NDA for Documents",          desc: "Buyers must sign NDA to view attachments",     group: "ACCESS" },
  { key: "hide_business_name",      label: "Hide Business Name",         desc: "Show as 'Confidential Business' on the listing", group: "PRIVACY" },
  { key: "hide_exact_address",      label: "Hide Exact Address",         desc: "Show suburb/state only — not full address",    group: "PRIVACY" },
  { key: "show_asking_price",       label: "Show Asking Price",          desc: "Display the asking price on the IM",           group: "VISIBILITY" },
  { key: "show_valuation_range",    label: "Show Valuation Range",       desc: "Include the app valuation band in the report", group: "VISIBILITY" },
  { key: "show_equipment_value",    label: "Show Equipment Value",       desc: "Include plant & equipment valuation",          group: "VISIBILITY" },
  { key: "show_lease_risk",         label: "Show Lease Risk Score",      desc: "Display lease risk rating to buyers",          group: "VISIBILITY" },
  { key: "show_360_tour",           label: "Show 360° Tour",             desc: "Include immersive property tour in the IM",    group: "VISIBILITY" },
  { key: "allow_pdf_download",      label: "Allow PDF Download",         desc: "Buyers can download a PDF copy of the IM",     group: "DOWNLOADS" },
  { key: "allow_document_requests", label: "Allow Document Requests",    desc: "Buyers can request additional documents",      group: "DOWNLOADS" },
  { key: "notify_on_view",          label: "Notify on View",             desc: "Get a push notification when a buyer opens the IM", group: "NOTIFICATIONS" },
  { key: "notify_on_access_request",label: "Notify on Access Request",   desc: "Get notified when a buyer requests access",   group: "NOTIFICATIONS" },
];

const MODE_LABELS: Record<AccessMode, string> = {
  public: "Public",
  users: "Specific Users",
  password: "Password",
  users_and_password: "Users or Password",
};

const MODE_DESCRIPTIONS: Record<AccessMode, string> = {
  public: "Anyone can view the verified financials.",
  users: "Only approved phone numbers can view.",
  password: "Buyers must enter a password to unlock.",
  users_and_password: "Approved users or anyone with the password.",
};

const NDA_LABELS: Record<NdaMode, string> = {
  none: "No NDA",
  required: "Required (SMS signed)",
  third_party: "Third-Party Link",
};

const NDA_DESCRIPTIONS: Record<NdaMode, string> = {
  none: "No NDA required before viewing financials.",
  required: "Buyers must sign an NDA via SMS verification.",
  third_party: "Buyers are redirected to your own NDA document.",
};

export default function ReportAccessScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe } = useValuation();

  const [tab, setTab] = useState<Tab>("settings");
  const [settings, setSettings] = useState<AccessSettings | null>(null);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [buyers, setBuyers] = useState<BuyerAnalytic[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [ndaMode, setNdaMode] = useState<NdaMode>("none");
  const [ndaThirdPartyUrl, setNdaThirdPartyUrl] = useState("");
  const [ndaSignatures, setNdaSignatures] = useState<NdaSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ndaSaving, setNdaSaving] = useState(false);
  const [imSaving, setImSaving] = useState(false);

  const [selectedMode, setSelectedMode] = useState<AccessMode>("public");
  const [newPassword, setNewPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [smsUnlock, setSmsUnlock] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [addingGrant, setAddingGrant] = useState(false);

  const [imSettings, setImSettings] = useState<ImSettings>({ ...DEFAULT_IM });

  const cafeId = selectedCafe?.id;

  const load = useCallback(async () => {
    if (!cafeId) return;
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const [settingsRes, analyticsRes, ndaSettingsRes, ndaSignaturesRes, imSettingsRes] = await Promise.all([
        fetch(`${API_BASE}/api/valuation/cafes/${cafeId}/report-access`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/valuation/cafes/${cafeId}/report-access/analytics`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/valuation/cafes/${cafeId}/nda-settings`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/valuation/cafes/${cafeId}/nda-settings/signatures`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/valuation/cafes/${cafeId}/report-access/im-settings`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings ?? null);
        setGrants(data.grants ?? []);
        if (data.settings) {
          setSelectedMode(data.settings.accessMode as AccessMode);
          setSmsUnlock(data.settings.smsUnlockEnabled ?? false);
        }
      }
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setBuyers(data.buyers ?? []);
        setTotalViews(data.totalViews ?? 0);
      }
      if (ndaSettingsRes.ok) {
        const data = await ndaSettingsRes.json();
        const s = data.settings;
        if (s) {
          setNdaMode(s.ndaMode as NdaMode);
          setNdaThirdPartyUrl(s.thirdPartyUrl ?? "");
        }
      }
      if (ndaSignaturesRes.ok) {
        const data = await ndaSignaturesRes.json();
        setNdaSignatures(data.signatures ?? []);
      }
      if (imSettingsRes.ok) {
        const data = await imSettingsRes.json();
        if (data.settings && typeof data.settings === "object") {
          setImSettings({ ...DEFAULT_IM, ...(data.settings as Partial<ImSettings>) });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [cafeId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!cafeId) return;
    const token = await getToken();
    if (!token) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { accessMode: selectedMode, smsUnlockEnabled: smsUnlock };
      if (newPassword) body.password = newPassword;
      const res = await fetch(`${API_BASE}/api/valuation/cafes/${cafeId}/report-access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings ?? null);
        setNewPassword("");
        Alert.alert("Saved", "Access settings updated.");
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err.error ?? "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleNdaSave() {
    if (!cafeId) return;
    const token = await getToken();
    if (!token) return;
    if (ndaMode === "third_party" && !ndaThirdPartyUrl.trim()) {
      Alert.alert("Error", "Please enter the third-party NDA URL.");
      return;
    }
    setNdaSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/valuation/cafes/${cafeId}/nda-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ndaMode, thirdPartyUrl: ndaThirdPartyUrl.trim() || null }),
      });
      if (res.ok) {
        Alert.alert("Saved", "NDA settings updated.");
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err.error ?? "Failed to save NDA settings");
      }
    } finally {
      setNdaSaving(false);
    }
  }

  async function handleImSave() {
    if (!cafeId) {
      Alert.alert("Error", "No business selected.");
      return;
    }
    const token = await getToken();
    if (!token) return;
    setImSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/valuation/cafes/${cafeId}/report-access/im-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(imSettings),
      });
      if (res.ok) {
        Alert.alert("Saved", "IM report settings updated.");
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err.error ?? "Failed to save IM settings");
      }
    } catch { Alert.alert("Error", "Network error. Please try again."); }
    finally { setImSaving(false); }
  }

  function toggleIm(key: keyof ImSettings) {
    setImSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleAddGrant() {
    if (!cafeId || !newPhone.trim()) return;
    const token = await getToken();
    if (!token) return;
    setAddingGrant(true);
    try {
      const res = await fetch(`${API_BASE}/api/valuation/cafes/${cafeId}/report-access/grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: newPhone.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setGrants((g) => [data.grant, ...g]);
        setNewPhone("");
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err.error ?? "Failed to add user");
      }
    } finally { setAddingGrant(false); }
  }

  async function handleRemoveGrant(grantId: string) {
    if (!cafeId) return;
    Alert.alert("Remove access?", "This buyer will no longer be able to view the report.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          const token = await getToken();
          if (!token) return;
          await fetch(`${API_BASE}/api/valuation/cafes/${cafeId}/report-access/grants/${grantId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          setGrants((g) => g.filter((x) => x.id !== grantId));
        },
      },
    ]);
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
  }

  const needsPassword = selectedMode === "password" || selectedMode === "users_and_password";
  const needsUsers = selectedMode === "users" || selectedMode === "users_and_password";

  /* Group IM toggles by group label */
  const imGroups = Array.from(new Set(IM_TOGGLES.map((t) => t.group)));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Report Access</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {([
            { key: "settings" as Tab, label: "Access" },
            { key: "analytics" as Tab, label: `Views (${totalViews})` },
            { key: "nda" as Tab, label: `NDA (${ndaSignatures.length})` },
            { key: "im" as Tab, label: "IM Settings" },
          ]).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.tabBtn, tab === key && { backgroundColor: colors.primary }]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabBtnText, tab === key && { color: "#fff" }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : tab === "settings" ? (
          <View style={{ gap: 16 }}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>WHO CAN VIEW THE REPORT</Text>
            {(["public", "users", "password", "users_and_password"] as AccessMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.modeCard, { backgroundColor: colors.card, borderColor: selectedMode === mode ? colors.primary : colors.border }]}
                onPress={() => setSelectedMode(mode)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeTitle, { color: colors.foreground }]}>{MODE_LABELS[mode]}</Text>
                  <Text style={[styles.modeDesc, { color: colors.mutedForeground }]}>{MODE_DESCRIPTIONS[mode]}</Text>
                </View>
                <View style={[styles.radioOuter, { borderColor: selectedMode === mode ? colors.primary : colors.border }]}>
                  {selectedMode === mode && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                </View>
              </TouchableOpacity>
            ))}

            {needsPassword && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PASSWORD</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.input, { color: colors.foreground, flex: 1 }]}
                    placeholder={settings?.hasPassword ? "Enter new password to change" : "Set access password"}
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!showPwd}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPwd((v) => !v)} style={{ padding: 4 }}>
                    <Feather name={showPwd ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                  Min 8 chars · uppercase · number · symbol
                  {settings?.hasPassword ? " · Leave blank to keep current password" : ""}
                </Text>
                <TouchableOpacity
                  style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setSmsUnlock((v) => !v)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeTitle, { color: colors.foreground }]}>SMS Unlock</Text>
                    <Text style={[styles.modeDesc, { color: colors.mutedForeground }]}>Allow buyers to receive the password via SMS</Text>
                  </View>
                  <View style={[styles.toggle, { backgroundColor: smsUnlock ? colors.primary : colors.border }]}>
                    <View style={[styles.toggleThumb, { left: smsUnlock ? 18 : 2 }]} />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {needsUsers && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>APPROVED BUYERS</Text>
                <View style={[styles.addRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.input, { color: colors.foreground, flex: 1 }]}
                    placeholder="+61 400 000 000"
                    placeholderTextColor={colors.mutedForeground}
                    value={newPhone}
                    onChangeText={setNewPhone}
                    keyboardType="phone-pad"
                  />
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: colors.primary, opacity: newPhone.trim() ? 1 : 0.4 }]}
                    onPress={handleAddGrant}
                    disabled={addingGrant || !newPhone.trim()}
                  >
                    {addingGrant ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="plus" size={16} color="#fff" />}
                  </TouchableOpacity>
                </View>
                {grants.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No approved buyers yet.</Text>
                ) : grants.map((g) => (
                  <View key={g.id} style={[styles.grantRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Feather name="user-check" size={16} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.grantPhone, { color: colors.foreground }]}>{g.phone}</Text>
                      {g.createdAt && <Text style={[styles.grantDate, { color: colors.mutedForeground }]}>{formatDate(g.createdAt)}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveGrant(g.id)}>
                      <Feather name="x" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={[styles.saveBtn, { opacity: saving ? 0.6 : 1 }]} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Feather name="check" size={16} color="#fff" /><Text style={styles.saveBtnText}>Save Settings</Text></>}
            </TouchableOpacity>
          </View>

        ) : tab === "analytics" ? (
          <View style={{ gap: 12 }}>
            {buyers.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="bar-chart-2" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No views yet</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>View events will appear once buyers access the report.</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  {totalViews} TOTAL VIEW{totalViews !== 1 ? "S" : ""} · {buyers.length} UNIQUE BUYER{buyers.length !== 1 ? "S" : ""}
                </Text>
                {buyers.map((b, i) => (
                  <View key={b.phone ?? `anon-${i}`} style={[styles.eventRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Feather name="user" size={16} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.grantPhone, { color: colors.foreground }]}>{b.phone ?? "Anonymous"}</Text>
                      <Text style={[styles.grantDate, { color: colors.mutedForeground }]}>
                        {b.viewCount} open{b.viewCount !== 1 ? "s" : ""} · Last {formatDate(b.lastOpenedAt)}
                      </Text>
                    </View>
                    <View style={[styles.badgeCount, { backgroundColor: colors.primary + "22" }]}>
                      <Text style={[styles.badgeText, { color: colors.primary }]}>{b.viewCount}×</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>

        ) : tab === "nda" ? (
          <View style={{ gap: 16 }}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NDA REQUIREMENT</Text>
            {(["none", "required", "third_party"] as NdaMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.modeCard, { backgroundColor: colors.card, borderColor: ndaMode === mode ? colors.primary : colors.border }]}
                onPress={() => setNdaMode(mode)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeTitle, { color: colors.foreground }]}>{NDA_LABELS[mode]}</Text>
                  <Text style={[styles.modeDesc, { color: colors.mutedForeground }]}>{NDA_DESCRIPTIONS[mode]}</Text>
                </View>
                <View style={[styles.radioOuter, { borderColor: ndaMode === mode ? colors.primary : colors.border }]}>
                  {ndaMode === mode && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                </View>
              </TouchableOpacity>
            ))}

            {ndaMode === "third_party" && (
              <View style={{ gap: 6 }}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>THIRD-PARTY NDA URL</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.input, { color: colors.foreground, flex: 1 }]}
                    placeholder="https://your-nda-service.com/sign/..."
                    placeholderTextColor={colors.mutedForeground}
                    value={ndaThirdPartyUrl}
                    onChangeText={setNdaThirdPartyUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>
                <Text style={[styles.hint, { color: colors.mutedForeground }]}>Buyers will be directed here before accessing financials.</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.saveBtn, { opacity: ndaSaving ? 0.6 : 1 }]} onPress={handleNdaSave} disabled={ndaSaving}>
              {ndaSaving
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Feather name="check" size={16} color="#fff" /><Text style={styles.saveBtnText}>Save NDA Settings</Text></>}
            </TouchableOpacity>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>NDA SIGNATURES ({ndaSignatures.length})</Text>
            {ndaSignatures.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="file-text" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No signatures yet</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {ndaMode === "none" ? "Enable NDA requirement above to start collecting signatures." : "Signatures appear here once buyers sign."}
                </Text>
              </View>
            ) : (
              ndaSignatures.map((sig) => (
                <View key={sig.id} style={[styles.grantRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="file-text" size={16} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.grantPhone, { color: colors.foreground }]}>{sig.buyerPhone}</Text>
                    <Text style={[styles.grantDate, { color: colors.mutedForeground }]}>
                      Signed {formatDate(sig.signedAt)} · NDA {sig.ndaVersion}
                      {sig.buyerIp ? `\nIP ${sig.buyerIp}` : ""}
                    </Text>
                  </View>
                  <View style={[styles.badgeCount, { backgroundColor: "#22c55e22" }]}>
                    <Feather name="check" size={12} color="#22c55e" />
                  </View>
                </View>
              ))
            )}
          </View>

        ) : (
          /* IM Settings tab */
          <View style={{ gap: 16 }}>
            <View style={[styles.imInfoCard, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
              <Feather name="info" size={15} color="#60A5FA" />
              <Text style={styles.imInfoText}>
                These settings control what buyers see when they view your Information Memorandum on the EXIT360 marketplace.
              </Text>
            </View>

            {imGroups.map((group) => {
              const groupToggles = IM_TOGGLES.filter((t) => t.group === group);
              return (
                <View key={group} style={{ gap: 8 }}>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{group}</Text>
                  <View style={[styles.toggleBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {groupToggles.map((item, idx) => (
                      <TouchableOpacity
                        key={item.key}
                        style={[
                          styles.imToggleRow,
                          idx < groupToggles.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                        ]}
                        onPress={() => toggleIm(item.key)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.modeTitle, { color: colors.foreground }]}>{item.label}</Text>
                          <Text style={[styles.modeDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
                        </View>
                        <View style={[styles.toggle, { backgroundColor: imSettings[item.key] ? colors.primary : colors.border }]}>
                          <View style={[styles.toggleThumb, { left: imSettings[item.key] ? 18 : 2 }]} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={[styles.saveBtn, { opacity: imSaving ? 0.6 : 1 }]} onPress={handleImSave} disabled={imSaving}>
              {imSaving
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Feather name="check" size={16} color="#fff" /><Text style={styles.saveBtnText}>Save IM Settings</Text></>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 16, gap: 14 },
  header:       { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:      { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:        { fontSize: 22, fontFamily: "Inter_700Bold" },
  tabRow:       { gap: 8, paddingBottom: 2 },
  tabBtn:       { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#1E3A5C", alignItems: "center" },
  tabBtnText:   { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#8B9CB8" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginTop: 4 },
  modeCard:     { borderRadius: 14, padding: 16, borderWidth: 1.5, flexDirection: "row", alignItems: "center", gap: 12 },
  modeTitle:    { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modeDesc:     { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 18 },
  radioOuter:   { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner:   { width: 12, height: 12, borderRadius: 6 },
  inputRow:     { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, borderWidth: 1, gap: 8 },
  addRow:       { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 8, borderWidth: 1, gap: 8, paddingLeft: 12 },
  input:        { fontSize: 14, fontFamily: "Inter_400Regular" },
  addBtn:       { borderRadius: 10, padding: 10 },
  hint:         { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 17 },
  toggleRow:    { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  toggle:       { width: 40, height: 24, borderRadius: 12, justifyContent: "center" },
  toggleThumb:  { position: "absolute", width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", top: 2 },
  grantRow:     { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, borderWidth: 1, gap: 10 },
  eventRow:     { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, borderWidth: 1, gap: 10 },
  grantPhone:   { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  grantDate:    { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  saveBtn:      { backgroundColor: "#3B82F6", borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 },
  saveBtnText:  { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  emptyState:   { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle:   { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText:    { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  badgeCount:   { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center", justifyContent: "center" },
  badgeText:    { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  imInfoCard:   { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  imInfoText:   { flex: 1, color: "#60A5FA", fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  toggleBlock:  { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  imToggleRow:  { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
});
