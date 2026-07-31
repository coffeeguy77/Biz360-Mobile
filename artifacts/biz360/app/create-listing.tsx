import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
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
import { VerificationBadge } from "@/data/listings";
import { useColors } from "@/hooks/useColors";
import {
  getPendingListings,
  PendingListing,
  randomHeroColor,
  savePendingListings,
} from "@/lib/adminStore";

const STEPS = ["Basic Info", "Financials", "Details", "Photos", "Verification", "Contact & Review"];
const CATEGORIES = [
  "Food & Beverage", "Health & Beauty", "Services", "Health & Fitness",
  "Retail", "Professional Services", "Manufacturing", "Hospitality", "Technology", "Transport",
];
const AU_STATES = ["VIC", "NSW", "QLD", "WA", "SA", "ACT", "TAS", "NT"];
const FRANCHISE_OPTIONS = ["Independent", "Franchise", "License Agreement", "Cooperative"];
const MAX_PHOTOS = 8;

const BADGE_META: { badge: VerificationBadge; label: string; desc: string; icon: string }[] = [
  { badge: "identity",        label: "Identity Verified",    desc: "Seller ID confirmed via government document", icon: "user-check"   },
  { badge: "abn",             label: "ABN Verified",         desc: "Active ABN confirmed with the ATO",           icon: "shield"       },
  { badge: "financials",      label: "Financials Verified",  desc: "P&L and BAS verified by accountant",          icon: "trending-up"  },
  { badge: "lease",           label: "Lease Verified",       desc: "Lease agreement reviewed and confirmed",      icon: "home"         },
  { badge: "equipment",       label: "Equipment List",       desc: "Full equipment schedule provided",            icon: "tool"         },
  { badge: "tour",            label: "360 Tour",             desc: "Interactive business tour available",         icon: "rotate-ccw"   },
  { badge: "broker",          label: "Broker Represented",   desc: "Licensed business broker engaged",            icon: "briefcase"    },
  { badge: "accountant",      label: "Accountant Signed",    desc: "CPA/CA has signed off on financials",         icon: "file-text"    },
  { badge: "seller_supplied", label: "Seller Supplied Docs", desc: "Seller has uploaded supporting documents",    icon: "upload"       },
];

interface FormState {
  businessName: string;
  category: string;
  state: string;
  suburb: string;
  description: string;
  confidential: boolean;
  askingPrice: string;
  askingPriceMin: string;
  askingPriceMax: string;
  weeklyRevenue: string;
  adjustedProfit: string;
  rent: string;
  staffCount: string;
  ownerHours: string;
  leaseExpiry: string;
  leaseOptions: string;
  franchiseStatus: string;
  trainingPeriod: string;
  reasonForSale: string;
  growthOpportunities: string;
  risks: string;
  badges: VerificationBadge[];
  contactPreference: "message" | "call" | "broker_only";
  priceDisplay: "askingPrice" | "weeklyRevenue" | "poa";
  stat2Display: string;
  stat3Display: string;
  sellerPhone: string;
  photos: string[];
}

const INITIAL_FORM: FormState = {
  businessName: "", category: "", state: "", suburb: "", description: "",
  confidential: false, askingPrice: "", askingPriceMin: "", askingPriceMax: "", weeklyRevenue: "", adjustedProfit: "",
  rent: "", staffCount: "", ownerHours: "", leaseExpiry: "", leaseOptions: "",
  franchiseStatus: "", trainingPeriod: "", reasonForSale: "", growthOpportunities: "",
  risks: "", badges: [], contactPreference: "message", priceDisplay: "askingPrice",
  stat2Display: "sde", stat3Display: "staffCount",
  sellerPhone: "", photos: [],
};

export default function CreateListing() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { editId } = useLocalSearchParams<{ editId?: string }>();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    getPendingListings().then((all) => {
      const item = all.find((p) => p.id === editId);
      if (item) {
        setForm({
          businessName:       item.businessName       ?? "",
          suburb:             item.suburb             ?? "",
          state:              item.state              ?? "",
          category:           item.category           ?? "",
          description:        item.description        ?? "",
          confidential:       item.confidential       ?? false,
          askingPrice:        item.askingPrice        ? String(item.askingPrice)  : "",
          askingPriceMin:     item.askingPriceMin     ? String(item.askingPriceMin): "",
          askingPriceMax:     item.askingPriceMax     ? String(item.askingPriceMax): "",
          weeklyRevenue:      item.weeklyRevenue      ? String(item.weeklyRevenue): "",
          priceDisplay:       (item.priceDisplay      ?? "askingPrice") as FormState["priceDisplay"],
          stat2Display:       item.stat2Display       ?? "sde",
          stat3Display:       item.stat3Display       ?? "staffCount",
          adjustedProfit:     item.adjustedProfit     ? String(item.adjustedProfit): "",
          rent:               item.rent               ? String(item.rent)         : "",
          staffCount:         item.staffCount         ? String(item.staffCount)   : "",
          ownerHours:         item.ownerHours         ? String(item.ownerHours)   : "",
          leaseExpiry:        item.leaseExpiry        ?? "",
          leaseOptions:       item.leaseOptions       ?? "",
          franchiseStatus:    item.franchiseStatus    ?? "",
          trainingPeriod:     item.trainingPeriod     ?? "",
          reasonForSale:      item.reasonForSale      ?? "",
          growthOpportunities:item.growthOpportunities?? "",
          risks:              item.risks              ?? "",
          badges:             (item.badges            ?? []) as VerificationBadge[],
          contactPreference:  (item.contactPreference as any) ?? "message",
          sellerPhone:        item.sellerPhone        ?? "",
          photos:             item.photos             ?? [],
        });
      }
      setLoadingEdit(false);
    });
  }, [editId]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleBadge = (badge: VerificationBadge) => {
    setForm((f) => ({
      ...f,
      badges: f.badges.includes(badge)
        ? f.badges.filter((b) => b !== badge)
        : [...f.badges, badge],
    }));
  };

  const addPhotos = async () => {
    const remaining = MAX_PHOTOS - form.photos.length;
    if (remaining <= 0) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library to add listing photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: remaining,
    });

    if (result.canceled || !result.assets?.length) return;

    if (Platform.OS === "web") {
      setForm((f) => ({ ...f, photos: [...f.photos, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS) }));
      return;
    }

    const dir = `${FileSystem.documentDirectory}biz360_listing_photos/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    const saved: string[] = [];
    for (const asset of result.assets) {
      const ext = asset.uri.split(".").pop() ?? "jpg";
      const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const dest = `${dir}${filename}`;
      await FileSystem.copyAsync({ from: asset.uri, to: dest });
      saved.push(dest);
    }

    setForm((f) => ({ ...f, photos: [...f.photos, ...saved].slice(0, MAX_PHOTOS) }));
  };

  const removePhoto = (idx: number) => {
    setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }));
  };

  const next = () => {
    if (step === 0 && !form.businessName.trim()) {
      Alert.alert("Required", "Please enter a business name before continuing.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const skip = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const back = () => setStep((s) => s - 1);

  const submit = async () => {
    if (!form.businessName.trim()) {
      Alert.alert("Required", "Please enter a business name before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      // Resolve the target listing id + owner up front so photos can be uploaded
      // to the right Cloudinary folder (biz360/<userId>/<listingId>).
      const existing = await getPendingListings();
      const userId = user?.id ?? "unknown";
      const listingId = editId
        ? (existing.find((p) => p.id === editId)?.listingId ?? `user-listing-${Date.now()}`)
        : `user-listing-${Date.now()}`;

      let savedPhotos = form.photos;
      try {
        if (Platform.OS !== "web" && form.photos.length > 0 && FileSystem.documentDirectory) {
          const dir = `${FileSystem.documentDirectory}biz360_listing_photos/`;
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          savedPhotos = (await Promise.all(
            form.photos.map(async (uri) => {
              if (!uri) return null;
              // pass through all absolute URI formats — only copy transient picker URIs (ph://, etc.)
              if (uri.startsWith("file://") || uri.startsWith("http") || uri.startsWith(dir)) return uri;
              try {
                const ext = uri.split(".").pop() ?? "jpg";
                const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                const dest = `${dir}${filename}`;
                await FileSystem.copyAsync({ from: uri, to: dest });
                return dest;
              } catch {
                return uri; // keep original URI if copy fails
              }
            }),
          )).filter((u): u is string => !!u);
        }
      } catch {
        // keep savedPhotos as-is — don't let a photo error kill the save
      }

      // Upload any local (file://) photos to Cloudinary so they show on the
      // website (same endpoint the 360° tour uses). Keep the local path as a
      // fallback if an individual upload fails — never block the save on it.
      // Any failure reason is captured and surfaced so it's never silent.
      let photoUploadError: string | null = null;
      try {
        const domain  = process.env.EXPO_PUBLIC_DOMAIN;
        const apiBase = domain ? `https://${domain}/api` : "/api";
        savedPhotos = await Promise.all(
          savedPhotos.map(async (uri, index) => {
            if (typeof uri !== "string" || /^https?:\/\//.test(uri)) return uri; // already remote
            try {
              // Cloudinary's free tier caps images at 10MB; phone photos are
              // often 12MB+. Resize + compress to JPEG first so they upload.
              let uploadUri = uri;
              try {
                const manip = await ImageManipulator.manipulateAsync(
                  uri,
                  [{ resize: { width: 1920 } }],
                  { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
                );
                if (manip?.uri) uploadUri = manip.uri;
              } catch { /* fall back to the original if manipulation fails */ }
              const base64   = await FileSystem.readAsStringAsync(uploadUri, { encoding: "base64" });
              const mimeType = "image/jpeg";
              const ctrl     = new AbortController();
              const timer    = setTimeout(() => ctrl.abort(), 120_000);
              try {
                const res = await fetch(`${apiBase}/biz360/img`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ key: `listing_photo_${index}`, data: base64, mimeType, userId, listingId }),
                  signal: ctrl.signal,
                });
                clearTimeout(timer);
                if (!res.ok) {
                  const body = await res.text().catch(() => "");
                  photoUploadError = `Upload failed (HTTP ${res.status})${body ? `: ${body.slice(0, 140)}` : ""} · ${apiBase}`;
                  return uri;
                }
                const json = (await res.json()) as { url?: string };
                if (!json.url) { photoUploadError = "Server returned no URL"; return uri; }
                return json.url;
              } catch (e) {
                clearTimeout(timer);
                photoUploadError = `Network error: ${e instanceof Error ? e.message : String(e)} · ${apiBase}`;
                return uri;
              }
            } catch (e) {
              photoUploadError = `Could not read photo: ${e instanceof Error ? e.message : String(e)}`;
              return uri; // couldn't read/upload — keep local path
            }
          }),
        );
      } catch (e) {
        photoUploadError = `Photo upload error: ${e instanceof Error ? e.message : String(e)}`;
      }

      const fieldData = {
        businessName:        form.businessName.trim(),
        suburb:              form.suburb.trim() || "Unknown",
        state:               form.state || "VIC",
        category:            form.category || "Other",
        description:         form.description.trim(),
        confidential:        form.confidential,
        askingPrice:         parseInt(form.askingPrice.replace(/[^0-9]/g, ""))        || 0,
        askingPriceMin:      parseInt(form.askingPriceMin.replace(/[^0-9]/g, ""))     || 0,
        askingPriceMax:      parseInt(form.askingPriceMax.replace(/[^0-9]/g, ""))     || 0,
        weeklyRevenue:       parseInt(form.weeklyRevenue.replace(/[^0-9]/g, ""))      || 0,
        priceDisplay:        form.priceDisplay,
        stat2Display:        form.stat2Display,
        stat3Display:        form.stat3Display,
        adjustedProfit:      parseInt(form.adjustedProfit.replace(/[^0-9]/g, ""))     || 0,
        rent:                parseInt(form.rent.replace(/[^0-9]/g, ""))               || 0,
        staffCount:          parseInt(form.staffCount)                                || 0,
        ownerHours:          parseInt(form.ownerHours)                                || 0,
        leaseExpiry:         form.leaseExpiry.trim(),
        leaseOptions:        form.leaseOptions.trim(),
        franchiseStatus:     form.franchiseStatus,
        trainingPeriod:      form.trainingPeriod.trim(),
        reasonForSale:       form.reasonForSale.trim(),
        growthOpportunities: form.growthOpportunities.trim(),
        risks:               form.risks.trim(),
        contactPreference:   form.contactPreference,
        sellerPhone:         form.sellerPhone.trim(),
        badges:              form.badges,
        photos:              savedPhotos,
      };

      if (editId) {
        const updated = existing.map((p) =>
          p.id === editId
            ? { ...p, ...fieldData, submittedAt: Date.now() }
            : p,
        );
        await savePendingListings(updated);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          photoUploadError ? "Saved — photo didn't upload" : "Listing Updated!",
          photoUploadError
            ? `"${form.businessName.trim()}" was saved, but the photo could not be uploaded to the website:\n\n${photoUploadError}`
            : `"${form.businessName.trim()}" has been saved.`,
          [{ text: "Done", onPress: () => router.back() }],
        );
      } else {
        const newItem: PendingListing = {
          id: `p-${Date.now()}`,
          listingId,
          submittedAt: Date.now(),
          status: "pending",
          submittedBy: userId,
          submittedByName: user?.displayName ?? user?.name?.split(" ")[0] ?? "Seller",
          submittedByRole: user?.role ?? "seller",
          heroColor: randomHeroColor(),
          ...fieldData,
        };
        await savePendingListings([...existing, newItem]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          photoUploadError ? "Submitted — photo didn't upload" : "Listing Submitted!",
          photoUploadError
            ? `"${form.businessName.trim()}" was submitted, but the photo could not be uploaded:\n\n${photoUploadError}`
            : `"${form.businessName.trim()}" has been submitted for admin review. You'll see it in your listings with a Pending badge. Approval typically takes 1 business day.`,
          [{ text: "Done", onPress: () => router.back() }],
        );
      }
    } catch {
      Alert.alert("Error", "Something went wrong saving your listing. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const textField = (
    key: keyof FormState,
    label: string,
    placeholder: string,
    numeric = false,
    multiline = false,
  ) => (
    <View key={key} style={styles.field}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMulti,
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={form[key] as string}
        onChangeText={(v) => update(key, v as any)}
        keyboardType={numeric ? "numeric" : "default"}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );

  if (loadingEdit) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading listing…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {editId ? "Edit Listing" : "Create Listing"}
        </Text>
        <Text style={[styles.stepIndicator, { color: colors.mutedForeground }]}>{step + 1}/{STEPS.length}</Text>
      </View>

      <View style={styles.stepBar}>
        {STEPS.map((s, idx) => (
          <View key={s} style={[styles.stepItem, { backgroundColor: idx <= step ? colors.primary : colors.muted }]} />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>{STEPS[step]}</Text>

        {/* ── Step 0: Basic Info ── */}
        {step === 0 && (
          <View style={styles.fields}>
            {textField("businessName", "Business Name *", "e.g. My Business Name")}
            {textField("suburb", "Suburb", "e.g. Inner City")}
            {textField("description", "Business Description", "Briefly describe the business, its history, and what makes it attractive to buyers…", false, true)}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
              <View style={styles.chipGrid}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, { backgroundColor: form.category === c ? colors.primary : colors.muted }]}
                    onPress={() => update("category", c)}
                  >
                    <Text style={[styles.chipText, { color: form.category === c ? "#fff" : colors.foreground }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>State</Text>
              <View style={styles.chipGrid}>
                {AU_STATES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, { backgroundColor: form.state === s ? colors.primary : colors.muted }]}
                    onPress={() => update("state", s)}
                  >
                    <Text style={[styles.chipText, { color: form.state === s ? "#fff" : colors.foreground }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={[styles.switchRow, { backgroundColor: form.confidential ? colors.primary + "18" : colors.card, borderColor: form.confidential ? colors.primary : colors.border }]}>
              <Feather name={form.confidential ? "eye-off" : "eye"} size={16} color={form.confidential ? colors.primary : colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchLabel, { color: form.confidential ? colors.primary : colors.foreground }]}>Confidential Listing</Text>
                <Text style={[styles.switchHint, { color: colors.mutedForeground }]}>Business name hidden from public search results</Text>
              </View>
              <Switch
                value={form.confidential}
                onValueChange={(v) => update("confidential", v)}
                trackColor={{ false: colors.muted, true: colors.primary + "60" }}
                thumbColor={form.confidential ? colors.primary : colors.mutedForeground}
              />
            </View>
          </View>
        )}

        {/* ── Step 1: Financials ── */}
        {step === 1 && (
          <View style={styles.fields}>
            {textField("askingPrice",    "Asking Price ($)",                "185000",                  true)}
            {/* Optional From/To range — for multi-facet businesses that can be broken up.
                When both are set, the website shows a range instead of the single price. */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Asking Price Range (optional)</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 10, fontFamily: "Inter_400Regular" }}>
                Set a From and To if the price is flexible or the business can be split. Leave blank to show the single Asking Price above.
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>{textField("askingPriceMin", "From ($)", "1500000", true)}</View>
                <View style={{ flex: 1 }}>{textField("askingPriceMax", "To ($)",   "2100000", true)}</View>
              </View>
            </View>
            {textField("weeklyRevenue",  "Weekly Revenue ($)",              "18500",                   true)}

            {/* Price display selector */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Card Price Display</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 10, fontFamily: "Inter_400Regular" }}>
                What buyers see in the first stat slot on your listing card
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["askingPrice", "weeklyRevenue", "poa"] as const).map((opt) => {
                  const labels = { askingPrice: "Asking Price", weeklyRevenue: "Weekly Revenue", poa: "POA" };
                  const active = form.priceDisplay === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.chip, { flex: 1, backgroundColor: active ? colors.primary : colors.muted }]}
                      onPress={() => update("priceDisplay", opt)}
                    >
                      <Text style={[styles.chipText, { color: active ? "#fff" : colors.foreground, textAlign: "center" }]}>{labels[opt]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {form.priceDisplay === "poa" && (
                <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 8, fontFamily: "Inter_400Regular" }}>
                  Buyers will see "POA · Contact Seller" instead of a price.
                </Text>
              )}
            </View>

            {/* Stat slot 2 selector */}
            {(() => {
              const STAT_OPTS = [
                { value: "sde",            label: "SDE p.a." },
                { value: "staffCount",     label: "Staff" },
                { value: "weeklyRevenue",  label: "Weekly Rev." },
                { value: "rent",           label: "Monthly Rent" },
                { value: "equipmentValue", label: "Equipment $" },
                { value: "ownerHours",     label: "Owner Hrs" },
                { value: "leaseExpiry",    label: "Lease Expiry" },
                { value: "none",           label: "None" },
              ];
              return (
                <>
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Card Stat — Slot 2</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 10, fontFamily: "Inter_400Regular" }}>
                      Middle stat on your listing card (default: SDE p.a.)
                    </Text>
                    <View style={[styles.chipGrid]}>
                      {STAT_OPTS.map(({ value, label }) => {
                        const active = form.stat2Display === value;
                        return (
                          <TouchableOpacity
                            key={value}
                            style={[styles.chip, { backgroundColor: active ? colors.primary : colors.muted }]}
                            onPress={() => update("stat2Display", value)}
                          >
                            <Text style={[styles.chipText, { color: active ? "#fff" : colors.foreground }]}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Card Stat — Slot 3</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 10, fontFamily: "Inter_400Regular" }}>
                      Right stat on your listing card (default: Staff Count)
                    </Text>
                    <View style={[styles.chipGrid]}>
                      {STAT_OPTS.map(({ value, label }) => {
                        const active = form.stat3Display === value;
                        return (
                          <TouchableOpacity
                            key={value}
                            style={[styles.chip, { backgroundColor: active ? colors.primary : colors.muted }]}
                            onPress={() => update("stat3Display", value)}
                          >
                            <Text style={[styles.chipText, { color: active ? "#fff" : colors.foreground }]}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              );
            })()}

            {textField("adjustedProfit", "Adjusted Profit / SDE ($ p.a.)", "72000",                   true)}
            {textField("rent",           "Monthly Rent ($)",                "4200",                    true)}
            {textField("staffCount",     "Staff Count",                     "4",                       true)}
            {textField("ownerHours",     "Owner Hours / Week",              "40",                      true)}
            {textField("leaseExpiry",    "Lease Expiry Date",               "e.g. June 2027"               )}
            {textField("leaseOptions",   "Lease Renewal Options",           "e.g. 2 × 3-year options"      )}
          </View>
        )}

        {/* ── Step 2: Details ── */}
        {step === 2 && (
          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Franchise / License Status</Text>
              <View style={styles.chipGrid}>
                {FRANCHISE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, { backgroundColor: form.franchiseStatus === opt ? colors.primary : colors.muted }]}
                    onPress={() => update("franchiseStatus", opt)}
                  >
                    <Text style={[styles.chipText, { color: form.franchiseStatus === opt ? "#fff" : colors.foreground }]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {textField("trainingPeriod",       "Training Period",        "e.g. 4 weeks included"                              )}
            {textField("reasonForSale",        "Reason for Sale",        "e.g. Relocating interstate, retirement…",    false, true)}
            {textField("growthOpportunities",  "Growth Opportunities",   "What could a new owner do to grow revenue?", false, true)}
            {textField("risks",                "Risks / Disclosures",    "Any risks or issues a buyer should know…",   false, true)}
          </View>
        )}

        {/* ── Step 3: Photos ── */}
        {step === 3 && (
          <View style={styles.fields}>
            <View style={[styles.badgeInfoCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
              <Feather name="camera" size={16} color={colors.primary} />
              <Text style={[styles.badgeInfoText, { color: colors.foreground }]}>
                Add up to {MAX_PHOTOS} photos. The first photo becomes the hero image shown in search results. Listings with photos get 3× more buyer enquiries.
              </Text>
            </View>

            <View style={styles.photoGrid}>
              {form.photos.map((uri, idx) => (
                <View key={`${uri}-${idx}`} style={styles.photoCell}>
                  <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                  <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removePhoto(idx)}>
                    <Feather name="x" size={11} color="#fff" />
                  </TouchableOpacity>
                  {idx === 0 && (
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeText}>HERO</Text>
                    </View>
                  )}
                </View>
              ))}
              {form.photos.length < MAX_PHOTOS && (
                <TouchableOpacity
                  style={[styles.photoAddCell, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={addPhotos}
                >
                  <Feather name="camera" size={22} color={colors.mutedForeground} />
                  <Text style={[styles.photoAddLabel, { color: colors.mutedForeground }]}>
                    {form.photos.length === 0 ? "Add Photos" : "Add More"}
                  </Text>
                  <Text style={[styles.photoCount, { color: colors.border }]}>
                    {form.photos.length}/{MAX_PHOTOS}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {form.photos.length === 0 && (
              <View style={[styles.photoHintCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="image" size={14} color={colors.mutedForeground} />
                <Text style={[styles.photoHintText, { color: colors.mutedForeground }]}>
                  Photos are optional but strongly recommended. Interior shots, signage, equipment and foot traffic areas perform best.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Step 4: Verification Badges ── */}
        {step === 4 && (
          <View style={styles.fields}>
            <View style={[styles.badgeInfoCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
              <Feather name="shield" size={16} color={colors.primary} />
              <Text style={[styles.badgeInfoText, { color: colors.foreground }]}>
                Verification badges increase buyer trust and reduce time to sale. Select all that apply.
              </Text>
            </View>
            <Text style={[styles.badgesSelected, { color: colors.mutedForeground }]}>
              {form.badges.length} badge{form.badges.length !== 1 ? "s" : ""} selected
            </Text>
            {BADGE_META.map(({ badge, label, desc, icon }) => {
              const active = form.badges.includes(badge);
              return (
                <TouchableOpacity
                  key={badge}
                  style={[styles.badgeRow, { backgroundColor: active ? colors.accent + "12" : colors.card, borderColor: active ? colors.accent : colors.border }]}
                  onPress={() => toggleBadge(badge)}
                >
                  <View style={[styles.badgeIcon, { backgroundColor: (active ? colors.accent : colors.mutedForeground) + "18" }]}>
                    <Feather name={icon as any} size={16} color={active ? colors.accent : colors.mutedForeground} />
                  </View>
                  <View style={styles.badgeInfo}>
                    <Text style={[styles.badgeLabel, { color: active ? colors.accent : colors.foreground }]}>{label}</Text>
                    <Text style={[styles.badgeDesc,  { color: colors.mutedForeground }]}>{desc}</Text>
                  </View>
                  {active
                    ? <Feather name="check-circle" size={20} color={colors.accent} />
                    : <Feather name="circle"       size={20} color={colors.border}  />
                  }
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Step 5: Contact & Review ── */}
        {step === 5 && (
          <View style={styles.fields}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Contact Preference</Text>
            {[
              { val: "message",     label: "Message Only",    icon: "message-circle", hint: "Buyers contact via in-app message"      },
              { val: "call",        label: "Message + Call",  icon: "phone",          hint: "Buyers can message or click-to-call"     },
              { val: "broker_only", label: "Broker Only",     icon: "shield",         hint: "All enquiries routed through broker"     },
            ].map(({ val, label, icon, hint }) => (
              <TouchableOpacity
                key={val}
                style={[styles.radioRow, { backgroundColor: form.contactPreference === val ? colors.primary + "18" : colors.card, borderColor: form.contactPreference === val ? colors.primary : colors.border }]}
                onPress={() => update("contactPreference", val as any)}
              >
                <Feather name={icon as any} size={18} color={form.contactPreference === val ? colors.primary : colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.radioLabel, { color: form.contactPreference === val ? colors.primary : colors.foreground }]}>{label}</Text>
                  <Text style={[styles.radioHint,  { color: colors.mutedForeground }]}>{hint}</Text>
                </View>
                {form.contactPreference === val && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}

            {form.contactPreference === "call" && textField("sellerPhone", "Phone Number", "e.g. 0400 000 000")}

            <Text style={[styles.reviewSectionTitle, { color: colors.foreground }]}>Summary</Text>
            <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { label: "Business",      value: form.businessName    || "—" },
                { label: "Category",      value: form.category        || "—" },
                { label: "Location",      value: `${form.suburb || "—"}, ${form.state || "—"}` },
                { label: "Asking Price",  value: form.askingPrice  ? `$${parseInt(form.askingPrice).toLocaleString()}`   : "—" },
                { label: "Weekly Rev.",   value: form.weeklyRevenue ? `$${parseInt(form.weeklyRevenue).toLocaleString()}` : "—" },
                { label: "Adj. Profit",   value: form.adjustedProfit ? `$${parseInt(form.adjustedProfit).toLocaleString()} p.a.` : "—" },
                { label: "Lease Expiry",  value: form.leaseExpiry     || "—" },
                { label: "Franchise",     value: form.franchiseStatus || "—" },
                { label: "Training",      value: form.trainingPeriod  || "—" },
                { label: "Photos",        value: `${form.photos.length} added` },
                { label: "Contact",       value: form.contactPreference },
                { label: "Confidential",  value: form.confidential ? "Yes" : "No" },
                { label: "Badges",        value: form.badges.length > 0 ? `${form.badges.length} selected` : "None" },
              ].map(({ label, value }) => (
                <View key={label} style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <Text style={[styles.reviewValue, { color: colors.foreground }]}>{value}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
              <Feather name="info" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                {editId
                  ? "Edits are saved immediately. Your listing status is not affected."
                  : "Your listing will be reviewed by the Biz360 team before going live. Once submitted it will appear in your listings with a Pending status."
                }
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 12 }]}>
        {step > 0 && (
          <TouchableOpacity style={[styles.backStepBtn, { backgroundColor: colors.muted }]} onPress={back}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </TouchableOpacity>
        )}
        {step > 0 && step < STEPS.length - 1 && (
          <TouchableOpacity style={[styles.skipBtn, { borderColor: colors.border }]} onPress={skip}>
            <Text style={[styles.skipBtnText, { color: colors.mutedForeground }]}>Skip</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: submitting ? colors.muted : colors.primary }]}
          onPress={step < STEPS.length - 1 ? next : submit}
          disabled={submitting}
        >
          <Text style={styles.nextBtnText}>
            {step < STEPS.length - 1
              ? "Continue"
              : submitting
              ? "Saving…"
              : editId
              ? "Save & Resubmit"
              : "Submit Listing"}
          </Text>
          <Feather name={step < STEPS.length - 1 ? "arrow-right" : "check"} size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  loadingText:        { fontSize: 16, fontFamily: "Inter_400Regular" },
  header:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle:        { fontSize: 17, fontFamily: "Inter_700Bold" },
  stepIndicator:      { fontSize: 14, fontFamily: "Inter_500Medium" },
  stepBar:            { flexDirection: "row", gap: 4, paddingHorizontal: 16, paddingVertical: 12 },
  stepItem:           { flex: 1, height: 4, borderRadius: 2 },
  scroll:             { padding: 16, gap: 16 },
  stepTitle:          { fontSize: 22, fontFamily: "Inter_700Bold" },
  fields:             { gap: 14 },
  field:              { gap: 8 },
  label:              { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  input:              { paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  inputMulti:         { minHeight: 90, paddingTop: 13 },
  chipGrid:           { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:               { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  chipText:           { fontSize: 13, fontFamily: "Inter_500Medium" },
  switchRow:          { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  switchLabel:        { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  switchHint:         { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  radioRow:           { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  radioLabel:         { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  radioHint:          { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  badgeInfoCard:      { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  badgeInfoText:      { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  badgesSelected:     { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "right" },
  badgeRow:           { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  badgeIcon:          { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badgeInfo:          { flex: 1 },
  badgeLabel:         { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  badgeDesc:          { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  photoGrid:          { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoCell:          { width: "31%", aspectRatio: 1, borderRadius: 10, overflow: "hidden" },
  photoThumb:         { width: "100%", height: "100%" },
  photoRemoveBtn:     { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  heroBadge:          { position: "absolute", bottom: 4, left: 4, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  heroBadgeText:      { color: "#fff", fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  photoAddCell:       { width: "31%", aspectRatio: 1, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4 },
  photoAddLabel:      { fontSize: 11, fontFamily: "Inter_500Medium" },
  photoCount:         { fontSize: 10, fontFamily: "Inter_400Regular" },
  photoHintCard:      { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  photoHintText:      { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  reviewSectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 4 },
  reviewCard:         { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  reviewRow:          { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  reviewLabel:        { fontSize: 13, fontFamily: "Inter_400Regular" },
  reviewValue:        { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right", flex: 1, marginLeft: 16 },
  infoBox:            { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  infoText:           { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  footer:             { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  backStepBtn:        { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  skipBtn:            { paddingHorizontal: 16, height: 48, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  skipBtnText:        { fontSize: 14, fontFamily: "Inter_500Medium" },
  nextBtn:            { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  nextBtnText:        { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
