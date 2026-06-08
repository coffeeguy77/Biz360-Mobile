import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEMO_USERS, useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/lib/apiStore";
import { getPendingListings, getUsers } from "@/lib/adminStore";

const ROLES: { key: UserRole; label: string; subtitle: string; icon: string }[] = [
  { key: "buyer",  label: "Buyer",  subtitle: "Browse & explore businesses for sale", icon: "search"    },
  { key: "seller", label: "Seller", subtitle: "Manage & showcase your listing",       icon: "tag"       },
  { key: "broker", label: "Broker", subtitle: "Manage listings, leads & team",        icon: "briefcase" },
  { key: "admin",  label: "Admin",  subtitle: "Platform administration",               icon: "shield"    },
];

interface LiveStats {
  listings: number;
  tourSpaces: number;
  members: number;
}

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [selected, setSelected] = useState<UserRole>("buyer");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [devMode, setDevMode] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setDevMode((v) => !v);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 2000);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [allListings, allUsers] = await Promise.all([
          getPendingListings(),
          getUsers(),
        ]);
        const approved = allListings.filter((l) => l.status === "approved");

        // Fetch tour spaces for each approved listing in parallel
        const spaceCounts = await Promise.all(
          approved.map((l) =>
            apiGet<{ id: string }[]>(`biz360_tour_spaces_v1_${l.listingId}`)
              .then((spaces) => (spaces ?? []).length)
              .catch(() => 0),
          ),
        );
        const totalSpaces = spaceCounts.reduce((a, b) => a + b, 0);

        if (!cancelled) {
          setStats({
            listings:   approved.length,
            tourSpaces: totalSpaces,
            members:    allUsers.length,
          });
        }
      } catch {
        // non-critical — keep null (shows "—")
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDemoLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    await login(DEMO_USERS[selected]);
    setLoading(false);
    router.replace("/");
  };

  return (
    <View style={[styles.container, { backgroundColor: "#071221" }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 24,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoRow}>
          <TouchableOpacity onPress={handleLogoTap} activeOpacity={0.8}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>360</Text>
            </View>
          </TouchableOpacity>
          <View>
            <Text style={styles.brand}>Biz360</Text>
            <Text style={styles.tagline}>See the business before you buy it.</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Australia's immersive{"\n"}business marketplace</Text>
          <Text style={styles.heroSub}>
            Explore businesses with interactive 360° tours, financial pins,
            verified documents and direct seller messaging.
          </Text>
          <View style={styles.statsRow}>
            {([
              [stats ? String(stats.listings)   : "—", "Listings"],
              [stats ? String(stats.tourSpaces) : "—", "Tour Spaces"],
              [stats ? String(stats.members)    : "—", "Members"],
            ] as [string, string][]).map(([val, lbl]) => (
              <View key={lbl} style={styles.stat}>
                <Text style={styles.statVal}>{val}</Text>
                <Text style={styles.statLbl}>{lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {devMode && (
          <>
            <Text style={styles.sectionLabel}>Continue as</Text>
            <View style={styles.roleGrid}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[
                    styles.roleCard,
                    {
                      backgroundColor: selected === r.key ? "#2563EB" : "#0F2040",
                      borderColor: selected === r.key ? "#3B82F6" : "#1E3A5C",
                    },
                  ]}
                  onPress={() => {
                    setSelected(r.key);
                    Haptics.selectionAsync();
                  }}
                >
                  <View
                    style={[
                      styles.roleIcon,
                      {
                        backgroundColor:
                          selected === r.key ? "rgba(255,255,255,0.2)" : "#162033",
                      },
                    ]}
                  >
                    <Feather
                      name={r.icon as any}
                      size={20}
                      color={selected === r.key ? "#fff" : "#3B82F6"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.roleLabel,
                      { color: selected === r.key ? "#fff" : "#E2E8F0" },
                    ]}
                  >
                    {r.label}
                  </Text>
                  <Text
                    style={[
                      styles.roleSub,
                      { color: selected === r.key ? "rgba(255,255,255,0.7)" : "#8B9CB8" },
                    ]}
                  >
                    {r.subtitle}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { opacity: loading ? 0.7 : 1, marginBottom: 12 }]}
              onPress={handleDemoLogin}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? "Loading..." : `Continue as ${ROLES.find((r) => r.key === selected)?.label}`}
              </Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, { opacity: 1 }, devMode && { backgroundColor: "#0F2040", borderWidth: 1, borderColor: "#1E3A5C" }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Feather name="smartphone" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Sign In</Text>
        </TouchableOpacity>

        <View style={[styles.loginRow, { marginTop: 16 }]}>
          <Text style={[styles.loginText, { color: "#8B9CB8" }]}>New to Biz360? </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
            <Text style={[styles.loginLink, { color: "#3B82F6" }]}>Create account</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.browseBtn}
          onPress={() => router.replace("/(tabs)/discover" as any)}
        >
          <Feather name="compass" size={15} color="#8B9CB8" />
          <Text style={styles.browseBtnText}>Browse listings without an account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 },
  logoBox: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center",
  },
  logoText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  brand: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  tagline: { color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_400Regular" },
  heroCard: {
    backgroundColor: "#0F2040",
    borderRadius: 20, padding: 22, marginBottom: 28,
    borderWidth: 1, borderColor: "#1E3A5C",
  },
  heroTitle: {
    color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold",
    lineHeight: 34, marginBottom: 10,
  },
  heroSub: {
    color: "#8B9CB8", fontSize: 14, fontFamily: "Inter_400Regular",
    lineHeight: 22, marginBottom: 18,
  },
  statsRow: { flexDirection: "row", gap: 24 },
  stat: { alignItems: "center" },
  statVal: { color: "#3B82F6", fontSize: 20, fontFamily: "Inter_700Bold" },
  statLbl: { color: "#8B9CB8", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionLabel: {
    color: "#8B9CB8", fontSize: 12, fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
  },
  roleGrid: { gap: 10, marginBottom: 24 },
  roleCard: {
    padding: 16, borderRadius: 14, borderWidth: 1,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  roleIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  roleLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  roleSub: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 2, textAlign: "right" },
  primaryBtn: {
    backgroundColor: "#2563EB", borderRadius: 14,
    paddingVertical: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  loginRow: { flexDirection: "row", justifyContent: "center" },
  loginText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  loginLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  browseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20, paddingVertical: 10 },
  browseBtnText: { color: "#8B9CB8", fontSize: 14, fontFamily: "Inter_400Regular" },
});
