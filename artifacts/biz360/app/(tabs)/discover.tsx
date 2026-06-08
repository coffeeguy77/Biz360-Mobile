import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "@/components/ListingCard";
import { FilterSheet, FilterState } from "@/components/FilterSheet";
import { Listing } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { getPendingListings } from "@/lib/adminStore";
import { pendingToListing } from "@/lib/listingUtils";
import { getSavedIds, toggleSaved as persistToggleSaved } from "@/lib/savedStore";

const DEFAULT_FILTERS: FilterState = {
  categories: [], states: [], hasTour: false, verified: false, maxPrice: null,
};


export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [search,      setSearch]      = useState("");
  const [filters,     setFilters]     = useState<FilterState>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [savedIds,    setSavedIds]    = useState<string[]>([]);
  const [listings,    setListings]    = useState<Listing[]>([]);
  const [hiddenIds,   setHiddenIds]   = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getPendingListings(), getSavedIds()]).then(([all, ids]) => {
        if (!active) return;
        const approved = all
          .filter((p) => p.status === "approved")
          .map(pendingToListing);
        setListings(approved);
        setSavedIds(ids);
      });
      return () => { active = false; };
    }, []),
  );

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (hiddenIds.includes(l.id)) return false;
      const q = search.toLowerCase();
      if (q && !l.businessName.toLowerCase().includes(q) &&
        !l.category.toLowerCase().includes(q) &&
        !l.suburb.toLowerCase().includes(q)) return false;
      if (filters.categories.length && !filters.categories.includes(l.category)) return false;
      if (filters.states.length && !filters.states.includes(l.state)) return false;
      if (filters.hasTour && !l.hasTour) return false;
      if (filters.verified && !l.verified) return false;
      if (filters.maxPrice && l.askingPrice > filters.maxPrice) return false;
      return true;
    });
  }, [search, filters, hiddenIds, listings]);

  const toggleSave = async (id: string) => {
    const next = await persistToggleSaved(id);
    setSavedIds(next);
  };

  const handleLongPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const listing = listings.find((l) => l.id === id);
    Alert.alert(
      "Hide Listing",
      `Hide "${listing?.businessName}" from your view?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Hide",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setHiddenIds((prev) => [...prev, id]);
          },
        },
      ],
    );
  };

  const activeFilterCount = filters.categories.length + filters.states.length +
    (filters.hasTour ? 1 : 0) + (filters.verified ? 1 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: colors.foreground }]}>Discover</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {filtered.length} {filtered.length === 1 ? "business" : "businesses"} for sale
          </Text>
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search businesses..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Feather name="x" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[
              styles.filterBtn,
              {
                backgroundColor: activeFilterCount > 0 ? colors.primary : colors.card,
                borderColor:     activeFilterCount > 0 ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setShowFilters(true)}
          >
            <Feather name="sliders" size={16} color={activeFilterCount > 0 ? "#fff" : colors.foreground} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            onSave={user ? toggleSave : undefined}
            isSaved={user ? savedIds.includes(item.id) : false}
            onLongPress={handleLongPress}
          />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) },
        ]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="search" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No listings yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {search || activeFilterCount > 0
                ? "Try different search terms or filters."
                : "Approved listings from sellers will appear here."}
            </Text>
          </View>
        }
      />

      <FilterSheet
        visible={showFilters}
        filters={filters}
        onApply={setFilters}
        onClose={() => setShowFilters(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTop:       { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 },
  title:           { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle:        { fontSize: 13, fontFamily: "Inter_400Regular" },
  searchRow:       { flexDirection: "row", gap: 10, alignItems: "center" },
  searchBox:       { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1 },
  searchInput:     { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  filterBtn:       { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  filterBadge:     { position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  filterBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  list:            { paddingHorizontal: 16, paddingTop: 16 },
  empty:           { alignItems: "center", paddingTop: 80, gap: 10, paddingHorizontal: 32 },
  emptyTitle:      { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyText:       { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
