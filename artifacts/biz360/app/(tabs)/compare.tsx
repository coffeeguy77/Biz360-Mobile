import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEMO_LISTINGS, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

const COMPARE = [DEMO_LISTINGS[0], DEMO_LISTINGS[3]];

const FIELDS = [
  { key: "askingPrice", label: "Asking Price", format: (v: number) => formatPrice(v) },
  { key: "weeklyRevenue", label: "Weekly Revenue", format: (v: number) => `$${v.toLocaleString()}` },
  { key: "adjustedProfit", label: "SDE p.a.", format: (v: number) => `$${v.toLocaleString()}` },
  { key: "rent", label: "Monthly Rent", format: (v: number) => `$${v.toLocaleString()}` },
  { key: "staffCount", label: "Staff", format: (v: number) => String(v) },
  { key: "ownerHours", label: "Owner Hours/wk", format: (v: number) => `${v}h` },
];

export default function CompareScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

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
        <Text style={[styles.title, { color: colors.foreground }]}>Compare</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Side-by-side comparison</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) },
        ]}
      >
        <View style={styles.colHeader}>
          <View style={styles.labelCol} />
          {COMPARE.map((l) => (
            <TouchableOpacity
              key={l.id}
              style={[styles.listingCol, { backgroundColor: l.heroColor }]}
              onPress={() => router.push(`/listing/${l.id}` as any)}
            >
              <Text style={styles.colName} numberOfLines={2}>{l.businessName}</Text>
              <Text style={styles.colMeta}>{l.suburb}, {l.state}</Text>
              <Text style={styles.colPrice}>{formatPrice(l.askingPrice)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {FIELDS.map((field, fi) => (
          <View
            key={field.key}
            style={[
              styles.row,
              {
                backgroundColor: fi % 2 === 0 ? colors.card : colors.background,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              {field.label}
            </Text>
            {COMPARE.map((l) => (
              <Text key={l.id} style={[styles.fieldValue, { color: colors.foreground }]}>
                {field.format((l as any)[field.key])}
              </Text>
            ))}
          </View>
        ))}

        <View style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>360 Tour</Text>
          {COMPARE.map((l) => (
            <View key={l.id} style={styles.fieldCenter}>
              <Feather
                name={l.hasTour ? "check-circle" : "x-circle"}
                size={18}
                color={l.hasTour ? "#16A34A" : "#EF4444"}
              />
            </View>
          ))}
        </View>

        <View style={[styles.row, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Badges</Text>
          {COMPARE.map((l) => (
            <Text key={l.id} style={[styles.fieldValue, { color: colors.foreground }]}>
              {l.badges.length} verified
            </Text>
          ))}
        </View>

        <View style={styles.actionsRow}>
          {COMPARE.map((l) => (
            <TouchableOpacity
              key={l.id}
              style={[styles.viewBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push(`/listing/${l.id}` as any)}
            >
              <Text style={styles.viewBtnText}>View Listing</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 4 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  scroll: { padding: 16 },
  colHeader: { flexDirection: "row", gap: 8, marginBottom: 16 },
  labelCol: { flex: 1 },
  listingCol: {
    flex: 1.4, borderRadius: 12, padding: 12, gap: 4,
  },
  colName: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  colMeta: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_400Regular" },
  colPrice: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 4 },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1,
  },
  fieldLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  fieldValue: { flex: 1.4, fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  fieldCenter: { flex: 1.4, alignItems: "center" },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 20 },
  viewBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", marginLeft: "auto" as any,
  },
  viewBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
