import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { AudioTrigger, DEFAULT_TOUR_SETTINGS, PinAnimation, PopupContent, PopupSection, TourPin, TourSettings, TourSpace } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import { getPendingListings, PendingListing } from "@/lib/adminStore";
import { getTourSettings, getTourSpaces, saveTourSettings, saveTourSpaces } from "@/lib/tourStore";

const { width: SCREEN_W } = Dimensions.get("window");
const MINI_PANO_H = 100;

const DIRS_4 = ["Front", "Right", "Back", "Left"] as const;
const DIRS_8 = ["Front", "Front-Right", "Right", "Back-Right", "Back", "Back-Left", "Left", "Front-Left"] as const;

// ─── Hotspot customisation constants ─────────────────────────────────────────

export const GROUND_PITCH_PRESETS = [
  { key: "shallow", label: "−35°", hint: "Floor near centre" },
  { key: "normal",  label: "−50°", hint: "Typical"           },
  { key: "deep",    label: "−65°", hint: "Floor low down"    },
  { key: "verylow", label: "−80°", hint: "Floor at edge"     },
] as const;

export const HEIGHT_PRESETS = [
  { key: "floor",   label: "Floor",     metres: 0.0  },
  { key: "table",   label: "Table",     metres: 0.75 },
  { key: "counter", label: "Counter",   metres: 0.9  },
  { key: "eye",     label: "Eye Level", metres: 1.6  },
  { key: "signage", label: "Signage",   metres: 2.0  },
  { key: "ceiling", label: "Ceiling",   metres: 2.8  },
] as const;

export const PIN_ANIMATIONS: { key: PinAnimation; label: string; hint: string }[] = [
  { key: "none",      label: "None",      hint: "Static pin"              },
  { key: "pulse",     label: "Pulse",     hint: "Rings expand outward"    },
  { key: "glow",      label: "Glow",      hint: "Soft brightness burst"   },
  { key: "bounce",    label: "Bounce",    hint: "Floats up and down"      },
  { key: "ripple",    label: "Ripple",    hint: "Sonar wave rings"        },
  { key: "breathing", label: "Breathing", hint: "Slow scale + fade"       },
];

export const SYSTEM_ICONS: { key: string; label: string; feather: string; emoji: string }[] = [
  { key: "audio",       label: "Audio",         feather: "mic",          emoji: "\u{1F399}" },
  { key: "info",        label: "Info",           feather: "info",         emoji: "\u2139"    },
  { key: "photos",      label: "Photos",         feather: "image",        emoji: "\u{1F4F7}" },
  { key: "video",       label: "Video",          feather: "video",        emoji: "\u{1F3AC}" },
  { key: "financials",  label: "Financials",     feather: "trending-up",  emoji: "\u{1F4C8}" },
  { key: "equipment",   label: "Equipment",      feather: "tool",         emoji: "\u{1F527}" },
  { key: "lease",       label: "Lease",          feather: "key",          emoji: "\u{1F511}" },
  { key: "staff",       label: "Staff",          feather: "users",        emoji: "\u{1F465}" },
  { key: "menu",        label: "Menu",           feather: "book-open",    emoji: "\u{1F4CB}" },
  { key: "outdoor",     label: "Outdoor Dining", feather: "sun",          emoji: "\u{1F33F}" },
  { key: "entry",       label: "Entry Access",   feather: "log-in",       emoji: "\u{1F6AA}" },
  { key: "kitchen",     label: "Kitchen",        feather: "coffee",       emoji: "\u{1F373}" },
  { key: "storage",     label: "Storage",        feather: "archive",      emoji: "\u{1F4E6}" },
  { key: "pos",         label: "POS",            feather: "credit-card",  emoji: "\u{1F4B3}" },
  { key: "roastery",    label: "Roastery",       feather: "droplet",      emoji: "\u2615"    },
  { key: "fitout",      label: "Fit-Out",        feather: "layout",       emoji: "\u{1F3D7}" },
  { key: "seating",     label: "Seating",        feather: "grid",         emoji: "\u{1FA91}" },
  { key: "utilities",   label: "Utilities",      feather: "zap",          emoji: "\u26A1"    },
  { key: "foottraffic", label: "Foot Traffic",   feather: "activity",     emoji: "\u{1F6B6}" },
  { key: "reviews",     label: "Reviews",        feather: "star",         emoji: "\u2B50"    },
];

function PulsingListenDot({ size, active }: { size: number; active: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
        Animated.delay(400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const ringScale   = anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 4.5] });
  const ringOpacity = anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.9, 0.25, 0] });
  const dotSize = Math.max(6, size * 0.38);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size * 0.55, height: size * 0.55,
          borderRadius: size * 0.275,
          backgroundColor: "transparent",
          borderWidth: 2,
          borderColor: "rgba(236,72,153,0.9)",
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }}
      />
      <View style={{
        width: dotSize, height: dotSize, borderRadius: dotSize / 2,
        backgroundColor: "#EC4899",
        alignItems: "center", justifyContent: "center",
        shadowColor: "#EC4899", shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9, shadowRadius: 4, elevation: 4,
      }}>
        <Feather name="mic" size={dotSize * 0.55} color="#fff" />
      </View>
    </View>
  );
}

function PulsingNavDot({ size, active }: { size: number; active: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
        Animated.delay(400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const ringScale   = anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 4.5] });
  const ringOpacity = anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.9, 0.25, 0] });
  const dotSize = Math.max(6, size * 0.32);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Ring: border-only (transparent fill), expands outward and fades */}
      <Animated.View
        style={{
          position: "absolute",
          width: size * 0.55, height: size * 0.55,
          borderRadius: size * 0.275,
          backgroundColor: "transparent",
          borderWidth: 2,
          borderColor: "rgba(59,130,246,0.9)",
          transform: [{ scale: ringScale }],
          opacity: ringOpacity,
        }}
      />
      {/* Core: small solid dot, no icon */}
      <View style={{
        width: dotSize, height: dotSize, borderRadius: dotSize / 2,
        backgroundColor: "#3B82F6",
        shadowColor: "#3B82F6", shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9, shadowRadius: 4, elevation: 4,
      }} />
    </View>
  );
}

const ALL_PIN_TYPES: { type: TourPin["type"]; label: string; icon: string; color: string; image?: any }[] = [
  // ── Primary pins ──
  { type: "navigation",   label: "Navigation",    icon: "arrow-right-circle", color: "#2563EB" },
  { type: "look",         label: "Look",          icon: "eye",                color: "#0EA5E9" },
  { type: "audio",        label: "Listen",        icon: "mic",                color: "#EC4899" },
  // ── Info pins ──
  { type: "equipment",    label: "Equipment",     icon: "tool",               color: "#F59E0B" },
  { type: "revenue",      label: "Revenue",       icon: "trending-up",        color: "#16A34A" },
  { type: "cogs",         label: "COGS",          icon: "package",            color: "#EF4444" },
  { type: "workflow",     label: "Workflow",       icon: "git-branch",         color: "#8B5CF6" },
  { type: "staffing",     label: "Staffing",       icon: "users",              color: "#3B82F6" },
  { type: "lease",        label: "Lease",          icon: "home",               color: "#F97316" },
  { type: "risk",         label: "Risk",           icon: "alert-triangle",     color: "#EF4444" },
  { type: "opportunity",  label: "Opportunity",    icon: "star",               color: "#16A34A" },
  { type: "inspection",   label: "Inspection",     icon: "clipboard",          color: "#06B6D4" },
  { type: "highlight",    label: "Highlight",      icon: "zap",                color: "#F59E0B" },
  { type: "document",     label: "Document",       icon: "file-text",          color: "#6366F1" },
  { type: "external_link",label: "External Link",  icon: "external-link",      color: "#0891B2" },
  // ── Legacy (not selectable — kept for backward compat display of saved pins) ──
  { type: "narration",    label: "Narration",      icon: "mic",                color: "#EC4899" },
];

const PRIMARY_PIN_TYPES = new Set(["navigation", "look", "audio"]);

const INFO_PIN_TYPES = new Set([
  "equipment","revenue","cogs","workflow","staffing","lease",
  "risk","opportunity","inspection","highlight","document",
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
  // Look pin — dedicated photo
  imageUrl?: string;
  // Document / External link
  documentUrl?: string;
  externalUrl?: string;
  // Ground-mounted pin (renders near floor in panorama)
  groundMounted?: boolean;
  // Height from ground in metres (overrides groundMounted when set)
  heightMetres?: number;
  // Per-pin appearance overrides
  pinAnimation?: PinAnimation;
  pinIconKey?: string;
  pinSize?: number;
  pinOpacity?: number;
  pinColor?: string;
  // Audio / Listen hotspot
  audioName?: string;
  audioUrl?: string;
  audioTrigger?: AudioTrigger;
  // Rich popup content (info pins)
  popupContent?: PopupContent;
}

interface DraftSpace {
  name: string;
  dirMode: 4 | 8 | "panorama" | "single";
  photos: Record<string, string>;
  panoramaUri?: string;
  groundPitch?: number;
  pins: DraftPin[];
  // Audio narration
  audioName?: string;
  audioUrl?: string;
  audioTrigger?: AudioTrigger;
  audioTranscript?: string;
  // Start scene
  isStartScene?: boolean;
}

const EMPTY_SPACE: DraftSpace = {
  name: "", dirMode: "panorama", photos: {}, pins: [],
  audioName: "", audioUrl: "", audioTrigger: "button", audioTranscript: "", isStartScene: false,
};
const EMPTY_PIN: DraftPin = {
  id: "", type: "navigation", title: "", description: "",
  requiresNDA: false, visibility: "public",
  heightMetres: 1.6,
};

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

// ─── Upload helpers ────────────────────────────────────────────────────────────

/** Compress + resize a local image URI before upload. Falls back to original on error. */
async function _compressImage(uri: string, maxWidth: number, quality: number): Promise<string> {
  if (uri.startsWith("http")) return uri;
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return uri;
  }
}

async function _uploadAudio(
  uri: string, key: string, userId: string, listingId: string, onStatus: (s: string) => void,
): Promise<string> {
  if (uri.startsWith("http")) return uri;
  const domain   = process.env.EXPO_PUBLIC_DOMAIN;
  const apiBase  = domain ? `https://${domain}/api` : "/api";
  onStatus("Uploading audio…");
  const base64   = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  const ctrl     = new AbortController();
  const timer    = setTimeout(() => ctrl.abort(), 120_000);
  try {
    const res = await fetch(`${apiBase}/biz360/audio`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, data: base64, userId, listingId }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      let serverMsg = `Server error ${res.status}`;
      try { const j = await res.json(); if (j.error) serverMsg = j.error; } catch {}
      throw new Error(serverMsg);
    }
    const json = await res.json() as { url: string };
    if (!json.url) throw new Error("No URL returned");
    return json.url;
  } catch (err) { clearTimeout(timer); throw err; }
}

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
  const [relocatePinId,      setRelocatePinId]      = useState<string | null>(null);
  const [relocatePos,        setRelocatePos]        = useState<{ x: number; y: number } | null>(null);
  const [relocateOriginal,   setRelocateOriginal]   = useState<{ x: number; y: number } | null>(null);
  const [saving,             setSaving]             = useState(false);
  const [saveStatus,         setSaveStatus]         = useState("");
  const [showRichPopup,         setShowRichPopup]         = useState(false);
  const [audioUploadingScene,   setAudioUploadingScene]   = useState(false);
  const [audioUploadingPin,     setAudioUploadingPin]     = useState(false);
  const [imageUploadingLook,    setImageUploadingLook]    = useState(false);
  const [deleteMode,            setDeleteMode]            = useState(false);
  const [pendingDeleteSpaceId,  setPendingDeleteSpaceId]  = useState<string | null>(null);
  const [pendingDeletePinId,    setPendingDeletePinId]    = useState<string | null>(null);

  // ── Tour settings state ────────────────────────────────────────────────────
  const [tourSettings,     setTourSettings]     = useState<TourSettings>(DEFAULT_TOUR_SETTINGS);
  const [showTourSettings, setShowTourSettings] = useState(false);
  const [settingsSaving,   setSettingsSaving]   = useState(false);

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
        // Brokers can manage tours for any approved listing; sellers see only their own
        const mine = user.role === "broker"
          ? all.filter((p) => p.status === "approved")
          : all.filter((p) => p.submittedBy === user.id);
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

  // ── Load spaces + tour settings when listing changes ──────────────────────

  useEffect(() => {
    currentListingIdRef.current = selectedId;
    if (!selectedId) { setAllSpaces([]); setSpacesLoaded(true); return; }
    setSpacesLoaded(false);
    getTourSpaces(selectedId).then((spaces) => { setAllSpaces(spaces); setSpacesLoaded(true); });
    getTourSettings(selectedId).then(setTourSettings);
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
        // Compress immediately so the pin-placement overlay loads fast and upload is smaller
        const compressed = await _compressImage(localUri, 4000, 0.85);
        setDraftSpace((prev) => ({ ...prev, panoramaUri: compressed }));
      } catch { Alert.alert("Could not load panorama", "Failed to copy photo. Try again."); }
    }
  };

  // ── Pin handlers ───────────────────────────────────────────────────────────

  const openAddPin = () => {
    const newPin = { ...EMPTY_PIN, id: `pin-${Date.now()}` };
    setDraftPin(newPin);
    setEditingPinId(null);
    setShowRichPopup(false);
    if ((draftSpace.dirMode === "panorama" || draftSpace.dirMode === "single") && draftSpace.panoramaUri) { setPinPlaceMode(true); }
    else { setShowPinModal(true); }
  };

  const openEditPin = (pin: DraftPin) => {
    setDraftPin(pin);
    setEditingPinId(pin.id);
    setActivePinId(pin.id);
    setShowRichPopup(!!(pin.popupContent?.sections?.length || pin.popupContent?.docLinks?.length || pin.popupContent?.images?.some(Boolean)));
    setShowPinModal(true);
  };

  const openRelocate = (pin: DraftPin) => {
    setRelocatePinId(pin.id);
    setRelocateOriginal(pin.x != null ? { x: pin.x, y: pin.y ?? 0.5 } : null);
    setRelocatePos(null);
  };

  const commitRelocate = () => {
    if (!relocatePinId || !relocatePos) return;
    setDraftSpace((prev) => ({
      ...prev,
      pins: prev.pins.map((p) =>
        p.id === relocatePinId ? { ...p, x: relocatePos.x, y: relocatePos.y } : p,
      ),
    }));
    setRelocatePinId(null);
    setRelocatePos(null);
  };

  const cancelRelocate = () => {
    setRelocatePinId(null);
    setRelocatePos(null);
  };

  const undoRelocate = () => {
    setRelocatePos(null);
  };

  const copyPin = (pin: DraftPin) => {
    const copied: DraftPin = { ...pin, id: `pin-${Date.now()}`, title: pin.title + " (Copy)" };
    setDraftSpace((prev) => ({ ...prev, pins: [...prev.pins, copied] }));
  };

  const savePin = () => {
    if (!draftPin.title.trim()) { Alert.alert("Title required", "Please enter a title for this pin."); return; }
    const needsDesc = draftPin.type !== "navigation" && draftPin.type !== "external_link" && draftPin.type !== "audio";
    if (needsDesc && !draftPin.description.trim()) { Alert.alert("Description required", "Please add a description so buyers understand this pin."); return; }
    if (draftPin.type === "navigation" && !draftPin.targetSpaceId) {
      Alert.alert("Destination required", "Choose which scene this navigation pin leads to."); return;
    }
    if (draftPin.type === "document" && !draftPin.documentUrl?.trim()) {
      Alert.alert("Document URL required", "Paste or upload a document URL for this pin."); return;
    }
    if (draftPin.type === "external_link" && !draftPin.externalUrl?.trim()) {
      Alert.alert("URL required", "Paste an external URL for this link pin."); return;
    }
    if (draftPin.type === "audio" && !draftPin.audioUrl?.trim()) {
      Alert.alert("Audio required", "Pick or paste an MP3 URL for this audio pin."); return;
    }
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

  // ── Audio picker + upload ──────────────────────────────────────────────────

  const pickAudio = async (target: "scene" | "pin") => {
    const setUploading = target === "scene" ? setAudioUploadingScene : setAudioUploadingPin;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const key = `audio_${target}_${Date.now()}`;
      const url = await _uploadAudio(asset.uri, key, user?.id ?? "anon", selectedId ?? "misc", () => {});
      if (target === "scene") setDraftSpace((p) => ({ ...p, audioUrl: url }));
      else                    setDraftPin((p)   => ({ ...p, audioUrl: url }));
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Could not upload audio. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // ── Look pin image picker + upload ────────────────────────────────────────

  const pickLookImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow photo library access to add a photo."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      setImageUploadingLook(true);
      const compressed = await _compressImage(result.assets[0].uri, 2000, 0.82);
      const key        = `look_img_${Date.now()}`;
      const url        = await _uploadPhoto(compressed, key, user?.id ?? "anon", selectedId ?? "misc", () => {});
      setDraftPin((p) => ({ ...p, imageUrl: url }));
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Could not upload image.");
    } finally {
      setImageUploadingLook(false);
    }
  };

  // ── Space handlers ─────────────────────────────────────────────────────────

  const openEditSpace = (space: TourSpace) => {
    const dirMode: 4 | 8 | "panorama" | "single" = space.dirMode ?? (space.panoramaUrl ? "panorama" : space.photos.length > 4 ? 8 : 4);
    const dirs = dirMode === 8 ? DIRS_8 : dirMode === 4 ? DIRS_4 : [];
    const photos: Record<string, string> = {};
    if (dirMode !== "panorama" && dirMode !== "single") { dirs.forEach((dir, i) => { if (space.photos[i]) photos[dir] = space.photos[i]; }); }
    const draftPins: DraftPin[] = space.pins.map((p) => ({
      id: p.id, type: p.type, title: p.title, description: p.description,
      requiresNDA: p.requiresNDA ?? false, visibility: "public" as Visibility,
      x: p.position.x, y: p.position.y,
      groundMounted:  p.groundMounted ?? false,
      heightMetres:   p.heightMetres,
      pinAnimation:   p.pinAnimation,
      pinIconKey:     p.pinIconKey,
      pinSize:        p.pinSize,
      pinOpacity:     p.pinOpacity,
      pinColor:       p.pinColor,
      targetSpaceId:  p.targetSpaceId,
      imageUrl:       p.imageUrl,
      documentUrl:    p.documentUrl,
      externalUrl:    p.externalUrl,
      audioUrl:       p.audioUrl,
      audioTrigger:   p.audioTrigger,
      popupContent:   p.popupContent,
    }));
    setDraftSpace({
      name: space.name, dirMode, photos, panoramaUri: space.panoramaUrl, pins: draftPins,
      groundPitch:    space.groundPitch,
      audioName:      space.audioName ?? "",
      audioUrl:       space.audioUrl ?? "",
      audioTrigger:   space.audioTrigger ?? "button",
      audioTranscript:space.audioTranscript ?? "",
      isStartScene:   space.isStartScene ?? false,
    });
    setEditingSpaceId(space.id);
    setShowSpaceModal(true);
  };

  const confirmDeleteSpace = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setAllSpaces((prev) => prev.filter((s) => s.id !== id));
    setPendingDeleteSpaceId(null);
  };

  const closeSpaceModal = () => {
    setShowSpaceModal(false); setDraftSpace(EMPTY_SPACE);
    setEditingSpaceId(null);  setPinPlaceMode(false);
    setActivePinId(null);     setConfirmedPlacement(null);
    setShowPinModal(false);   setEditingPinId(null);
    setShowRichPopup(false);
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
    if (draftSpace.dirMode === "panorama" || draftSpace.dirMode === "single") {
      if (!draftSpace.panoramaUri) { Alert.alert("Photo required", "Please choose a photo before saving."); return; }
    } else {
      if (Object.keys(draftSpace.photos).length === 0) { Alert.alert("Photos required", `Please add at least 1 directional photo before saving.`); return; }
    }

    setSaving(true);
    const isEditing  = editingSpaceId !== null;
    const spaceIdNow = isEditing ? editingSpaceId! : `space-${Date.now()}`;
    const listingKey = selectedId ?? spaceIdNow;
    const userId     = user?.id ?? "unknown";

    const extraFields = {
      groundPitch:     draftSpace.groundPitch,
      audioName:       draftSpace.audioName?.trim() || undefined,
      audioUrl:        draftSpace.audioUrl?.trim() || undefined,
      audioTrigger:    draftSpace.audioTrigger,
      audioTranscript: draftSpace.audioTranscript?.trim() || undefined,
      isStartScene:    draftSpace.isStartScene ?? false,
    };

    try {
      let savedSpace: TourSpace;
      if (draftSpace.dirMode === "panorama" || draftSpace.dirMode === "single") {
        setSaveStatus(draftSpace.dirMode === "single" ? "Uploading photo…" : "Uploading panorama…");
        const imgKey      = `pano_${Date.now()}`;
        const panoramaUrl = await _uploadPhoto(draftSpace.panoramaUri!, imgKey, userId, listingKey, setSaveStatus);
        savedSpace = {
          id: spaceIdNow, name: draftSpace.name.trim(), photos: [],
          pins: buildTourPins(draftSpace.pins), panoramaUrl, panoramaStartYaw: 0, dirMode: draftSpace.dirMode,
          ...extraFields,
        };
      } else {
        const dirs = draftSpace.dirMode === 8 ? DIRS_8 : DIRS_4;
        const photoArray: string[] = [];
        let photoIdx = 0;
        for (const dir of dirs) {
          const uri = draftSpace.photos[dir];
          if (!uri) continue;
          setSaveStatus(`Compressing photo ${photoIdx + 1}…`);
          const compressed  = await _compressImage(uri, 2000, 0.8);
          setSaveStatus(`Uploading photo ${++photoIdx}…`);
          const imgKey      = `${dir.replace(/\s/g, "_")}_${Date.now()}`;
          const uploadedUrl = await _uploadPhoto(compressed, imgKey, userId, listingKey, setSaveStatus);
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
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      Alert.alert("Save failed", `Could not upload photos.\n\n${detail}`);
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
      if (dp.imageUrl?.trim())        pin.imageUrl       = dp.imageUrl.trim();
      if (dp.documentUrl?.trim())     pin.documentUrl    = dp.documentUrl.trim();
      if (dp.externalUrl?.trim())     pin.externalUrl    = dp.externalUrl.trim();
      if (dp.groundMounted)           pin.groundMounted  = true;
      if (dp.heightMetres !== undefined) pin.heightMetres = dp.heightMetres;
      if (dp.pinAnimation)            pin.pinAnimation   = dp.pinAnimation;
      if (dp.pinIconKey)              pin.pinIconKey     = dp.pinIconKey;
      if (dp.pinSize !== undefined)   pin.pinSize        = dp.pinSize;
      if (dp.pinOpacity !== undefined) pin.pinOpacity    = dp.pinOpacity;
      if (dp.pinColor)                pin.pinColor       = dp.pinColor;
      if (dp.audioName?.trim())       pin.audioName      = dp.audioName.trim();
      if (dp.audioUrl?.trim())        pin.audioUrl       = dp.audioUrl.trim();
      if (dp.audioTrigger)            pin.audioTrigger   = dp.audioTrigger;
      const hasPopup = dp.popupContent && (
        dp.popupContent.sections?.length ||
        dp.popupContent.docLinks?.length ||
        dp.popupContent.images?.some(Boolean)
      );
      if (hasPopup) {
        pin.popupContent = {
          ...dp.popupContent,
          heading: dp.title,
          body:    dp.description,
          images:  (dp.popupContent!.images ?? []).filter(Boolean),
        };
      }
      return pin;
    });
  }

  const switchDirMode = (mode: 4 | 8 | "panorama" | "single") => {
    if ((draftSpace.dirMode as string) === String(mode)) return;
    setDraftSpace((prev) => ({ ...prev, dirMode: mode, photos: {}, panoramaUri: undefined }));
  };

  const selectedPinMeta = ALL_PIN_TYPES.find((p) => p.type === draftPin.type) ?? ALL_PIN_TYPES[0];

  // Other spaces available for navigation targets (excluding the current space being edited)
  const navTargetOptions = allSpaces.filter((s) => s.id !== editingSpaceId);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>360 Tours</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {selectedListing && (
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setShowTourSettings(true)}
            >
              <Feather name="settings" size={17} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          {selectedListing && (
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowSpaceModal(true)}>
              <Feather name="plus" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
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

                <View style={styles.spacesTitleRow}>
                  <Text style={[styles.spacesTitle, { color: colors.foreground }]}>Tour Spaces</Text>
                  <TouchableOpacity
                    style={[styles.deleteModeToggle, { backgroundColor: deleteMode ? "#EF444418" : colors.muted, borderColor: deleteMode ? "#EF4444" : colors.border }]}
                    onPress={() => { setDeleteMode((v) => !v); setPendingDeleteSpaceId(null); setPendingDeletePinId(null); }}
                  >
                    <Feather name={deleteMode ? "unlock" : "lock"} size={11} color={deleteMode ? "#EF4444" : colors.mutedForeground} />
                    <Text style={[styles.deleteModeText, { color: deleteMode ? "#EF4444" : colors.mutedForeground }]}>
                      {deleteMode ? "Delete on" : "Delete off"}
                    </Text>
                  </TouchableOpacity>
                </View>

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
                      {deleteMode && (
                        pendingDeleteSpaceId === space.id ? (
                          <TouchableOpacity style={styles.confirmDeleteBtn} onPress={() => confirmDeleteSpace(space.id)}>
                            <Text style={styles.confirmDeleteText}>Confirm?</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPendingDeleteSpaceId(space.id); setPendingDeletePinId(null); }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Feather name="trash-2" size={17} color="#EF4444" />
                          </TouchableOpacity>
                        )
                      )}
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

            {/* Row 1: 360° and Single */}
            <View style={styles.modeRow}>
              {([
                { mode: "panorama" as const, emoji: "🔮" as string | undefined, icon: undefined as string | undefined, label: "360° Photo",  hint: "Insta360 / Panoramic" },
                { mode: "single"   as const, emoji: undefined as string | undefined, icon: "image",                    label: "Single",       hint: "Traditional photo"    },
              ]).map(({ mode, emoji, icon, label, hint }) => {
                const active = draftSpace.dirMode === mode;
                const bg     = active ? "#7C3AED" : colors.card;
                const bc     = active ? "#7C3AED" : colors.border;
                return (
                  <TouchableOpacity key={mode} style={[styles.modeChip, { backgroundColor: bg, borderColor: bc }]} onPress={() => switchDirMode(mode)}>
                    {emoji ? <Text style={{ fontSize: 16 }}>{emoji}</Text> : <Feather name={icon as any} size={14} color={active ? "#fff" : colors.mutedForeground} />}
                    <Text style={[styles.modeLabel, { color: active ? "#fff" : colors.foreground }]}>{label}</Text>
                    <Text style={[styles.modeHint, { color: active ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>{hint}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Row 2: 4-Direction and 8-Direction */}
            <View style={styles.modeRow}>
              {([4, 8] as const).map((mode) => {
                const active = draftSpace.dirMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.modeChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
                    onPress={() => switchDirMode(mode)}
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

            {(draftSpace.dirMode === "panorama" || draftSpace.dirMode === "single") ? (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{draftSpace.dirMode === "single" ? "PHOTO" : "PANORAMA PHOTO"}</Text>
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
                        const meta        = ALL_PIN_TYPES.find((m) => m.type === pin.type) ?? ALL_PIN_TYPES[0];
                        const isActivePin = activePinId === pin.id;
                        const dotSize     = isActivePin ? 22 : 18;
                        const isNav       = pin.type === "navigation";
                        const isListen    = pin.type === "audio";
                        return (
                          <View
                            key={pin.id}
                            style={[styles.pinDotOnPano, {
                              left: pin.x! * panoLayout.width  - dotSize / 2,
                              top:  (pin.y ?? 0.5) * panoLayout.height - dotSize / 2,
                              width: dotSize, height: dotSize,
                              backgroundColor: "transparent",
                            }]}
                          >
                            {isNav ? (
                              <PulsingNavDot size={dotSize} active={isActivePin} />
                            ) : isListen ? (
                              <PulsingListenDot size={dotSize} active={isActivePin} />
                            ) : (
                              <View style={{
                                width: dotSize, height: dotSize, borderRadius: dotSize / 2,
                                backgroundColor: meta.color,
                                alignItems: "center", justifyContent: "center",
                              }}>
                                {meta.image
                                  ? <Image source={meta.image} style={{ width: dotSize * 0.5, height: dotSize * 0.5 }} tintColor="#fff" />
                                  : <Feather name={meta.icon as any} size={dotSize * 0.45} color="#fff" />
                                }
                              </View>
                            )}
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

                {/* ── Ground pitch calibration ── */}
                {draftSpace.panoramaUri && (
                  <>
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 12 }]}>FLOOR LEVEL IN PANORAMA</Text>
                    <Text style={[styles.modeHint, { color: colors.mutedForeground, marginBottom: 8, fontSize: 11 }]}>
                      Set how low the floor appears in your panorama shot so ground-level pins land correctly
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }} contentContainerStyle={{ gap: 7, paddingRight: 12 }}>
                      {GROUND_PITCH_PRESETS.map((gp) => {
                        const gpVal = -parseInt(gp.label.replace("−", ""), 10);
                        const active = (draftSpace.groundPitch ?? -50) === gpVal;
                        return (
                          <TouchableOpacity
                            key={gp.key}
                            style={[styles.heightChip, { backgroundColor: active ? "#7C3AED" : colors.card, borderColor: active ? "#7C3AED" : colors.border }]}
                            onPress={() => setDraftSpace((p) => ({ ...p, groundPitch: gpVal }))}
                          >
                            <Text style={[styles.heightChipTop, { color: active ? "#fff" : colors.foreground }]}>{gp.label}</Text>
                            <Text style={[styles.heightChipBot, { color: active ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}>{gp.hint}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </>
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
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CLIP NAME</Text>
              <TextInput
                style={[styles.nameInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder='e.g. "Main dining narration"'
                placeholderTextColor={colors.mutedForeground}
                value={draftSpace.audioName ?? ""}
                onChangeText={(t) => setDraftSpace((p) => ({ ...p, audioName: t }))}
              />
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>MP3 FILE</Text>
              <View style={styles.audioPickerRow}>
                <TextInput
                  style={[styles.nameInput, { flex: 1, marginBottom: 0, backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="Paste URL or pick MP3 →"
                  placeholderTextColor={colors.mutedForeground}
                  value={draftSpace.audioUrl ?? ""}
                  onChangeText={(t) => setDraftSpace((p) => ({ ...p, audioUrl: t }))}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <TouchableOpacity
                  style={[styles.audioPickBtn, { backgroundColor: "#EC4899", opacity: audioUploadingScene ? 0.7 : 1 }]}
                  onPress={() => pickAudio("scene")}
                  disabled={audioUploadingScene}
                >
                  {audioUploadingScene
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><Feather name="upload" size={13} color="#fff" /><Text style={styles.audioPickBtnText}>Pick MP3</Text></>
                  }
                </TouchableOpacity>
              </View>
              {draftSpace.audioUrl?.trim() && (
                <TouchableOpacity style={styles.audioRemoveBtn} onPress={() => setDraftSpace((p) => ({ ...p, audioUrl: "", audioTranscript: "" }))}>
                  <Feather name="x" size={11} color="#EF4444" />
                  <Text style={[styles.audioRemoveBtnText, { color: "#EF4444" }]}>Remove audio</Text>
                </TouchableOpacity>
              )}
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
                  {(draftSpace.audioTrigger ?? "button") === "hotspot" && (
                    <Text style={[styles.fieldHint, { color: colors.mutedForeground, marginBottom: 10 }]}>
                      A pink narration pin will appear on the scene. Buyers tap it to start playback.
                    </Text>
                  )}
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
                    {meta.image
                      ? <Image source={meta.image} style={{ width: 12, height: 12 }} tintColor="#fff" />
                      : <Feather name={meta.icon as any} size={12} color="#fff" />
                    }
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
                    {draftSpace.panoramaUri && (
                      <TouchableOpacity onPress={() => openRelocate(pin)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Feather name="map-pin" size={14} color="#16A34A" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => copyPin(pin)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="copy" size={14} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    {deleteMode && (
                      pendingDeletePinId === pin.id ? (
                        <TouchableOpacity style={styles.confirmDeleteBtn} onPress={() => { removePin(pin.id); setPendingDeletePinId(null); }}>
                          <Text style={styles.confirmDeleteText}>Confirm?</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPendingDeletePinId(pin.id); setPendingDeleteSpaceId(null); }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather name="trash-2" size={15} color="#EF4444" />
                        </TouchableOpacity>
                      )
                    )}
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
                    {meta.image
                      ? <Image source={meta.image} style={{ width: 8, height: 8 }} tintColor="#fff" />
                      : <Feather name={meta.icon as any} size={8} color="#fff" />
                    }
                  </View>
                );
              })}
              {draftPin.x != null && (
                <View style={[styles.pinDotOnPano, {
                  left: draftPin.x * panoLayout.width - 11,
                  top: (draftPin.y ?? 0.5) * panoLayout.height - 11,
                  width: 22, height: 22,
                  backgroundColor: "transparent",
                }]}>
                  {draftPin.type === "navigation"
                    ? <PulsingNavDot size={22} active />
                    : draftPin.type === "audio"
                    ? <PulsingListenDot size={22} active />
                    : (
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: selectedPinMeta.color, alignItems: "center", justifyContent: "center" }}>
                        <Feather name={selectedPinMeta.icon as any} size={10} color="#fff" />
                      </View>
                    )
                  }
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

          {/* ── Relocate pin full-screen overlay ── */}
          {relocatePinId != null && draftSpace.panoramaUri && (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: "#000", zIndex: 250 }]}
              onLayout={(e) => setPanoLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
            >
              <Image source={{ uri: draftSpace.panoramaUri }} style={StyleSheet.absoluteFill} resizeMode="stretch" />

              {/* All other pins as dim dots */}
              {draftSpace.pins.filter((p) => p.x != null && p.id !== relocatePinId).map((p) => {
                const m = ALL_PIN_TYPES.find((m) => m.type === p.type) ?? ALL_PIN_TYPES[0];
                return (
                  <View key={p.id} style={[styles.pinDotOnPano, { left: p.x! * panoLayout.width - 8, top: (p.y ?? 0.5) * panoLayout.height - 8, backgroundColor: m.color, opacity: 0.4 }]}>
                    <Feather name={m.icon as any} size={8} color="#fff" />
                  </View>
                );
              })}

              {/* Original position — ghost ring */}
              {relocateOriginal && (
                <View style={[styles.relocateGhost, { left: relocateOriginal.x * panoLayout.width - 14, top: relocateOriginal.y * panoLayout.height - 14 }]} />
              )}

              {/* New position dot — shown immediately on tap */}
              {relocatePos && (
                <View style={[styles.pinDotOnPano, { left: relocatePos.x * panoLayout.width - 11, top: relocatePos.y * panoLayout.height - 11, width: 22, height: 22, borderRadius: 11 }]}>
                  {(() => {
                    const pin = draftSpace.pins.find((p) => p.id === relocatePinId);
                    const m   = ALL_PIN_TYPES.find((m) => m.type === pin?.type) ?? ALL_PIN_TYPES[0];
                    return (
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: m.color, alignItems: "center", justifyContent: "center" }}>
                        <Feather name={m.icon as any} size={10} color="#fff" />
                      </View>
                    );
                  })()}
                </View>
              )}

              {/* Tap catcher */}
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={(e) => {
                  const { locationX, locationY } = e.nativeEvent;
                  const nx = Math.max(0.01, Math.min(0.99, locationX / panoLayout.width));
                  const ny = Math.max(0.01, Math.min(0.99, locationY / panoLayout.height));
                  setRelocatePos({ x: nx, y: ny });
                }}
              />

              {/* Top bar */}
              <View style={styles.pinPlaceTopBar}>
                <View style={{ width: 60 }} />
                <Text style={styles.pinPlaceTitle}>
                  {relocatePos ? "Location set — tap Save" : "Tap to place"}
                </Text>
                <View style={{ width: 60 }} />
              </View>

              {/* Bottom action bar */}
              <View style={styles.relocateBottomBar}>
                <TouchableOpacity style={styles.relocateCancelBtn} onPress={cancelRelocate}>
                  <Text style={styles.relocateCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.relocateUndoBtn, !relocatePos && { opacity: 0.35 }]}
                  onPress={undoRelocate}
                  disabled={!relocatePos}
                >
                  <Feather name="rotate-ccw" size={14} color="#fff" />
                  <Text style={styles.relocateUndoText}>Undo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.relocateSaveBtn, !relocatePos && { opacity: 0.35 }]}
                  onPress={commitRelocate}
                  disabled={!relocatePos}
                >
                  <Text style={styles.relocateSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Pin config (inline overlay — avoids iOS double-modal freeze) ── */}
          {showPinModal && (
            <View style={[StyleSheet.absoluteFill, { zIndex: 300, backgroundColor: colors.background }]}>
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
            {/* Pin type picker — Primary row */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PRIMARY</Text>
            <View style={[styles.typeGrid, { marginBottom: 12, paddingRight: 0 }]}>
              {ALL_PIN_TYPES.filter((t) => PRIMARY_PIN_TYPES.has(t.type)).map((t) => {
                const active = draftPin.type === t.type;
                return (
                  <TouchableOpacity
                    key={t.type}
                    style={[styles.typeChipLg, { backgroundColor: active ? t.color + "25" : colors.card, borderColor: active ? t.color : colors.border }]}
                    onPress={() => setDraftPin((p) => ({ ...p, type: t.type }))}
                  >
                    {t.image
                      ? <Image source={t.image} style={{ width: 18, height: 18 }} tintColor={active ? t.color : colors.mutedForeground} />
                      : <Feather name={t.icon as any} size={18} color={active ? t.color : colors.mutedForeground} />
                    }
                    <Text style={[styles.typeChipText, { color: active ? t.color : colors.mutedForeground, fontSize: 13 }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Info pins */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>INFORMATION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.typeGrid}>
                {ALL_PIN_TYPES.filter((t) => !PRIMARY_PIN_TYPES.has(t.type) && t.type !== "narration").map((t) => {
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

            {/* Look pin: photo + description */}
            {draftPin.type === "look" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PHOTO</Text>
                <View style={styles.audioPickerRow}>
                  <TextInput
                    style={[styles.nameInput, { flex: 1, marginBottom: 0, backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                    placeholder="Paste image URL or upload →"
                    placeholderTextColor={colors.mutedForeground}
                    value={draftPin.imageUrl ?? ""}
                    onChangeText={(t) => setDraftPin((p) => ({ ...p, imageUrl: t }))}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                  <TouchableOpacity
                    style={[styles.audioPickBtn, { backgroundColor: "#0EA5E9", opacity: imageUploadingLook ? 0.7 : 1 }]}
                    onPress={pickLookImage}
                    disabled={imageUploadingLook}
                  >
                    {imageUploadingLook
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <><Feather name="upload" size={13} color="#fff" /><Text style={styles.audioPickBtnText}>Upload</Text></>
                    }
                  </TouchableOpacity>
                </View>
                {draftPin.imageUrl?.trim() ? (
                  <View style={{ marginTop: 8, marginBottom: 4, borderRadius: 10, overflow: "hidden" }}>
                    <Image source={{ uri: draftPin.imageUrl }} style={{ width: "100%", height: 140 }} resizeMode="cover" />
                    <TouchableOpacity
                      style={[styles.audioRemoveBtn, { marginTop: 4 }]}
                      onPress={() => setDraftPin((p) => ({ ...p, imageUrl: "" }))}
                    >
                      <Feather name="x" size={11} color="#EF4444" />
                      <Text style={[styles.audioRemoveBtnText, { color: "#EF4444" }]}>Remove photo</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESCRIPTION</Text>
                <TextInput
                  style={[styles.nameInput, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="What should buyers look at? Describe what makes this notable…"
                  placeholderTextColor={colors.mutedForeground}
                  value={draftPin.description}
                  onChangeText={(t) => setDraftPin((p) => ({ ...p, description: t }))}
                  multiline numberOfLines={3}
                />
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
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CLIP NAME</Text>
                <TextInput
                  style={[styles.nameInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder='e.g. "Outdoor dining narration"'
                  placeholderTextColor={colors.mutedForeground}
                  value={draftPin.audioName ?? ""}
                  onChangeText={(t) => setDraftPin((p) => ({ ...p, audioName: t }))}
                />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>MP3 FILE</Text>
                <View style={styles.audioPickerRow}>
                  <TextInput
                    style={[styles.nameInput, { flex: 1, marginBottom: 0, backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                    placeholder="Paste URL or pick MP3 →"
                    placeholderTextColor={colors.mutedForeground}
                    value={draftPin.audioUrl ?? ""}
                    onChangeText={(t) => setDraftPin((p) => ({ ...p, audioUrl: t }))}
                    autoCapitalize="none" keyboardType="url"
                  />
                  <TouchableOpacity
                    style={[styles.audioPickBtn, { backgroundColor: "#EC4899", opacity: audioUploadingPin ? 0.7 : 1 }]}
                    onPress={() => pickAudio("pin")}
                    disabled={audioUploadingPin}
                  >
                    {audioUploadingPin
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <><Feather name="upload" size={13} color="#fff" /><Text style={styles.audioPickBtnText}>Pick MP3</Text></>
                    }
                  </TouchableOpacity>
                </View>
                {draftPin.audioUrl?.trim() && (
                  <TouchableOpacity style={styles.audioRemoveBtn} onPress={() => setDraftPin((p) => ({ ...p, audioUrl: "" }))}>
                    <Feather name="x" size={11} color="#EF4444" />
                    <Text style={[styles.audioRemoveBtnText, { color: "#EF4444" }]}>Remove audio</Text>
                  </TouchableOpacity>
                )}
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
                      {draftPin.x != null ? `Reposition pin (${Math.round(draftPin.x * 100)}%, ${Math.round((draftPin.y ?? 0.5) * 100)}%)` : (draftSpace.dirMode as string) === "single" ? "Place on Photo" : "Place on Panorama"}
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

            {/* ── HEIGHT FROM GROUND ─────────────────────────────────── */}
            {draftPin.type !== "navigation" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 4 }]}>HEIGHT FROM GROUND</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 7, paddingRight: 12 }}>
                  {HEIGHT_PRESETS.map((h) => {
                    const active = draftPin.heightMetres === h.metres;
                    return (
                      <TouchableOpacity
                        key={h.key}
                        style={[styles.heightChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
                        onPress={() => setDraftPin((p) => ({ ...p, heightMetres: h.metres }))}
                      >
                        <Text style={[styles.heightChipTop, { color: active ? "#fff" : colors.foreground }]}>{h.label}</Text>
                        <Text style={[styles.heightChipBot, { color: active ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}>{h.metres}m</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={[styles.heightInputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="move" size={14} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.heightInput, { color: colors.foreground }]}
                    keyboardType="decimal-pad"
                    value={draftPin.heightMetres != null ? String(draftPin.heightMetres) : ""}
                    onChangeText={(t) => {
                      const n = parseFloat(t);
                      if (!isNaN(n)) setDraftPin((p) => ({ ...p, heightMetres: Math.max(0, Math.min(4, n)) }));
                      else if (t === "" || t === ".") setDraftPin((p) => ({ ...p, heightMetres: undefined }));
                    }}
                    placeholder="Custom metres (0 – 4)"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <Text style={[styles.heightUnit, { color: colors.mutedForeground }]}>m</Text>
                </View>
              </>
            )}

            {/* ── ICON STYLE ─────────────────────────────────────────── */}
            {draftPin.type !== "navigation" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 4 }]}>PIN ICON</Text>
                <View style={styles.iconGrid}>
                  {SYSTEM_ICONS.map((ic) => {
                    const active = draftPin.pinIconKey === ic.key;
                    return (
                      <TouchableOpacity
                        key={ic.key}
                        style={[styles.iconCell, { backgroundColor: active ? colors.primary + "20" : colors.card, borderColor: active ? colors.primary : colors.border }]}
                        onPress={() => setDraftPin((p) => ({ ...p, pinIconKey: active ? undefined : ic.key }))}
                      >
                        <Feather name={ic.feather as any} size={15} color={active ? colors.primary : colors.mutedForeground} />
                        <Text style={[styles.iconCellText, { color: active ? colors.primary : colors.mutedForeground }]} numberOfLines={1}>{ic.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {draftPin.pinIconKey && (
                  <TouchableOpacity onPress={() => setDraftPin((p) => ({ ...p, pinIconKey: undefined }))} style={{ marginBottom: 6, alignSelf: "flex-start" }}>
                    <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_400Regular" }}>↩ Reset to type default</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* ── ANIMATION ──────────────────────────────────────────── */}
            {draftPin.type !== "navigation" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 4 }]}>ANIMATION</Text>
                <View style={styles.animGrid}>
                  {PIN_ANIMATIONS.map((a) => {
                    const active = draftPin.pinAnimation === a.key || (!draftPin.pinAnimation && a.key === (draftPin.type === "audio" ? "pulse" : "none"));
                    return (
                      <TouchableOpacity
                        key={a.key}
                        style={[styles.animChip, { backgroundColor: active ? colors.primary + "18" : colors.card, borderColor: active ? colors.primary : colors.border }]}
                        onPress={() => setDraftPin((p) => ({ ...p, pinAnimation: a.key }))}
                      >
                        <Text style={[styles.animChipLabel, { color: active ? colors.primary : colors.foreground }]}>{a.label}</Text>
                        <Text style={[styles.animChipHint, { color: colors.mutedForeground }]}>{a.hint}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Ground-mounted toggle — kept for backward compat; hidden when heightMetres is set */}
            {draftPin.type !== "navigation" && draftPin.heightMetres === undefined && (
              <TouchableOpacity
                style={[styles.ndaToggle, { backgroundColor: draftPin.groundMounted ? "#16A34A18" : colors.card, borderColor: draftPin.groundMounted ? "#16A34A" : colors.border }]}
                onPress={() => setDraftPin((p) => ({ ...p, groundMounted: !p.groundMounted }))}
              >
                <Feather name="map-pin" size={14} color={draftPin.groundMounted ? "#16A34A" : colors.mutedForeground} />
                <Text style={[styles.ndaToggleText, { color: draftPin.groundMounted ? "#16A34A" : colors.foreground }]}>
                  Ground mounted (pin sits at floor level)
                </Text>
                <Feather name={draftPin.groundMounted ? "check-square" : "square"} size={16} color={draftPin.groundMounted ? "#16A34A" : colors.mutedForeground} />
              </TouchableOpacity>
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
          )}
        </View>
      </Modal>

      {/* ── Tour Settings Modal ────────────────────────────────────────────── */}
      <Modal visible={showTourSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTourSettings(false)}>
        <View style={[styles.modalOuter, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowTourSettings(false)} style={styles.modalBack}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Tour Settings</Text>
            <TouchableOpacity
              style={[styles.settingsSaveBtn, { backgroundColor: colors.primary, opacity: settingsSaving ? 0.6 : 1 }]}
              disabled={settingsSaving}
              onPress={async () => {
                if (!selectedId) return;
                setSettingsSaving(true);
                try { await saveTourSettings(selectedId, tourSettings); } catch {}
                setSettingsSaving(false);
                setShowTourSettings(false);
              }}
            >
              <Text style={styles.settingsSaveBtnText}>{settingsSaving ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">

            {/* Narration Bar */}
            <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Feather name="music" size={16} color={colors.primary} />
                <Text style={[styles.settingsCardTitle, { color: colors.foreground }]}>Narration Bar</Text>
              </View>
              <Text style={[styles.settingsCardHint, { color: colors.mutedForeground }]}>
                Show the audio narration bar when a buyer enters the tour
              </Text>
              <TouchableOpacity
                style={[styles.settingsToggle, { backgroundColor: tourSettings.showNarrationBar ? colors.primary + "18" : colors.background, borderColor: tourSettings.showNarrationBar ? colors.primary : colors.border }]}
                onPress={() => setTourSettings((s) => ({ ...s, showNarrationBar: !s.showNarrationBar }))}
              >
                <Text style={[styles.settingsToggleText, { color: tourSettings.showNarrationBar ? colors.primary : colors.mutedForeground }]}>
                  {tourSettings.showNarrationBar ? "Visible" : "Hidden"}
                </Text>
                <Feather name={tourSettings.showNarrationBar ? "toggle-right" : "toggle-left"} size={22} color={tourSettings.showNarrationBar ? colors.primary : colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Default Height */}
            <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Feather name="move" size={16} color={colors.primary} />
                <Text style={[styles.settingsCardTitle, { color: colors.foreground }]}>Default Pin Height</Text>
              </View>
              <Text style={[styles.settingsCardHint, { color: colors.mutedForeground }]}>
                Applied when a new pin is added without a specific height
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingTop: 10 }}>
                {HEIGHT_PRESETS.map((h) => {
                  const active = tourSettings.defaultHeightMetres === h.metres;
                  return (
                    <TouchableOpacity
                      key={h.key}
                      style={[styles.heightChip, { backgroundColor: active ? colors.primary : colors.background, borderColor: active ? colors.primary : colors.border }]}
                      onPress={() => setTourSettings((s) => ({ ...s, defaultHeightMetres: h.metres }))}
                    >
                      <Text style={[styles.heightChipTop, { color: active ? "#fff" : colors.foreground }]}>{h.label}</Text>
                      <Text style={[styles.heightChipBot, { color: active ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}>{h.metres}m</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Default Animation */}
            <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Feather name="zap" size={16} color={colors.primary} />
                <Text style={[styles.settingsCardTitle, { color: colors.foreground }]}>Default Animation</Text>
              </View>
              <Text style={[styles.settingsCardHint, { color: colors.mutedForeground }]}>
                Animation applied to new info pins (audio + navigation have their own defaults)
              </Text>
              <View style={[styles.animGrid, { marginTop: 10 }]}>
                {PIN_ANIMATIONS.map((a) => {
                  const active = tourSettings.defaultAnimation === a.key;
                  return (
                    <TouchableOpacity
                      key={a.key}
                      style={[styles.animChip, { backgroundColor: active ? colors.primary + "18" : colors.background, borderColor: active ? colors.primary : colors.border }]}
                      onPress={() => setTourSettings((s) => ({ ...s, defaultAnimation: a.key }))}
                    >
                      <Text style={[styles.animChipLabel, { color: active ? colors.primary : colors.foreground }]}>{a.label}</Text>
                      <Text style={[styles.animChipHint, { color: colors.mutedForeground }]}>{a.hint}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Pin Opacity */}
            <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Feather name="eye" size={16} color={colors.primary} />
                <Text style={[styles.settingsCardTitle, { color: colors.foreground }]}>Default Pin Opacity</Text>
              </View>
              <Text style={[styles.settingsCardHint, { color: colors.mutedForeground }]}>
                1.0 = fully visible · 0.3 = very subtle
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {[0.3, 0.5, 0.7, 0.85, 1.0].map((v) => {
                  const active = tourSettings.defaultPinOpacity === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      style={[styles.opacityChip, { backgroundColor: active ? colors.primary : colors.background, borderColor: active ? colors.primary : colors.border }]}
                      onPress={() => setTourSettings((s) => ({ ...s, defaultPinOpacity: v }))}
                    >
                      <Text style={{ color: active ? "#fff" : colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{Math.round(v * 100)}%</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Pin Size */}
            <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Feather name="maximize-2" size={16} color={colors.primary} />
                <Text style={[styles.settingsCardTitle, { color: colors.foreground }]}>Default Pin Size</Text>
              </View>
              <Text style={[styles.settingsCardHint, { color: colors.mutedForeground }]}>
                Scale of pins rendered in the panorama (1.0 = standard 36 px)
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {[{ label: "XS", v: 0.6 }, { label: "S", v: 0.8 }, { label: "M", v: 1.0 }, { label: "L", v: 1.3 }, { label: "XL", v: 1.6 }].map(({ label, v }) => {
                  const active = tourSettings.defaultPinSize === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      style={[styles.opacityChip, { backgroundColor: active ? colors.primary : colors.background, borderColor: active ? colors.primary : colors.border }]}
                      onPress={() => setTourSettings((s) => ({ ...s, defaultPinSize: v }))}
                    >
                      <Text style={{ color: active ? "#fff" : colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Hotspot Behaviour */}
            <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Feather name="mouse-pointer" size={16} color={colors.primary} />
                <Text style={[styles.settingsCardTitle, { color: colors.foreground }]}>Hotspot Behaviour</Text>
              </View>
              <Text style={[styles.settingsCardHint, { color: colors.mutedForeground }]}>
                How buyers interact with pins
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                {([{ val: "tap", label: "Tap to open", icon: "mouse-pointer" }, { val: "always", label: "Always open", icon: "layers" }] as const).map(({ val, label, icon }) => {
                  const active = tourSettings.defaultHotspotBehaviour === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[styles.behaviourChip, { flex: 1, backgroundColor: active ? colors.primary + "18" : colors.background, borderColor: active ? colors.primary : colors.border }]}
                      onPress={() => setTourSettings((s) => ({ ...s, defaultHotspotBehaviour: val }))}
                    >
                      <Feather name={icon as any} size={14} color={active ? colors.primary : colors.mutedForeground} />
                      <Text style={{ color: active ? colors.primary : colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

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
  spacesTitleRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  spacesTitle:     { fontSize: 13, fontFamily: "Inter_700Bold" },
  deleteModeToggle:{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  deleteModeText:  { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  confirmDeleteBtn:{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: "#EF4444" },
  confirmDeleteText:{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
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
  audioSection:       { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16, gap: 4 },
  audioSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  audioSectionTitle:  { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  audioSectionHint:   { fontSize: 11, fontFamily: "Inter_400Regular" },
  audioPickerRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  audioPickBtn:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12 },
  audioPickBtnText:   { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  audioRemoveBtn:     { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 10 },
  audioRemoveBtnText: { fontSize: 12, fontFamily: "Inter_400Regular" },
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
  relocateGhost:      { position: "absolute", width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.45)", zIndex: 5 },
  relocatePending:    { position: "absolute", width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(22,163,74,0.55)", borderWidth: 2, borderColor: "#16A34A", alignItems: "center", justifyContent: "center", zIndex: 6 },
  relocateBottomBar:  { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 44, backgroundColor: "rgba(0,0,0,0.65)", gap: 12 },
  relocateCancelBtn:  { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  relocateCancelText: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  relocateUndoBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  relocateUndoText:   { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  relocateSaveBtn:    { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 14, backgroundColor: "#16A34A" },
  relocateSaveText:   { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  typeGrid:        { flexDirection: "row", gap: 8, paddingRight: 16 },
  typeChip:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  typeChipLg:      { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, justifyContent: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
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

  // ── Header gear icon ────────────────────────────────────────────────────────
  headerIconBtn:   { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  // ── Tour settings modal ─────────────────────────────────────────────────────
  modalOuter:         { flex: 1 },
  modalBack:          { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  settingsSaveBtn:    { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  settingsSaveBtnText:{ color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  settingsCard:       { borderRadius: 16, borderWidth: 1, padding: 16 },
  settingsCardTitle:  { fontSize: 15, fontFamily: "Inter_700Bold" },
  settingsCardHint:   { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginBottom: 2 },
  settingsToggle:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 10 },
  settingsToggleText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // ── Per-pin height presets ──────────────────────────────────────────────────
  heightChip:      { alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, minWidth: 70 },
  heightChipTop:   { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  heightChipBot:   { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  heightInputRow:  { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  heightInput:     { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 0 },
  heightUnit:      { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // ── Per-pin icon picker ─────────────────────────────────────────────────────
  iconGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  iconCell:        { width: "22.5%", alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, gap: 4 },
  iconCellText:    { fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center" },

  // ── Per-pin animation picker ────────────────────────────────────────────────
  animGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 },
  animChip:        { width: "48%", padding: 10, borderRadius: 10, borderWidth: 1 },
  animChipLabel:   { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  animChipHint:    { fontSize: 10, fontFamily: "Inter_400Regular" },

  // ── Opacity / size / behaviour chips ───────────────────────────────────────
  opacityChip:     { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  behaviourChip:   { flexDirection: "row", alignItems: "center", gap: 7, padding: 12, borderRadius: 12, borderWidth: 1, justifyContent: "center" },
});
