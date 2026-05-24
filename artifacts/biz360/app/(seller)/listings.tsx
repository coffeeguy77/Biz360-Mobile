import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEMO_LISTINGS, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

const MY_LISTINGS = [DEMO_LISTINGS[0]];

export default function SellerListings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>My Listings</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/create-listing" as any)}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={MY_LISTINGS}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/listing/${item.id}` as any)}
          >
            <View style={[styles.cardHero, { backgroundColor: item.heroColor }]}>
              <View style={[styles.statusPill, { backgroundColor: "#16A34A" }]}>
                <Feather name="check-circle" size={10} color="#fff" />
                <Text style={styles.statusText}>Active</Text>
              </View>
              <Text style={styles.heroPrice}>{formatPrice(item.askingPrice)}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardName, { color: colors.foreground }]}>{item.businessName}</Text>
              <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{item.suburb}, {item.state} · {item.category}</Text>
              <View style={styles.metricsRow}>
                {[
                  { label: "Views", val: item.viewCount },
                  { label: "Tour starts", val: item.tourStarts },
                  { label: "Saved", val: item.savedCount },
                ].map(({ label, val }) => (
                  <View key={label} style={styles.metric}>
                    <Text style={[styles.metricVal, { color: colors.primary }]}>{val}</Text>
                    <Text style={[styles.metricLbl, { color: colors.mutedForeground }]}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.muted }]}>
                  <Feather name="edit-2" size={14} color={colors.foreground} />
                  <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/tour/${item.id}` as any)}>
                  <Feather name="rotate-ccw" size={14} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>View Tour</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 16 },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cardHero: { height: 120, padding: 14, justifyContent: "space-between" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusText: { color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  heroPrice: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  cardBody: { padding: 14, gap: 8 },
  cardName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  metricsRow: { flexDirection: "row", gap: 24, paddingVertical: 6 },
  metric: {},
  metricVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  metricLbl: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
