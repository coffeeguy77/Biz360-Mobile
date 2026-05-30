import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  WIKI_ARTICLES,
  WIKI_CATEGORIES,
  WikiArticle,
  WikiCategory,
  isCategoryVisible,
  isArticleVisible,
} from "@/data/wiki";

// ─── Role label ────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  seller: { label: "Seller",  color: "#3B82F6" },
  broker: { label: "Broker",  color: "#8B5CF6" },
  admin:  { label: "Admin",   color: "#EF4444" },
  buyer:  { label: "Buyer",   color: "#16A34A" },
};

// ─── View states ────────────────────────────────────────────────────────────

type ViewState =
  | { screen: "home" }
  | { screen: "category"; category: WikiCategory }
  | { screen: "article"; article: WikiArticle; category: WikiCategory };

// ─── Main Component ─────────────────────────────────────────────────────────

export default function WikiScreen() {
  const insets    = useSafeAreaInsets();
  const colors    = useColors();
  const { user }  = useAuth();
  const role      = user?.role ?? "seller";

  const [view, setView]         = useState<ViewState>({ screen: "home" });
  const [query, setQuery]       = useState("");

  // ── Visible categories & articles for this role ────────────────────────
  const visibleCategories = useMemo(
    () => WIKI_CATEGORIES.filter((c) => isCategoryVisible(c, role)),
    [role],
  );
  const visibleArticles = useMemo(
    () => WIKI_ARTICLES.filter((a) => isArticleVisible(a, role)),
    [role],
  );

  // ── Search results ─────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return visibleArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.sections.some((s) => s.body.toLowerCase().includes(q) || s.heading?.toLowerCase().includes(q)),
    );
  }, [query, visibleArticles]);

  // ── Navigation helpers ─────────────────────────────────────────────────
  const openCategory = (cat: WikiCategory) => {
    setQuery("");
    setView({ screen: "category", category: cat });
  };
  const openArticle = (article: WikiArticle) => {
    const cat = WIKI_CATEGORIES.find((c) => c.id === article.categoryId)!;
    setView({ screen: "article", article, category: cat });
  };
  const goBack = () => {
    if (view.screen === "article")   { setView({ screen: "category", category: view.category }); return; }
    if (view.screen === "category")  { setView({ screen: "home" }); return; }
    router.back();
  };

  // ── Header ──────────────────────────────────────────────────────────────
  const roleInfo    = ROLE_LABELS[role] ?? ROLE_LABELS.seller;
  const headerTitle =
    view.screen === "home"     ? "Help & Wiki" :
    view.screen === "category" ? view.category.title :
    view.article.title;
  const showBack    = view.screen !== "home";

  // ── Articles for current category ──────────────────────────────────────
  const categoryArticles = useMemo(() => {
    if (view.screen !== "category") return [];
    return visibleArticles.filter((a) => a.categoryId === view.category.id);
  }, [view, visibleArticles]);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* ── Top bar ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={goBack} activeOpacity={0.7}>
          <Feather name={showBack ? "chevron-left" : "x"} size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.topTitle, { color: colors.foreground }]} numberOfLines={1}>{headerTitle}</Text>
        <View style={[s.rolePill, { backgroundColor: roleInfo.color + "22" }]}>
          <Text style={[s.rolePillText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
        </View>
      </View>

      {/* ── Home ── */}
      {view.screen === "home" && (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Search */}
          <View style={[s.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[s.searchInput, { color: colors.foreground }]}
              placeholder="Search the wiki…"
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Feather name="x-circle" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Search results */}
          {query.trim().length > 0 ? (
            <View style={s.section}>
              <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{query}"
              </Text>
              {searchResults.length === 0 ? (
                <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ fontSize: 32 }}>🔍</Text>
                  <Text style={[s.emptyTitle, { color: colors.foreground }]}>Nothing found</Text>
                  <Text style={[s.emptySub, { color: colors.mutedForeground }]}>Try different keywords</Text>
                </View>
              ) : (
                searchResults.map((a) => <ArticleRow key={a.id} article={a} colors={colors} onPress={() => openArticle(a)} />)
              )}
            </View>
          ) : (
            <>
              {/* Intro */}
              <View style={[s.heroBanner, { backgroundColor: "#0F2040", borderColor: "#1E3A5C" }]}>
                <Text style={s.heroEmoji}>📖</Text>
                <Text style={s.heroTitle}>Biz360 Manual</Text>
                <Text style={s.heroSub}>
                  Everything you need to know to list, tour, and sell your business. Content is tailored to your{" "}
                  <Text style={{ color: roleInfo.color }}>{roleInfo.label}</Text> account.
                </Text>
              </View>

              {/* Categories */}
              <Text style={[s.sectionLabel, { color: colors.mutedForeground, marginTop: 20 }]}>CATEGORIES</Text>
              {visibleCategories.map((cat) => {
                const count = visibleArticles.filter((a) => a.categoryId === cat.id).length;
                return (
                  <CategoryCard
                    key={cat.id}
                    category={cat}
                    articleCount={count}
                    colors={colors}
                    onPress={() => openCategory(cat)}
                  />
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Category ── */}
      {view.screen === "category" && (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.catHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={s.catEmoji}>{view.category.icon}</Text>
            <Text style={[s.catDesc, { color: colors.mutedForeground }]}>{view.category.description}</Text>
          </View>
          <Text style={[s.sectionLabel, { color: colors.mutedForeground, marginTop: 16 }]}>
            {categoryArticles.length} article{categoryArticles.length !== 1 ? "s" : ""}
          </Text>
          {categoryArticles.map((a) => (
            <ArticleRow key={a.id} article={a} colors={colors} onPress={() => openArticle(a)} />
          ))}
        </ScrollView>
      )}

      {/* ── Article ── */}
      {view.screen === "article" && (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 48 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Breadcrumb */}
          <TouchableOpacity
            style={s.breadcrumb}
            onPress={() => setView({ screen: "category", category: view.category })}
            activeOpacity={0.7}
          >
            <Text style={s.breadcrumbIcon}>{view.category.icon}</Text>
            <Text style={[s.breadcrumbText, { color: colors.primary }]}>{view.category.title}</Text>
            <Feather name="chevron-right" size={12} color={colors.mutedForeground} style={{ marginLeft: 2 }} />
          </TouchableOpacity>

          {/* Article header */}
          <View style={s.articleHeader}>
            <Text style={s.articleIcon}>{view.article.icon}</Text>
            <Text style={[s.articleTitle, { color: colors.foreground }]}>{view.article.title}</Text>
            <Text style={[s.articleSummary, { color: colors.mutedForeground }]}>{view.article.summary}</Text>
            {view.article.updatedDate && (
              <Text style={[s.articleDate, { color: colors.mutedForeground }]}>
                Last updated: {view.article.updatedDate}
              </Text>
            )}
          </View>

          {/* Divider */}
          <View style={[s.divider, { backgroundColor: colors.border }]} />

          {/* Sections */}
          {view.article.sections.map((sec, i) => (
            <View key={i} style={s.section}>
              {sec.heading && (
                <Text style={[s.secHeading, { color: colors.foreground }]}>{sec.heading}</Text>
              )}
              <Text style={[s.secBody, { color: colors.mutedForeground }]}>{sec.body}</Text>
            </View>
          ))}

          {/* Related articles */}
          <RelatedArticles
            article={view.article}
            visibleArticles={visibleArticles}
            colors={colors}
            onPress={openArticle}
          />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function CategoryCard({
  category, articleCount, colors, onPress,
}: {
  category: WikiCategory;
  articleCount: number;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.catCard, { backgroundColor: pressed ? colors.card + "cc" : colors.card, borderColor: colors.border }]}
      onPress={onPress}
    >
      <Text style={s.catCardEmoji}>{category.icon}</Text>
      <View style={s.catCardBody}>
        <Text style={[s.catCardTitle, { color: colors.foreground }]}>{category.title}</Text>
        <Text style={[s.catCardDesc, { color: colors.mutedForeground }]}>{category.description}</Text>
      </View>
      <View style={s.catCardRight}>
        <Text style={[s.catCardCount, { color: colors.mutedForeground }]}>{articleCount}</Text>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

function ArticleRow({
  article, colors, onPress,
}: {
  article: WikiArticle;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.articleRow, { backgroundColor: pressed ? colors.card + "cc" : colors.card, borderColor: colors.border }]}
      onPress={onPress}
    >
      <Text style={s.articleRowIcon}>{article.icon}</Text>
      <View style={s.articleRowBody}>
        <Text style={[s.articleRowTitle, { color: colors.foreground }]}>{article.title}</Text>
        <Text style={[s.articleRowSummary, { color: colors.mutedForeground }]} numberOfLines={2}>{article.summary}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

function RelatedArticles({
  article, visibleArticles, colors, onPress,
}: {
  article: WikiArticle;
  visibleArticles: WikiArticle[];
  colors: ReturnType<typeof useColors>;
  onPress: (a: WikiArticle) => void;
}) {
  const related = useMemo(
    () => visibleArticles.filter((a) => a.categoryId === article.categoryId && a.id !== article.id).slice(0, 3),
    [article, visibleArticles],
  );
  if (related.length === 0) return null;
  return (
    <View style={{ marginTop: 32 }}>
      <View style={[s.divider, { backgroundColor: colors.border }]} />
      <Text style={[s.sectionLabel, { color: colors.mutedForeground, marginTop: 16 }]}>MORE IN THIS CATEGORY</Text>
      {related.map((a) => (
        <ArticleRow key={a.id} article={a} colors={colors} onPress={() => onPress(a)} />
      ))}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:           { flex: 1 },
  topBar:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  backBtn:        { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  topTitle:       { flex: 1, fontSize: 17, fontWeight: "600", letterSpacing: -0.3 },
  rolePill:       { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  rolePillText:   { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },

  scroll:         { paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel:   { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },

  searchRow:      { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20 },
  searchInput:    { flex: 1, fontSize: 15 },

  heroBanner:     { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: "center", marginBottom: 4 },
  heroEmoji:      { fontSize: 36, marginBottom: 8 },
  heroTitle:      { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 6 },
  heroSub:        { fontSize: 14, color: "rgba(255,255,255,0.65)", textAlign: "center", lineHeight: 20 },

  catCard:        { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10, gap: 12 },
  catCardEmoji:   { fontSize: 28, width: 40, textAlign: "center" },
  catCardBody:    { flex: 1, gap: 2 },
  catCardTitle:   { fontSize: 15, fontWeight: "600" },
  catCardDesc:    { fontSize: 13, lineHeight: 18 },
  catCardRight:   { flexDirection: "row", alignItems: "center", gap: 4 },
  catCardCount:   { fontSize: 13, fontWeight: "500" },

  catHeader:      { borderRadius: 14, borderWidth: 1, padding: 16, alignItems: "center", gap: 8 },
  catEmoji:       { fontSize: 40 },
  catDesc:        { fontSize: 14, lineHeight: 20, textAlign: "center" },

  articleRow:     { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8, gap: 12 },
  articleRowIcon: { fontSize: 22, width: 32, textAlign: "center" },
  articleRowBody: { flex: 1, gap: 3 },
  articleRowTitle:   { fontSize: 15, fontWeight: "600" },
  articleRowSummary: { fontSize: 13, lineHeight: 18 },

  breadcrumb:     { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 16 },
  breadcrumbIcon: { fontSize: 14 },
  breadcrumbText: { fontSize: 13, fontWeight: "600" },

  articleHeader:  { gap: 6, marginBottom: 20 },
  articleIcon:    { fontSize: 40, marginBottom: 4 },
  articleTitle:   { fontSize: 22, fontWeight: "700", letterSpacing: -0.5, lineHeight: 28 },
  articleSummary: { fontSize: 15, lineHeight: 22 },
  articleDate:    { fontSize: 11, marginTop: 4 },

  divider:        { height: StyleSheet.hairlineWidth, marginBottom: 20 },

  section:        { marginBottom: 20 },
  secHeading:     { fontSize: 16, fontWeight: "700", marginBottom: 8, letterSpacing: -0.2 },
  secBody:        { fontSize: 15, lineHeight: 24 },

  emptyCard:      { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyTitle:     { fontSize: 16, fontWeight: "600" },
  emptySub:       { fontSize: 14 },
});
