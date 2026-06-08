import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe, fetchCafes, authToken } = useValuation();
  const [connecting, setConnecting] = useState<"square" | "xero" | null>(null);

  useFocusEffect(useCallback(() => { fetchCafes(); }, []));

  const integrations = selectedCafe?.integrations ?? [];
  const squareInt = integrations.find((i) => i.type === "square");
  const xeroInt = integrations.find((i) => i.type === "xero");

  const handleConnect = async (provider: "square" | "xero") => {
    if (!selectedCafe || !authToken) { Alert.alert("Error", "Select a business first"); return; }
    setConnecting(provider);
    try {
      // Server handles the HTTPS OAuth callback with Square/Xero, then redirects to biz360://oauth/done
      // WebBrowser catches that biz360:// redirect and returns it here — Square/Xero never see a custom scheme
      const startUrl = `${API_BASE}/api/valuation/oauth/${provider}/start?cafeId=${selectedCafe.id}&token=${encodeURIComponent(authToken)}`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, "biz360://oauth/done");
      if (result.type !== "success") return;
      const parsed = new URL(result.url);
      const status = parsed.searchParams.get("status");
      if (status === "success") {
        await fetchCafes();
        Alert.alert("Connected!", `${provider === "square" ? "Square" : "Xero"} connected successfully.`);
      } else {
        const detail = parsed.searchParams.get("detail") ?? "";
        Alert.alert("Connection failed", detail || "Please try again.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Something went wrong");
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (integrationId: string, name: string) => {
    Alert.alert("Disconnect", `Disconnect ${name}? You'll need to reconnect to sync data.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: async () => {
        await fetch(`${API_BASE}/api/valuation/integrations/${integrationId}/disconnect`, { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
        fetchCafes();
      }},
    ]);
  };

  const renderIntegration = (name: string, provider: "square" | "xero", icon: string, int: any) => {
    const connected = int?.status === "connected";
    return (
      <View style={[styles.intCard, { backgroundColor: colors.card, borderColor: connected ? "#16A34A40" : colors.border }]}>
        <View style={styles.intRow}>
          <View style={[styles.intIcon, { backgroundColor: provider === "square" ? "#00B37220" : "#00B5E220" }]}>
            <Feather name={icon as any} size={22} color={provider === "square" ? "#00B372" : "#00B5E2"} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.intName, { color: colors.foreground }]}>{name}</Text>
            <Text style={[styles.intStatus, { color: connected ? "#16A34A" : colors.mutedForeground }]}>
              {connected ? (int.merchantName ? `Connected: ${int.merchantName}` : "Connected") : "Not connected"}
            </Text>
          </View>
          {connected ? (
            <TouchableOpacity style={[styles.intBtn, { backgroundColor: "#EF444420", borderColor: "#EF444440" }]} onPress={() => handleDisconnect(int.id, name)}>
              <Text style={{ color: "#EF4444", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Disconnect</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.intBtn, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "40", opacity: connecting === provider ? 0.6 : 1 }]}
              onPress={() => handleConnect(provider)}
              disabled={!!connecting}
            >
              {connecting === provider
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Connect</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Connections</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Data Integrations</Text>
        {renderIntegration("Square", "square", "credit-card", squareInt)}
        {renderIntegration("Xero", "xero", "book-open", xeroInt)}

        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Square provides your sales revenue. Xero provides P&L data, supplier spend, and bank transactions. Both are shared across all business units — only COGS tagging is per-unit.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Mapping Tools</Text>
        {[
          { label: "P&L Line Mapping", sub: "Choose which Xero income lines count as revenue", route: "/(seller)/valuation/pl-mappings", icon: "bar-chart-2" },
          { label: "COGS Supplier Tags", sub: "Tag which suppliers are Cost of Goods Sold", route: "/(seller)/valuation/supplier-mappings", icon: "package" },
        ].map(({ label, sub, route, icon }) => (
          <TouchableOpacity key={label} style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(route as any)}>
            <Feather name={icon as any} size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.linkLabel, { color: colors.foreground }]}>{label}</Text>
              <Text style={[styles.linkSub, { color: colors.mutedForeground }]}>{sub}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
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
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  intCard:      { padding: 16, borderRadius: 14, borderWidth: 1 },
  intRow:       { flexDirection: "row", alignItems: "center", gap: 12 },
  intIcon:      { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  intName:      { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  intStatus:    { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  intBtn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  infoBox:      { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText:     { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  linkCard:     { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  linkLabel:    { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  linkSub:      { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
