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
import { BADGE_LABELS, Listing, StatSlotOption, formatPrice } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

interface Props {
  listing: Listing;
  onSave?: (id: string) => void;
  isSaved?: boolean;
  onLongPress?: (id: string) => void;
}

function getStatSlot(
  opt: string | undefined,
  listing: Listing,
): { value: string; label: string; accent?: boolean } | null {
  switch (opt) {
    case "none":          return null;
    case "sde":           return listing.adjustedProfit > 0 ? { value: `$${listing.adjustedProfit.toLocaleString()}`, label: "SDE p.a.", accent: true } : null;
    case "staffCount":    return { value: String(listing.staffCount), label: "staff" };
    case "weeklyRevenue": return listing.weeklyRevenue > 0 ? { value: `$${listing.weeklyRevenue.toLocaleString()}`, label: "/week revenue" } : null;
    case "rent":          return listing.rent > 0 ? { value: `$${listing.rent.toLocaleString()}`, label: "/month rent" } : null;
    case "ownerHours":    return listing.ownerHours > 0 ? { value: `${listing.ownerHours}h`, label: "owner hrs/wk" } : null;
    case "leaseExpiry":   return listing.leaseExpiry ? { value: listing.leaseExpiry, label: "lease expiry" } : null;
    default:              return null;
  }
}

export function ListingCard({ listing, onSave, isSaved, onLongPress }: Props) {
  const colors = useColors();

  const primaryBadges = listing.badges.slice(0, 3);
  const slot2 = getStatSlot(listing.stat2Display ?? "sde", listing);
  const slot3 = getStatSlot(listing.stat3Display ?? "staffCount", listing);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/listing/${listing.id}` as any)}
      onLongPress={onLongPress ? () => onLongPress(listing.id) : undefined}
      delayLongPress={400}
      activeOpacity={0.92}
    >
      <View style={[styles.heroImage, { backgroundColor: listing.heroColor }]}>
        {listing.imageUrl && (
          <Image source={{ uri: listing.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
        {(listing.confidential || listing.hasTour) && (
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
          </View>
        )}

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
            {listing.priceDisplay === "poa" ? (
              <>
                <Text style={[styles.statValue, { color: colors.foreground }]}>POA</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Contact Seller</Text>
              </>
            ) : listing.priceDisplay === "weeklyRevenue" ? (
              <>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  ${listing.weeklyRevenue.toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>/week revenue</Text>
              </>
            ) : (
              <>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {formatPrice(listing.askingPrice)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>asking price</Text>
              </>
            )}
          </View>
          {slot2 && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
          {slot2 && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: slot2.accent ? colors.accent : colors.foreground }]}>{slot2.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{slot2.label}</Text>
            </View>
          )}
          {slot3 && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
          {slot3 && (
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: slot3.accent ? colors.accent : colors.foreground }]}>{slot3.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{slot3.label}</Text>
            </View>
          )}
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 10,
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
