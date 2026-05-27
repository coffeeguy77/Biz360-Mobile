import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

export interface FilterState {
  categories: string[];
  states: string[];
  hasTour: boolean;
  verified: boolean;
  maxPrice: number | null;
}

const CATEGORIES = [
  "Food & Beverage",
  "Health & Beauty",
  "Services",
  "Health & Fitness",
  "Retail",
  "Professional Services",
];

const AU_STATES = ["VIC", "NSW", "QLD", "WA", "SA", "ACT", "TAS", "NT"];

interface Props {
  visible: boolean;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  onClose: () => void;
}

export function FilterSheet({ visible, filters, onApply, onClose }: Props) {
  const colors = useColors();
  const [local, setLocal] = useState<FilterState>(filters);

  const toggleCategory = (c: string) => {
    setLocal((f) => ({
      ...f,
      categories: f.categories.includes(c)
        ? f.categories.filter((x) => x !== c)
        : [...f.categories, c],
    }));
  };

  const toggleState = (s: string) => {
    setLocal((f) => ({
      ...f,
      states: f.states.includes(s)
        ? f.states.filter((x) => x !== s)
        : [...f.states, s],
    }));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.handle} />
          <View style={styles.topRow}>
            <Text style={[styles.heading, { color: colors.foreground }]}>Filter</Text>
            <TouchableOpacity
              onPress={() =>
                setLocal({ categories: [], states: [], hasTour: false, verified: false, maxPrice: null })
              }
            >
              <Text style={[styles.reset, { color: colors.primary }]}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              CATEGORY
            </Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: local.categories.includes(c)
                        ? colors.primary
                        : colors.muted,
                    },
                  ]}
                  onPress={() => toggleCategory(c)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: local.categories.includes(c)
                          ? "#fff"
                          : colors.foreground,
                      },
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              STATE
            </Text>
            <View style={styles.chipRow}>
              {AU_STATES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: local.states.includes(s)
                        ? colors.primary
                        : colors.muted,
                    },
                  ]}
                  onPress={() => toggleState(s)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: local.states.includes(s) ? "#fff" : colors.foreground },
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              FEATURES
            </Text>
            <View style={styles.toggleRow}>
              {[
                { key: "hasTour", label: "360 Tour Available", icon: "rotate-ccw" },
                { key: "verified", label: "Verified Listing", icon: "check-circle" },
              ].map(({ key, label, icon }) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.toggleItem,
                    {
                      backgroundColor: (local as any)[key] ? colors.primary + "18" : colors.muted,
                      borderColor: (local as any)[key] ? colors.primary : "transparent",
                    },
                  ]}
                  onPress={() =>
                    setLocal((f) => ({ ...f, [key]: !(f as any)[key] }))
                  }
                >
                  <Feather
                    name={icon as any}
                    size={15}
                    color={(local as any)[key] ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.toggleLabel,
                      {
                        color: (local as any)[key] ? colors.primary : colors.foreground,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              onApply(local);
              onClose();
            }}
          >
            <Text style={styles.applyText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: "85%",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#ccc", alignSelf: "center",
    marginTop: 10, marginBottom: 14,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  heading: { fontSize: 18, fontFamily: "Inter_700Bold" },
  reset: { fontSize: 14, fontFamily: "Inter_500Medium" },
  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginTop: 16, marginBottom: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  toggleRow: { gap: 8 },
  toggleItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  applyBtn: {
    marginTop: 20, paddingVertical: 15, borderRadius: 14, alignItems: "center",
  },
  applyText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
