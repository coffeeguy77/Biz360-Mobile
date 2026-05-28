import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { AudioTrigger, PopupContent, PopupSection, TourPin, TourSpace } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { getPendingListings, PendingListing } from "@/lib/adminStore";
import { getTourSpaces, saveTourSpaces } from "@/lib/tourStore";

const { width: SCREEN_W } = Dimensions.get("window");
const MINI_PANO_H = 100;

const DIRS_4 = ["Front", "Right", "Back", "Left"] as const;
const DIRS_8 = ["Front", "Front-Right", "Right", "Back-Right", "Back", "Back-Left", "Left", "Front-Left"] as const;

const ALL_PIN_TYPES: { type: TourPin["type"]; label: string; icon: string; color: string }[] = [
  { type: "equipment",    label: "Equipment",    icon: "tool",              color: "#F59E0B" },
  { type: "revenue",      label: "Revenue",      icon: "trending-up",       color: "#16A34A" },
  { type: "cogs",         label: "COGS",         icon: "package",           color: "#EF4444" },
  { type: "workflow",     label: "Workflow",      icon: "git-branch",        color: "#8B5CF6" },
  { type: "staffing",     label: "Staffing",      icon: "users",             color: "#3B82F6" },
  { type: "lease",        label: "Lease",         icon: "home",              color: "#F97316" },
  { type: "risk",         label: "Risk",          icon: "alert-triangle",    color: "#EF4444" },
  { type: "opportunity",  label: "Opportunity",   icon: "star",              color: "#16A34A" },
  { type: "narration",    label: "Narration",     icon: "mic",               color: "#EC4899" },
  { type: "inspection",   label: "Inspection",    icon: "clipboard",         color: "#06B6D4" },
  { type: "highlight",    label: "Highlight",     icon: "zap",               color: "#F59E0B" },
  { type: "document",     label: "Document",      icon: "file-text",         color: "#6366F1" },
  { type: "navigation",   label: "Navigation",    icon: "arrow-right-circle",color: "#2563EB" },
  { type: "external_link",label: "External Link", icon: "external-link",     color: "#0891B2" },
  { type: "audio",        label: "Audio Hotspot", icon: "volume-2",          color: "#EC4899" },
];

const INFO_PIN_TYPES = new Set([
  "equipment","revenue","cogs","workflow","staffing","lease",
  "risk","opportunity","narration","inspection","highlight","document",
]);

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
  // Navigation
  targetSpaceId?: string;
  // Document / External link
  documentUrl?: string;
  externalUrl?: string;
  // Audio hotspot
  audioUrl?: string;
  audioTrigger?: AudioTrigger;
  // Rich popup content (info pins)
  popupContent?: PopupContent;
}

interface DraftSpace {
  name: string;
  dirMode: 4 | 8 | "panorama";
  photos: Record<string, string>;
  panoramaUri?: string;
  pins: DraftPin[];
  // Audio narration
  audioUrl?: string;
  audioTrigger?: AudioTrigger;
  audioTranscript?: string;
  // Start scene
  isStartScene?: boolean;
}

const EMPTY_SPACE: DraftSpace = {
  name: "", dirMode: 4, photos: {}, pins: [],
  audioUrl: "", audioTrigger: "button", audioTranscript: "", isStartScene: false,
};
const EMPTY_PIN: DraftPin = { id: "", type: "equipment", title: "", description: "", requiresNDA: false, visibility: "public" };

const VISIBILITY_OPTIONS: { val: Visibility; label: string; hint: string; icon: string; color: string }[] = [
  { val: "public",        label: "Public",        hint: "All buyers can see this pin",      icon: "eye",    color: "#16A34A" },
  { val: "nda_only",      label: "NDA Required",  hint: "Buyer must request and sign NDA", icon: "lock",   color: "#F59E0B" },
  { val: "approved_only", label: "Approved Only", hint: "Only seller-approved buyers",      icon: "shield", color: "#3B82F6" },
];

const AUDIO_TRIGGERS: { val: AudioTrigger; label: string; hint: string }[] = [
  { val: "auto_prompt", label: "Auto-prompt", hint: "Buyer sees prompt when entering scene" },
  { val: "button",      label: "Play Button",  hint: "Buyer taps a play button manually" },
  { val: "hotspot",     label: "Hotspot",      hint: "Buyer taps a pin to trigger audio" },
];

// ─── Upload helper ─────────────────────────────────────────────────────────────

async function _uploadPhoto(
  uri: string, key: string, userId: string, listingId: string, onStatus: (s: string) => void,
): Promise<string> {
  if (uri.startsWith("http")) return uri;
  const domain   = process.env.EXPO_PUBLIC_DOMAIN;
  const apiBase  = domain ? `https://${domain}/api` : "/api";
  onStatus("Uploading photo…");
  const base64   = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  const ext      = uri.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  const ctrl     = new AbortController();
  const timer    = setTimeout(() => ctrl.abort(), 120_000);
  try {
    const res  = await fetch(`${apiBase}/biz360/img`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, data: base64, mimeType, userId, listingId }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const json = await res.json() as { url: string };
    if (!json.url) throw new Error("No URL returned");
    return json.url;
  } catch (err) { clearTimeout(timer); throw err; }
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function ToursScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { listingId: initListingId } = useLocalSearchParams<{ listingId?: string }>();

  const [listings,        setListings]        = useState<PendingListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [selectedId,      setSelectedId]      = useState<string | null>(null);
  const [allSpaces,       setAllSpaces]       = useState<TourSpace[]>([]);
  const [spacesLoaded,    setSpacesLoaded]    = useState(false);
  const currentListingIdRef = useRef<string | null>(null);

  const [showSpaceModal,     setShowSpaceModal]     = useState(false);
  const [draftSpace,         setDraftSpace]         = useState<DraftSpace>(EMPTY_SPACE);
  const [showPinModal,       setShowPinModal]       = useState(false);
  const [draftPin,           setDraftPin]           = useState<DraftPin>(EMPTY_PIN);
  const [pinPlaceMode,       setPinPlaceMode]       = useState(false);
  const [panoLayout,         setPanoLayout]         = useState({ width: 1, height: 1 });
  const [editingSpaceId,     setEditingSpaceId]     = useState<string | null>(null);
  const [editingPinId,       setEditingPinId]       = useState<string | null>(null);
  const [activePinId,        setActivePinId]        = useState<string | null>(null);
  const [confirmedPlacement, setConfirmedPlacement] = useState<{ x: number; y: number } | null>(null);
  const [saving,             setSaving]             = useState(false);
  const [saveStatus,         setSaveStatus]         = useState("");
  const [showRichPopup,      setShowRichPopup]      = useState(false);

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
            if (initListingId && mine.some((l) => l.listingId === initListingId)) return initListingId;
            const stillValid = prev && mine.some((l) => l.listingId === prev);
            return stillValid ? prev : mine[0].listingId;
          });
        } else { setSelectedId(null); }
      });
    }, [user?.id]),
  );

  // ── Load spaces when listing changes ──────────────────────────────────────

  useEffect(() => {
    currentListingIdRef.current = selectedId;
    if (!selectedId) { setAllSpaces([]); setSpacesLoaded(true); return; }
    setSpacesLoaded(false);
    getTourSpaces(selectedId).then((spaces) => { setAllSpaces(spaces); setSpacesLoaded(true); });
  }, [selectedId]);

  // ── Auto-save spaces ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!spacesLoaded || !currentListingIdRef.current) return;
    saveTourSpaces(currentListingIdRef.current, allSpaces).catch(() => {});
  }, [allSpaces, spacesLoaded]);

  const selectedListing = listings.find((l) => l.listingId === selectedId);
  const bannerPhoto     = selectedListing?.photos?.[0] ?? allSpaces[0]?.photos?.[0] ?? allSpaces[0]?.panoramaUrl ?? null;
  const heroBg          = selectedListing?.heroColor ?? "#0F2040";
  const totalPins       = allSpaces.reduce((a, s) => a + s.pins.length, 0);
  const startSpaceCount = allSpaces.filter((s) => s.isStartScene).length;

  // ── Photo pickers ──────────────────────────────────────────────────────────

  const copyPickerAsset = async (pickedUri: string, prefix: string): Promise<string> => {
    if (Platform.OS === "web") return pickedUri;
    const dir  = `${FileSystem.documentDirectory}biz360_tour/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const ext  = pickedUri.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "jpg";
    const dest = `${dir}${prefix}_${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: pickedUri, to: dest });
    return dest;
  };

  const pickPhoto = async (dir: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow photo library access to add photos."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      try {
        const localUri = await copyPickerAsset(result.assets[0].uri, `photo_${dir.replace(/\s/g, "_")}`);
        setDraftSpace((prev) => ({ ...prev, photos: { ...prev.photos, [dir]: localUri } }));
      } catch { Alert.alert("Could not load photo", "Failed to copy photo. Try again."); }
    }
  };

  const removePhoto = (dir: string) => {
    setDraftSpace((prev) => { const { [dir]: _, ...rest } = prev.photos; return { ...prev, photos: rest }; });
  };

  const pickPanorama = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow photo library access to add a panorama."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      try {
        const localUri = await copyPickerAsset(result.assets[0].uri, "pano");
        setDraftSpace((prev) => ({ ...prev, panoramaUri: localUri }));
      } catch { Alert.alert("Could not load panorama", "Failed to copy photo. Try again."); }
    }
  };

  // ── Pin handlers ───────────────────────────────────────────────────────────

  const openAddPin = () => {
    const newPin = { ...EMPTY_PIN, id: `pin-${Date.now()}` };
    setDraftPin(newPin);
    setEditingPinId(null);
    setShowRichPopup(false);
    if (draftSpace.dirMode === "panorama" && draftSpace.panoramaUri) { setPinPlaceMode(true); }
    else { setShowPinModal(true); }
  };

  const openEditPin = (pin: DraftPin) => {
    setDraftPin(pin);
    setEditingPinId(pin.id);
    setActivePinId(pin.id);
    setShowRichPopup(!!(pin.popupContent?.sections?.length || pin.popupContent?.docLinks?.length || pin.popupContent?.images?.some(Boolean)));
    setShowPinModal(true);
  };

  const copyPin = (pin: DraftPin) => {
    const copied: DraftPin = { ...pin, id: `pin-${Date.now()}`, title: pin.title + " (Copy)" };
    setDraftSpace((prev) => ({ ...prev, pins: [...prev.pins, copied] }));
  };

  const savePin = () => {
    if (!draftPin.title.trim()) { Alert.alert("Title required", "Please enter a title for this pin."); return; }
    const needsDesc = draftPin.type !== "navigation" && draftPin.type !== "external_link";
    if (needsDesc && !draftPin.description.trim()) { Alert.alert("Description required", "Please add a description so buyers understand this pin."); return; }
    if (editingPinId) {
      setDraftSpace((prev) => ({ ...prev, pins: prev.pins.map((p) => p.id === editingPinId ? draftPin : p) }));
    } else {
      setDraftSpace((prev) => ({ ...prev, pins: [...prev.pins, draftPin] }));
    }
    setShowPinModal(false);
    setEditingPinId(null);
    setShowRichPopup(false);
  };

  const removePin = (id: string) => {
    setDraftSpace((prev) => ({ ...prev, pins: prev.pins.filter((p) => p.id !== id) }));
    if (activePinId === id) setActivePinId(null);
  };

  // ── Popup content helpers ──────────────────────────────────────────────────

  const addSection = () => {
    const sections: PopupSection[] = [...(draftPin.popupContent?.sections ?? []), { label: "", value: "" }];
    setDraftPin((p) => ({ ...p, popupContent: { ...p.popupContent, sections } }));
  };

  const updateSection = (i: number, field: "label" | "value", val: string) => {
    const sections = [...(draftPin.popupContent?.sections ?? [])];
    sections[i] = { ...sections[i], [field]: val };
    setDraftPin((p) => ({ ...p, popupContent: { ...p.popupContent, sections } }));
  };

  const removeSection = (i: number) => {
    const sections = (draftPin.popupContent?.sections ?? []).filter((_, j) => j !== i);
    setDraftPin((p) => ({ ...p, popupContent: { ...p.popupContent, sections } }));
  };

  const addDocLink = () => {
    const docLinks = [...(draftPin.popupContent?.docLinks ?? []), { label: "", url: "" }];
    setDraftPin((p) => ({ ...p, popupContent: { ...p.popupContent, docLinks } }));
  };

  const updateDocLink = (i: number, field: "label" | "url", val: string) => {
    const docLinks = [...(draftPin.popupContent?.docLinks ?? [])];
    docLinks[i] = { ...docLinks[i], [field]: val };
    setDraftPin((p) => ({ ...p, popupContent: { ...p.popupContent, docLinks } }));
  };

  const removeDocLink = (i: number) => {
    const docLinks = (draftPin.popupContent?.docLinks ?? []).filter((_, j) => j !== i);
    setDraftPin((p) => ({ ...p, popupContent: { ...p.popupContent, docLinks } }));
  };

  const updatePopupImage = (i: number, val: string) => {
    const images = [...(draftPin.popupContent?.images ?? ["", "", ""])];
    while (images.length < 3) images.push("");
    images[i] = val;
    setDraftPin((p) => ({ ...p, popupContent: { ...p.popupContent, images } }));
  };

  // ── Space handlers ─────────────────────────────────────────────────────────

  const openEditSpace = (space: TourSpace) => {
    const dirMode: 4 | 8 | "panorama" = space.dirMode ?? (space.panoramaUrl ? "panorama" : space.photos.length > 4 ? 8 : 4);
    const dirs = dirMode === 8 ? DIRS_8 : dirMode === 4 ? DIRS_4 : [];
    const photos: Record<string, string> = {};
    if (dirMode !== "panorama") { dirs.forEach((dir, i) => { if (space.photos[i]) photos[dir] = space.photos[i]; }); }
    const draftPins: DraftPin[] = space.pins.map((p) => ({
      id: p.id, type: p.type, title: p.title, description: p.description,
      requiresNDA: p.requiresNDA ?? false, visibility: "public" as Visibility,
      x: p.position.x, y: p.position.y,
      targetSpaceId:  p.targetSpaceId,
      documentUrl:    p.documentUrl,
      externalUrl:    p.externalUrl,
      audioUrl:       p.audioUrl,
      audioTrigger:   p.audioTrigger,
      popupContent:   p.popupContent,
    }));
    setDraftSpace({
      name: space.name, dirMode, photos, panoramaUri: space.panoramaUrl, pins: draftPins,
      audioUrl:       space.audioUrl ?? "",
      audioTrigger:   space.audioTrigger ?? "button",
      audioTranscript:space.audioTranscript ?? "",
      isStartScene:   space.isStartScene ?? false,
    });
    setEditingSpaceId(space.id);
    setShowSpaceModal(true);
  };

  const deleteSpace = (space: TourSpace) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Delete Space", `Remove "${space.name}" from this tour?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setAllSpaces((prev) => prev.filter((s) => s.id !== space.id));
      }},
    ]);
  };

  const closeSpaceModal = () => {
    setShowSpaceModal(false); setDraftSpace(EMPTY_SPACE);
    setEditingSpaceId(null);  setPinPlaceMode(false);
    setActivePinId(null);     setConfirmedPlacement(null);
  };

  const moveSpaceUp = (idx: number) => {
    if (idx === 0) return;
    setAllSpaces((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveSpaceDown = (idx: number) => {
    setAllSpaces((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const toggleStartScene = (spaceId: string) => {
    setAllSpaces((prev) => prev.map((s) => ({
      ...s,
      isStartScene: s.id === spaceId ? !s.isStartScene : false,
    })));
  };

  const handleSaveSpace = async () => {
    if (!draftSpace.name.trim()) { Alert.alert("Name required", "Please enter a name for this tour space."); return; }
    if (draftSpace.dirMode === "panorama") {
      if (!draftSpace.panoramaUri) { Alert.alert("Photo required", "Please choose a panorama photo before saving."); return; }
    } else {
      if (Object.keys(draftSpace.photos).length === 0) { Alert.alert("Photos required", `Please add at least 1 directional photo before saving.`); return; }
    }

    setSaving(true);
    const isEditing  = editingSpaceId !== null;
    const spaceIdNow = isEditing ? editingSpaceId! : `space-${Date.now()}`;
    const listingKey = selectedId ?? spaceIdNow;
    const userId     = user?.id ?? "unknown";

    const extraFields = {
      audioUrl:        draftSpace.audioUrl?.trim() || undefined,
      audioTrigger:    draftSpace.audioTrigger,
      audioTranscript: draftSpace.audioTranscript?.trim() || undefined,
      isStartScene:    draftSpace.isStartScene ?? false,
    };

    try {
      let savedSpace: TourSpace;
      if (draftSpace.dirMode === "panorama") {
        setSaveStatus("Uploading panorama…");
        const imgKey      = `pano_${Date.now()}`;
        const panoramaUrl = await _uploadPhoto(draftSpace.panoramaUri!, imgKey, userId, listingKey, setSaveStatus);
        savedSpace = {
          id: spaceIdNow, name: draftSpace.name.trim(), photos: [],
          pins: buildTourPins(draftSpace.pins), panoramaUrl, panoramaStartYaw: 0, dirMode: "panorama",
          ...extraFields,
        };
      } else {
        const dirs = draftSpace.dirMode === 8 ? DIRS_8 : DIRS_4;
        const photoArray: string[] = [];
        let photoIdx = 0;
        for (const dir of dirs) {
          const uri = draftSpace.photos[dir];
          if (!uri) continue;
          setSaveStatus(`Uploading photo ${++photoIdx}…`);
          const imgKey      = `${dir.replace(/\s/g, "_")}_${Date.now()}`;
          const uploadedUrl = await _uploadPhoto(uri, imgKey, userId, listingKey, setSaveStatus);
          photoArray.push(uploadedUrl);
        }
        savedSpace = {
          id: spaceIdNow, name: draftSpace.name.trim(), photos: photoArray,
          pins: buildTourPins(draftSpace.pins), dirMode: draftSpace.dirMode,
          ...extraFields,
        };
      }

      // If this is a new start scene, clear old ones
      if (savedSpace.isStartScene) {
        setAllSpaces((prev) => {
          const cleared = prev.map((s) => ({ ...s, isStartScene: false }));
          return isEditing
            ? cleared.map((s) => s.id === editingSpaceId ? savedSpace : s)
            : [...cleared, savedSpace];
        });
      } else {
        setAllSpaces((prev) => isEditing
          ? prev.map((s) => s.id === editingSpaceId ? savedSpace : s)
          : [...prev, savedSpace]);
      }
      closeSpaceModal();
    } catch {
      Alert.alert("Save failed", "Could not upload photos. Check your connection and try again.");
    } finally { setSaving(false); setSaveStatus(""); }
  };

  function buildTourPins(draftPins: DraftPin[]): TourPin[] {
    return draftPins.map((dp, i) => {
      const pin: TourPin = {
        id:          dp.id,
        type:        dp.type,
        title:       dp.title,
        description: dp.description,
        requiresNDA: dp.requiresNDA,
        position: {
          x: dp.x ?? parseFloat(((i + 0.5) / Math.max(draftPins.length, 1)).toFixed(2)),
          y: dp.y ?? (0.4 + (i % 3) * 0.1),
        },
      };
      if (dp.targetSpaceId)           pin.targetSpaceId  = dp.targetSpaceId;
      if (dp.documentUrl?.trim())     pin.documentUrl    = dp.documentUrl.trim();
      if (dp.externalUrl?.trim())     pin.externalUrl    = dp.externalUrl.trim();
      if (dp.audioUrl?.trim())        pin.audioUrl       = dp.audioUrl.trim();
      if (dp.audioTrigger)            pin.audioTrigger   = dp.audioTrigger;
      if (dp.popupContent && (dp.popupContent.sections?.length || dp.popupContent.docLinks?.length)) {
        pin.popupContent = {
          ...dp.popupContent,
          heading: dp.title,
          body:    dp.description,
        };
      }
      return pin;
    });
  }

  const switchDirMode = (mode: 4 | 8 | "panorama") => {
    const messages: Record<string, string> = {
      "4":        "Reduce to 4 cardinal directions. Existing photos will be cleared.",
      "8":        "8 directions for a more immersive tour. Existing photos will be cleared.",
      "panorama": "Upload a single 360° panorama photo from your camera roll.",
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

  // Other spaces available for navigation targets (excluding the current space being edited)
  const navTargetOptions = allSpaces.filter((s) => s.id !== editingSpaceId);

  // ── Render ─────────────────────────────────────────────────────────────────

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
        <View style={styles.centered}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
            <Feather name="rotate-ccw" size={36} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No listings yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Create a listing first, then come back to build your 360° tour.
          </Text>
          <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/create-listing" as any)}>
            <Feather name="plus" size={15} color="#fff" />
            <Text style={styles.createBtnText}>Create Listing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Listing picker */}
          {listings.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
              {listings.map((l) => {
                const active = l.listingId === selectedId;
                return (
                  <TouchableOpacity
                    key={l.listingId}
                    style={[styles.pickerChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
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

          {/* Tour card */}
          {selectedListing && (
            <View style={[styles.tourCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {bannerPhoto ? (
                <ImageBackground source={{ uri: bannerPhoto }} style={styles.tourHero} imageStyle={styles.tourHeroImg}>
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
                <View style={styles.tourStats}>
                  {[
                    { val: String(allSpaces.length), lbl: "Spaces",     color: colors.primary },
                    { val: String(totalPins),         lbl: "Pins",       color: colors.primary },
                    { val: String(allSpaces.filter((s) => s.audioUrl).length), lbl: "Audio",  color: "#EC4899" },
                    { val: startSpaceCount > 0 ? "✓" : "—", lbl: "Start",  color: colors.accent },
                  ].map(({ val, lbl, color }) => (
                    <View key={lbl} style={styles.tourStat}>
                      <Text style={[styles.tourStatVal, { color }]}>{val}</Text>
                      <Text style={[styles.tourStatLbl, { color: colors.mutedForeground }]}>{lbl}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[styles.spacesTitle, { color: colors.foreground }]}>Tour Spaces</Text>

                {!spacesLoaded && <ActivityIndicator color={colors.primary} style={{ alignSelf: "center", marginVertical: 16 }} />}

                {spacesLoaded && allSpaces.length === 0 && (
                  <View style={[styles.emptySpacesBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Feather name="camera-off" size={18} color={colors.mutedForeground} />
                    <Text style={[styles.emptySpacesText, { color: colors.mutedForeground }]}>
                      No spaces yet. Tap + to add your first tour space.
                    </Text>
                  </View>
                )}

                {spacesLoaded && allSpaces.map((space, idx) => (
                  <View key={space.id} style={[styles.spaceRow, { borderBottomColor: colors.border }]}>
                    {/* Reorder + start scene */}
                    <View style={styles.spaceReorder}>
                      <TouchableOpacity
                        onPress={() => moveSpaceUp(idx)}
                        style={[styles.reorderBtn, { opacity: idx === 0 ? 0.3 : 1 }]}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        disabled={idx === 0}
                      >
                        <Feather name="chevron-up" size={14} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => moveSpaceDown(idx)}
                        style={[styles.reorderBtn, { opacity: idx === allSpaces.length - 1 ? 0.3 : 1 }]}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        disabled={idx === allSpaces.length - 1}
                      >
                        <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.spaceIcon, { backgroundColor: space.isStartScene ? "#16A34A18" : colors.primary + "18" }]}>
                      <Feather name={space.isStartScene ? "home" : "camera"} size={16} color={space.isStartScene ? "#16A34A" : colors.primary} />
                    </View>

                    <View style={styles.spaceInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.spaceName, { color: colors.foreground }]}>{space.name}</Text>
                        {space.isStartScene && (
                          <View style={[styles.startBadge, { backgroundColor: "#16A34A20" }]}>
                            <Text style={[styles.startBadgeText, { color: "#16A34A" }]}>START</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.spaceMeta, { color: colors.mutedForeground }]}>
                        {space.panoramaUrl && space.photos.length === 0 ? "360°" : `${space.photos.length} photos`}
                        {` · ${space.pins.length} pins`}
                        {space.audioUrl ? " · 🎵" : ""}
                        {space.pins.some((p) => p.type === "navigation") ? " · 🧭" : ""}
                      </Text>
                    </View>

                    <View style={styles.spaceActions}>
                      <TouchableOpacity
                        onPress={() => toggleStartScene(space.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="home" size={15} color={space.isStartScene ? "#16A34A" : colors.mutedForeground} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { const idx2 = allSpaces.indexOf(space); router.push(`/tour/${selectedListing!.listingId}?startSpace=${idx2}` as any); }}
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

                <TouchableOpacity style={[styles.addSpaceBtn, { backgroundColor: colors.muted }]} onPress={() => setShowSpaceModal(true)}>
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

            {/* Start scene toggle */}
            <View style={[styles.startToggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.startToggleLabel, { color: colors.foreground }]}>Start Scene</Text>
                <Text style={[styles.startToggleHint, { color: colors.mutedForeground }]}>
                  Buyers start the tour in this space
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.startToggleBtn, { backgroundColor: draftSpace.isStartScene ? "#16A34A" : colors.muted }]}
                onPress={() => setDraftSpace((p) => ({ ...p, isStartScene: !p.isStartScene }))}
              >
                <Text style={[styles.startToggleBtnText, { color: draftSpace.isStartScene ? "#fff" : colors.mutedForeground }]}>
                  {draftSpace.isStartScene ? "ON" : "OFF"}
                </Text>
              </TouchableOpacity>
            </View>

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
                        draggingPinIdRef.current = null;
                        dragPositionRef.current  = null;
                        const spaceId = editingSpaceIdRef.current;
                        if (wasDragging && finalPos && spaceId) {
                          setAllSpaces((prev) => prev.map((s) => s.id !== spaceId ? s : {
                            ...s,
                            pins: s.pins.map((p) => p.id === wasDragging ? { ...p, position: { x: finalPos.x, y: finalPos.y } } : p),
                          }));
                        }
                      }}
                    >
                      {draftSpace.pins.filter((p) => p.x != null).map((pin) => {
                        const meta       = ALL_PIN_TYPES.find((m) => m.type === pin.type) ?? ALL_PIN_TYPES[0];
                        const isActivePin = activePinId === pin.id;
                        return (
                          <View key={pin.id} style={[styles.pinDotOnPano, {
                            left: pin.x! * panoLayout.width - (isActivePin ? 10 : 8),
                            top:  (pin.y ?? 0.5) * panoLayout.height - (isActivePin ? 10 : 8),
                            backgroundColor: meta.color,
                            width: isActivePin ? 20 : 16, height: isActivePin ? 20 : 16,
                            borderRadius: isActivePin ? 10 : 8,
                          }]}>
                            <Feather name={meta.icon as any} size={isActivePin ? 10 : 8} color="#fff" />
                          </View>
                        );
                      })}
                      {confirmedPlacement && (
                        <View style={[styles.confirmDot, { left: confirmedPlacement.x * panoLayout.width - 16, top: confirmedPlacement.y * panoLayout.height - 16 }]} />
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
                        {"✓ "}{draftSpace.pins.filter((p) => p.x != null).length > 0
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
                  <TouchableOpacity style={[styles.panoUploadSlot, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={pickPanorama}>
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
                <View style={styles.photoGrid}>
                  {activeDirections.map((dir) => {
                    const uri = draftSpace.photos[dir];
                    return (
                      <View key={dir} style={[styles.photoSlotWrapper, { width: draftSpace.dirMode === 8 ? "23%" : "30%" }]}>
                        <TouchableOpacity
                          style={[styles.photoSlot, { backgroundColor: uri ? "transparent" : colors.card, borderColor: uri ? colors.primary : colors.border }]}
                          onPress={() => pickPhoto(dir)}
                        >
                          {uri ? <Image source={{ uri }} style={styles.photoThumb} /> : (
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

            {/* ── Audio Narration Section ── */}
            <View style={[styles.audioSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.audioSectionHeader}>
                <Feather name="volume-2" size={16} color="#EC4899" />
                <Text style={[styles.audioSectionTitle, { color: colors.foreground }]}>Audio Narration</Text>
                <Text style={[styles.audioSectionHint, { color: colors.mutedForeground }]}>Optional</Text>
              </View>
              <Text style={[styles.fieldHint, { color: colors.mutedForeground, marginBottom: 10 }]}>
                Paste a Cloudinary or hosted MP3 URL. Buyers can play narration while viewing this scene.
              </Text>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>AUDIO URL (MP3)</Text>
              <TextInput
                style={[styles.nameInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="https://res.cloudinary.com/…/audio.mp3"
                placeholderTextColor={colors.mutedForeground}
                value={draftSpace.audioUrl ?? ""}
                onChangeText={(t) => setDraftSpace((p) => ({ ...p, audioUrl: t }))}
                autoCapitalize="none"
                keyboardType="url"
              />
              {draftSpace.audioUrl?.trim() ? (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TRIGGER</Text>
                  <View style={styles.triggerRow}>
                    {AUDIO_TRIGGERS.map((t) => {
                      const active = (draftSpace.audioTrigger ?? "button") === t.val;
                      return (
                        <TouchableOpacity
                          key={t.val}
                          style={[styles.triggerChip, { backgroundColor: active ? "#EC489920" : colors.background, borderColor: active ? "#EC4899" : colors.border }]}
                          onPress={() => setDraftSpace((p) => ({ ...p, audioTrigger: t.val }))}
                        >
                          <Text style={[styles.triggerChipText, { color: active ? "#EC4899" : colors.mutedForeground }]}>{t.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TRANSCRIPT (OPTIONAL)</Text>
                  <TextInput
                    style={[styles.nameInput, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                    placeholder="Transcript of the narration…"
                    placeholderTextColor={colors.mutedForeground}
                    value={draftSpace.audioTranscript ?? ""}
                    onChangeText={(t) => setDraftSpace((p) => ({ ...p, audioTranscript: t }))}
                    multiline numberOfLines={3}
                  />
                </>
              ) : null}
            </View>

            {/* ── Pin Section ── */}
            <View style={styles.pinSectionHeader}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>INFO PINS ({draftSpace.pins.length})</Text>
              <TouchableOpacity style={[styles.addPinBtn, { backgroundColor: colors.primary }]} onPress={openAddPin}>
                <Feather name="plus" size={13} color="#fff" />
                <Text style={styles.addPinText}>Add Pin</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Tap a pin to highlight it. Edit, copy, or drag it on the panorama.</Text>

            {draftSpace.pins.map((pin) => {
              const meta      = ALL_PIN_TYPES.find((p) => p.type === pin.type) ?? ALL_PIN_TYPES[0];
              const visMeta   = VISIBILITY_OPTIONS.find((v) => v.val === pin.visibility) ?? VISIBILITY_OPTIONS[0];
              const isActivePin = activePinId === pin.id;
              return (
                <TouchableOpacity
                  key={pin.id}
                  style={[styles.pinRow, { backgroundColor: isActivePin ? meta.color + "18" : colors.card, borderColor: isActivePin ? meta.color : colors.border }]}
                  onPress={() => setActivePinId(isActivePin ? null : pin.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.pinDot, { backgroundColor: meta.color }]}>
                    <Feather name={meta.icon as any} size={12} color="#fff" />
                  </View>
                  <View style={styles.pinRowInfo}>
                    <Text style={[styles.pinRowTitle, { color: colors.foreground }]}>{pin.title}</Text>
                    <Text style={[styles.pinRowMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {meta.label}{pin.type === "navigation" && pin.targetSpaceId
                        ? ` → ${allSpaces.find((s) => s.id === pin.targetSpaceId)?.name ?? "?"}`
                        : ""}
                      {" · "}{visMeta.label}{pin.x != null ? " · 📍" : ""}
                      {pin.popupContent?.sections?.length ? " · ✨" : ""}
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
                  <View key={pin.id} style={[styles.pinDotOnPano, { left: pin.x! * panoLayout.width - 8, top: (pin.y ?? 0.5) * panoLayout.height - 8, backgroundColor: meta.color, opacity: 0.5 }]}>
                    <Feather name={meta.icon as any} size={8} color="#fff" />
                  </View>
                );
              })}
              {draftPin.x != null && (
                <View style={[styles.pinDotOnPano, { left: draftPin.x * panoLayout.width - 10, top: (draftPin.y ?? 0.5) * panoLayout.height - 10, width: 20, height: 20, borderRadius: 10, backgroundColor: selectedPinMeta.color }]}>
                  <Feather name={selectedPinMeta.icon as any} size={10} color="#fff" />
                </View>
              )}
              {confirmedPlacement && (
                <View style={[styles.confirmDot, { left: confirmedPlacement.x * panoLayout.width - 16, top: confirmedPlacement.y * panoLayout.height - 16 }]} />
              )}
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={(e) => {
                  const { locationX, locationY } = e.nativeEvent;
                  const nx = Math.max(0.01, Math.min(0.99, locationX / panoLayout.width));
                  const ny = Math.max(0.01, Math.min(0.99, locationY / panoLayout.height));
                  setDraftPin((p) => ({ ...p, x: nx, y: ny }));
                  setConfirmedPlacement({ x: nx, y: ny });
                }}
              />
              <View style={styles.pinPlaceTopBar}>
                <TouchableOpacity style={styles.pinPlaceBack} onPress={() => { setPinPlaceMode(false); setShowPinModal(true); }}>
                  <Feather name="arrow-left" size={18} color="#fff" />
                  <Text style={styles.pinPlaceBackText}>Back to pin</Text>
                </TouchableOpacity>
                <Text style={styles.pinPlaceTitle}>Tap to place pin</Text>
                {draftPin.x != null && (
                  <TouchableOpacity
                    style={styles.pinPlaceConfirm}
                    onPress={() => { setPinPlaceMode(false); setShowPinModal(true); }}
                  >
                    <Text style={styles.pinPlaceConfirmText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Pin Modal ── */}
      <Modal visible={showPinModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPinModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setShowPinModal(false); setEditingPinId(null); setShowRichPopup(false); }}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingPinId ? "Edit Pin" : "New Pin"}</Text>
            <TouchableOpacity onPress={savePin}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Pin type picker */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PIN TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.typeGrid}>
                {ALL_PIN_TYPES.map((t) => {
                  const active = draftPin.type === t.type;
                  return (
                    <TouchableOpacity
                      key={t.type}
                      style={[styles.typeChip, { backgroundColor: active ? t.color + "20" : colors.card, borderColor: active ? t.color : colors.border }]}
                      onPress={() => setDraftPin((p) => ({ ...p, type: t.type }))}
                    >
                      <Feather name={t.icon as any} size={13} color={active ? t.color : colors.mutedForeground} />
                      <Text style={[styles.typeChipText, { color: active ? t.color : colors.mutedForeground }]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TITLE</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Short, descriptive title…"
              placeholderTextColor={colors.mutedForeground}
              value={draftPin.title}
              onChangeText={(t) => setDraftPin((p) => ({ ...p, title: t }))}
            />

            {/* Navigation: target scene picker */}
            {draftPin.type === "navigation" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TARGET SCENE</Text>
                {navTargetOptions.length === 0 ? (
                  <View style={[styles.emptyPins, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.emptyPinsText, { color: colors.mutedForeground }]}>
                      No other spaces yet — add more spaces to create navigation pins.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 8, marginBottom: 16 }}>
                    {navTargetOptions.map((s) => {
                      const active = draftPin.targetSpaceId === s.id;
                      return (
                        <TouchableOpacity
                          key={s.id}
                          style={[styles.navTargetRow, { backgroundColor: active ? "#2563EB18" : colors.card, borderColor: active ? "#2563EB" : colors.border }]}
                          onPress={() => setDraftPin((p) => ({ ...p, targetSpaceId: s.id }))}
                        >
                          <Feather name={active ? "check-circle" : "circle"} size={16} color={active ? "#2563EB" : colors.mutedForeground} />
                          <Text style={[styles.navTargetText, { color: active ? "#2563EB" : colors.foreground }]}>{s.name}</Text>
                          {s.isStartScene && (
                            <View style={[styles.startBadge, { backgroundColor: "#16A34A20" }]}>
                              <Text style={[styles.startBadgeText, { color: "#16A34A" }]}>START</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESCRIPTION (OPTIONAL)</Text>
                <TextInput
                  style={[styles.nameInput, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="e.g. See the commercial kitchen setup…"
                  placeholderTextColor={colors.mutedForeground}
                  value={draftPin.description}
                  onChangeText={(t) => setDraftPin((p) => ({ ...p, description: t }))}
                  multiline numberOfLines={2}
                />
              </>
            )}

            {/* External link URL */}
            {draftPin.type === "external_link" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>URL</Text>
                <TextInput
                  style={[styles.nameInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="https://…"
                  placeholderTextColor={colors.mutedForeground}
                  value={draftPin.externalUrl ?? ""}
                  onChangeText={(t) => setDraftPin((p) => ({ ...p, externalUrl: t }))}
                  autoCapitalize="none" keyboardType="url"
                />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESCRIPTION</Text>
                <TextInput
                  style={[styles.nameInput, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="What does this link show or document?"
                  placeholderTextColor={colors.mutedForeground}
                  value={draftPin.description}
                  onChangeText={(t) => setDraftPin((p) => ({ ...p, description: t }))}
                  multiline numberOfLines={2}
                />
              </>
            )}

            {/* Document link URL */}
            {draftPin.type === "document" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DOCUMENT URL</Text>
                <TextInput
                  style={[styles.nameInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="https://…"
                  placeholderTextColor={colors.mutedForeground}
                  value={draftPin.documentUrl ?? ""}
                  onChangeText={(t) => setDraftPin((p) => ({ ...p, documentUrl: t }))}
                  autoCapitalize="none" keyboardType="url"
                />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESCRIPTION</Text>
                <TextInput
                  style={[styles.nameInput, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="What does this document show? (health inspection, equipment list…)"
                  placeholderTextColor={colors.mutedForeground}
                  value={draftPin.description}
                  onChangeText={(t) => setDraftPin((p) => ({ ...p, description: t }))}
                  multiline numberOfLines={2}
                />
              </>
            )}

            {/* Audio hotspot */}
            {draftPin.type === "audio" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>AUDIO URL (MP3)</Text>
                <TextInput
                  style={[styles.nameInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="https://res.cloudinary.com/…/audio.mp3"
                  placeholderTextColor={colors.mutedForeground}
                  value={draftPin.audioUrl ?? ""}
                  onChangeText={(t) => setDraftPin((p) => ({ ...p, audioUrl: t }))}
                  autoCapitalize="none" keyboardType="url"
                />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TRIGGER</Text>
                <View style={styles.triggerRow}>
                  {AUDIO_TRIGGERS.map((t) => {
                    const active = (draftPin.audioTrigger ?? "button") === t.val;
                    return (
                      <TouchableOpacity
                        key={t.val}
                        style={[styles.triggerChip, { backgroundColor: active ? "#EC489920" : colors.card, borderColor: active ? "#EC4899" : colors.border }]}
                        onPress={() => setDraftPin((p) => ({ ...p, audioTrigger: t.val }))}
                      >
                        <Text style={[styles.triggerChipText, { color: active ? "#EC4899" : colors.mutedForeground }]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESCRIPTION</Text>
                <TextInput
                  style={[styles.nameInput, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="Brief description of what the audio covers…"
                  placeholderTextColor={colors.mutedForeground}
                  value={draftPin.description}
                  onChangeText={(t) => setDraftPin((p) => ({ ...p, description: t }))}
                  multiline numberOfLines={2}
                />
              </>
            )}

            {/* Standard info pin: description + optional rich content */}
            {INFO_PIN_TYPES.has(draftPin.type) && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESCRIPTION</Text>
                <TextInput
                  style={[styles.nameInput, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="Describe what buyers should know about this point of interest…"
                  placeholderTextColor={colors.mutedForeground}
                  value={draftPin.description}
                  onChangeText={(t) => setDraftPin((p) => ({ ...p, description: t }))}
                  multiline numberOfLines={4}
                />

                {/* NDA toggle */}
                <TouchableOpacity
                  style={[styles.ndaToggle, { backgroundColor: draftPin.requiresNDA ? "#EF444418" : colors.card, borderColor: draftPin.requiresNDA ? "#EF4444" : colors.border }]}
                  onPress={() => setDraftPin((p) => ({ ...p, requiresNDA: !p.requiresNDA }))}
                >
                  <Feather name="lock" size={14} color={draftPin.requiresNDA ? "#EF4444" : colors.mutedForeground} />
                  <Text style={[styles.ndaToggleText, { color: draftPin.requiresNDA ? "#EF4444" : colors.foreground }]}>
                    Requires NDA to view
                  </Text>
                  <Feather name={draftPin.requiresNDA ? "check-square" : "square"} size={16} color={draftPin.requiresNDA ? "#EF4444" : colors.mutedForeground} />
                </TouchableOpacity>

                {/* Place on panorama */}
                {draftSpace.dirMode === "panorama" && draftSpace.panoramaUri && (
                  <TouchableOpacity
                    style={[styles.placePinBtn, { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
                    onPress={() => { setShowPinModal(false); setPinPlaceMode(true); }}
                  >
                    <Feather name="crosshair" size={14} color={colors.primary} />
                    <Text style={[styles.placePinBtnText, { color: colors.primary }]}>
                      {draftPin.x != null ? `Reposition pin (${Math.round(draftPin.x * 100)}%, ${Math.round((draftPin.y ?? 0.5) * 100)}%)` : "Place on Panorama"}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Rich popup section */}
                <TouchableOpacity
                  style={[styles.richToggle, { backgroundColor: showRichPopup ? "#3B82F618" : colors.card, borderColor: showRichPopup ? "#3B82F6" : colors.border }]}
                  onPress={() => setShowRichPopup((v) => !v)}
                >
                  <Feather name="layout" size={14} color={showRichPopup ? "#3B82F6" : colors.mutedForeground} />
                  <Text style={[styles.richToggleText, { color: showRichPopup ? "#3B82F6" : colors.foreground }]}>Rich Content (Key Facts, Doc Link)</Text>
                  <Feather name={showRichPopup ? "chevron-up" : "chevron-down"} size={15} color={colors.mutedForeground} />
                </TouchableOpacity>

                {showRichPopup && (
                  <View style={[styles.richSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>KEY FACTS (label / value)</Text>
                    {(draftPin.popupContent?.sections ?? []).map((s, i) => (
                      <View key={i} style={styles.sectionEditorRow}>
                        <TextInput
                          style={[styles.sectionInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                          placeholder="Label"
                          placeholderTextColor={colors.mutedForeground}
                          value={s.label}
                          onChangeText={(v) => updateSection(i, "label", v)}
                        />
                        <TextInput
                          style={[styles.sectionInput, { flex: 1.5, backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                          placeholder="Value"
                          placeholderTextColor={colors.mutedForeground}
                          value={s.value}
                          onChangeText={(v) => updateSection(i, "value", v)}
                        />
                        <TouchableOpacity onPress={() => removeSection(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Feather name="x" size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity style={[styles.addSectionBtn, { borderColor: colors.border }]} onPress={addSection}>
                      <Feather name="plus" size={13} color={colors.primary} />
                      <Text style={[styles.addSectionBtnText, { color: colors.primary }]}>Add Key Fact</Text>
                    </TouchableOpacity>

                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 12 }]}>POPUP IMAGES (up to 3 URLs)</Text>
                    {[0, 1, 2].map((i) => (
                      <TextInput
                        key={`img-${i}`}
                        style={[styles.nameInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                        placeholder={`Image URL ${i + 1} (https://…)`}
                        placeholderTextColor={colors.mutedForeground}
                        value={draftPin.popupContent?.images?.[i] ?? ""}
                        onChangeText={(v) => updatePopupImage(i, v)}
                        autoCapitalize="none"
                        keyboardType="url"
                      />
                    ))}

                    <View style={[styles.richDocHeader, { marginTop: 12 }]}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>DOCUMENT LINKS</Text>
                      <TouchableOpacity style={[styles.addSectionBtn, { borderColor: colors.primary }]} onPress={addDocLink}>
                        <Feather name="plus" size={12} color={colors.primary} />
                        <Text style={[styles.addSectionBtnText, { color: colors.primary }]}>Add</Text>
                      </TouchableOpacity>
                    </View>
                    {(draftPin.popupContent?.docLinks ?? []).length === 0 && (
                      <Text style={[styles.richDocEmpty, { color: colors.mutedForeground }]}>No document links yet — tap Add to attach PDFs or reports.</Text>
                    )}
                    {(draftPin.popupContent?.docLinks ?? []).map((doc, i) => (
                      <View key={`doc-${i}`} style={[styles.docLinkEditorRow, { borderColor: colors.border }]}>
                        <View style={{ flex: 1, gap: 6 }}>
                          <TextInput
                            style={[styles.nameInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginBottom: 0 }]}
                            placeholder="Label (e.g. Health Inspection Report)"
                            placeholderTextColor={colors.mutedForeground}
                            value={doc.label}
                            onChangeText={(v) => updateDocLink(i, "label", v)}
                          />
                          <TextInput
                            style={[styles.nameInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginBottom: 0 }]}
                            placeholder="URL (https://…)"
                            placeholderTextColor={colors.mutedForeground}
                            value={doc.url}
                            onChangeText={(v) => updateDocLink(i, "url", v)}
                            autoCapitalize="none"
                            keyboardType="url"
                          />
                        </View>
                        <TouchableOpacity onPress={() => removeDocLink(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Feather name="trash-2" size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Visibility for non-navigation pins */}
            {draftPin.type !== "navigation" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>VISIBILITY</Text>
                {VISIBILITY_OPTIONS.map((v) => {
                  const active = draftPin.visibility === v.val;
                  return (
                    <TouchableOpacity
                      key={v.val}
                      style={[styles.visRow, { backgroundColor: active ? v.color + "12" : colors.card, borderColor: active ? v.color : colors.border }]}
                      onPress={() => setDraftPin((p) => ({ ...p, visibility: v.val }))}
                    >
                      <Feather name={v.icon as any} size={16} color={active ? v.color : colors.mutedForeground} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.visLabel, { color: active ? v.color : colors.foreground }]}>{v.label}</Text>
                        <Text style={[styles.visHint, { color: colors.mutedForeground }]}>{v.hint}</Text>
                      </View>
                      <Feather name={active ? "check-circle" : "circle"} size={16} color={active ? v.color : colors.mutedForeground} />
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title:           { fontSize: 26, fontFamily: "Inter_700Bold" },
  addBtn:          { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  centered:        { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 },
  emptyIcon:       { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  emptyTitle:      { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptyText:       { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  createBtn:       { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  createBtnText:   { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  scroll:          { padding: 16, gap: 14 },
  pickerScroll:    { marginBottom: 8 },
  pickerChip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8, maxWidth: 200 },
  pickerChipText:  { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tourCard:        { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  tourHero:        { height: 110, justifyContent: "flex-end", padding: 16, gap: 4 },
  tourHeroImg:     { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  tourHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  tourHeroTitle:   { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  tourBody:        { padding: 16, gap: 12 },
  tourStats:       { flexDirection: "row", justifyContent: "space-around", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#1E3A5C" },
  tourStat:        { alignItems: "center", gap: 3 },
  tourStatVal:     { fontSize: 20, fontFamily: "Inter_700Bold" },
  tourStatLbl:     { fontSize: 11, fontFamily: "Inter_400Regular" },
  spacesTitle:     { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 4 },
  emptySpacesBox:  { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  emptySpacesText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  spaceRow:        { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  spaceReorder:    { gap: 2 },
  reorderBtn:      { padding: 2 },
  spaceIcon:       { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  spaceInfo:       { flex: 1 },
  spaceName:       { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  spaceMeta:       { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  startBadge:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  startBadgeText:  { fontSize: 9, fontFamily: "Inter_700Bold" },
  spaceActions:    { flexDirection: "row", alignItems: "center", gap: 12 },
  addSpaceBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 12, marginTop: 8 },
  addSpaceBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  modal:           { flex: 1 },
  modalHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1 },
  modalCancel:     { fontSize: 15, fontFamily: "Inter_400Regular" },
  modalTitle:      { fontSize: 16, fontFamily: "Inter_700Bold" },
  modalSave:       { fontSize: 15, fontFamily: "Inter_700Bold" },
  modalScroll:     { padding: 16, gap: 6, paddingBottom: 80 },
  fieldLabel:      { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  fieldHint:       { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12, lineHeight: 17 },
  nameInput:       { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 12 },
  textArea:        { minHeight: 80, textAlignVertical: "top" },
  startToggleRow:  { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  startToggleLabel:{ fontSize: 14, fontFamily: "Inter_600SemiBold" },
  startToggleHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  startToggleBtn:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  startToggleBtnText:{ fontSize: 12, fontFamily: "Inter_700Bold" },
  modeChipWide:    { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  modeRow:         { flexDirection: "row", gap: 10, marginBottom: 16 },
  modeChip:        { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, gap: 4 },
  modeLabel:       { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modeHint:        { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
  panoUploadSlot:  { borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", height: MINI_PANO_H + 40, alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden", marginBottom: 16 },
  panoThumb:       { ...StyleSheet.absoluteFillObject, borderRadius: 12 },
  removePhotoBtn:  { position: "absolute", width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", top: 6, right: 6 },
  changePanoBtn:   { position: "absolute", bottom: 8, right: 8, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.5)" },
  changePanoBtnText:{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontFamily: "Inter_500Medium" },
  panoReadyBadge:  { position: "absolute", bottom: 8, left: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(22,163,74,0.85)" },
  panoReadyText:   { color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  dragHint:        { position: "absolute", top: 8, left: 8, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: "rgba(0,0,0,0.5)" },
  dragHintText:    { color: "rgba(255,255,255,0.75)", fontSize: 9, fontFamily: "Inter_400Regular" },
  photoGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  photoSlotWrapper:{ aspectRatio: 1.6, position: "relative" },
  photoSlot:       { flex: 1, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4, overflow: "hidden" },
  photoThumb:      { width: "100%", height: "100%", borderRadius: 10 },
  photoLabel:      { fontFamily: "Inter_500Medium" },
  photoLabelUnder: { textAlign: "center", fontFamily: "Inter_600SemiBold", marginTop: 3 },
  audioSection:    { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16, gap: 4 },
  audioSectionHeader:{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  audioSectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  audioSectionHint:  { fontSize: 11, fontFamily: "Inter_400Regular" },
  triggerRow:      { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  triggerChip:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  triggerChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pinSectionHeader:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 4 },
  addPinBtn:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  addPinText:      { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pinRow:          { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  pinDot:          { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  pinRowInfo:      { flex: 1 },
  pinRowTitle:     { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pinRowMeta:      { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  emptyPins:       { alignItems: "center", gap: 8, padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  emptyPinsText:   { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  pinDotOnPano:    { position: "absolute", width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", zIndex: 5 },
  confirmDot:      { position: "absolute", width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "#fff", backgroundColor: "rgba(59,130,246,0.3)", zIndex: 4 },
  pinPlaceTopBar:  { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingTop: 52, backgroundColor: "rgba(0,0,0,0.5)" },
  pinPlaceBack:    { flexDirection: "row", alignItems: "center", gap: 6 },
  pinPlaceBackText:{ color: "#fff", fontSize: 14, fontFamily: "Inter_500Medium" },
  pinPlaceTitle:   { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  pinPlaceConfirm: { backgroundColor: "#3B82F6", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  pinPlaceConfirmText:{ color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  typeGrid:        { flexDirection: "row", gap: 8, paddingRight: 16 },
  typeChip:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  typeChipText:    { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  navTargetRow:    { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 12, borderWidth: 1 },
  navTargetText:   { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  ndaToggle:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  ndaToggleText:   { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  placePinBtn:     { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  placePinBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  richToggle:      { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  richToggleText:  { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  richSection:     { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12, gap: 4 },
  sectionEditorRow:{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sectionInput:    { flex: 1, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, fontFamily: "Inter_400Regular" },
  addSectionBtn:    { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", alignSelf: "flex-start" },
  addSectionBtnText:{ fontSize: 12, fontFamily: "Inter_600SemiBold" },
  richDocHeader:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  richDocEmpty:     { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic", marginBottom: 8 },
  docLinkEditorRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  visRow:          { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  visLabel:        { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  visHint:         { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
