import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
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
import { useColors } from "@/hooks/useColors";

interface Category {
  id: string;
  name: string;
  icon: string;
  listingCount: number;
  active: boolean;
  featured: boolean;
  sortOrder: number;
}

const INITIAL_CATEGORIES: Category[] = [
  { id: "cat-01", name: "Food & Beverage", icon: "coffee", listingCount: 142, active: true, featured: true, sortOrder: 1 },
  { id: "cat-02", name: "Retail", icon: "shopping-bag", listingCount: 89, active: true, featured: true, sortOrder: 2 },
  { id: "cat-03", name: "Health & Wellness", icon: "heart", listingCount: 67, active: true, featured: true, sortOrder: 3 },
  { id: "cat-04", name: "Professional Services", icon: "briefcase", listingCount: 54, active: true, featured: false, sortOrder: 4 },
  { id: "cat-05", name: "Manufacturing", icon: "tool", listingCount: 31, active: true, featured: false, sortOrder: 5 },
  { id: "cat-06", name: "Hospitality", icon: "home", listingCount: 28, active: true, featured: true, sortOrder: 6 },
  { id: "cat-07", name: "Transport & Logistics", icon: "truck", listingCount: 22, active: true, featured: false, sortOrder: 7 },
  { id: "cat-08", name: "Technology", icon: "monitor", listingCount: 19, active: true, featured: false, sortOrder: 8 },
  { id: "cat-09", name: "Education & Training", icon: "book-open", listingCount: 14, active: true, featured: false, sortOrder: 9 },
  { id: "cat-10", name: "Agriculture", icon: "sun", listingCount: 8, active: false, featured: false, sortOrder: 10 },
];

const ICON_OPTIONS = ["coffee", "shopping-bag", "heart", "briefcase", "tool", "home", "truck", "monitor", "book-open", "sun", "zap", "globe", "music", "camera", "scissors"];

export default function AdminCategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftIcon, setDraftIcon] = useState("briefcase");
  const [draftFeatured, setDraftFeatured] = useState(false);

  const openCreate = () => {
    setEditTarget(null);
    setDraftName("");
    setDraftIcon("briefcase");
    setDraftFeatured(false);
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditTarget(cat);
    setDraftName(cat.name);
    setDraftIcon(cat.icon);
    setDraftFeatured(cat.featured);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!draftName.trim()) {
      Alert.alert("Name required", "Please enter a category name.");
      return;
    }
    if (editTarget) {
      setCategories((prev) => prev.map((c) => c.id === editTarget.id ? { ...c, name: draftName.trim(), icon: draftIcon, featured: draftFeatured } : c));
    } else {
      const newCat: Category = {
        id: `cat-${Date.now()}`,
        name: draftName.trim(),
        icon: draftIcon,
        listingCount: 0,
        active: true,
        featured: draftFeatured,
        sortOrder: categories.length + 1,
      };
      setCategories((prev) => [...prev, newCat]);
    }
    setShowModal(false);
  };

  const toggleActive = (id: string) => {
    setCategories((prev) => prev.map((c) => c.id === id ? { ...c, active: !c.active } : c));
  };

  const handleDelete = (cat: Category) => {
    Alert.alert(
      "Delete Category",
      `Delete "${cat.name}"? This will unassign it from ${cat.listingCount} listings.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => setCategories((prev) => prev.filter((c) => c.id !== cat.id)) },
      ]
    );
  };

  const activeCount = categories.filter((c) => c.active).length;
  const featuredCount = categories.filter((c) => c.featured).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Categories</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{activeCount} active · {featuredCount} featured</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 80) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.primary }]}>{categories.length}</Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Total</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.accent }]}>{activeCount}</Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Active</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: "#F59E0B" }]}>{featuredCount}</Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Featured</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statVal, { color: colors.foreground }]}>{categories.reduce((a, c) => a + c.listingCount, 0)}</Text>
            <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>Listings</Text>
          </View>
        </View>

        {categories
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((cat) => (
            <View key={cat.id} style={[styles.catRow, { backgroundColor: colors.card, borderColor: cat.active ? colors.border : colors.border + "60", opacity: cat.active ? 1 : 0.6 }]}>
              <View style={[styles.catIcon, { backgroundColor: (cat.active ? colors.primary : colors.mutedForeground) + "18" }]}>
                <Feather name={cat.icon as any} size={18} color={cat.active ? colors.primary : colors.mutedForeground} />
              </View>
              <View style={styles.catInfo}>
                <View style={styles.catNameRow}>
                  <Text style={[styles.catName, { color: colors.foreground }]}>{cat.name}</Text>
                  {cat.featured && (
                    <View style={[styles.featuredBadge, { backgroundColor: "#F59E0B20" }]}>
                      <Feather name="star" size={9} color="#F59E0B" />
                      <Text style={[styles.featuredText, { color: "#F59E0B" }]}>Featured</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.catMeta, { color: colors.mutedForeground }]}>{cat.listingCount} listings · Sort #{cat.sortOrder}</Text>
              </View>
              <Switch
                value={cat.active}
                onValueChange={() => toggleActive(cat.id)}
                trackColor={{ false: colors.muted, true: colors.primary + "60" }}
                thumbColor={cat.active ? colors.primary : colors.mutedForeground}
              />
              <TouchableOpacity onPress={() => openEdit(cat)} style={styles.editBtn}>
                <Feather name="edit-2" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(cat)} style={styles.editBtn}>
                <Feather name="trash-2" size={15} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editTarget ? "Edit Category" : "New Category"}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CATEGORY NAME</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. Food & Beverage"
              placeholderTextColor={colors.mutedForeground}
              value={draftName}
              onChangeText={setDraftName}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>ICON</Text>
            <View style={styles.iconGrid}>
              {ICON_OPTIONS.map((ico) => (
                <TouchableOpacity
                  key={ico}
                  style={[styles.iconOption, { backgroundColor: draftIcon === ico ? colors.primary + "20" : colors.card, borderColor: draftIcon === ico ? colors.primary : colors.border }]}
                  onPress={() => setDraftIcon(ico)}
                >
                  <Feather name={ico as any} size={20} color={draftIcon === ico ? colors.primary : colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View>
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>Featured on homepage</Text>
                <Text style={[styles.toggleHint, { color: colors.mutedForeground }]}>Shown in the discover browse grid</Text>
              </View>
              <Switch
                value={draftFeatured}
                onValueChange={setDraftFeatured}
                trackColor={{ false: colors.muted, true: colors.primary + "60" }}
                thumbColor={draftFeatured ? colors.primary : colors.mutedForeground}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, gap: 10 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  statChip: { flex: 1, alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, gap: 2 },
  statVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLbl: { fontSize: 10, fontFamily: "Inter_400Regular" },
  catRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  catIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  catInfo: { flex: 1, gap: 3 },
  catNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  catName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  catMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  featuredBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  featuredText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  editBtn: { padding: 4 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalCancel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  modalSave: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalScroll: { padding: 20, gap: 14 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  nameInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 4 },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  iconOption: { width: 52, height: 52, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1 },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
