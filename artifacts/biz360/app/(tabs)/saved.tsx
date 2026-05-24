import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "@/components/ListingCard";
import { DEMO_LISTINGS } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

const SAVED_DEMO = [DEMO_LISTINGS[0], DEMO_LISTINGS[3]];

export default function SavedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState(SAVED_DEMO);

  const remove = (id: string) => setSaved((p) => p.filter((l) => l.id !== id));

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
          {saved.length} saved {saved.length === 1 ? "listing" : "listings"}
        </Text>
      </View>

      <FlatList
        data={saved}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <ListingCard listing={item} onSave={() => remove(item.id)} isSaved />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) },
        ]}
        scrollEnabled={!!saved.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="bookmark" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No saved listings</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Save businesses you're interested in from the Discover tab
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, gap: 4,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  list: { paddingHorizontal: 16, paddingTop: 16 },
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },
});
