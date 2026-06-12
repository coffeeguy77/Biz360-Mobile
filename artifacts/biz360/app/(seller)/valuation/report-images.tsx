import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useColors } from "@/hooks/useColors";
import { useValuation } from "@/context/ValuationContext";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = domain ? `https://${domain}` : "";

async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem("biz360_auth_token");
}

const VALID_ROLES = [
  { key: "cover_primary",   label: "Cover Photo",      icon: "image",      color: "#3B82F6", desc: "Main cover image for the IM report" },
  { key: "cover_secondary", label: "Secondary Cover",  icon: "layers",     color: "#8B5CF6", desc: "Backup cover / header image" },
  { key: "exterior",        label: "Exterior",         icon: "home",       color: "#10B981", desc: "Outside / shopfront photo" },
  { key: "interior",        label: "Interior",         icon: "grid",       color: "#F59E0B", desc: "Inside the business" },
  { key: "equipment",       label: "Equipment",        icon: "tool",       color: "#EC4899", desc: "Key machinery or assets" },
  { key: "team",            label: "Team",             icon: "users",      color: "#14B8A6", desc: "Staff or team photo" },
  { key: "product",         label: "Product",          icon: "package",    color: "#F97316", desc: "Product or menu items" },
  { key: "other",           label: "Other",            icon: "more-horizontal", color: "#6B7280", desc: "Any other image" },
] as const;
type RoleKey = typeof VALID_ROLES[number]["key"];

interface ReportImage {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  role: RoleKey;
  caption: string | null;
  isPrimaryCover: boolean;
  includeInPdf: boolean;
  includeInHtml: boolean;
  isPanoramic: boolean;
  sortOrder: number;
  originalFilename: string | null;
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  format: string | null;
  createdAt: string;
}

function roleMeta(role: RoleKey) {
  return VALID_ROLES.find((r) => r.key === role) ?? VALID_ROLES[VALID_ROLES.length - 1];
}

function fmtBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function ReportImagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedCafe } = useValuation();
  const [images, setImages] = useState<ReportImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleKey>("cover_primary");
  const [pendingCaption, setPendingCaption] = useState("");

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
      allowsEditing: true,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Error", "Could not read image data. Please try again.");
      return;
    }

    const token = await getAuthToken();
    if (!token) return;
    setUploading(true);
    try {
      const mimeType = asset.mimeType ?? "image/jpeg";
      const res = await fetch(`${API_BASE}/api/report-images/${listingId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          base64: asset.base64,
          mimeType,
          originalFilename: asset.fileName ?? `image_${Date.now()}.jpg`,
          role: selectedRole,
          caption: pendingCaption.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Upload failed", data.error ?? "Please try again.");
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

  async function handleSetPrimary(image: ReportImage) {
    if (image.isPanoramic) {
      Alert.alert("Panoramic image", "Panoramic images cannot be set as the cover photo. Please use a standard photo.");
      return;
    }
    const token = await getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/report-images/${listingId}/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isPrimaryCover: true }),
      });
      if (res.ok) {
        setImages((prev) => prev.map((img) => ({
          ...img,
          isPrimaryCover: img.id === image.id,
        })));
      }
    } catch { /* non-fatal */ }
  }

  async function handleTogglePdf(image: ReportImage) {
    const token = await getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/report-images/${listingId}/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ includeInPdf: !image.includeInPdf }),
      });
      if (res.ok) {
        setImages((prev) => prev.map((img) =>
          img.id === image.id ? { ...img, includeInPdf: !image.includeInPdf } : img,
        ));
      }
    } catch { /* non-fatal */ }
  }

  async function handleChangeRole(image: ReportImage) {
    const roleOptions = VALID_ROLES.filter((r) => !image.isPanoramic || !["cover_primary", "cover_secondary", "exterior", "interior"].includes(r.key));
    Alert.alert(
      "Change Role",
      "What does this image show?",
      [
        ...roleOptions.map((r) => ({
          text: r.label,
          onPress: async () => {
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch(`${API_BASE}/api/report-images/${listingId}/${image.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ role: r.key }),
            });
            if (res.ok) {
              setImages((prev) => prev.map((img) =>
                img.id === image.id ? { ...img, role: r.key as RoleKey } : img,
              ));
            }
          },
        })),
        { text: "Cancel", style: "cancel" },
      ],
    );
  }

  async function handleDelete(image: ReportImage) {
    Alert.alert(
      "Delete Image?",
      "This will permanently remove the image from Cloudinary and the report.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            const token = await getAuthToken();
            if (!token) return;
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

  const primaryCover = images.find((img) => img.isPrimaryCover && !img.isPanoramic);
  const coverImages  = images.filter((img) => img.role === "cover_primary" && !img.isPanoramic);
  const otherImages  = images.filter((img) => img.role !== "cover_primary" || img.isPanoramic);

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

        {/* Explainer */}
        <View style={[styles.infoBox, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
          <Feather name="info" size={14} color="#60A5FA" style={{ marginTop: 1 }} />
          <Text style={styles.infoText}>
            These images appear in your IM report cover page and PDF export. Panoramic tour images are never used here — upload standard photos only.
          </Text>
        </View>

        {/* Primary cover status */}
        <View style={[styles.coverCard, { backgroundColor: primaryCover ? "#052e16" : "#1c1300", borderColor: primaryCover ? "#16A34A33" : "#F59E0B33" }]}>
          <View style={styles.coverCardRow}>
            <Feather name={primaryCover ? "check-circle" : "alert-triangle"} size={18} color={primaryCover ? "#16A34A" : "#F59E0B"} />
            <Text style={[styles.coverCardTitle, { color: primaryCover ? "#16A34A" : "#F59E0B" }]}>
              {primaryCover ? "Cover photo set" : "No cover photo set"}
            </Text>
          </View>
          {primaryCover ? (
            <View style={styles.coverThumbRow}>
              <Image source={{ uri: primaryCover.thumbnailUrl ?? primaryCover.url }} style={styles.coverThumb} resizeMode="cover" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.coverThumbLabel}>{roleMeta(primaryCover.role).label}</Text>
                {primaryCover.caption ? <Text style={styles.coverThumbCaption}>{primaryCover.caption}</Text> : null}
                <Text style={styles.coverThumbMeta}>
                  {primaryCover.width && primaryCover.height ? `${primaryCover.width}×${primaryCover.height}  ` : ""}
                  {fmtBytes(primaryCover.fileSizeBytes)}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.coverCardHint, { color: "#D97706" }]}>
              Upload a photo below and tap "Set as Cover" to use it as the IM report cover image.
            </Text>
          )}
        </View>

        {/* Upload section */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>UPLOAD NEW IMAGE</Text>

        {/* Role picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rolePicker}>
          {VALID_ROLES.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.roleChip, selectedRole === r.key && { backgroundColor: r.color + "33", borderColor: r.color }]}
              onPress={() => setSelectedRole(r.key)}
            >
              <Feather name={r.icon as any} size={12} color={selectedRole === r.key ? r.color : colors.mutedForeground} />
              <Text style={[styles.roleChipText, { color: selectedRole === r.key ? r.color : colors.mutedForeground }]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.roleDesc, { color: colors.mutedForeground }]}>
          {VALID_ROLES.find((r) => r.key === selectedRole)?.desc ?? ""}
        </Text>

        <TouchableOpacity
          style={[styles.uploadBtn, { opacity: uploading ? 0.6 : 1 }]}
          onPress={handlePickAndUpload}
          disabled={uploading}
        >
          {uploading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="upload" size={18} color="#fff" />}
          <Text style={styles.uploadBtnText}>
            {uploading ? "Uploading…" : `Upload ${VALID_ROLES.find((r) => r.key === selectedRole)?.label ?? "Image"}`}
          </Text>
        </TouchableOpacity>

        {/* Panoramic warning */}
        {["cover_primary", "cover_secondary", "exterior", "interior"].includes(selectedRole) && (
          <View style={[styles.warnBox, { borderColor: "#F59E0B33" }]}>
            <Feather name="alert-triangle" size={12} color="#F59E0B" />
            <Text style={[styles.warnText, { color: "#D97706" }]}>
              Panoramic images (wider than 2.2× their height) will be rejected for this role. Use a standard landscape photo.
            </Text>
          </View>
        )}

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
                onTogglePdf={() => handleTogglePdf(img)}
                onChangeRole={() => handleChangeRole(img)}
                onDelete={() => handleDelete(img)}
              />
            ))}
          </>
        )}

        {/* Other images */}
        {otherImages.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>OTHER IMAGES</Text>
            {otherImages.map((img) => (
              <ImageCard
                key={img.id}
                image={img}
                colors={colors}
                onSetPrimary={() => handleSetPrimary(img)}
                onTogglePdf={() => handleTogglePdf(img)}
                onChangeRole={() => handleChangeRole(img)}
                onDelete={() => handleDelete(img)}
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
    </View>
  );
}

function ImageCard({
  image, colors,
  onSetPrimary, onTogglePdf, onChangeRole, onDelete,
}: {
  image: ReportImage;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onSetPrimary: () => void;
  onTogglePdf: () => void;
  onChangeRole: () => void;
  onDelete: () => void;
}) {
  const rm = roleMeta(image.role);
  return (
    <View style={[styles.imageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.imageCardTop}>
        <Image
          source={{ uri: image.thumbnailUrl ?? image.url }}
          style={styles.imageThumb}
          resizeMode="cover"
        />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.imageBadgeRow}>
            {image.isPrimaryCover && (
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
              <Feather name={rm.icon as any} size={10} color={rm.color} />
              <Text style={[styles.badgeText, { color: rm.color }]}>{rm.label}</Text>
            </View>
            {image.includeInPdf && (
              <View style={[styles.badge, { backgroundColor: "#A78BFA22" }]}>
                <Feather name="file-text" size={10} color="#A78BFA" />
                <Text style={[styles.badgeText, { color: "#A78BFA" }]}>PDF</Text>
              </View>
            )}
          </View>
          {image.caption && (
            <Text style={[styles.imageCaption, { color: colors.foreground }]} numberOfLines={2}>
              {image.caption}
            </Text>
          )}
          <Text style={[styles.imageMeta, { color: colors.mutedForeground }]}>
            {image.width && image.height ? `${image.width}×${image.height}  ` : ""}
            {fmtBytes(image.fileSizeBytes)}
            {image.format ? `  ${image.format.toUpperCase()}` : ""}
          </Text>
        </View>
      </View>

      <View style={[styles.imageCardActions, { borderTopColor: colors.border }]}>
        {!image.isPanoramic && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: image.isPrimaryCover ? "#052e16" : colors.primary }]}
            onPress={onSetPrimary}
          >
            <Feather name="star" size={12} color={image.isPrimaryCover ? "#16A34A" : "#fff"} />
            <Text style={[styles.actionBtnText, { color: image.isPrimaryCover ? "#16A34A" : "#fff" }]}>
              {image.isPrimaryCover ? "Cover ✓" : "Set Cover"}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtnOutline, { borderColor: colors.border }]}
          onPress={onTogglePdf}
        >
          <Feather name={image.includeInPdf ? "file-minus" : "file-plus"} size={12} color={colors.mutedForeground} />
          <Text style={[styles.actionBtnOutlineText, { color: colors.mutedForeground }]}>
            {image.includeInPdf ? "Hide PDF" : "Add PDF"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtnOutline, { borderColor: colors.border }]}
          onPress={onChangeRole}
        >
          <Feather name="tag" size={12} color={colors.mutedForeground} />
          <Text style={[styles.actionBtnOutlineText, { color: colors.mutedForeground }]}>Role</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Feather name="trash-2" size={14} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  scroll:             { paddingHorizontal: 16, gap: 14 },
  header:             { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn:            { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title:              { fontSize: 22, fontFamily: "Inter_700Bold", flex: 1 },
  infoBox:            { flexDirection: "row", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  infoText:           { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#93C5FD", lineHeight: 17 },
  coverCard:          { borderRadius: 14, padding: 14, borderWidth: 1, gap: 10 },
  coverCardRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  coverCardTitle:     { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  coverCardHint:      { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  coverThumbRow:      { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  coverThumb:         { width: 72, height: 52, borderRadius: 8 },
  coverThumbLabel:    { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  coverThumbCaption:  { fontSize: 11, fontFamily: "Inter_400Regular", color: "#8B9CB8" },
  coverThumbMeta:     { fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7280" },
  sectionLabel:       { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  rolePicker:         { gap: 8, paddingBottom: 2 },
  roleChip:           { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#1E3A5C", borderWidth: 1, borderColor: "transparent" },
  roleChipText:       { fontSize: 12, fontFamily: "Inter_500Medium" },
  roleDesc:           { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  uploadBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3B82F6", borderRadius: 14, paddingVertical: 14 },
  uploadBtnText:      { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  warnBox:            { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, backgroundColor: "#7c2d1208" },
  warnText:           { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  imageCard:          { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  imageCardTop:       { flexDirection: "row", gap: 12, padding: 12 },
  imageThumb:         { width: 80, height: 60, borderRadius: 8 },
  imageBadgeRow:      { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  badge:              { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  badgeText:          { fontSize: 10, fontFamily: "Inter_600SemiBold" },
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
