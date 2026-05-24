import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEMO_LISTINGS, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

const BROKER_LISTINGS = [DEMO_LISTINGS[3], DEMO_LISTINGS[4]];

export default function BrokerListings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Listings</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/create-listing" as any)}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={BROKER_LISTINGS}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/listing/${item.id}` as any)}>
            <View style={[styles.cardHero, { backgroundColor: item.heroColor }]}>
              <Text style={styles.heroName} numberOfLines={1}>{item.businessName}</Text>
              <Text style={styles.heroPrice}>{formatPrice(item.askingPrice)}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{item.suburb}, {item.state} · {item.category}</Text>
              <View style={styles.metrics}>
                {[
                  { l: "Views", v: item.viewCount },
                  { l: "Saved", v: item.savedCount },
                  { l: "Tour Starts", v: item.tourStarts },
                ].map(({ l, v }) => (
                  <View key={l} style={styles.metric}>
                    <Text style={[styles.metVal, { color: colors.primary }]}>{v}</Text>
                    <Text style={[styles.metLbl, { color: colors.mutedForeground }]}>{l}</Text>
                  </View>
                ))}
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
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardHero: { height: 90, padding: 14, justifyContent: "flex-end", gap: 2 },
  heroName: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  heroPrice: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  cardBody: { padding: 12, gap: 8 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  metrics: { flexDirection: "row", gap: 20 },
  metric: {},
  metVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  metLbl: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
});
