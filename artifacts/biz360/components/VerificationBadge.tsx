import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BADGE_LABELS, VerificationBadge as BadgeType } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

interface Props {
  badges: BadgeType[];
}

const BADGE_ICONS: Record<string, string> = {
  identity: "user-check",
  abn: "briefcase",
  financials: "file-text",
  lease: "home",
  equipment: "tool",
  tour: "rotate-ccw",
  broker: "shield",
  accountant: "check-square",
  seller_supplied: "upload",
};

export function VerificationBadges({ badges }: Props) {
  const colors = useColors();

  if (badges.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: colors.mutedForeground }]}>
        Verified Information
      </Text>
      <View style={styles.grid}>
        {badges.map((badge) => (
          <View
            key={badge}
            style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.accent + "20" }]}>
              <Feather
                name={(BADGE_ICONS[badge] as any) || "check"}
                size={14}
                color={colors.accent}
              />
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {BADGE_LABELS[badge]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  heading: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
