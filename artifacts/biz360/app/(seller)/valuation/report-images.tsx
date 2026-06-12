import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem("biz360_auth_token");
}

// ─── Role catalogue ────────────────────────────────────────────────────────────
const ROLES = [
  { key: "listing_hero",    label: "Listing Hero",    icon: "star" as const,           color: "#3B82F6", desc: "Primary cover for the IM report", suggestedSection: null },
  { key: "cover_secondary", label: "Secondary Cover", icon: "layers" as const,         color: "#8B5CF6", desc: "Backup cover / header image", suggestedSection: null },
  { key: "exterior",        label: "Exterior",        icon: "home" as const,           color: "#10B981", desc: "Shopfront or building exterior", suggestedSection: "business_location_market_context" },
  { key: "interior",        label: "Interior",        icon: "grid" as const,           color: "#F59E0B", desc: "Inside the business", suggestedSection: "business_overview" },
  { key: "equipment",       label: "Equipment",       icon: "tool" as const,           color: "#EC4899", desc: "Key machinery or assets", suggestedSection: "plant_equipment_summary" },
  { key: "team",            label: "Team",            icon: "users" as const,          color: "#14B8A6", desc: "Staff or team photo", suggestedSection: "staff_owner_involvement" },
  { key: "product",         label: "Product",         icon: "package" as const,        color: "#F97316", desc: "Product or menu items", suggestedSection: "key_selling_points" },
  { key: "360_preview",     label: "360° Preview",    icon: "aperture" as const,       color: "#6366F1", desc: "Tour scene thumbnail (panoramic OK)", suggestedSection: "360_business_walkthrough" },
  { key: "other",           label: "Other",           icon: "more-horizontal" as const, color: "#6B7280", desc: "Any other image", suggestedSection: null },
] as const;
type RoleKey = typeof ROLES[number]["key"];

const PANORAMIC_BLOCKED: RoleKey[] = ["listing_hero", "cover_secondary", "exterior", "interior", "equipment"];

function roleMeta(role: RoleKey) {
  return ROLES.find((r) => r.key === role) ?? ROLES[ROLES.length - 1];
}

function fmtBytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ReportImage {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  cloudinaryPublicId: string;
  imageRole: RoleKey;
  displayName: string | null;
  caption: string | null;
  altText: string | null;
  sectionKey: string | null;
  isPrimary: boolean;
  includeInPdf: boolean;
  includeInHtml: boolean;
  includeInBuyerReport: boolean;
  includeInSellerReport: boolean;
  isPanoramic: boolean;
  sourceType: string;
  sortOrder: number;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
}

interface UsageItem {
  label: string;
  color: string;
}

// ─── Image Editor Modal ────────────────────────────────────────────────────────
function ImageEditorModal({
  image, colors, onClose, onSave,
}: {
  image: ReportImage;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onClose: () => void;
  onSave: (patch: Partial<ReportImage>) => void;
}) {
  const insets = useSafeAreaInsets();
  const [imageRole, setImageRole] = useState<RoleKey>(image.imageRole);
  const [displayName, setDisplayName] = useState(image.displayName ?? "");
  const [caption, setCaption] = useState(image.caption ?? "");
  const [altText, setAltText] = useState(image.altText ?? "");
  const [sectionKey, setSectionKey] = useState(image.sectionKey ?? "");
  const [includeInPdf, setIncludeInPdf] = useState(image.includeInPdf);
  const [includeInBuyerReport, setIncludeInBuyerReport] = useState(image.includeInBuyerReport);
  const [saving, setSaving] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);

  const suggestedSection = roleMeta(imageRole).suggestedSection;
  const availableRoles = image.isPanoramic ? ROLES.filter((r) => !PANORAMIC_BLOCKED.includes(r.key)) : ROLES;

  async function handleSave() {
    setSaving(true);
    try {
      onSave({
        imageRole, displayName: displayName.trim() || null,
        caption: caption.trim() || null, altText: altText.trim() || null,
        sectionKey: sectionKey.trim() || (suggestedSection ?? null) || null,
        includeInPdf, includeInBuyerReport,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={editorStyles.overlay}>
        <View style={[editorStyles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          {/* Header */}
          <View style={editorStyles.sheetHeader}>
            <Text style={[editorStyles.sheetTitle, { color: colors.foreground }]}>Edit Image</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            {/* Thumbnail preview */}
            <Image
              source={{ uri: image.thumbnailUrl ?? image.url }}
              style={editorStyles.thumbPreview}
              resizeMode="cover"
            />

            {image.isPanoramic && (
              <View style={[editorStyles.warnBanner, { borderColor: "#F59E0B44" }]}>
                <Feather name="alert-triangle" size={13} color="#F59E0B" />
                <Text style={editorStyles.warnText}>
                  This is a 360° panoramic image. Cover and listing roles are not available — only 360° Preview is allowed.
                </Text>
              </View>
            )}

            {/* Role picker */}
            <View style={editorStyles.fieldGroup}>
              <Text style={[editorStyles.label, { color: colors.mutedForeground }]}>ROLE</Text>
              <TouchableOpacity
                style={[editorStyles.roleDropdown, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setRolePickerOpen((p) => !p)}
              >
                <Feather name={roleMeta(imageRole).icon} size={14} color={roleMeta(imageRole).color} />
                <Text style={[editorStyles.roleDropdownText, { color: colors.foreground }]}>
                  {roleMeta(imageRole).label}
                </Text>
                <Feather name={rolePickerOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              {rolePickerOpen && (
                <View style={[editorStyles.roleMenu, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  {availableRoles.map((r) => (
                    <TouchableOpacity
                      key={r.key}
                      style={[editorStyles.roleMenuItem, imageRole === r.key && { backgroundColor: r.color + "18" }]}
                      onPress={() => { setImageRole(r.key); setRolePickerOpen(false); }}
                    >
                      <Feather name={r.icon} size={13} color={r.color} />
                      <View style={{ flex: 1 }}>
                        <Text style={[editorStyles.roleMenuItemLabel, { color: colors.foreground }]}>{r.label}</Text>
                        <Text style={[editorStyles.roleMenuItemDesc, { color: colors.mutedForeground }]}>{r.desc}</Text>
                        {r.suggestedSection && (
                          <Text style={editorStyles.roleMenuItemSection}>section: {r.suggestedSection}</Text>
                        )}
                      </View>
                      {imageRole === r.key && <Feather name="check" size={14} color={r.color} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {suggestedSection && (
                <Text style={[editorStyles.hint, { color: colors.mutedForeground }]}>
                  Suggested section: <Text style={{ color: "#60A5FA" }}>{suggestedSection}</Text>
                </Text>
              )}
            </View>

            {/* Display name */}
            <View style={editorStyles.fieldGroup}>
              <Text style={[editorStyles.label, { color: colors.mutedForeground }]}>DISPLAY NAME</Text>
              <TextInput
                style={[editorStyles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g. Shopfront, Interior — Main Area"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Caption */}
            <View style={editorStyles.fieldGroup}>
              <Text style={[editorStyles.label, { color: colors.mutedForeground }]}>CAPTION</Text>
              <TextInput
                style={[editorStyles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                value={caption}
                onChangeText={setCaption}
                placeholder="Appears below the image in the report"
                placeholderTextColor={colors.mutedForeground}
                multiline
              />
            </View>

            {/* Alt text */}
            <View style={editorStyles.fieldGroup}>
              <Text style={[editorStyles.label, { color: colors.mutedForeground }]}>ALT TEXT</Text>
              <TextInput
                style={[editorStyles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                value={altText}
                onChangeText={setAltText}
                placeholder="Describe the image for accessibility"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Section key override */}
            <View style={editorStyles.fieldGroup}>
              <Text style={[editorStyles.label, { color: colors.mutedForeground }]}>SECTION (OPTIONAL OVERRIDE)</Text>
              <TextInput
                style={[editorStyles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                value={sectionKey}
                onChangeText={setSectionKey}
                placeholder={suggestedSection ?? "e.g. business_overview"}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Toggles */}
            <View style={editorStyles.toggleRow}>
              <Toggle label="Include in PDF" value={includeInPdf} onToggle={() => setIncludeInPdf((v) => !v)} colors={colors} />
              <Toggle label="Visible to Buyer" value={includeInBuyerReport} onToggle={() => setIncludeInBuyerReport((v) => !v)} colors={colors} />
            </View>

            <TouchableOpacity
              style={[editorStyles.saveBtn, { opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="check" size={16} color="#fff" />}
              <Text style={editorStyles.saveBtnText}>{saving ? "Saving…" : "Save Changes"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Toggle({ label, value, onToggle, colors }: {
  label: string; value: boolean; onToggle: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <TouchableOpacity style={editorStyles.toggle} onPress={onToggle}>
      <View style={[editorStyles.toggleDot, { backgroundColor: value ? "#16A34A" : colors.border }]}>
        <Feather name={value ? "check" : "x"} size={10} color="#fff" />
      </View>
      <Text style={[editorStyles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const editorStyles = StyleSheet.create({
  overlay:           { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  sheet:             { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%", gap: 4 },
  sheetHeader:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sheetTitle:        { fontSize: 18, fontFamily: "Inter_700Bold" },
  thumbPreview:      { width: "100%", height: 160, borderRadius: 12 },
  warnBanner:        { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, backgroundColor: "#7c2d1208" },
  warnText:          { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#D97706", lineHeight: 17 },
  fieldGroup:        { gap: 6 },
  label:             { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  input:             { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 13, fontFamily: "Inter_400Regular" },
  roleDropdown:      { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  roleDropdownText:  { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  roleMenu:          { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  roleMenuItem:      { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#1E3A5C" },
  roleMenuItemLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  roleMenuItemDesc:  { fontSize: 11, fontFamily: "Inter_400Regular" },
  roleMenuItemSection: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#60A5FA", marginTop: 2 },
  hint:              { fontSize: 11, fontFamily: "Inter_400Regular" },
  toggleRow:         { flexDirection: "row", gap: 10 },
  toggle:            { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#1E3A5C" },
  toggleDot:         { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  toggleLabel:       { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  saveBtn:           { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3B82F6", borderRadius: 14, paddingVertical: 14 },
  saveBtnText:       { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function ReportImagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe } = useValuation();
  const [images, setImages] = useState<ReportImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleKey>("listing_hero");
  const [editingImage, setEditingImage] = useState<ReportImage | null>(null);

  const listingId = selectedCafe?.listingId ?? selectedCafe?.listing_id;

  const loadImages = useCallback(async () => {
    if (!listingId) return;
    const token = await getAuthToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/report-images/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setImages(data.images ?? []);
      }
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [listingId]);

  useFocusEffect(useCallback(() => { loadImages(); }, [loadImages]));

  async function handlePickAndUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow photo library access in Settings to upload images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) { Alert.alert("Error", "Could not read image data. Please try again."); return; }

    const token = await getAuthToken();
    if (!token) return;
    setUploading(true);
    try {
      const mimeType = asset.mimeType ?? "image/jpeg";
      const res = await fetch(`${API_BASE}/api/report-images/${listingId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          base64: asset.base64, mimeType,
          originalFilename: asset.fileName ?? `image_${Date.now()}.jpg`,
          imageRole: selectedRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert(data.isPanoramic ? "Panoramic Image" : "Upload failed",
          data.error ?? "Please try again.");
        return;
      }
      setImages((prev) => [...prev, data.image]);
      Alert.alert("Uploaded", `Image added as "${roleMeta(selectedRole).label}".`);
    } catch {
      Alert.alert("Error", "Upload failed. Check your connection.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAddTourThumbnail() {
    Alert.alert(
      "Use Tour Thumbnail",
      "To use a tour scene thumbnail, paste the Cloudinary public ID of the scene image below.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Report Builder Instead",
          onPress: () => router.push("/(seller)/valuation/report-builder" as any),
        },
      ],
    );
  }

  async function handleSetPrimary(image: ReportImage) {
    if (image.isPanoramic) {
      Alert.alert("Panoramic Image",
        "360° panoramic images can look distorted in reports. Please upload a normal photo or choose a cropped thumbnail.");
      return;
    }
    const token = await getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/report-images/${listingId}/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (res.ok) {
        setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === image.id })));
      }
    } catch { /* non-fatal */ }
  }

  async function handleSaveEdit(image: ReportImage, patch: Partial<ReportImage>) {
    const token = await getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/report-images/${listingId}/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const { image: updated } = await res.json();
        setImages((prev) => prev.map((img) => img.id === image.id ? { ...img, ...updated } : img));
        setEditingImage(null);
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Panoramic Image", err.error ?? "Update failed.");
      }
    } catch {
      Alert.alert("Error", "Could not save changes.");
    }
  }

  async function handleDeleteWithWarning(image: ReportImage) {
    const token = await getAuthToken();
    if (!token) return;

    // Build usage summary for the warning dialog
    const usages: string[] = [];
    if (image.isPrimary)           usages.push("primary cover image");
    if (image.imageRole !== "other") usages.push(`role: ${roleMeta(image.imageRole).label}`);
    if (image.sectionKey)          usages.push(`section: ${image.sectionKey}`);
    if (image.includeInPdf)        usages.push("PDF export");
    if (!image.includeInBuyerReport) usages.push("hidden from buyer");

    const usageText = usages.length
      ? `\n\nThis image is currently used as:\n• ${usages.join("\n• ")}`
      : "";
    const coverWarning = image.isPrimary
      ? "\n\n⚠️ This is the active cover photo. Deleting it will remove the cover from your report until you set a new one."
      : "";

    Alert.alert(
      "Delete Image?",
      `This will permanently remove the image from Cloudinary and the report.${usageText}${coverWarning}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE}/api/report-images/${listingId}/${image.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                setImages((prev) => prev.filter((img) => img.id !== image.id));
              } else {
                const err = await res.json().catch(() => ({}));
                Alert.alert("Error", err.error ?? "Could not delete image.");
              }
            } catch {
              Alert.alert("Error", "Network error. Please try again.");
            }
          },
        },
      ],
    );
  }

  const primaryCover = images.find((img) => img.isPrimary && !img.isPanoramic);
  const coverImages  = images.filter((img) => ["listing_hero", "cover_secondary"].includes(img.imageRole) && !img.isPanoramic);
  const regularImages = images.filter((img) => !["listing_hero", "cover_secondary"].includes(img.imageRole) || img.isPanoramic);

  // Summary counts for Report Hub card
  const businessPhotoCount = images.filter((i) => ["exterior", "interior"].includes(i.imageRole)).length;
  const equipmentCount = images.filter((i) => i.imageRole === "equipment").length;
  const has360Preview = images.some((i) => i.imageRole === "360_preview");

  if (!listingId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.scroll, { paddingTop: insets.top + 20 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.foreground }]}>Report Images</Text>
          </View>
          <View style={styles.emptyState}>
            <Feather name="image" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Listing Linked</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Link this business to a listing to manage report images.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12,
          paddingBottom: insets.bottom + 80,
        }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Report Images</Text>
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
        </View>

        {/* Info banner */}
        <View style={[styles.infoBox, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
          <Feather name="info" size={14} color="#60A5FA" style={{ marginTop: 1 }} />
          <Text style={styles.infoText}>
            Upload standard photos for your report cover and sections. 360° panoramic images are blocked from cover roles — they look distorted in print.
          </Text>
        </View>

        {/* Summary counts */}
        {images.length > 0 && (
          <View style={[styles.summaryRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SummaryChip icon="star" color="#3B82F6" label="Cover" value={primaryCover ? "Set ✓" : "Missing"} ok={!!primaryCover} />
            <SummaryChip icon="camera" color="#10B981" label="Business" value={`${businessPhotoCount}`} ok={businessPhotoCount > 0} />
            <SummaryChip icon="tool" color="#EC4899" label="Equipment" value={`${equipmentCount}`} ok={equipmentCount > 0} />
            <SummaryChip icon="aperture" color="#6366F1" label="360°" value={has360Preview ? "Set ✓" : "None"} ok={has360Preview} />
          </View>
        )}

        {/* Primary cover status */}
        <View style={[styles.coverCard, {
          backgroundColor: primaryCover ? "#052e16" : "#1c1300",
          borderColor: primaryCover ? "#16A34A33" : "#F59E0B33",
        }]}>
          <View style={styles.coverCardRow}>
            <Feather name={primaryCover ? "check-circle" : "alert-triangle"} size={18} color={primaryCover ? "#16A34A" : "#F59E0B"} />
            <Text style={[styles.coverCardTitle, { color: primaryCover ? "#16A34A" : "#F59E0B" }]}>
              {primaryCover ? "Cover photo set" : "No cover photo set"}
            </Text>
          </View>
          {primaryCover ? (
            <View style={styles.coverThumbRow}>
              <Image source={{ uri: primaryCover.thumbnailUrl ?? primaryCover.url }} style={styles.coverThumb} resizeMode="cover" />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.coverThumbLabel}>{primaryCover.displayName ?? roleMeta(primaryCover.imageRole).label}</Text>
                {primaryCover.caption ? <Text style={styles.coverThumbCaption}>{primaryCover.caption}</Text> : null}
                <Text style={styles.coverThumbMeta}>Source: {primaryCover.sourceType}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.coverCardHint}>
              Upload a photo and tap "Set as Cover". Panoramic images cannot be set as the cover.
            </Text>
          )}
        </View>

        {/* Upload buttons */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>UPLOAD</Text>

        {/* Role picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rolePicker}>
          {ROLES.filter((r) => r.key !== "360_preview").map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.roleChip, selectedRole === r.key && { backgroundColor: r.color + "33", borderColor: r.color }]}
              onPress={() => setSelectedRole(r.key)}
            >
              <Feather name={r.icon} size={12} color={selectedRole === r.key ? r.color : colors.mutedForeground} />
              <Text style={[styles.roleChipText, { color: selectedRole === r.key ? r.color : colors.mutedForeground }]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {PANORAMIC_BLOCKED.includes(selectedRole) && (
          <View style={[styles.warnBox, { borderColor: "#F59E0B33" }]}>
            <Feather name="alert-triangle" size={12} color="#F59E0B" />
            <Text style={[styles.warnText, { color: "#D97706" }]}>
              Panoramic images will be rejected for this role. Upload a standard landscape photo.
            </Text>
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            style={[styles.uploadBtn, { flex: 3, opacity: uploading ? 0.6 : 1 }]}
            onPress={handlePickAndUpload}
            disabled={uploading}
          >
            {uploading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="upload" size={16} color="#fff" />}
            <Text style={styles.uploadBtnText}>
              {uploading ? "Uploading…" : `Upload ${roleMeta(selectedRole).label}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.uploadBtnSecondary, { flex: 2, borderColor: "#6366F133" }]}
            onPress={handleAddTourThumbnail}
          >
            <Feather name="aperture" size={14} color="#6366F1" />
            <Text style={[styles.uploadBtnSecondaryText, { color: "#6366F1" }]}>Tour Thumbnail</Text>
          </TouchableOpacity>
        </View>

        {/* Cover photos */}
        {coverImages.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>COVER PHOTOS</Text>
            {coverImages.map((img) => (
              <ImageCard
                key={img.id}
                image={img}
                colors={colors}
                onSetPrimary={() => handleSetPrimary(img)}
                onEdit={() => setEditingImage(img)}
                onDelete={() => handleDeleteWithWarning(img)}
              />
            ))}
          </>
        )}

        {/* Other images */}
        {regularImages.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>OTHER IMAGES</Text>
            {regularImages.map((img) => (
              <ImageCard
                key={img.id}
                image={img}
                colors={colors}
                onSetPrimary={() => handleSetPrimary(img)}
                onEdit={() => setEditingImage(img)}
                onDelete={() => handleDeleteWithWarning(img)}
              />
            ))}
          </>
        )}

        {images.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Feather name="image" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Images Yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Upload photos to use as the cover and body images in your IM report and PDF export.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Editor bottom-sheet */}
      {editingImage && (
        <ImageEditorModal
          image={editingImage}
          colors={colors}
          onClose={() => setEditingImage(null)}
          onSave={(patch) => handleSaveEdit(editingImage, patch)}
        />
      )}
    </View>
  );
}

// ─── Summary chip ──────────────────────────────────────────────────────────────
function SummaryChip({ icon, color, label, value, ok }: {
  icon: string; color: string; label: string; value: string; ok: boolean;
}) {
  return (
    <View style={{ alignItems: "center", gap: 4, flex: 1 }}>
      <Feather name={icon as any} size={16} color={ok ? color : "#6B7280"} />
      <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: "#6B7280" }}>{label}</Text>
      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: ok ? color : "#F59E0B" }}>{value}</Text>
    </View>
  );
}

// ─── ImageCard ─────────────────────────────────────────────────────────────────
function ImageCard({
  image, colors, onSetPrimary, onEdit, onDelete,
}: {
  image: ReportImage;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onSetPrimary: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const rm = roleMeta(image.imageRole);
  return (
    <View style={[styles.imageCard, { backgroundColor: colors.card, borderColor: image.isPrimary ? "#16A34A44" : colors.border }]}>
      <View style={styles.imageCardTop}>
        <Image
          source={{ uri: image.thumbnailUrl ?? image.url }}
          style={styles.imageThumb}
          resizeMode="cover"
        />
        <View style={{ flex: 1, gap: 5 }}>
          <View style={styles.imageBadgeRow}>
            {image.isPrimary && (
              <View style={[styles.badge, { backgroundColor: "#16A34A22" }]}>
                <Feather name="star" size={10} color="#16A34A" />
                <Text style={[styles.badgeText, { color: "#16A34A" }]}>Cover</Text>
              </View>
            )}
            {image.isPanoramic && (
              <View style={[styles.badge, { backgroundColor: "#F59E0B22" }]}>
                <Text style={[styles.badgeText, { color: "#F59E0B" }]}>360°</Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: rm.color + "22" }]}>
              <Feather name={rm.icon} size={10} color={rm.color} />
              <Text style={[styles.badgeText, { color: rm.color }]}>{rm.label}</Text>
            </View>
            {image.includeInPdf && (
              <View style={[styles.badge, { backgroundColor: "#A78BFA22" }]}>
                <Feather name="file-text" size={10} color="#A78BFA" />
                <Text style={[styles.badgeText, { color: "#A78BFA" }]}>PDF</Text>
              </View>
            )}
            {!image.includeInBuyerReport && (
              <View style={[styles.badge, { backgroundColor: "#EF444422" }]}>
                <Feather name="eye-off" size={10} color="#EF4444" />
                <Text style={[styles.badgeText, { color: "#EF4444" }]}>Hidden</Text>
              </View>
            )}
          </View>
          {image.displayName ? (
            <Text style={[styles.imageCaption, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
              {image.displayName}
            </Text>
          ) : null}
          {image.caption ? (
            <Text style={[styles.imageCaption, { color: colors.mutedForeground }]} numberOfLines={2}>
              {image.caption}
            </Text>
          ) : null}
          {image.sectionKey ? (
            <Text style={styles.sectionKeyTag}>§ {image.sectionKey}</Text>
          ) : null}
          <Text style={[styles.imageMeta, { color: colors.mutedForeground }]}>
            {image.sourceType !== "uploaded" ? `Source: ${image.sourceType}  ` : ""}
            {fmtBytes(image.fileSize)}
          </Text>
        </View>
      </View>

      <View style={[styles.imageCardActions, { borderTopColor: colors.border }]}>
        {!image.isPanoramic && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: image.isPrimary ? "#052e16" : colors.primary }]}
            onPress={onSetPrimary}
          >
            <Feather name="star" size={12} color={image.isPrimary ? "#16A34A" : "#fff"} />
            <Text style={[styles.actionBtnText, { color: image.isPrimary ? "#16A34A" : "#fff" }]}>
              {image.isPrimary ? "Cover ✓" : "Set Cover"}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.actionBtnOutline, { borderColor: colors.border }]} onPress={onEdit}>
          <Feather name="edit-2" size={12} color={colors.mutedForeground} />
          <Text style={[styles.actionBtnOutlineText, { color: colors.mutedForeground }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Feather name="trash-2" size={14} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:          { flex: 1 },
  scroll:             { paddingHorizontal: 16, gap: 14 },
  header:             { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:            { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:              { fontSize: 22, fontFamily: "Inter_700Bold", flex: 1 },
  infoBox:            { flexDirection: "row", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  infoText:           { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#93C5FD", lineHeight: 17 },
  summaryRow:         { flexDirection: "row", padding: 14, borderRadius: 14, borderWidth: 1, gap: 6 },
  coverCard:          { borderRadius: 14, padding: 14, borderWidth: 1, gap: 10 },
  coverCardRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  coverCardTitle:     { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  coverCardHint:      { fontSize: 12, fontFamily: "Inter_400Regular", color: "#D97706", lineHeight: 17 },
  coverThumbRow:      { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  coverThumb:         { width: 72, height: 52, borderRadius: 8 },
  coverThumbLabel:    { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  coverThumbCaption:  { fontSize: 11, fontFamily: "Inter_400Regular", color: "#8B9CB8" },
  coverThumbMeta:     { fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7280" },
  sectionLabel:       { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  rolePicker:         { gap: 8, paddingBottom: 2 },
  roleChip:           { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1E3A5C", borderWidth: 1, borderColor: "transparent" },
  roleChipText:       { fontSize: 12, fontFamily: "Inter_500Medium" },
  warnBox:            { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, backgroundColor: "#7c2d1208" },
  warnText:           { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  uploadBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3B82F6", borderRadius: 14, paddingVertical: 14 },
  uploadBtnText:      { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  uploadBtnSecondary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 14, paddingVertical: 14, borderWidth: 1 },
  uploadBtnSecondaryText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  imageCard:          { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  imageCardTop:       { flexDirection: "row", gap: 12, padding: 12 },
  imageThumb:         { width: 80, height: 64, borderRadius: 8 },
  imageBadgeRow:      { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  badge:              { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  badgeText:          { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  sectionKeyTag:      { fontSize: 10, fontFamily: "Inter_400Regular", color: "#60A5FA" },
  imageCaption:       { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  imageMeta:          { fontSize: 10, fontFamily: "Inter_400Regular" },
  imageCardActions:   { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  actionBtn:          { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  actionBtnText:      { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  actionBtnOutline:   { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  actionBtnOutlineText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  deleteBtn:          { marginLeft: "auto" as any, padding: 7 },
  emptyState:         { alignItems: "center", paddingVertical: 48, gap: 14 },
  emptyTitle:         { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText:          { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 280 },
});
