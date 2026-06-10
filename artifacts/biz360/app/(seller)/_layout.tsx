import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { Feather } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function NativeLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="dashboard">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tours">
        <Icon sf={{ default: "rotate.3d", selected: "rotate.3d.fill" }} />
        <Label>Tours</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="valuation">
        <Icon sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis.circle.fill" }} />
        <Label>Valuation</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="leases">
        <Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} />
        <Label>Leases</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <Icon sf={{ default: "ellipsis", selected: "ellipsis.circle.fill" }} />
        <Label>More</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          paddingBottom: isWeb ? 0 : insets.bottom,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            : isWeb ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} /> : null,
      }}
    >
      <Tabs.Screen name="dashboard"  options={{ title: "Dashboard",  tabBarIcon: ({ color }) => isIOS ? <SymbolView name="chart.bar"                     tintColor={color} size={24} /> : <Feather name="bar-chart-2"    size={22} color={color} /> }} />
      <Tabs.Screen name="tours"      options={{ title: "Tours",      tabBarIcon: ({ color }) => isIOS ? <SymbolView name="rotate.3d"                      tintColor={color} size={24} /> : <Feather name="rotate-ccw"    size={22} color={color} /> }} />
      <Tabs.Screen name="valuation"  options={{ title: "Valuation",  tabBarIcon: ({ color }) => isIOS ? <SymbolView name="chart.line.uptrend.xyaxis"      tintColor={color} size={24} /> : <Feather name="trending-up"   size={22} color={color} /> }} />
      <Tabs.Screen name="leases"     options={{ title: "Leases",     tabBarIcon: ({ color }) => isIOS ? <SymbolView name="doc.text"                        tintColor={color} size={24} /> : <Feather name="file-text"     size={22} color={color} /> }} />
      <Tabs.Screen name="more"       options={{ title: "More",       tabBarIcon: ({ color }) => isIOS ? <SymbolView name="ellipsis"                        tintColor={color} size={24} /> : <Feather name="more-horizontal" size={22} color={color} /> }} />
      {/* Hidden tabs — accessible via router.push from More screen */}
      <Tabs.Screen name="listings"   options={{ href: null }} />
      <Tabs.Screen name="leads"      options={{ href: null }} />
      <Tabs.Screen name="messages"   options={{ href: null }} />
      <Tabs.Screen name="help"       options={{ href: null }} />
    </Tabs>
  );
}

export default function SellerTabLayout() {
  if (isLiquidGlassAvailable()) return <NativeLayout />;
  return <ClassicLayout />;
}
