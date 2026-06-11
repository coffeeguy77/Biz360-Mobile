import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const domain   = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

interface TemplateRow {
  id:           string;
  name:         string;
  jurisdiction: string | null;
  leaseType:    string | null;
  premisesType: string | null;
  isMaster:     boolean;
  variableMap:  Record<string, string>;
  createdAt:    string | null;
}

const JURISDICTION_COLORS: Record<string, string> = {
  NSW: "#3B82F6", VIC: "#8B5CF6", QLD: "#F59E0B", WA: "#10B981",
  SA:  "#EF4444", TAS: "#06B6D4", ACT: "#EC4899", NT: "#F97316",
};

function JurisdictionBadge({ value }: { value: string | null }) {
  if (!value) return null;
  const color = JURISDICTION_COLORS[value] ?? "#6B7280";
  return (
    <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color + "55" }]}>
      <Text style={[styles.badgeText, { color }]}>{value}</Text>
    </View>
  );
}

export default function TemplatesScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTemplates = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const authToken = await AsyncStorage.getItem("biz360_auth_token");
      const resp = await fetch(`${API_BASE}/api/lease-templates`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);
      const data = await resp.json() as { templates: TemplateRow[] };
      setTemplates(data.templates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handlePress = (id: string) => {
    router.push({ pathname: "/(seller)/leases/template-detail/[id]", params: { id } } as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchTemplates(true)} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Lease Templates</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Generated from analysed leases — pre-filled for your business
            </Text>
          </View>
        </View>

        {/* Info banner */}
        <View style={[styles.infoBanner, { backgroundColor: "#0F1F35", borderColor: "#1E3A5C" }]}>
          <Feather name="info" size={14} color="#93C5FD" />
          <Text style={[styles.infoText, { color: "#93C5FD" }]}>
            Templates are created automatically each time you analyse a lease. Use them to speed up new lease drafts.
          </Text>
        </View>

        {loading ? (
          <View style={styles.centred}>
            <ActivityIndicator color="#3B82F6" />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading templates…</Text>
          </View>
        ) : error ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="wifi-off" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Couldn't load templates</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: "#2563EB" }]} onPress={() => fetchTemplates()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : templates.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="file-text" size={28} color="#3B82F6" />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No templates yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Templates are generated automatically when you upload and analyse a lease document. Upload your first lease to get started.
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: "#2563EB" }]}
              onPress={() => router.push("/(seller)/leases/upload" as any)}
            >
              <Text style={styles.retryBtnText}>Upload Lease</Text>
            </TouchableOpacity>
          </View>
        ) : (
          templates.map(tpl => {
            const varCount = Object.keys(tpl.variableMap ?? {}).length;
            const date = tpl.createdAt ? new Date(tpl.createdAt).toLocaleDateString("en-AU") : null;
            return (
              <TouchableOpacity
                key={tpl.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handlePress(tpl.id)}
                activeOpacity={0.85}
              >
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIcon, { backgroundColor: "#1E3A5C" }]}>
                    <Feather name="file-text" size={18} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
                      {tpl.name}
                    </Text>
                    <View style={styles.cardMeta}>
                      {tpl.jurisdiction && <JurisdictionBadge value={tpl.jurisdiction} />}
                      {tpl.leaseType && (
                        <View style={[styles.badge, { backgroundColor: "#1E3A5C", borderColor: "#3B82F640" }]}>
                          <Text style={[styles.badgeText, { color: "#93C5FD" }]}>{tpl.leaseType}</Text>
                        </View>
                      )}
                      {tpl.isMaster && (
                        <View style={[styles.badge, { backgroundColor: "#431407", borderColor: "#F59E0B40" }]}>
                          <Text style={[styles.badgeText, { color: "#F59E0B" }]}>Master</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.cardFooter}>
                      {varCount > 0 && (
                        <Text style={[styles.cardFooterText, { color: colors.mutedForeground }]}>
                          {varCount} variable{varCount !== 1 ? "s" : ""}
                        </Text>
                      )}
                      {date && (
                        <Text style={[styles.cardFooterText, { color: colors.mutedForeground }]}>{date}</Text>
                      )}
                    </View>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  scroll:         { paddingHorizontal: 16, gap: 12 },
  headerRow:      { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  backBtn:        { padding: 4, marginTop: 2 },
  title:          { fontSize: 20, fontFamily: "Inter_700Bold" },
  sub:            { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  infoBanner:     { flexDirection: "row", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "flex-start" },
  infoText:       { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  centred:        { alignItems: "center", gap: 10, paddingVertical: 40 },
  loadingText:    { fontSize: 13, fontFamily: "Inter_400Regular" },
  emptyCard:      { borderRadius: 14, padding: 24, borderWidth: 1, alignItems: "center", gap: 10 },
  emptyTitle:     { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyText:      { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  retryBtn:       { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 4 },
  retryBtnText:   { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  card:           { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  cardLeft:       { flex: 1, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  cardIcon:       { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle:      { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  cardMeta:       { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cardFooter:     { flexDirection: "row", gap: 10 },
  cardFooterText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  badge:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  badgeText:      { fontSize: 10, fontFamily: "Inter_600SemiBold" },
});
