import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const MORE_ITEMS = [
  {
    icon:    "list",
    label:   "Listings",
    desc:    "Manage your business listings",
    route:   "/(seller)/listings",
    color:   "#3B82F6",
    bg:      "#1E3A5C",
  },
  {
    icon:    "users",
    label:   "Leads",
    desc:    "Buyer enquiries and leads",
    route:   "/(seller)/leads",
    color:   "#F59E0B",
    bg:      "#431407",
  },
  {
    icon:    "user",
    label:   "Seller Details",
    desc:    "Your public profile & phone visibility",
    route:   "/(seller)/seller-profile",
    color:   "#3B82F6",
    bg:      "#1E3A5C",
  },
  {
    icon:    "book-open",
    label:   "Help & Guides",
    desc:    "Resources and support",
    route:   "/(seller)/help",
    color:   "#8B5CF6",
    bg:      "#2D1B69",
  },
] as const;

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>More</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Additional tools and resources</Text>
        </View>

        {MORE_ITEMS.map(item => (
          <TouchableOpacity
            key={item.label}
            style={[styles.item, { backgroundColor: item.bg, borderColor: item.color + "40" }]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.color + "22" }]}>
              <Feather name={item.icon} size={22} color={item.color} />
            </View>
            <View style={styles.itemText}>
              <Text style={[styles.itemLabel, { color: "#fff" }]}>{item.label}</Text>
              <Text style={[styles.itemDesc, { color: "#8B9CB8" }]}>{item.desc}</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#8B9CB8" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 16, gap: 12 },
  header:    { gap: 2, paddingBottom: 4 },
  title:     { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub:       { fontSize: 13, fontFamily: "Inter_400Regular" },
  item:      { borderRadius: 16, padding: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  iconWrap:  { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  itemText:  { flex: 1, gap: 2 },
  itemLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  itemDesc:  { fontSize: 12, fontFamily: "Inter_400Regular" },
});
