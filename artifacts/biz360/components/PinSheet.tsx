import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  Linking,
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
  equipment:    "Equipment",
  revenue:      "Revenue",
  cogs:         "Cost of Goods",
  workflow:     "Workflow",
  staffing:     "Staffing",
  lease:        "Lease",
  risk:         "Risk",
  opportunity:  "Opportunity",
  narration:    "Narration",
  inspection:   "Inspection",
  highlight:    "Highlight",
  document:     "Document",
  navigation:   "Navigation",
  look:         "Look",
  external_link:"External Link",
  audio:        "Listen",
};

const PIN_TYPE_COLORS: Record<string, string> = {
  equipment:    "#F59E0B",
  revenue:      "#16A34A",
  cogs:         "#EF4444",
  workflow:     "#8B5CF6",
  staffing:     "#3B82F6",
  lease:        "#F97316",
  risk:         "#EF4444",
  opportunity:  "#16A34A",
  narration:    "#EC4899",
  inspection:   "#06B6D4",
  highlight:    "#F59E0B",
  document:     "#6366F1",
  navigation:   "#3B82F6",
  external_link:"#0891B2",
  audio:        "#EC4899",
};

const PIN_TYPE_ICONS: Record<string, string> = {
  equipment:    "tool",
  revenue:      "trending-up",
  cogs:         "package",
  workflow:     "git-branch",
  staffing:     "users",
  lease:        "home",
  risk:         "alert-triangle",
  opportunity:  "star",
  narration:    "mic",
  inspection:   "clipboard",
  highlight:    "zap",
  document:     "file-text",
  navigation:   "arrow-right-circle",
  external_link:"external-link",
  audio:        "volume-2",
};

export function PinSheet({ pin, onClose }: Props) {
  const colors = useColors();

  if (!pin) return null;

  const pinColor = PIN_TYPE_COLORS[pin.type] ?? "#3B82F6";
  const pinIcon  = (PIN_TYPE_ICONS[pin.type] ?? "info") as any;
  const pinLabel = PIN_TYPE_LABELS[pin.type] ?? pin.type;
  const popup    = pin.popupContent;

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
    onClose();
  };

  return (
    <Modal visible={!!pin} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.handle} />

          {/* Header */}
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
            {/* Popup heading (if rich content has its own heading) */}
            <Text style={[styles.title, { color: colors.foreground }]}>
              {popup?.heading ?? pin.title}
            </Text>

            {/* Look pin — dedicated feature photo */}
            {pin.type === "look" && pin.imageUrl ? (
              <Image
                source={{ uri: pin.imageUrl }}
                style={styles.lookImage}
                resizeMode="cover"
              />
            ) : null}

            {/* Body / description */}
            {(popup?.body || pin.description) ? (
              <Text style={[styles.description, { color: colors.mutedForeground }]}>
                {popup?.body ?? pin.description}
              </Text>
            ) : null}

            {/* Key-value sections */}
            {popup?.sections && popup.sections.length > 0 && (
              <View style={[styles.sectionsCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {popup.sections.map((s, i) => (
                  <View
                    key={i}
                    style={[styles.sectionRow, i < popup.sections!.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  >
                    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
                    <Text style={[styles.sectionValue, { color: colors.foreground }]}>{s.value}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Images */}
            {popup?.images && popup.images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                {popup.images.filter(Boolean).map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.popupImage} resizeMode="cover" />
                ))}
              </ScrollView>
            )}

            {/* Document links */}
            {popup?.docLinks && popup.docLinks.length > 0 && (
              <View style={styles.docLinksSection}>
                {popup.docLinks.filter((d) => d.url).map((doc, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.docLinkBtn, { backgroundColor: "#6366F120", borderColor: "#6366F140" }]}
                    onPress={() => openUrl(doc.url)}
                    activeOpacity={0.7}
                  >
                    <Feather name="file-text" size={15} color="#6366F1" />
                    <Text style={[styles.docLinkText, { color: "#6366F1" }]}>{doc.label || "Open Document"}</Text>
                    <Feather name="external-link" size={13} color="#6366F180" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Audio hotspot info */}
            {pin.type === "audio" && pin.audioUrl && (
              <TouchableOpacity
                style={[styles.audioBtn, { backgroundColor: "#EC489920", borderColor: "#EC489940" }]}
                onPress={() => openUrl(pin.audioUrl!)}
                activeOpacity={0.7}
              >
                <Feather name="volume-2" size={16} color="#EC4899" />
                <Text style={[styles.audioBtnText, { color: "#EC4899" }]}>Play Audio Narration</Text>
              </TouchableOpacity>
            )}

            {/* External link */}
            {pin.type === "external_link" && pin.externalUrl && (
              <TouchableOpacity
                style={[styles.extLinkBtn, { backgroundColor: "#0891B220", borderColor: "#0891B240" }]}
                onPress={() => openUrl(pin.externalUrl!)}
                activeOpacity={0.7}
              >
                <Feather name="external-link" size={15} color="#0891B2" />
                <Text style={[styles.extLinkText, { color: "#0891B2" }]}>Open Link</Text>
              </TouchableOpacity>
            )}

            {/* Document link (document pin type) */}
            {pin.type === "document" && pin.documentUrl && (
              <TouchableOpacity
                style={[styles.docLinkBtn, { backgroundColor: "#6366F120", borderColor: "#6366F140" }]}
                onPress={() => openUrl(pin.documentUrl!)}
                activeOpacity={0.7}
              >
                <Feather name="file-text" size={15} color="#6366F1" />
                <Text style={[styles.docLinkText, { color: "#6366F1" }]}>Open Document</Text>
                <Feather name="external-link" size={13} color="#6366F180" />
              </TouchableOpacity>
            )}
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
  overlay:        { flex: 1, justifyContent: "flex-end" },
  backdrop:       { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet:          { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 32, maxHeight: "80%" },
  handle:         { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginTop: 10, marginBottom: 14 },
  header:         { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  typeTag:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  ndaTag:         { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  typeLabel:      { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  closeBtn:       { marginLeft: "auto", padding: 4 },
  body:           { marginBottom: 16 },
  title:          { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 8 },
  description:    { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24, marginBottom: 12 },
  sectionsCard:   { borderRadius: 12, borderWidth: 1, marginBottom: 14, overflow: "hidden" },
  sectionRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10 },
  sectionLabel:   { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  sectionValue:   { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  lookImage:      { width: "100%", height: 200, borderRadius: 12, marginBottom: 12 },
  imageScroll:    { marginBottom: 14 },
  popupImage:     { width: 180, height: 120, borderRadius: 10, marginRight: 10 },
  docLinksSection:{ gap: 8, marginBottom: 12 },
  docLinkBtn:     { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  docLinkText:    { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  audioBtn:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  audioBtnText:   { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  extLinkBtn:     { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  extLinkText:    { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  footer:         { borderTopWidth: 1, paddingTop: 16 },
  actionBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  actionBtnText:  { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
