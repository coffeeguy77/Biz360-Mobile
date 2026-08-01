import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  fetchMyAccess,
  isSignedIn,
  listingUrl,
  reportUrl,
  setBuyerEmail,
  type MyAccessResponse,
  type PortalListing,
} from "@/lib/buyerPortal";

const SUCCESS = "#22C55E";

export default function BuyerPortalScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [data,     setData]     = useState<MyAccessResponse | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const authed = await isSignedIn();
    setSignedIn(authed);
    if (!authed) { setData(null); setLoading(false); return; }
    const res = await fetchMyAccess(user?.name);
    setData(res);
    setLoading(false);
  }, [user?.name]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const headerPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 8;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: headerPad, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Portal</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : !signedIn ? (
        <SignInPrompt colors={colors} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <Text style={[styles.intro, { color: colors.mutedForeground }]}>
            Confidential reports and walkthroughs a seller has granted you access to.
          </Text>

          <EmailCard colors={colors} data={data} onSaved={load} />

          {(!data || data.listings.length === 0) ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="folder" size={30} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No access yet</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                When a seller grants you access to a confidential report or walkthrough, it will appear here.
                Request access from any listing you're interested in.
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 14 }]}
                onPress={() => router.push("/(tabs)/discover" as any)}
              >
                <Feather name="search" size={15} color="#fff" />
                <Text style={styles.primaryBtnText}>Browse listings</Text>
              </TouchableOpacity>
            </View>
          ) : (
            data.listings.map((item) => (
              <PortalCard key={item.cafeId} item={item} colors={colors} userId={user?.id} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function SignInPrompt({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.center}>
      <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, width: "88%" }]}>
        <Feather name="lock" size={30} color={colors.primary} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sign in to view your portal</Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
          Create a free account to see the confidential reports and walkthroughs sellers have shared with you,
          message sellers, and reveal seller phone numbers.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
          onPress={() => { Haptics.selectionAsync(); router.push("/(auth)/welcome" as any); }}
        >
          <Feather name="user-plus" size={15} color="#fff" />
          <Text style={styles.primaryBtnText}>Create a free account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 12 }} onPress={() => router.push("/(auth)/login" as any)}>
          <Text style={[styles.linkText, { color: colors.primary }]}>I already have an account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EmailCard({
  colors, data, onSaved,
}: { colors: ReturnType<typeof useColors>; data: MyAccessResponse | null; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [email,   setEmail]   = useState(data?.email ?? "");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const verified = !!data?.emailVerified;
  const hasEmail = !!data?.email;

  const save = async () => {
    setSaving(true); setError(null);
    const res = await setBuyerEmail(email.trim());
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Couldn't save email"); return; }
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSaved();
  };

  return (
    <View style={[styles.emailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.emailHead}>
        <Feather name="mail" size={16} color={colors.primary} />
        <Text style={[styles.emailTitle, { color: colors.foreground }]}>Message alerts</Text>
        {verified && (
          <View style={[styles.verifiedPill, { backgroundColor: SUCCESS + "22" }]}>
            <Feather name="check" size={11} color={SUCCESS} />
            <Text style={[styles.verifiedText, { color: SUCCESS }]}>Verified</Text>
          </View>
        )}
        {hasEmail && !verified && (
          <View style={[styles.verifiedPill, { backgroundColor: "#F59E0B22" }]}>
            <Text style={[styles.verifiedText, { color: "#F59E0B" }]}>Pending</Text>
          </View>
        )}
      </View>

      {!editing ? (
        <>
          <Text style={[styles.emailSub, { color: colors.mutedForeground }]}>
            {verified
              ? `We'll email ${data?.email} when a seller replies.`
              : hasEmail
                ? `Check ${data?.email} for a verification link to turn on reply alerts.`
                : "Add your email to get notified the moment a seller replies to you."}
          </Text>
          <TouchableOpacity onPress={() => { setEmail(data?.email ?? ""); setEditing(true); }}>
            <Text style={[styles.linkText, { color: colors.primary, marginTop: 8 }]}>
              {hasEmail ? "Change email" : "Add email"}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
          {error && <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}
          <View style={styles.rowGap}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={save}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Save & verify</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ghostBtn, { borderColor: colors.border }]}
              onPress={() => { setEditing(false); setError(null); }}
            >
              <Text style={[styles.ghostBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function AccessBadge({
  granted, label, colors,
}: { granted: boolean; label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.badge, {
      backgroundColor: granted ? colors.primary + "1A" : colors.muted,
      borderColor: granted ? colors.primary + "44" : "transparent",
    }]}>
      <Feather name={granted ? "check" : "lock"} size={10} color={granted ? colors.primary : colors.mutedForeground} />
      <Text style={[styles.badgeText, { color: granted ? colors.primary : colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function PortalCard({
  item, colors, userId,
}: { item: PortalListing; colors: ReturnType<typeof useColors>; userId?: string }) {
  const p = item.permissions;
  const rUrl = reportUrl(item);
  const lUrl = listingUrl(item);

  const openReport = async () => {
    if (!rUrl) return;
    Haptics.selectionAsync();
    try { await WebBrowser.openBrowserAsync(rUrl); } catch { /* ignore */ }
  };
  const openWalkthrough = async () => {
    if (!lUrl) return;
    Haptics.selectionAsync();
    try { await WebBrowser.openBrowserAsync(lUrl); } catch { /* ignore */ }
  };
  const messageSeller = () => {
    if (!item.listingId) return;
    Haptics.selectionAsync();
    const buyer = userId ?? "guest";
    const threadId = `${item.listingId}_${buyer}`;
    router.push(
      `/thread/${threadId}?listingName=${encodeURIComponent(item.businessName)}` +
      `&sellerName=${encodeURIComponent("Seller")}` +
      `&listingId=${encodeURIComponent(item.listingId)}` +
      `&buyerId=${encodeURIComponent(buyer)}` as any,
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {item.heroImageUrl ? (
        <Image source={{ uri: item.heroImageUrl }} style={styles.hero} resizeMode="cover" />
      ) : (
        <View style={[styles.hero, styles.heroPlaceholder, { backgroundColor: colors.muted }]}>
          <Feather name="image" size={26} color={colors.mutedForeground} />
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.confidentialRow}>
          <Feather name="shield" size={11} color={colors.mutedForeground} />
          <Text style={[styles.confidential, { color: colors.mutedForeground }]}>CONFIDENTIAL</Text>
        </View>
        <Text style={[styles.bizName, { color: colors.foreground }]}>{item.businessName}</Text>
        {!!item.city && <Text style={[styles.city, { color: colors.mutedForeground }]}>{item.city}</Text>}

        <View style={styles.badgeRow}>
          <AccessBadge granted={p.canViewImReport}    label="Report"     colors={colors} />
          <AccessBadge granted={p.canViewWalkthrough} label="360°"       colors={colors} />
          <AccessBadge granted={p.canViewFinancials}  label="Financials" colors={colors} />
          <AccessBadge granted={p.canViewEquipment}   label="Equipment"  colors={colors} />
        </View>

        <View style={styles.actions}>
          {p.canViewImReport && rUrl && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]} onPress={openReport}>
              <Feather name="file-text" size={15} color="#fff" />
              <Text style={styles.primaryBtnText}>View Report</Text>
            </TouchableOpacity>
          )}
          {p.canViewWalkthrough && lUrl && (
            <TouchableOpacity style={[styles.ghostBtn, { borderColor: colors.border, flex: 1 }]} onPress={openWalkthrough}>
              <Feather name="video" size={15} color={colors.primary} />
              <Text style={[styles.ghostBtnText, { color: colors.foreground }]}>360° Tour</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={[styles.ghostBtn, { borderColor: colors.border, marginTop: 8 }]} onPress={messageSeller}>
          <Feather name="message-circle" size={15} color={colors.primary} />
          <Text style={[styles.ghostBtnText, { color: colors.foreground }]}>Message Seller</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  intro: { fontSize: 13, lineHeight: 19, marginBottom: 14 },

  emailCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 },
  emailHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  emailTitle: { fontSize: 14, fontWeight: "700", flex: 1 },
  emailSub: { fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  verifiedPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  verifiedText: { fontSize: 11, fontWeight: "700" },

  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginTop: 10 },
  errorText: { fontSize: 12, marginTop: 6 },
  rowGap: { flexDirection: "row", gap: 8, marginTop: 10 },

  emptyCard: { borderWidth: 1, borderRadius: 16, padding: 22, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 12, textAlign: "center" },
  emptySub: { fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: "center" },

  card: { borderWidth: 1, borderRadius: 18, overflow: "hidden", marginBottom: 16 },
  hero: { width: "100%", height: 150 },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },
  cardBody: { padding: 14 },
  confidentialRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  confidential: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  bizName: { fontSize: 17, fontWeight: "700", marginTop: 4 },
  city: { fontSize: 13, marginTop: 2 },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: "600" },

  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12 },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  ghostBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  ghostBtnText: { fontSize: 14, fontWeight: "700" },
  linkText: { fontSize: 13, fontWeight: "600" },
});
