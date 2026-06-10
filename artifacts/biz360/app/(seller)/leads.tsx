import { Feather } from "@expo/vector-icons";
import { useFocusEffect, router } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { TourRequest } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { getPendingListings, isMySubmission, PendingListing } from "@/lib/adminStore";
import { getThreads, formatThreadTime, Thread } from "@/lib/messageStore";
import { getTourRequests, REQUEST_CATEGORIES } from "@/lib/tourStore";

const QC: Record<string, string>       = { hot: "#EF4444", warm: "#F59E0B", cold: "#3B82F6" };
const QC_LABEL: Record<string, string> = { hot: "HOT", warm: "WARM", cold: "COLD" };
type Filter = "all" | "hot" | "warm" | "cold";
type Tab    = "messages" | "tour_requests";

interface Lead {
  id: string;
  name: string;
  action: string;
  time: string;
  quality: "hot" | "warm" | "cold";
  canMessage: boolean;
  threadId: string;
  listingName: string;
}

function threadToLead(t: Thread): Lead {
  const ageMs  = Date.now() - t.updatedAt;
  const unread = (t.unreadSeller ?? 0) > 0;
  const quality: "hot" | "warm" | "cold" =
    unread || ageMs < 3_600_000   ? "hot"  :
    ageMs  < 86_400_000           ? "warm" : "cold";
  const last = t.messages[t.messages.length - 1];
  const action = last ? (last.from === "buyer" ? last.text.slice(0, 60) : "You replied") : "Started a conversation";
  return {
    id:          t.id,
    name:        t.buyerName,
    action,
    time:        formatThreadTime(t.updatedAt),
    quality,
    canMessage:  true,
    threadId:    t.id,
    listingName: t.listingName,
  };
}

const REQUEST_CAT_MAP = Object.fromEntries(REQUEST_CATEGORIES.map((c) => [c.id, c]));

function formatReqTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)       return "just now";
  if (diff < 3_600_000)    return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)   return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function SellerLeads() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab,    setActiveTab]    = useState<Tab>("messages");
  const [filter,       setFilter]       = useState<Filter>("all");
  const [myListings,   setMyListings]   = useState<PendingListing[]>([]);
  const [leads,        setLeads]        = useState<Lead[]>([]);
  const [tourRequests, setTourRequests] = useState<TourRequest[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      let active = true;
      (async () => {
        const [allListings, allThreads] = await Promise.all([
          getPendingListings(),
          getThreads(),
        ]);
        if (!active) return;
        const mine      = allListings.filter((p) => isMySubmission(p.submittedBy, user.id));
        const myIds     = new Set(mine.map((p) => p.listingId));
        const myThreads = allThreads.filter((t) => myIds.has(t.listingId));
        setMyListings(mine);
        setLeads(myThreads.map(threadToLead));

        // Load tour requests for all my listings
        const reqArrays = await Promise.all(mine.map((p) => getTourRequests(p.listingId)));
        if (!active) return;
        const allReqs = reqArrays.flat().sort((a, b) => b.timestamp - a.timestamp);
        setTourRequests(allReqs);
      })();
      return () => { active = false; };
    }, [user?.id]),
  );

  const hasListings = myListings.length > 0;
  const filtered    = filter === "all" ? leads : leads.filter((l) => l.quality === filter);
  const hotCount    = leads.filter((l) => l.quality === "hot").length;
  const newReqCount = tourRequests.filter((r) => r.status === "new").length;

  const handleMessage = (lead: Lead) => {
    router.push(
      `/thread/${lead.threadId}?listingName=${encodeURIComponent(lead.listingName)}&sellerName=${encodeURIComponent(user?.name ?? "Seller")}&buyerName=${encodeURIComponent(lead.name)}` as any,
    );
  };

  const listingName = (listingId: string) =>
    myListings.find((l) => l.listingId === listingId)?.businessName ?? listingId;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ paddingBottom: 4 }}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Leads</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {leads.length > 0 ? `${leads.length} messages · ${hotCount} hot` : "No leads yet"}
          </Text>
          </View>
        </View>
        {(hotCount > 0 || newReqCount > 0) && (
          <View style={[styles.hotBadge, { backgroundColor: "#EF4444" }]}>
            <Text style={styles.hotBadgeText}>{hotCount + newReqCount}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(["messages", "tour_requests"] as Tab[]).map((tab) => {
          const active = activeTab === tab;
          const label  = tab === "messages" ? "Messages" : "Tour Requests";
          const badge  = tab === "messages" ? hotCount : newReqCount;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: active ? colors.primary : colors.mutedForeground }]}>
                {label}
              </Text>
              {badge > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: "#EF4444" }]}>
                  <Text style={styles.tabBadgeText}>{badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === "messages" ? (
        <>
          {hasListings && (
            <View style={styles.filterRow}>
              {(["all", "hot", "warm", "cold"] as Filter[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, { backgroundColor: filter === f ? colors.primary : colors.muted }]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, { color: filter === f ? "#fff" : colors.foreground }]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
            scrollEnabled
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="users" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {hasListings ? "No leads in this filter" : "No leads yet"}
                </Text>
                {!hasListings && (
                  <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                    Submit a listing to start receiving buyer enquiries.
                  </Text>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: item.quality === "hot" ? QC.hot + "40" : colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: QC[item.quality] + "20" }]}>
                  <Text style={[styles.avatarText, { color: QC[item.quality] }]}>
                    {item.name.split(" ").map((n) => n[0]).join("")}
                  </Text>
                </View>
                <View style={styles.info}>
                  <View style={styles.top}>
                    <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                    <View style={[styles.qTag, { backgroundColor: QC[item.quality] + "20" }]}>
                      <Text style={[styles.qText, { color: QC[item.quality] }]}>{QC_LABEL[item.quality]}</Text>
                    </View>
                  </View>
                  <Text style={[styles.action, { color: colors.mutedForeground }]}>{item.action}</Text>
                  <Text style={[styles.time, { color: colors.mutedForeground }]}>{item.time}</Text>
                </View>
                {item.canMessage && (
                  <TouchableOpacity
                    style={[styles.msgBtn, { backgroundColor: colors.primary + "18" }]}
                    onPress={() => handleMessage(item)}
                  >
                    <Feather name="message-circle" size={18} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        </>
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
                Buyers can request more info while viewing your 360° tour.
              </Text>
            </View>
          ) : (
            tourRequests.map((req) => {
              const cat    = REQUEST_CAT_MAP[req.category];
              const isNew  = req.status === "new";
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
                        const thread = leads.find((l) => l.listingName === listingName(req.listingId));
                        if (thread) {
                          router.push(`/thread/${thread.threadId}` as any);
                        }
                      }}
                    >
                      <Feather name="message-circle" size={13} color="#fff" />
                      <Text style={[styles.reqBtnText, { color: "#fff" }]}>Reply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reqBtn, { backgroundColor: "#7C3AED" }]}
                      onPress={() => router.push("/(seller)/tours" as any)}
                    >
                      <Feather name="plus" size={13} color="#fff" />
                      <Text style={[styles.reqBtnText, { color: "#fff" }]}>Add Scene</Text>
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
  filterRow:    { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filterChip:   { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  filterText:   { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  list:         { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  empty:        { alignItems: "center", paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyTitle:   { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyHint:    { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  card:         { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  avatar:       { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarText:   { fontSize: 14, fontFamily: "Inter_700Bold" },
  info:         { flex: 1, gap: 3 },
  top:          { flexDirection: "row", alignItems: "center", gap: 8 },
  name:         { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  qTag:         { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  qText:        { fontSize: 9, fontFamily: "Inter_700Bold" },
  action:       { fontSize: 12, fontFamily: "Inter_400Regular" },
  time:         { fontSize: 11, fontFamily: "Inter_400Regular" },
  msgBtn:       { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
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
