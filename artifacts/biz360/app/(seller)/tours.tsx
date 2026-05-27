import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { TourPin, TourSpace } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { getPendingListings, PendingListing } from "@/lib/adminStore";
import { apiGet, apiSet } from "@/lib/apiStore";

const { width: SCREEN_W } = Dimensions.get("window");
const MINI_PANO_H = 100;
const MINI_PANO_W = SCREEN_W - 40;

const DIRS_4 = ["Front", "Right", "Back", "Left"] as const;
const DIRS_8 = ["Front", "Front-Right", "Right", "Back-Right", "Back", "Back-Left", "Left", "Front-Left"] as const;

const ALL_PIN_TYPES: { type: TourPin["type"]; label: string; icon: string; color: string }[] = [
  { type: "equipment",  label: "Equipment",  icon: "tool",          color: "#F59E0B" },
  { type: "revenue",    label: "Revenue",    icon: "trending-up",   color: "#16A34A" },
  { type: "cogs",       label: "COGS",       icon: "package",       color: "#EF4444" },
  { type: "workflow",   label: "Workflow",   icon: "git-branch",    color: "#8B5CF6" },
  { type: "staffing",   label: "Staffing",   icon: "users",         color: "#3B82F6" },
  { type: "lease",      label: "Lease",      icon: "home",          color: "#F97316" },
  { type: "risk",       label: "Risk",       icon: "alert-triangle",color: "#EF4444" },
  { type: "opportunity",label: "Opportunity",icon: "star",          color: "#16A34A" },
  { type: "narration",  label: "Narration",  icon: "mic",           color: "#EC4899" },
  { type: "inspection", label: "Inspection", icon: "clipboard",     color: "#06B6D4" },
  { type: "highlight",  label: "Highlight",  icon: "zap",           color: "#F59E0B" },
  { type: "document",   label: "Document",   icon: "file-text",     color: "#6366F1" },
];

type Visibility = "public" | "nda_only" | "approved_only";

interface DraftPin {
  id: string;
  type: TourPin["type"];
  title: string;
  description: string;
  requiresNDA: boolean;
  x?: number;
  y?: number;
  visibility: Visibility;
  mediaUri?: string;
}

interface DraftSpace {
  name: string;
  dirMode: 4 | 8 | "panorama";
  photos: Record<string, string>;
  panoramaUri?: string;
  pins: DraftPin[];
}

const EMPTY_SPACE: DraftSpace = { name: "", dirMode: 4, photos: {}, pins: [] };
const EMPTY_PIN: DraftPin     = { id: "", type: "equipment", title: "", description: "", requiresNDA: false, visibility: "public" };

const VISIBILITY_OPTIONS: { val: Visibility; label: string; hint: string; icon: string; color: string }[] = [
  { val: "public",        label: "Public",        hint: "All buyers can see this pin",          icon: "eye",    color: "#16A34A" },
  { val: "nda_only",      label: "NDA Required",  hint: "Buyer must request and sign NDA",      icon: "lock",   color: "#F59E0B" },
  { val: "approved_only", label: "Approved Only", hint: "Only seller-approved buyers",          icon: "shield", color: "#3B82F6" },
];

// ─── Image upload helper ──────────────────────────────────────────────────────
// Reads a local file:// URI as base64 and POSTs it to the API server.
// Returns the resulting https:// URL. Returns the original URI on failure.

async function uploadTourPhoto(
  uri: string,
  key: string,
  onStatus: (s: string) => void,
): Promise<string> {
  if (uri.startsWith("http")) return uri; // already a server URL
  const domain  = process.env.EXPO_PUBLIC_DOMAIN;
  const apiBase = domain ? `https://${domain}/api` : "/api";
  onStatus("Uploading photo…");
  try {
    const base64   = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const ext      = uri.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "jpg";
    const mimeType = ext === "png" ? "image/png" : "image/jpeg";
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), 120_000); // 2 min for large files
    const res = await fetch(`${apiBase}/biz360/img`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ key, data: base64, mimeType }),
      signal:  controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const json = await res.json() as { url: string };
    // Cloudinary returns a full https:// URL — use it as-is
    return json.url;
  } catch {
    return uri; // graceful fallback to local path
  }
}

// ─── KV helpers ───────────────────────────────────────────────────────────────

async function getTourSpaces(listingId: string): Promise<TourSpace[]> {
  try {
    const data = await apiGet<TourSpace[]>(`biz360_tour_spaces_v1_${listingId}`);
    return data ?? [];
  } catch { return []; }
}

async function saveTourSpaces(listingId: string, spaces: TourSpace[]): Promise<void> {
  await apiSet(`biz360_tour_spaces_v1_${listingId}`, spaces);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ToursScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Listings
  const [listings,        setListings]        = useState<PendingListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [selectedId,      setSelectedId]      = useState<string | null>(null);

  // Tour spaces for the selected listing
  const [allSpaces,    setAllSpaces]    = useState<TourSpace[]>([]);
  const [spacesLoaded, setSpacesLoaded] = useState(false);
  const currentListingIdRef             = useRef<string | null>(null);

  // Space + pin modal state
  const [showSpaceModal,      setShowSpaceModal]      = useState(false);
  const [draftSpace,          setDraftSpace]          = useState<DraftSpace>(EMPTY_SPACE);
  const [showPinModal,        setShowPinModal]        = useState(false);
  const [draftPin,            setDraftPin]            = useState<DraftPin>(EMPTY_PIN);
  const [pinPlaceMode,        setPinPlaceMode]        = useState(false);
  const [panoLayout,          setPanoLayout]          = useState({ width: 1, height: 1 });
  const [editingSpaceId,      setEditingSpaceId]      = useState<string | null>(null);
  const [editingPinId,        setEditingPinId]        = useState<string | null>(null);
  const [activePinId,         setActivePinId]         = useState<string | null>(null);
  const [confirmedPlacement,  setConfirmedPlacement]  = useState<{ x: number; y: number } | null>(null);
  const [saving,              setSaving]              = useState(false);
  const [saveStatus,          setSaveStatus]          = useState("");

  const draggingPinIdRef  = useRef<string | null>(null);
  const dragPositionRef   = useRef<{ x: number; y: number } | null>(null);
  const editingSpaceIdRef = useRef<string | null>(null);
  useEffect(() => { editingSpaceIdRef.current = editingSpaceId; }, [editingSpaceId]);

  const activeDirections = draftSpace.dirMode === 4 ? DIRS_4 : draftSpace.dirMode === 8 ? DIRS_8 : [];

  // ── Load listings on focus ─────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) { setListingsLoading(false); return; }
      setListingsLoading(true);
      getPendingListings().then((all) => {
        const mine = all.filter((p) => p.submittedBy === user.id);
        setListings(mine);
        setListingsLoading(false);
        if (mine.length > 0) {
          setSelectedId((prev) => {
            const stillValid = prev && mine.some((l) => l.listingId === prev);
            return stillValid ? prev : mine[0].listingId;
          });
        } else {
          setSelectedId(null);
        }
      });
    }, [user?.id]),
  );

  // ── Load spaces when listing changes ──────────────────────────────────────

  useEffect(() => {
    currentListingIdRef.current = selectedId;
    if (!selectedId) { setAllSpaces([]); setSpacesLoaded(true); return; }
    setSpacesLoaded(false);
    getTourSpaces(selectedId).then((spaces) => {
      setAllSpaces(spaces);
      setSpacesLoaded(true);
    });
  }, [selectedId]);

  // ── Save spaces when changed ───────────────────────────────────────────────

  useEffect(() => {
    if (!spacesLoaded || !currentListingIdRef.current) return;
    saveTourSpaces(currentListingIdRef.current, allSpaces).catch(() => {});
  }, [allSpaces, spacesLoaded]);

  const selectedListing = listings.find((l) => l.listingId === selectedId);
  const bannerPhoto =
    selectedListing?.photos?.[0] ??
    allSpaces[0]?.photos?.[0]    ??
    allSpaces[0]?.panoramaUrl    ??
    null;
  const heroBg = selectedListing?.heroColor ?? "#0F2040";

  // ── Photo pickers ──────────────────────────────────────────────────────────

  const pickPhoto = async (dir: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow photo library access to add photos to your tour."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setDraftSpace((prev) => ({ ...prev, photos: { ...prev.photos, [dir]: result.assets[0].uri } }));
    }
  };

  const removePhoto = (dir: string) => {
    setDraftSpace((prev) => { const { [dir]: _, ...rest } = prev.photos; return { ...prev, photos: rest }; });
  };

  const pickPanorama = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow photo library access to add a panorama to your tour."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setDraftSpace((prev) => ({ ...prev, panoramaUri: result.assets[0].uri }));
    }
  };

  const pickPinMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow photo library access to attach media to this pin."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setDraftPin((p) => ({ ...p, mediaUri: result.assets[0].uri }));
    }
  };

  // ── Pin handlers ───────────────────────────────────────────────────────────

  const openAddPin = () => {
    const newPin = { ...EMPTY_PIN, id: `pin-${Date.now()}` };
    setDraftPin(newPin);
    setEditingPinId(null);
    if (draftSpace.dirMode === "panorama" && draftSpace.panoramaUri) {
      setPinPlaceMode(true);
    } else {
      setShowPinModal(true);
    }
  };

  const openEditPin = (pin: DraftPin) => {
    setDraftPin(pin);
    setEditingPinId(pin.id);
    setActivePinId(pin.id);
    setShowPinModal(true);
  };

  const copyPin = (pin: DraftPin) => {
    const copied: DraftPin = { ...pin, id: `pin-${Date.now()}`, title: pin.title + " (Copy)" };
    setDraftSpace((prev) => ({ ...prev, pins: [...prev.pins, copied] }));
  };

  const savePin = () => {
    if (!draftPin.title.trim()) { Alert.alert("Title required", "Please enter a title for this pin."); return; }
    if (!draftPin.description.trim()) { Alert.alert("Description required", "Please add a description so buyers know what this pin is about."); return; }
    if (editingPinId) {
      setDraftSpace((prev) => ({ ...prev, pins: prev.pins.map((p) => p.id === editingPinId ? draftPin : p) }));
    } else {
      setDraftSpace((prev) => ({ ...prev, pins: [...prev.pins, draftPin] }));
    }
    setShowPinModal(false);
    setEditingPinId(null);
  };

  const removePin = (id: string) => {
    setDraftSpace((prev) => ({ ...prev, pins: prev.pins.filter((p) => p.id !== id) }));
    if (activePinId === id) setActivePinId(null);
  };

  // ── Space handlers ─────────────────────────────────────────────────────────

  const openEditSpace = (space: TourSpace) => {
    const dirMode: 4 | 8 | "panorama" = space.dirMode ?? (space.panoramaUrl ? "panorama" : space.photos.length > 4 ? 8 : 4);
    const dirs = dirMode === 8 ? DIRS_8 : dirMode === 4 ? DIRS_4 : [];
    const photos: Record<string, string> = {};
    if (dirMode !== "panorama") {
      dirs.forEach((dir, i) => { if (space.photos[i]) photos[dir] = space.photos[i]; });
    }
    const draftPins: DraftPin[] = space.pins.map((p) => ({
      id: p.id, type: p.type, title: p.title, description: p.description,
      requiresNDA: p.requiresNDA ?? false, visibility: "public" as Visibility,
      x: p.position.x, y: p.position.y,
    }));
    setDraftSpace({ name: space.name, dirMode, photos, panoramaUri: space.panoramaUrl, pins: draftPins });
    setEditingSpaceId(space.id);
    setShowSpaceModal(true);
  };

  const deleteSpace = (space: TourSpace) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Space", `Remove "${space.name}" from this tour?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setAllSpaces((prev) => prev.filter((s) => s.id !== space.id));
        },
      },
    ]);
  };

  const closeSpaceModal = () => {
    setShowSpaceModal(false);
    setDraftSpace(EMPTY_SPACE);
    setEditingSpaceId(null);
    setPinPlaceMode(false);
    setActivePinId(null);
    setConfirmedPlacement(null);
  };

  const handleSaveSpace = async () => {
    if (!draftSpace.name.trim()) { Alert.alert("Name required", "Please enter a name for this tour space."); return; }
    if (draftSpace.dirMode === "panorama") {
      if (!draftSpace.panoramaUri) { Alert.alert("Photo required", "Please choose a panorama photo before saving."); return; }
    } else {
      if (Object.keys(draftSpace.photos).length === 0) { Alert.alert("Photos required", `Please add at least 1 of the ${draftSpace.dirMode} directional photos before saving.`); return; }
    }

    setSaving(true);
    const isEditing  = editingSpaceId !== null;
    const spaceIdNow = isEditing ? editingSpaceId! : `space-${Date.now()}`;
    const listingKey = selectedId ?? spaceIdNow;

    try {
      if (draftSpace.dirMode === "panorama") {
        setSaveStatus("Uploading panorama…");
        const uri = draftSpace.panoramaUri!;
        const imgKey      = `${listingKey}_pano_${Date.now()}`;
        const panoramaUrl = await uploadTourPhoto(uri, imgKey, setSaveStatus);
        const tourPins    = buildTourPins(draftSpace.pins);
        const savedSpace: TourSpace = {
          id:   spaceIdNow,
          name: draftSpace.name.trim(), photos: [], pins: tourPins,
          panoramaUrl, panoramaStartYaw: 0, dirMode: "panorama",
        };
        setAllSpaces((prev) => isEditing ? prev.map((s) => s.id === editingSpaceId ? savedSpace : s) : [...prev, savedSpace]);
      } else {
        const dirs        = draftSpace.dirMode === 8 ? DIRS_8 : DIRS_4;
        const photoArray: string[] = [];
        let photoIdx = 0;
        for (const dir of dirs) {
          const uri = draftSpace.photos[dir];
          if (!uri) continue;
          setSaveStatus(`Uploading photo ${++photoIdx}…`);
          const imgKey     = `${listingKey}_${dir.replace(/\s/g, "_")}_${Date.now()}`;
          const uploadedUrl = await uploadTourPhoto(uri, imgKey, setSaveStatus);
          photoArray.push(uploadedUrl);
        }
        const tourPins = buildTourPins(draftSpace.pins);
        const savedSpace: TourSpace = {
          id:   spaceIdNow,
          name: draftSpace.name.trim(), photos: photoArray, pins: tourPins, dirMode: draftSpace.dirMode,
        };
        setAllSpaces((prev) => isEditing ? prev.map((s) => s.id === editingSpaceId ? savedSpace : s) : [...prev, savedSpace]);
      }
      closeSpaceModal();
    } catch {
      Alert.alert("Save failed", "Could not upload photos. Check your connection and try again.");
    } finally {
      setSaving(false);
      setSaveStatus("");
    }
  };

  function buildTourPins(draftPins: DraftPin[]): TourPin[] {
    return draftPins.map((dp, i) => ({
      id: dp.id, type: dp.type, title: dp.title, description: dp.description,
      requiresNDA: dp.requiresNDA,
      position: {
        x: dp.x ?? parseFloat(((i + 0.5) / Math.max(draftPins.length, 1)).toFixed(2)),
        y: dp.y ?? (0.4 + (i % 3) * 0.1),
      },
    }));
  }

  const switchDirMode = (mode: 4 | 8 | "panorama") => {
    const messages: Record<string, string> = {
      "4":        "Reduce to 4 cardinal directions (Front/Right/Back/Left). Any existing photos will be cleared.",
      "8":        "This adds 4 diagonal angles for a more immersive swipe tour. Any existing photos will be cleared.",
      "panorama": "Upload a single pre-made 360° panorama photo from your camera roll.",
    };
    Alert.alert(
      mode === "panorama" ? "Switch to 360° Photo" : `Switch to ${mode}-Direction`,
      messages[String(mode)],
      [
        { text: "Cancel", style: "cancel" },
        { text: "Switch", onPress: () => setDraftSpace((prev) => ({ ...prev, dirMode: mode, photos: {}, panoramaUri: undefined })) },
      ]
    );
  };

  const selectedPinMeta = ALL_PIN_TYPES.find((p) => p.type === draftPin.type) ?? ALL_PIN_TYPES[0];

  // ── Render ─────────────────────────────────────────────────────────────────

  const totalPins = allSpaces.reduce((a, s) => a + s.pins.length, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>360 Tours</Text>
        {selectedListing && (
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowSpaceModal(true)}>
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {listingsLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : listings.length === 0 ? (
        /* ── No listings empty state ── */
        <View style={styles.centered}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
            <Feather name="rotate-ccw" size={36} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No listings yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Create a listing first, then come back to build your 360° tour.
          </Text>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/create-listing" as any)}
          >
            <Feather name="plus" size={15} color="#fff" />
            <Text style={styles.createBtnText}>Create Listing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Listing picker (if > 1) ── */}
          {listings.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
              {listings.map((l) => {
                const active = l.listingId === selectedId;
                return (
                  <TouchableOpacity
                    key={l.listingId}
                    style={[
                      styles.pickerChip,
                      {
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor:     active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedId(l.listingId)}
                  >
                    <Text style={[styles.pickerChipText, { color: active ? "#fff" : colors.mutedForeground }]} numberOfLines={1}>
                      {l.businessName ?? l.listingId}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* ── Tour card ── */}
          {selectedListing && (
            <View style={[styles.tourCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {bannerPhoto ? (
                <ImageBackground
                  source={{ uri: bannerPhoto }}
                  style={styles.tourHero}
                  imageStyle={styles.tourHeroImg}
                >
                  <View style={styles.tourHeroOverlay} />
                  <Feather name="rotate-ccw" size={28} color="#fff" />
                  <Text style={styles.tourHeroTitle}>{selectedListing.businessName ?? "My Listing"}</Text>
                </ImageBackground>
              ) : (
                <View style={[styles.tourHero, { backgroundColor: heroBg }]}>
                  <Feather name="rotate-ccw" size={28} color="#fff" />
                  <Text style={styles.tourHeroTitle}>{selectedListing.businessName ?? "My Listing"}</Text>
                </View>
              )}

              <View style={styles.tourBody}>
                {/* Stats row */}
                <View style={styles.tourStats}>
                  {[
                    { val: String(allSpaces.length), lbl: "Spaces",     color: colors.primary },
                    { val: String(totalPins),         lbl: "Pins",       color: colors.primary },
                    { val: "—",                       lbl: "Starts",     color: colors.primary },
                    { val: "—",                       lbl: "Completion", color: colors.accent  },
                  ].map(({ val, lbl, color }) => (
                    <View key={lbl} style={styles.tourStat}>
                      <Text style={[styles.tourStatVal, { color }]}>{val}</Text>
                      <Text style={[styles.tourStatLbl, { color: colors.mutedForeground }]}>{lbl}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[styles.spacesTitle, { color: colors.foreground }]}>Tour Spaces</Text>

                {/* Spaces loading */}
                {!spacesLoaded && (
                  <ActivityIndicator color={colors.primary} style={{ alignSelf: "center", marginVertical: 16 }} />
                )}

                {/* Spaces list */}
                {spacesLoaded && allSpaces.length === 0 && (
                  <View style={[styles.emptySpacesBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Feather name="camera-off" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.emptySpacesText, { color: colors.mutedForeground }]}>
                      No spaces yet. Tap + to add your first tour space.
                    </Text>
                  </View>
                )}

                {spacesLoaded && allSpaces.map((space) => (
                  <View key={space.id} style={[styles.spaceRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.spaceIcon, { backgroundColor: colors.primary + "18" }]}>
                      <Feather name="camera" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.spaceInfo}>
                      <Text style={[styles.spaceName, { color: colors.foreground }]}>{space.name}</Text>
                      <Text style={[styles.spaceMeta, { color: colors.mutedForeground }]}>
                        {space.panoramaUrl && space.photos.length === 0 ? "360° panorama" : `${space.photos.length} photos`} · {space.pins.length} pins
                      </Text>
                    </View>
                    <View style={styles.spaceActions}>
                      <TouchableOpacity
                        onPress={() => {
                          const idx = allSpaces.indexOf(space);
                          router.push(`/tour/${selectedListing!.listingId}?startSpace=${idx}` as any);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="eye" size={16} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => openEditSpace(space)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="edit-2" size={16} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteSpace(space)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="trash-2" size={17} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.addSpaceBtn, { backgroundColor: colors.muted }]}
                  onPress={() => setShowSpaceModal(true)}
                >
                  <Feather name="plus" size={14} color={colors.foreground} />
                  <Text style={[styles.addSpaceBtnText, { color: colors.foreground }]}>Add Space</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Create / Edit Space Modal ── */}
      <Modal visible={showSpaceModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeSpaceModal}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closeSpaceModal}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingSpaceId ? "Edit Space" : "New Tour Space"}</Text>
            <TouchableOpacity onPress={handleSaveSpace} disabled={saving}>
              <Text style={[styles.modalSave, { color: saving ? colors.mutedForeground : colors.primary }]}>
                {saving ? (saveStatus || "Saving…") : editingSpaceId ? "Save" : "Create"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>SPACE NAME</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. Main Dining Area, Kitchen, Front Counter…"
              placeholderTextColor={colors.mutedForeground}
              value={draftSpace.name}
              onChangeText={(t) => setDraftSpace((p) => ({ ...p, name: t }))}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PHOTO MODE</Text>
            <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Choose how buyers experience this space in the tour.</Text>

            {(() => {
              const active = draftSpace.dirMode === "panorama";
              return (
                <TouchableOpacity
                  style={[styles.modeChipWide, { backgroundColor: active ? "#7C3AED" : colors.card, borderColor: active ? "#7C3AED" : colors.border }]}
                  onPress={() => !active ? switchDirMode("panorama") : undefined}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>🔮</Text>
                    <View>
                      <Text style={[styles.modeLabel, { color: active ? "#fff" : colors.foreground }]}>360° Photo</Text>
                      <Text style={[styles.modeHint, { color: active ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}>
                        Insta360 / Panoramic — upload a pre-made panorama
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })()}

            <View style={styles.modeRow}>
              {([4, 8] as const).map((mode) => {
                const active = draftSpace.dirMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.modeChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
                    onPress={() => !active ? switchDirMode(mode) : undefined}
                  >
                    <Feather name="compass" size={14} color={active ? "#fff" : colors.mutedForeground} />
                    <Text style={[styles.modeLabel, { color: active ? "#fff" : colors.foreground }]}>{mode}-Direction</Text>
                    <Text style={[styles.modeHint, { color: active ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
                      {mode === 4 ? "Front / Right / Back / Left" : "8 directions incl. diagonals"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {draftSpace.dirMode === "panorama" ? (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PANORAMA PHOTO</Text>
                <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
                  Upload the stitched panorama from your Insta360 app or camera roll. Pinch to zoom while placing pins.
                </Text>

                {draftSpace.panoramaUri ? (
                  <View
                    style={[styles.panoUploadSlot, { borderColor: "#7C3AED", borderStyle: "solid" }]}
                    onLayout={(e) => setPanoLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
                  >
                    <Image source={{ uri: draftSpace.panoramaUri }} style={styles.panoThumb} />
                    <View
                      style={StyleSheet.absoluteFill}
                      onStartShouldSetResponder={(e) => {
                        const { locationX, locationY } = e.nativeEvent;
                        for (const p of draftSpace.pins) {
                          if (p.x == null) continue;
                          const px = p.x * panoLayout.width;
                          const py = (p.y ?? 0.5) * panoLayout.height;
                          if (Math.abs(locationX - px) < 22 && Math.abs(locationY - py) < 22) {
                            draggingPinIdRef.current = p.id;
                            setActivePinId(p.id);
                            return true;
                          }
                        }
                        return false;
                      }}
                      onMoveShouldSetResponder={() => draggingPinIdRef.current !== null}
                      onResponderMove={(e) => {
                        if (!draggingPinIdRef.current) return;
                        const { locationX, locationY } = e.nativeEvent;
                        const nx = Math.max(0.01, Math.min(0.99, locationX / panoLayout.width));
                        const ny = Math.max(0.01, Math.min(0.99, locationY / panoLayout.height));
                        dragPositionRef.current = { x: nx, y: ny };
                        setDraftSpace((prev) => ({
                          ...prev,
                          pins: prev.pins.map((p) => p.id === draggingPinIdRef.current ? { ...p, x: nx, y: ny } : p),
                        }));
                      }}
                      onResponderRelease={() => {
                        const wasDragging = draggingPinIdRef.current;
                        const finalPos    = dragPositionRef.current;
                        draggingPinIdRef.current  = null;
                        dragPositionRef.current   = null;
                        const spaceId = editingSpaceIdRef.current;
                        if (wasDragging && finalPos && spaceId) {
                          setAllSpaces((prev) => prev.map((s) => {
                            if (s.id !== spaceId) return s;
                            return {
                              ...s,
                              pins: s.pins.map((p) =>
                                p.id === wasDragging
                                  ? { ...p, position: { x: finalPos.x, y: finalPos.y } }
                                  : p
                              ),
                            };
                          }));
                        }
                      }}
                    >
                      {draftSpace.pins.filter((p) => p.x != null).map((pin) => {
                        const meta       = ALL_PIN_TYPES.find((m) => m.type === pin.type) ?? ALL_PIN_TYPES[0];
                        const isActivePin = activePinId === pin.id;
                        return (
                          <View
                            key={pin.id}
                            style={[styles.pinDotOnPano, {
                              left: pin.x! * panoLayout.width - (isActivePin ? 10 : 8),
                              top:  (pin.y ?? 0.5) * panoLayout.height - (isActivePin ? 10 : 8),
                              backgroundColor: meta.color,
                              width:  isActivePin ? 20 : 16,
                              height: isActivePin ? 20 : 16,
                              borderRadius: isActivePin ? 10 : 8,
                            }]}
                          >
                            <Feather name={meta.icon as any} size={isActivePin ? 10 : 8} color="#fff" />
                          </View>
                        );
                      })}
                      {confirmedPlacement && (
                        <View style={[styles.confirmDot, {
                          left: confirmedPlacement.x * panoLayout.width - 16,
                          top:  confirmedPlacement.y * panoLayout.height - 16,
                        }]} />
                      )}
                    </View>
                    <TouchableOpacity style={[styles.removePhotoBtn, { top: 8, right: 8 }]} onPress={() => setDraftSpace((p) => ({ ...p, panoramaUri: undefined }))}>
                      <Feather name="x" size={10} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.changePanoBtn} onPress={pickPanorama}>
                      <Feather name="refresh-cw" size={9} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.changePanoBtnText}>Change</Text>
                    </TouchableOpacity>
                    <View style={styles.panoReadyBadge}>
                      <Text style={styles.panoReadyText}>
                        {"✓ "}
                        {draftSpace.pins.filter((p) => p.x != null).length > 0
                          ? `${draftSpace.pins.filter((p) => p.x != null).length} pin${draftSpace.pins.filter((p) => p.x != null).length > 1 ? "s" : ""} placed`
                          : "Panorama ready"}
                      </Text>
                    </View>
                    {draftSpace.pins.some((p) => p.x != null) && (
                      <View style={styles.dragHint}>
                        <Feather name="move" size={9} color="rgba(255,255,255,0.75)" />
                        <Text style={styles.dragHintText}>Drag pins to reposition</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.panoUploadSlot, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={pickPanorama}
                  >
                    <Text style={{ fontSize: 28 }}>🔮</Text>
                    <Text style={[styles.modeLabel, { color: colors.foreground }]}>Tap to choose panorama</Text>
                    <Text style={[styles.modeHint, { color: colors.mutedForeground, textAlign: "center" }]}>
                      Select the panorama exported from Insta360 or any 360° camera app
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  DIRECTIONAL PHOTOS ({Object.keys(draftSpace.photos).length}/{draftSpace.dirMode})
                </Text>
                <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Tap each slot to add a photo from your library. Buyers swipe through these in the tour.</Text>
                <View style={styles.photoGrid}>
                  {activeDirections.map((dir) => {
                    const uri = draftSpace.photos[dir];
                    return (
                      <View key={dir} style={[styles.photoSlotWrapper, { width: draftSpace.dirMode === 8 ? "23%" : "30%" }]}>
                        <TouchableOpacity
                          style={[styles.photoSlot, { backgroundColor: uri ? "transparent" : colors.card, borderColor: uri ? colors.primary : colors.border }]}
                          onPress={() => pickPhoto(dir)}
                        >
                          {uri ? (
                            <Image source={{ uri }} style={styles.photoThumb} />
                          ) : (
                            <>
                              <Feather name="camera" size={draftSpace.dirMode === 8 ? 16 : 20} color={colors.mutedForeground} />
                              <Text style={[styles.photoLabel, { color: colors.mutedForeground, fontSize: draftSpace.dirMode === 8 ? 9 : 11 }]}>{dir}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        {uri && (
                          <>
                            <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(dir)}>
                              <Feather name="x" size={10} color="#fff" />
                            </TouchableOpacity>
                            <Text style={[styles.photoLabelUnder, { color: colors.primary, fontSize: 9 }]}>{dir}</Text>
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* ── Pin section ── */}
            <View style={styles.pinSectionHeader}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>INFO PINS ({draftSpace.pins.length})</Text>
              <TouchableOpacity style={[styles.addPinBtn, { backgroundColor: colors.primary }]} onPress={openAddPin}>
                <Feather name="plus" size={13} color="#fff" />
                <Text style={styles.addPinText}>Add Pin</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Tap a pin to highlight it. Edit, copy, or drag it on the panorama.</Text>

            {draftSpace.pins.map((pin) => {
              const meta       = ALL_PIN_TYPES.find((p) => p.type === pin.type) ?? ALL_PIN_TYPES[0];
              const visMeta    = VISIBILITY_OPTIONS.find((v) => v.val === pin.visibility) ?? VISIBILITY_OPTIONS[0];
              const isActivePin = activePinId === pin.id;
              return (
                <TouchableOpacity
                  key={pin.id}
                  style={[styles.pinRow, {
                    backgroundColor: isActivePin ? meta.color + "18" : colors.card,
                    borderColor:     isActivePin ? meta.color         : colors.border,
                  }]}
                  onPress={() => setActivePinId(isActivePin ? null : pin.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.pinDot, { backgroundColor: meta.color }]}>
                    <Feather name={meta.icon as any} size={12} color="#fff" />
                  </View>
                  <View style={styles.pinRowInfo}>
                    <Text style={[styles.pinRowTitle, { color: colors.foreground }]}>{pin.title}</Text>
                    <Text style={[styles.pinRowMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {meta.label} · {visMeta.label}{pin.x != null ? " · 📍" : ""}{pin.mediaUri ? " · 📎" : ""}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <TouchableOpacity onPress={() => openEditPin(pin)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="edit-2" size={14} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => copyPin(pin)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="copy" size={14} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removePin(pin.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="trash-2" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}

            {draftSpace.pins.length === 0 && (
              <View style={[styles.emptyPins, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="map-pin" size={20} color={colors.mutedForeground} />
                <Text style={[styles.emptyPinsText, { color: colors.mutedForeground }]}>No pins yet. Tap "Add Pin" to create your first info pin.</Text>
              </View>
            )}
          </ScrollView>

          {/* ── Full-screen pin placement overlay ── */}
          {pinPlaceMode && draftSpace.panoramaUri && (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: "#000", zIndex: 200 }]}
              onLayout={(e) => setPanoLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
            >
              <Image source={{ uri: draftSpace.panoramaUri }} style={StyleSheet.absoluteFill} resizeMode="stretch" />
              {draftSpace.pins.filter((p) => p.x != null && p.id !== draftPin.id).map((pin) => {
                const meta = ALL_PIN_TYPES.find((m) => m.type === pin.type) ?? ALL_PIN_TYPES[0];
                return (
                  <View key={pin.id} style={[styles.pinDotOnPano, {
                    left: pin.x! * panoLayout.width - 8,
                    top:  (pin.y ?? 0.5) * panoLayout.height - 8,
                    backgroundColor: meta.color, opacity: 0.5,
                  }]}>
                    <Feather name={meta.icon as any} size={8} color="#fff" />
                  </View>
                );
              })}
              {draftPin.x != null && (
                <View style={[styles.pinDotOnPano, {
                  left: draftPin.x * panoLayout.width - 10,
                  top:  (draftPin.y ?? 0.5) * panoLayout.height - 10,
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: selectedPinMeta.color,
                }]}>
                  <Feather name={selectedPinMeta.icon as any} size={10} color="#fff" />
                </View>
              )}
              {confirmedPlacement && (
                <View style={[styles.confirmDot, {
                  left: confirmedPlacement.x * panoLayout.width - 16,
                  top:  confirmedPlacement.y * panoLayout.height - 16,
                }]} />
              )}
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={(e) => {
                  const nx = parseFloat((e.nativeEvent.locationX / panoLayout.width).toFixed(3));
                  const ny = parseFloat((e.nativeEvent.locationY / panoLayout.height).toFixed(3));
                  setDraftPin((p) => ({ ...p, x: nx, y: ny }));
                  setPinPlaceMode(false);
                  setConfirmedPlacement({ x: nx, y: ny });
                  setTimeout(() => {
                    setConfirmedPlacement(null);
                    setShowPinModal(true);
                  }, 600);
                }}
              />
              <View style={[styles.placementBar, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
                <TouchableOpacity style={styles.placementCancel} onPress={() => setPinPlaceMode(false)}>
                  <Feather name="x" size={18} color="#fff" />
                </TouchableOpacity>
                <View style={styles.placeModeChip}>
                  <Feather name="crosshair" size={14} color="#fff" />
                  <Text style={styles.placeModeText}>Tap to place pin</Text>
                </View>
                <View style={{ width: 40 }} />
              </View>
            </View>
          )}

          {/* ── Pin editor overlay ── */}
          {showPinModal && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, zIndex: 50 }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => { setShowPinModal(false); setEditingPinId(null); }}>
                  <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingPinId ? "Edit Pin" : "New Info Pin"}</Text>
                <TouchableOpacity onPress={savePin}>
                  <Text style={[styles.modalSave, { color: colors.primary }]}>{editingPinId ? "Save" : "Add"}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {draftSpace.dirMode === "panorama" && draftSpace.panoramaUri && (
                  <View style={[styles.miniPanoWrap, { borderColor: colors.border }]}>
                    <Image source={{ uri: draftSpace.panoramaUri }} style={styles.miniPanoThumb} />
                    {draftPin.x != null && (
                      <View style={[styles.miniPinDot, {
                        left: draftPin.x * MINI_PANO_W - 8,
                        top:  (draftPin.y ?? 0.5) * MINI_PANO_H - 8,
                        backgroundColor: selectedPinMeta.color,
                      }]}>
                        <Feather name={selectedPinMeta.icon as any} size={8} color="#fff" />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.repositionBtn}
                      onPress={() => { setShowPinModal(false); setPinPlaceMode(true); }}
                    >
                      <Feather name="crosshair" size={10} color="#fff" />
                      <Text style={styles.repositionBtnText}>{draftPin.x != null ? "Reposition" : "Place on panorama"}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PIN TYPE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pinTypeRow}>
                  {ALL_PIN_TYPES.map(({ type, label, icon, color: pinColor }) => {
                    const active = draftPin.type === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[styles.pinTypeChip, { backgroundColor: active ? pinColor + "20" : colors.card, borderColor: active ? pinColor : colors.border }]}
                        onPress={() => setDraftPin((p) => ({ ...p, type }))}
                      >
                        <Feather name={icon as any} size={14} color={active ? pinColor : colors.mutedForeground} />
                        <Text style={[styles.pinTypeLabel, { color: active ? pinColor : colors.mutedForeground }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={[styles.pinTypeBanner, { backgroundColor: selectedPinMeta.color + "15", borderColor: selectedPinMeta.color + "30" }]}>
                  <Feather name={selectedPinMeta.icon as any} size={14} color={selectedPinMeta.color} />
                  <Text style={[styles.pinTypeBannerText, { color: selectedPinMeta.color }]}>
                    {selectedPinMeta.label} pin — buyers tap this to see {selectedPinMeta.label.toLowerCase()} details
                  </Text>
                </View>

                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TITLE</Text>
                <TextInput
                  style={[styles.nameInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder={`e.g. ${selectedPinMeta.label} — key detail here`}
                  placeholderTextColor={colors.mutedForeground}
                  value={draftPin.title}
                  onChangeText={(t) => setDraftPin((p) => ({ ...p, title: t }))}
                />

                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESCRIPTION</Text>
                <TextInput
                  style={[styles.descInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="Detailed information buyers will see when they tap this pin…"
                  placeholderTextColor={colors.mutedForeground}
                  value={draftPin.description}
                  onChangeText={(t) => setDraftPin((p) => ({ ...p, description: t }))}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>ATTACH MEDIA (OPTIONAL)</Text>
                <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Attach a photo or document scan to this pin — buyers will see it when they tap.</Text>
                {draftPin.mediaUri ? (
                  <View style={styles.mediaRow}>
                    <Image source={{ uri: draftPin.mediaUri }} style={styles.mediaThumb} />
                    <View style={styles.mediaInfo}>
                      <Text style={[styles.mediaLabel, { color: colors.foreground }]}>Photo attached</Text>
                      <TouchableOpacity onPress={() => setDraftPin((p) => ({ ...p, mediaUri: undefined }))}>
                        <Text style={{ color: "#EF4444", fontSize: 12, fontFamily: "Inter_500Medium" }}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.attachBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={pickPinMedia}>
                    <Feather name="paperclip" size={16} color={colors.mutedForeground} />
                    <Text style={[styles.attachBtnText, { color: colors.mutedForeground }]}>Choose photo or scan from library</Text>
                  </TouchableOpacity>
                )}

                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>VISIBILITY</Text>
                <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Control which buyers can see and interact with this pin.</Text>
                <View style={styles.visGrid}>
                  {VISIBILITY_OPTIONS.map(({ val, label, hint, icon, color: visColor }) => {
                    const active = draftPin.visibility === val;
                    return (
                      <TouchableOpacity
                        key={val}
                        style={[styles.visOption, { backgroundColor: active ? visColor + "15" : colors.card, borderColor: active ? visColor : colors.border }]}
                        onPress={() => setDraftPin((p) => ({ ...p, visibility: val, requiresNDA: val === "nda_only" ? true : p.requiresNDA }))}
                      >
                        <Feather name={icon as any} size={16} color={active ? visColor : colors.mutedForeground} />
                        <Text style={[styles.visLabel, { color: active ? visColor : colors.foreground }]}>{label}</Text>
                        <Text style={[styles.visHint, { color: colors.mutedForeground }]}>{hint}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.ndaLabelRow}>
                      <Feather name="lock" size={14} color="#F59E0B" />
                      <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Requires NDA</Text>
                    </View>
                    <Text style={[styles.toggleHint, { color: colors.mutedForeground }]}>Lock this pin — buyers need signed NDA to view the content</Text>
                  </View>
                  <Switch
                    value={draftPin.requiresNDA}
                    onValueChange={(v) => setDraftPin((p) => ({ ...p, requiresNDA: v }))}
                    trackColor={{ false: colors.muted, true: "#F59E0B60" }}
                    thumbColor={draftPin.requiresNDA ? "#F59E0B" : colors.mutedForeground}
                  />
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  header:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title:             { fontSize: 26, fontFamily: "Inter_700Bold" },
  addBtn:            { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  centered:          { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  emptyIcon:         { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle:        { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyText:         { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  createBtn:         { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14, marginTop: 8 },
  createBtnText:     { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  scroll:            { padding: 16, gap: 16 },
  pickerScroll:      { marginBottom: 4 },
  pickerChip:        { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  pickerChipText:    { fontSize: 13, fontFamily: "Inter_600SemiBold", maxWidth: 180 },
  tourCard:          { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  tourHero:          { height: 100, alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden" },
  tourHeroImg:       { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  tourHeroOverlay:   { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" },
  tourHeroTitle:     { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  tourBody:          { padding: 14, gap: 14 },
  tourStats:         { flexDirection: "row", justifyContent: "space-between" },
  tourStat:          { alignItems: "center" },
  tourStatVal:       { fontSize: 22, fontFamily: "Inter_700Bold" },
  tourStatLbl:       { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  spacesTitle:       { fontSize: 15, fontFamily: "Inter_700Bold" },
  emptySpacesBox:    { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" },
  emptySpacesText:   { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  spaceRow:          { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  spaceIcon:         { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  spaceInfo:         { flex: 1 },
  spaceName:         { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  spaceMeta:         { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  spaceActions:      { flexDirection: "row", alignItems: "center", gap: 14 },
  addSpaceBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12 },
  addSpaceBtnText:   { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  modal:             { flex: 1 },
  modalHeader:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalCancel:       { fontSize: 15, fontFamily: "Inter_400Regular" },
  modalTitle:        { fontSize: 16, fontFamily: "Inter_700Bold" },
  modalSave:         { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalScroll:       { padding: 20, gap: 12 },
  fieldLabel:        { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  fieldHint:         { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -6 },
  nameInput:         { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 4 },
  descInput:         { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 100, marginTop: 4 },
  modeRow:           { flexDirection: "row", gap: 10, marginTop: 6 },
  modeChipWide:      { width: "100%", padding: 16, borderRadius: 14, borderWidth: 1.5, marginTop: 4 },
  modeChip:          { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1.5, gap: 4 },
  modeLabel:         { fontSize: 14, fontFamily: "Inter_700Bold" },
  modeHint:          { fontSize: 11, fontFamily: "Inter_400Regular" },
  panoUploadSlot:    { width: "100%", height: 180, borderRadius: 16, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden", marginTop: 4 },
  panoThumb:         { width: "100%", height: "100%", resizeMode: "cover" },
  panoReadyBadge:    { position: "absolute", bottom: 10, left: 10, backgroundColor: "rgba(124,58,237,0.85)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  panoReadyText:     { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  changePanoBtn:     { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  changePanoBtnText: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  dragHint:          { position: "absolute", bottom: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  dragHintText:      { color: "rgba(255,255,255,0.75)", fontSize: 10, fontFamily: "Inter_500Medium" },
  placeModeChip:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(59,130,246,0.9)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  placeModeText:     { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  placementBar:      { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "rgba(0,0,0,0.55)" },
  placementCancel:   { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  pinDotOnPano:      { position: "absolute", width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  confirmDot:        { position: "absolute", width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: "#3B82F6", backgroundColor: "rgba(59,130,246,0.3)" },
  photoGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  photoSlotWrapper:  { alignItems: "center", gap: 4 },
  photoSlot:         { width: "100%", aspectRatio: 1, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center", gap: 4, overflow: "hidden" },
  photoThumb:        { width: "100%", height: "100%" },
  photoLabel:        { fontFamily: "Inter_600SemiBold", textAlign: "center" },
  photoLabelUnder:   { fontFamily: "Inter_600SemiBold" },
  removePhotoBtn:    { position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  pinSectionHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addPinBtn:         { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  addPinText:        { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pinRow:            { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  pinDot:            { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pinRowInfo:        { flex: 1 },
  pinRowTitle:       { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pinRowMeta:        { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  emptyPins:         { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderRadius: 12, borderWidth: 1, borderStyle: "dashed" },
  emptyPinsText:     { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  miniPanoWrap:      { width: "100%", height: MINI_PANO_H, borderRadius: 12, overflow: "hidden", borderWidth: 1, marginBottom: 4 },
  miniPanoThumb:     { width: "100%", height: "100%", resizeMode: "cover" },
  miniPinDot:        { position: "absolute", width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  repositionBtn:     { position: "absolute", bottom: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(59,130,246,0.85)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  repositionBtnText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  pinTypeRow:        { gap: 8, paddingVertical: 4 },
  pinTypeChip:       { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  pinTypeLabel:      { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pinTypeBanner:     { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  pinTypeBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  attachBtn:         { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", marginTop: 4 },
  attachBtnText:     { fontSize: 14, fontFamily: "Inter_400Regular" },
  mediaRow:          { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  mediaThumb:        { width: 60, height: 60, borderRadius: 10 },
  mediaInfo:         { gap: 6 },
  mediaLabel:        { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  visGrid:           { flexDirection: "row", gap: 8, marginTop: 4 },
  visOption:         { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1.5, alignItems: "center", gap: 4 },
  visLabel:          { fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "center" },
  visHint:           { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 14 },
  toggleRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1 },
  ndaLabelRow:       { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  toggleLabel:       { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleHint:        { fontSize: 12, fontFamily: "Inter_400Regular" },
});
