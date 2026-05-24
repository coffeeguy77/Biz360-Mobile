import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { TourPin } from "@/data/listings";
import { useColors } from "@/hooks/useColors";

interface Props {
  pin: TourPin | null;
  onClose: () => void;
}

const PIN_TYPE_LABELS: Record<string, string> = {
  equipment: "Equipment",
  revenue: "Revenue",
  cogs: "Cost of Goods",
  workflow: "Workflow",
  staffing: "Staffing",
  lease: "Lease",
  risk: "Risk",
  opportunity: "Opportunity",
  narration: "Narration",
};

const PIN_TYPE_COLORS: Record<string, string> = {
  equipment: "#F59E0B",
  revenue: "#16A34A",
  cogs: "#EF4444",
  workflow: "#8B5CF6",
  staffing: "#3B82F6",
  lease: "#F97316",
  risk: "#EF4444",
  opportunity: "#16A34A",
  narration: "#EC4899",
};

const PIN_TYPE_ICONS: Record<string, string> = {
  equipment: "tool",
  revenue: "trending-up",
  cogs: "package",
  workflow: "git-branch",
  staffing: "users",
  lease: "home",
  risk: "alert-triangle",
  opportunity: "star",
  narration: "mic",
};

export function PinSheet({ pin, onClose }: Props) {
  const colors = useColors();

  if (!pin) return null;

  const pinColor = PIN_TYPE_COLORS[pin.type] ?? "#3B82F6";
  const pinIcon = (PIN_TYPE_ICONS[pin.type] ?? "info") as any;
  const pinLabel = PIN_TYPE_LABELS[pin.type] ?? pin.type;

  return (
    <Modal
      visible={!!pin}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={[styles.typeTag, { backgroundColor: pinColor + "22", borderColor: pinColor + "44" }]}>
              <Feather name={pinIcon} size={13} color={pinColor} />
              <Text style={[styles.typeLabel, { color: pinColor }]}>{pinLabel}</Text>
            </View>
            {pin.requiresNDA && (
              <View style={[styles.ndaTag, { backgroundColor: "#EF444422", borderColor: "#EF444444" }]}>
                <Feather name="lock" size={12} color="#EF4444" />
                <Text style={[styles.typeLabel, { color: "#EF4444" }]}>NDA Required</Text>
              </View>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
            <Text style={[styles.title, { color: colors.foreground }]}>{pin.title}</Text>
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {pin.description}
            </Text>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={onClose}
            >
              <Feather name="message-circle" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Ask Seller About This</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: "70%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  typeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  ndaTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  closeBtn: {
    marginLeft: "auto",
    padding: 4,
  },
  body: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
