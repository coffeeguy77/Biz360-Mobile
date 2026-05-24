import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BADGE_LABELS, Listing, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

interface Props {
  listing: Listing;
  onSave?: (id: string) => void;
  isSaved?: boolean;
}

export function ListingCard({ listing, onSave, isSaved }: Props) {
  const colors = useColors();

  const primaryBadges = listing.badges.slice(0, 3);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/listing/${listing.id}` as any)}
      activeOpacity={0.92}
    >
      <View style={[styles.heroImage, { backgroundColor: listing.heroColor }]}>
        {listing.imageUrl && (
          <Image source={{ uri: listing.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
        <View style={styles.heroOverlay}>
          <View style={styles.heroTopRow}>
            {listing.confidential && (
              <View style={[styles.pill, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
                <Feather name="eye-off" size={10} color="#fff" />
                <Text style={styles.pillText}>Confidential</Text>
              </View>
            )}
            {listing.hasTour && (
              <View style={[styles.pill, { backgroundColor: "#2563EB" }]}>
                <Feather name="rotate-ccw" size={10} color="#fff" />
                <Text style={styles.pillText}>360 Tour</Text>
              </View>
            )}
          </View>
          <Text style={styles.heroPrice}>{formatPrice(listing.askingPrice)}</Text>
        </View>

        {onSave && (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => onSave(listing.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={20}
              color={isSaved ? "#3B82F6" : "#fff"}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {listing.businessName}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {listing.suburb}, {listing.state}
          </Text>
          <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {listing.category}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              ${listing.weeklyRevenue.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              /week revenue
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.accent }]}>
              ${listing.adjustedProfit.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              SDE p.a.
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {listing.staffCount}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              staff
            </Text>
          </View>
        </View>

        {primaryBadges.length > 0 && (
          <View style={styles.badgeRow}>
            {primaryBadges.map((badge) => (
              <View
                key={badge}
                style={[styles.badge, { backgroundColor: colors.muted }]}
              >
                <Feather name="check-circle" size={9} color={colors.accent} />
                <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                  {BADGE_LABELS[badge]}
                </Text>
              </View>
            ))}
            {listing.badges.length > 3 && (
              <View style={[styles.badge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                  +{listing.badges.length - 3}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  heroImage: {
    height: 160,
    justifyContent: "flex-end",
  },
  heroOverlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  heroTopRow: {
    flexDirection: "row",
    gap: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pillText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  heroPrice: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  saveBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: 14,
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  meta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  dot: {
    fontSize: 12,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
});
