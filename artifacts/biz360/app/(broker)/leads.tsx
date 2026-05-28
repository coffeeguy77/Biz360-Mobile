import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, router } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TourRequest } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { getPendingListings, PendingListing } from "@/lib/adminStore";
import { formatLeadTime, Lead, TEAM_MEMBERS, useLeads } from "@/lib/brokerStore";
import { getTourRequests, REQUEST_CATEGORIES } from "@/lib/tourStore";

const QC: Record<string, string> = { hot: "#EF4444", warm: "#F59E0B", cold: "#3B82F6" };
const QC_LABEL: Record<string, string> = { hot: "HOT", warm: "WARM", cold: "COLD" };
type Tab = "leads" | "tour_requests";

const REQUEST_CAT_MAP = Object.fromEntries(REQUEST_CATEGORIES.map((c) => [c.id, c]));

function formatReqTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)     return "just now";
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function LeadCard({ item, colors, onMessage, onAssign, onDelete }: {
  item: Lead;
  colors: ReturnType<typeof useColors>;
  onMessage: () => void;
  onAssign: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: item.quality === "hot" ? QC.hot + "40" : colors.border }]}>
      <View style={styles.top}>
        <View style={[styles.qTag, { backgroundColor: QC[item.quality] + "20" }]}>
          <View style={[styles.qDot, { backgroundColor: QC[item.quality] }]} />
          <Text style={[styles.qLabel, { color: QC[item.quality] }]}>{QC_LABEL[item.quality]}</Text>
        </View>
        <Text style={[styles.leadName, { color: colors.foreground }]}>{item.name}</Text>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>{formatLeadTime(item.timestamp)}</Text>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="trash-2" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.listing, { color: colors.primary }]}>{item.listing}</Text>
      <Text style={[styles.action, { color: colors.mutedForeground }]}>{item.action}</Text>
      <View style={styles.bottom}>
        <View style={[styles.assignedTag, { backgroundColor: colors.muted }]}>
          <Feather name="user" size={11} color={colors.mutedForeground} />
          <Text style={[styles.assignedText, { color: colors.mutedForeground }]}>{item.assignedTo}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary + "18" }]} onPress={onMessage}>
            <Feather name="message-circle" size={14} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent + "18" }]} onPress={onAssign}>
            <Feather name="user-check" size={14} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>
      {item.status !== "open" && (
        <View style={[styles.statusBar, { backgroundColor: colors.accent + "18" }]}>
          <Feather name="check-circle" size={12} color={colors.accent} />
          <Text style={[styles.statusBarText, { color: colors.accent }]}>
            {item.status === "contacted" ? "Contacted" : item.status === "qualified" ? "Qualified" : "Closed"}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function BrokerLeads() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { leads, setLeads, deleteLead } = useLeads();

  const [activeTab,    setActiveTab]    = useState<Tab>("leads");
  const [approvedList, setApprovedList] = useState<PendingListing[]>([]);
  const [tourRequests, setTourRequests] = useState<TourRequest[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const all      = await getPendingListings();
        const approved = all.filter((p) => p.status === "approved");
        if (!active) return;
        setApprovedList(approved);
        const reqArrays = await Promise.all(approved.map((p) => getTourRequests(p.listingId)));
        if (!active) return;
        const allReqs = reqArrays.flat().sort((a, b) => b.timestamp - a.timestamp);
        setTourRequests(allReqs);
      })();
      return () => { active = false; };
    }, []),
  );

  const hotCount    = leads.filter((l) => l.quality === "hot"  && l.status === "open").length;
  const openCount   = leads.filter((l) => l.status === "open").length;
  const newReqCount = tourRequests.filter((r) => r.status === "new").length;

  const listingName = (listingId: string) =>
    approvedList.find((l) => l.listingId === listingId)?.businessName ?? listingId;

  const handleMessage = (lead: Lead) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const threadId = `broker-lead-${lead.id}`;
    router.push(`/thread/${threadId}?listingName=${encodeURIComponent(lead.listing)}&sellerName=${encodeURIComponent(lead.name)}&buyerName=Broker` as any);
    setLeads((prev) => prev.map((l) => l.id === lead.id && l.status === "open" ? { ...l, status: "contacted" } : l));
  };

  const handleAssign = (lead: Lead) => {
    Alert.alert("Assign Lead", `Assign ${lead.name} to:`, [
      ...TEAM_MEMBERS.map((member) => ({
        text: member,
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, assignedTo: member } : l));
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const handleDelete = (lead: Lead) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Remove Lead", `Remove ${lead.name} from your leads?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          deleteLead(lead.id);
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Leads</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {openCount} open · {hotCount > 0 ? `${hotCount} hot 🔥` : "no hot leads"}
          </Text>
        </View>
        {(hotCount > 0 || newReqCount > 0) && (
          <View style={[styles.hotBadge, { backgroundColor: "#EF4444" }]}>
            <Text style={styles.hotBadgeText}>{hotCount + newReqCount}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {([["leads", "Leads"], ["tour_requests", "Tour Requests"]] as [Tab, string][]).map(([tab, label]) => {
          const active = activeTab === tab;
          const badge  = tab === "leads" ? hotCount : newReqCount;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: active ? colors.primary : colors.mutedForeground }]}>{label}</Text>
              {badge > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: "#EF4444" }]}>
                  <Text style={styles.tabBadgeText}>{badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === "leads" ? (
        <FlatList
          data={leads}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No leads yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <LeadCard
              item={item}
              colors={colors}
              onMessage={() => handleMessage(item)}
              onAssign={() => handleAssign(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
          showsVerticalScrollIndicator={false}
        >
          {tourRequests.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="rotate-ccw" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No tour requests yet</Text>
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                Buyers can request more info while viewing 360° tours on your approved listings.
              </Text>
            </View>
          ) : (
            tourRequests.map((req) => {
              const cat   = REQUEST_CAT_MAP[req.category];
              const isNew = req.status === "new";
              return (
                <View
                  key={req.id}
                  style={[styles.reqCard, { backgroundColor: colors.card, borderColor: isNew ? "#3B82F640" : colors.border }]}
                >
                  <View style={styles.reqHeader}>
                    <View style={[styles.reqIconBox, { backgroundColor: "#3B82F620" }]}>
                      <Feather name={(cat?.icon ?? "help-circle") as any} size={16} color="#3B82F6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reqTitle, { color: colors.foreground }]}>{cat?.label ?? req.category}</Text>
                      <Text style={[styles.reqMeta, { color: colors.mutedForeground }]}>
                        {listingName(req.listingId)} · {formatReqTime(req.timestamp)}
                      </Text>
                    </View>
                    {isNew && (
                      <View style={[styles.newBadge, { backgroundColor: "#EF4444" }]}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                      </View>
                    )}
                  </View>
                  {req.buyerName && (
                    <Text style={[styles.reqBuyer, { color: colors.mutedForeground }]}>From: {req.buyerName}</Text>
                  )}
                  {req.message ? (
                    <Text style={[styles.reqMessage, { color: colors.foreground }]}>"{req.message}"</Text>
                  ) : null}
                  <View style={styles.reqActions}>
                    <TouchableOpacity
                      style={[styles.reqBtn, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        const threadId = `broker-req-${req.listingId}`;
                        router.push(`/thread/${threadId}?listingName=${encodeURIComponent(listingName(req.listingId))}&sellerName=${encodeURIComponent(req.buyerName ?? "Buyer")}&buyerName=Broker` as any);
                      }}
                    >
                      <Feather name="message-circle" size={13} color="#fff" />
                      <Text style={[styles.reqBtnText, { color: "#fff" }]}>Reply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reqBtn, { backgroundColor: "#7C3AED" }]}
                      onPress={() => router.push(`/(seller)/tours?listingId=${req.listingId}` as any)}
                    >
                      <Feather name="map" size={13} color="#fff" />
                      <Text style={[styles.reqBtnText, { color: "#fff" }]}>Manage Tour</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title:        { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle:     { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  hotBadge:     { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  hotBadgeText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  tabs:         { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 16 },
  tab:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  tabText:      { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  tabBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  list:         { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  empty:        { alignItems: "center", paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyTitle:   { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyHint:    { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  card:         { padding: 14, borderRadius: 14, borderWidth: 1, gap: 6 },
  top:          { flexDirection: "row", alignItems: "center", gap: 8 },
  qTag:         { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  qDot:         { width: 6, height: 6, borderRadius: 3 },
  qLabel:       { fontSize: 10, fontFamily: "Inter_700Bold" },
  leadName:     { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  time:         { fontSize: 12, fontFamily: "Inter_400Regular" },
  listing:      { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  action:       { fontSize: 13, fontFamily: "Inter_400Regular" },
  bottom:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  assignedTag:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  assignedText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  actions:      { flexDirection: "row", gap: 8 },
  actionBtn:    { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  statusBar:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 2 },
  statusBarText:{ fontSize: 12, fontFamily: "Inter_600SemiBold" },
  reqCard:      { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  reqHeader:    { flexDirection: "row", alignItems: "center", gap: 12 },
  reqIconBox:   { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  reqTitle:     { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  reqMeta:      { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  newBadge:     { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  newBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  reqBuyer:     { fontSize: 12, fontFamily: "Inter_500Medium" },
  reqMessage:   { fontSize: 13, fontFamily: "Inter_400Regular", fontStyle: "italic", lineHeight: 19 },
  reqActions:   { flexDirection: "row", gap: 8 },
  reqBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10 },
  reqBtnText:   { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
