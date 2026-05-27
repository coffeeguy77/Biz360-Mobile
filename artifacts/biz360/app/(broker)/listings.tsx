import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { DEMO_LISTINGS, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { getPendingListings, PendingListing } from "@/lib/adminStore";

const DEMO_BROKER_LISTINGS = [DEMO_LISTINGS[3], DEMO_LISTINGS[4]];

const STATUS_CONFIG = {
  pending:  { label: "Pending Review", color: "#F59E0B", icon: "clock"       },
  approved: { label: "Active",         color: "#16A34A", icon: "check-circle" },
  rejected: { label: "Rejected",       color: "#EF4444", icon: "x-circle"     },
} as const;

export default function BrokerListings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [userListings, setUserListings] = useState<PendingListing[]>([]);

  useFocusEffect(
    useCallback(() => {
      getPendingListings().then((all) => {
        setUserListings(all.filter((p) => p.submittedBy === user?.id));
      });
    }, [user?.id]),
  );

  type Row = { kind: "demo"; listing: typeof DEMO_BROKER_LISTINGS[0] } | { kind: "user"; item: PendingListing };
  const rows: Row[] = [
    ...DEMO_BROKER_LISTINGS.map((l) => ({ kind: "demo" as const, listing: l })),
    ...userListings.map((p) => ({ kind: "user" as const, item: p })),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Listings</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {DEMO_BROKER_LISTINGS.length + userListings.filter((u) => u.status === "approved").length} active
            {userListings.filter((u) => u.status === "pending").length > 0
              ? ` · ${userListings.filter((u) => u.status === "pending").length} pending`
              : ""}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/create-listing" as any)}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        renderItem={({ item: row }) => {
          if (row.kind === "demo") {
            const l = row.listing;
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/listing/${l.id}` as any)}
              >
                <View style={[styles.cardHero, { backgroundColor: l.heroColor }]}>
                  <View style={[styles.activePill, { backgroundColor: "#16A34A" }]}>
                    <Feather name="check-circle" size={10} color="#fff" />
                    <Text style={styles.activePillText}>Active</Text>
                  </View>
                  <Text style={styles.heroName} numberOfLines={1}>{l.businessName}</Text>
                  <Text style={styles.heroPrice}>{formatPrice(l.askingPrice)}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    {l.suburb}, {l.state} · {l.category}
                  </Text>
                  <View style={styles.metrics}>
                    {[
                      { l: "Views", v: l.viewCount  },
                      { l: "Saved", v: l.savedCount  },
                      { l: "Tours", v: l.tourStarts  },
                    ].map(({ l: lbl, v }) => (
                      <View key={lbl} style={styles.metric}>
                        <Text style={[styles.metVal, { color: colors.primary }]}>{v}</Text>
                        <Text style={[styles.metLbl, { color: colors.mutedForeground }]}>{lbl}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }

          // User-submitted listing
          const { item } = row;
          const sc = STATUS_CONFIG[item.status];
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: item.status === "rejected" ? "#EF444440" : colors.border }]}>
              <View style={[styles.cardHero, { backgroundColor: item.heroColor ?? "#2563EB" }]}>
                <View style={[styles.activePill, { backgroundColor: sc.color }]}>
                  <Feather name={sc.icon as any} size={10} color="#fff" />
                  <Text style={styles.activePillText}>{sc.label}</Text>
                </View>
                <Text style={styles.heroName} numberOfLines={1}>{item.businessName}</Text>
                <Text style={styles.heroPrice}>
                  {item.askingPrice && item.askingPrice > 0 ? formatPrice(item.askingPrice) : "Price TBC"}
                </Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {item.suburb}{item.state ? `, ${item.state}` : ""} · {item.category}
                </Text>
                {item.status === "pending" && (
                  <View style={[styles.statusNote, { backgroundColor: "#F59E0B12", borderColor: "#F59E0B30" }]}>
                    <Feather name="info" size={12} color="#F59E0B" />
                    <Text style={[styles.statusNoteText, { color: "#F59E0B" }]}>
                      Awaiting admin approval. Typically reviewed within 1 business day.
                    </Text>
                  </View>
                )}
                {item.status === "rejected" && (
                  <View style={[styles.statusNote, { backgroundColor: "#EF444412", borderColor: "#EF444430" }]}>
                    <Feather name="alert-circle" size={12} color="#EF4444" />
                    <Text style={[styles.statusNoteText, { color: "#EF4444" }]}>
                      Not approved. Contact support or revise and resubmit.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardHero: { height: 90, padding: 14, justifyContent: "flex-end", gap: 2 },
  activePill: { position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  activePillText: { color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  heroName: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  heroPrice: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  cardBody: { padding: 12, gap: 8 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  metrics: { flexDirection: "row", gap: 20 },
  metric: {},
  metVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  metLbl: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  statusNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  statusNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
