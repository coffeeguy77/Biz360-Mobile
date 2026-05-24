import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEMO_LISTINGS } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

const cafe = DEMO_LISTINGS[0];

export default function ToursScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>360 Tours</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.tourCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.tourHero, { backgroundColor: cafe.heroColor }]}>
            <Feather name="rotate-ccw" size={28} color="#fff" />
            <Text style={styles.tourHeroTitle}>{cafe.businessName}</Text>
          </View>
          <View style={styles.tourBody}>
            <View style={styles.tourStats}>
              <View style={styles.tourStat}>
                <Text style={[styles.tourStatVal, { color: colors.primary }]}>{cafe.tourSpaces?.length ?? 0}</Text>
                <Text style={[styles.tourStatLbl, { color: colors.mutedForeground }]}>Spaces</Text>
              </View>
              <View style={styles.tourStat}>
                <Text style={[styles.tourStatVal, { color: colors.primary }]}>
                  {cafe.tourSpaces?.reduce((acc, s) => acc + s.pins.length, 0) ?? 0}
                </Text>
                <Text style={[styles.tourStatLbl, { color: colors.mutedForeground }]}>Pins</Text>
              </View>
              <View style={styles.tourStat}>
                <Text style={[styles.tourStatVal, { color: colors.primary }]}>{cafe.tourStarts}</Text>
                <Text style={[styles.tourStatLbl, { color: colors.mutedForeground }]}>Starts</Text>
              </View>
              <View style={styles.tourStat}>
                <Text style={[styles.tourStatVal, { color: colors.accent }]}>89%</Text>
                <Text style={[styles.tourStatLbl, { color: colors.mutedForeground }]}>Completion</Text>
              </View>
            </View>

            <Text style={[styles.spacesTitle, { color: colors.foreground }]}>Tour Spaces</Text>
            {cafe.tourSpaces?.map((space) => (
              <View key={space.id} style={[styles.spaceRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.spaceIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="camera" size={16} color={colors.primary} />
                </View>
                <View style={styles.spaceInfo}>
                  <Text style={[styles.spaceName, { color: colors.foreground }]}>{space.name}</Text>
                  <Text style={[styles.spaceMeta, { color: colors.mutedForeground }]}>
                    {space.photos.length} photos · {space.pins.length} pins
                  </Text>
                </View>
                <TouchableOpacity onPress={() => router.push(`/tour/${cafe.id}` as any)}>
                  <Feather name="eye" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]}>
                <Feather name="plus" size={14} color={colors.foreground} />
                <Text style={[styles.btnText, { color: colors.foreground }]}>Add Space</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/tour/${cafe.id}` as any)}>
                <Feather name="rotate-ccw" size={14} color="#fff" />
                <Text style={[styles.btnText, { color: "#fff" }]}>Preview Tour</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, gap: 16 },
  tourCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  tourHero: { height: 100, alignItems: "center", justifyContent: "center", gap: 8 },
  tourHeroTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  tourBody: { padding: 14, gap: 14 },
  tourStats: { flexDirection: "row", justifyContent: "space-between" },
  tourStat: { alignItems: "center" },
  tourStatVal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  tourStatLbl: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  spacesTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  spaceRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  spaceIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  spaceInfo: { flex: 1 },
  spaceName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  spaceMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  btnRow: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12 },
  btnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
