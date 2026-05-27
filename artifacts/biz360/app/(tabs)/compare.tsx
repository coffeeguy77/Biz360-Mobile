import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Listing, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { getPendingListings } from "@/lib/adminStore";
import { pendingToListing } from "@/lib/listingUtils";
import { getSavedIds } from "@/lib/savedStore";

const FIELDS = [
  { key: "askingPrice",    label: "Asking Price",    fmt: (v: number) => formatPrice(v) },
  { key: "weeklyRevenue",  label: "Weekly Revenue",  fmt: (v: number) => `$${v.toLocaleString()}` },
  { key: "adjustedProfit", label: "SDE p.a.",         fmt: (v: number) => `$${v.toLocaleString()}` },
  { key: "rent",           label: "Monthly Rent",    fmt: (v: number) => `$${v.toLocaleString()}` },
  { key: "staffCount",     label: "Staff",           fmt: (v: number) => String(v) },
  { key: "ownerHours",     label: "Owner Hours/wk",  fmt: (v: number) => `${v}h` },
] as const;

type Slot = Listing | null;

export default function CompareScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [listings,   setListings]   = useState<Listing[]>([]);
  const [savedIds,   setSavedIds]   = useState<string[]>([]);
  const [slots,      setSlots]      = useState<[Slot, Slot]>([null, null]);
  const [pickerSlot, setPickerSlot] = useState<0 | 1 | null>(null);
  const [search,     setSearch]     = useState("");
  const [pickerTab,  setPickerTab]  = useState<"favourites" | "all">("favourites");
  const [kvLoading,  setKvLoading]  = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setKvLoading(true);
      Promise.all([getPendingListings(), getSavedIds()]).then(([pending, ids]) => {
        if (!active) return;
        const approved = pending
          .filter((p) => p.status === "approved")
          .map(pendingToListing);
        setListings(approved);
        setSavedIds(ids);
        setKvLoading(false);
      });
      return () => { active = false; };
    }, []),
  );

  const otherSlotId = (slotIdx: 0 | 1) =>
    slots[slotIdx === 0 ? 1 : 0]?.id ?? null;

  const openPicker = (idx: 0 | 1) => {
    const hasFavourites = listings.some((l) => savedIds.includes(l.id));
    setPickerTab(hasFavourites ? "favourites" : "all");
    setSearch("");
    setPickerSlot(idx);
  };

  const selectListing = (listing: Listing) => {
    if (pickerSlot === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next: [Slot, Slot] = [...slots] as [Slot, Slot];
    next[pickerSlot] = listing;
    setSlots(next);
    setPickerSlot(null);
  };

  const clearSlot = (idx: 0 | 1) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next: [Slot, Slot] = [...slots] as [Slot, Slot];
    next[idx] = null;
    setSlots(next);
  };

  const pickerListings = useMemo(() => {
    const q    = search.toLowerCase();
    const base = pickerTab === "favourites"
      ? listings.filter((l) => savedIds.includes(l.id))
      : listings;
    return base.filter((l) => {
      if (pickerSlot !== null && l.id === otherSlotId(pickerSlot)) return false;
      if (!q) return true;
      return (
        l.businessName.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        l.suburb.toLowerCase().includes(q)
      );
    });
  }, [listings, savedIds, pickerTab, search, pickerSlot, slots]);

  const bothFilled = slots[0] !== null && slots[1] !== null;
  const padBottom  = insets.bottom + (Platform.OS === "web" ? 84 : 80);
  const padTop     = insets.top + (Platform.OS === "web" ? 67 : 0) + 12;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: padTop, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Compare</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Side-by-side comparison
        </Text>
      </View>

      {kvLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: padBottom }]}
        >
          {/* ── Slot cards ── */}
          <View style={styles.slotsRow}>
            {([0, 1] as const).map((idx) => {
              const slot = slots[idx];
              return slot ? (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.85}
                  style={[styles.filledSlot, { backgroundColor: slot.heroColor }]}
                  onPress={() => openPicker(idx)}
                >
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => clearSlot(idx)}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <Feather name="x" size={14} color="rgba(255,255,255,0.9)" />
                  </TouchableOpacity>
                  <Text style={styles.slotName} numberOfLines={2}>{slot.businessName}</Text>
                  <Text style={styles.slotMeta}>{slot.suburb}, {slot.state}</Text>
                  <Text style={styles.slotPrice}>{formatPrice(slot.askingPrice)}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.8}
                  style={[styles.emptySlot, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => openPicker(idx)}
                >
                  <View style={[styles.addIcon, { backgroundColor: colors.primary + "20" }]}>
                    <Feather name="plus" size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.emptySlotText, { color: colors.mutedForeground }]}>
                    Add listing
                  </Text>
                  <Text style={[styles.emptySlotHint, { color: colors.mutedForeground }]}>
                    Tap to browse
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Comparison table ── */}
          {bothFilled && (
            <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {FIELDS.map((field, fi) => {
                const v0 = (slots[0] as any)[field.key] as number;
                const v1 = (slots[1] as any)[field.key] as number;
                const rowBg = fi % 2 === 0 ? colors.card : colors.background;
                return (
                  <View key={field.key} style={[styles.tableRow, { backgroundColor: rowBg, borderBottomColor: colors.border }]}>
                    <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{field.label}</Text>
                    <Text style={[styles.rowVal, { color: colors.foreground }]}>{field.fmt(v0)}</Text>
                    <Text style={[styles.rowVal, { color: colors.foreground }]}>{field.fmt(v1)}</Text>
                  </View>
                );
              })}

              {/* 360 Tour row */}
              <View style={[styles.tableRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>360 Tour</Text>
                {([0, 1] as const).map((idx) => (
                  <View key={idx} style={styles.rowCenter}>
                    <Feather
                      name={slots[idx]!.hasTour ? "check-circle" : "x-circle"}
                      size={18}
                      color={slots[idx]!.hasTour ? "#16A34A" : "#EF4444"}
                    />
                  </View>
                ))}
              </View>

              {/* Badges row */}
              <View style={[styles.tableRow, { backgroundColor: colors.background, borderBottomWidth: 0 }]}>
                <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>Badges</Text>
                {([0, 1] as const).map((idx) => (
                  <Text key={idx} style={[styles.rowVal, { color: colors.foreground }]}>
                    {(slots[idx]!.badges ?? []).length} verified
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* ── View listing buttons ── */}
          {bothFilled && (
            <View style={styles.actionsRow}>
              {([0, 1] as const).map((idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.viewBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push(`/listing/${slots[idx]!.id}` as any)}
                >
                  <Text style={styles.viewBtnText}>View Listing</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Hint when not both filled ── */}
          {!bothFilled && (
            <View style={[styles.hint, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="columns" size={24} color={colors.mutedForeground} />
              <Text style={[styles.hintTitle, { color: colors.foreground }]}>
                {slots[0] || slots[1] ? "Add one more listing" : "Choose 2 listings to compare"}
              </Text>
              <Text style={[styles.hintSub, { color: colors.mutedForeground }]}>
                Tap a slot above to pick from your saved favourites or browse all listings
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Picker Modal ── */}
      <Modal
        visible={pickerSlot !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerSlot(null)}
      >
        <View style={[styles.picker, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>
              Choose a listing
            </Text>
            <TouchableOpacity onPress={() => setPickerSlot(null)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search businesses..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Feather name="x-circle" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Tabs */}
          <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
            {(["favourites", "all"] as const).map((tab) => {
              const active = pickerTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                  onPress={() => setPickerTab(tab)}
                >
                  {tab === "favourites" && (
                    <Feather name="bookmark" size={13} color={active ? colors.primary : colors.mutedForeground} />
                  )}
                  <Text style={[styles.tabText, { color: active ? colors.primary : colors.mutedForeground }]}>
                    {tab === "favourites" ? "Favourites" : "All Listings"}
                    {tab === "favourites" && savedIds.length > 0 ? ` (${savedIds.length})` : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Listing list */}
          {pickerListings.length === 0 ? (
            <View style={styles.pickerEmpty}>
              <Feather
                name={pickerTab === "favourites" ? "bookmark" : "search"}
                size={36}
                color={colors.mutedForeground}
              />
              <Text style={[styles.pickerEmptyTitle, { color: colors.foreground }]}>
                {pickerTab === "favourites" ? "No saved listings" : "No listings found"}
              </Text>
              <Text style={[styles.pickerEmptySub, { color: colors.mutedForeground }]}>
                {pickerTab === "favourites"
                  ? "Save listings in the Discover tab first"
                  : "Try a different search term"}
              </Text>
              {pickerTab === "favourites" && (
                <TouchableOpacity onPress={() => setPickerTab("all")} style={[styles.switchAllBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.switchAllBtnText}>Browse all listings</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={pickerListings}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.pickerList}
              renderItem={({ item }) => {
                const isCurrent = pickerSlot !== null && slots[pickerSlot]?.id === item.id;
                const isSaved   = savedIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.pickerRow,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      isCurrent && { borderColor: colors.primary },
                    ]}
                    onPress={() => selectListing(item)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.pickerColor, { backgroundColor: item.heroColor }]}>
                      <Text style={styles.pickerInitial}>{item.businessName.charAt(0)}</Text>
                    </View>
                    <View style={styles.pickerInfo}>
                      <Text style={[styles.pickerName, { color: colors.foreground }]} numberOfLines={1}>
                        {item.businessName}
                      </Text>
                      <Text style={[styles.pickerMeta, { color: colors.mutedForeground }]}>
                        {item.suburb}, {item.state} · {formatPrice(item.askingPrice)}
                      </Text>
                    </View>
                    <View style={styles.pickerRight}>
                      {isSaved && (
                        <Feather name="bookmark" size={13} color={colors.primary} style={styles.savedBadge} />
                      )}
                      {isCurrent
                        ? <Feather name="check-circle" size={18} color={colors.primary} />
                        : <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                      }
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 4 },
  title:           { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle:        { fontSize: 13, fontFamily: "Inter_400Regular" },
  loadingWrap:     { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll:          { padding: 16, gap: 14 },

  slotsRow:        { flexDirection: "row", gap: 10 },
  emptySlot:       { flex: 1, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", padding: 20, alignItems: "center", gap: 8, minHeight: 130 },
  addIcon:         { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  emptySlotText:   { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptySlotHint:   { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", opacity: 0.7 },
  filledSlot:      { flex: 1, borderRadius: 14, padding: 14, gap: 4, minHeight: 130 },
  clearBtn:        { alignSelf: "flex-end", width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" },
  slotName:        { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18, marginTop: 2 },
  slotMeta:        { color: "rgba(255,255,255,0.72)", fontSize: 11, fontFamily: "Inter_400Regular" },
  slotPrice:       { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 4 },

  tableCard:       { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  tableRow:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 13, borderBottomWidth: 1 },
  rowLabel:        { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  rowVal:          { flex: 1.2, fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  rowCenter:       { flex: 1.2, alignItems: "center" },

  actionsRow:      { flexDirection: "row", gap: 10 },
  viewBtn:         { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  viewBtnText:     { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },

  hint:            { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: "center", gap: 10 },
  hintTitle:       { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  hintSub:         { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18, opacity: 0.75 },

  picker:          { flex: 1 },
  pickerHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1 },
  pickerTitle:     { fontSize: 17, fontFamily: "Inter_700Bold" },
  searchWrap:      { flexDirection: "row", alignItems: "center", gap: 8, margin: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  searchInput:     { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  tabs:            { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 14 },
  tab:             { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10 },
  tabText:         { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pickerList:      { paddingHorizontal: 14, paddingTop: 10, gap: 8, paddingBottom: 40 },
  pickerRow:       { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  pickerColor:     { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  pickerInitial:   { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  pickerInfo:      { flex: 1, gap: 3 },
  pickerName:      { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  pickerMeta:      { fontSize: 12, fontFamily: "Inter_400Regular" },
  pickerRight:     { flexDirection: "row", alignItems: "center", gap: 4 },
  savedBadge:      { marginRight: 2 },
  pickerEmpty:     { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 10 },
  pickerEmptyTitle:{ fontSize: 16, fontFamily: "Inter_600SemiBold" },
  pickerEmptySub:  { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  switchAllBtn:    { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  switchAllBtnText:{ color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
