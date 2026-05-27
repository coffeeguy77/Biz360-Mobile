import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Listing, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { getPendingListings } from "@/lib/adminStore";
import { pendingToListing } from "@/lib/listingUtils";
import { getSavedIds, toggleSaved } from "@/lib/savedStore";

export default function SavedScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();

  const [listings,  setListings]  = useState<Listing[]>([]);
  const [kvLoading, setKvLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setKvLoading(true);
      Promise.all([getPendingListings(), getSavedIds()]).then(([pending, ids]) => {
        if (!active) return;
        const approved = pending
          .filter((p) => p.status === "approved")
          .map(pendingToListing)
          .filter((l) => ids.includes(l.id));
        setListings(approved);
        setKvLoading(false);
      });
      return () => { active = false; };
    }, []),
  );

  const handleUnsave = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleSaved(id);
    setListings((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Saved</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {kvLoading ? "Loading…" : `${listings.length} saved ${listings.length === 1 ? "listing" : "listings"}`}
        </Text>
      </View>

      {kvLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.85}
              onPress={() => router.push(`/listing/${item.id}` as any)}
            >
              <View style={[styles.cardColor, { backgroundColor: item.heroColor }]}>
                <Text style={styles.cardInitial}>{item.businessName.charAt(0)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.businessName}
                </Text>
                <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                  {item.suburb}, {item.state} · {item.category}
                </Text>
                <Text style={[styles.cardPrice, { color: colors.primary }]}>
                  {formatPrice(item.askingPrice)}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.unsaveBtn, { backgroundColor: colors.primary + "18" }]}
                onPress={() => handleUnsave(item.id)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Feather name="bookmark" size={18} color={colors.primary} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
                <Feather name="bookmark" size={36} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No saved listings yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Tap the bookmark icon on any listing in Discover to save it here
              </Text>
              <TouchableOpacity
                style={[styles.discoverBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/(tabs)/discover" as any)}
              >
                <Feather name="search" size={15} color="#fff" />
                <Text style={styles.discoverBtnText}>Browse Listings</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 4 },
  title:        { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle:     { fontSize: 13, fontFamily: "Inter_400Regular" },
  loadingWrap:  { flex: 1, alignItems: "center", justifyContent: "center" },
  list:         { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  card:         { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  cardColor:    { width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardInitial:  { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  cardInfo:     { flex: 1, gap: 3 },
  cardName:     { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardMeta:     { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardPrice:    { fontSize: 15, fontFamily: "Inter_700Bold", marginTop: 2 },
  unsaveBtn:    { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  empty:        { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 40 },
  emptyIcon:    { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle:   { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText:    { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  discoverBtn:  { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  discoverBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
