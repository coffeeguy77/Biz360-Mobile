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
      <NativeTabs.Trigger name="dashboard"><Icon sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis.circle.fill" }} /><Label>Dashboard</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="listings"><Icon sf={{ default: "building.2", selected: "building.2.fill" }} /><Label>Listings</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="leads"><Icon sf={{ default: "person.2", selected: "person.2.fill" }} /><Label>Leads</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="team"><Icon sf={{ default: "person.3", selected: "person.3.fill" }} /><Label>Team</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="analytics"><Icon sf={{ default: "chart.pie", selected: "chart.pie.fill" }} /><Label>Analytics</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="billing"><Icon sf={{ default: "creditcard", selected: "creditcard.fill" }} /><Label>Billing</Label></NativeTabs.Trigger>
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
        tabBarStyle: { position: "absolute", backgroundColor: isIOS ? "transparent" : colors.background, borderTopWidth: isWeb ? 1 : 0, borderTopColor: colors.border, elevation: 0, paddingBottom: isWeb ? 0 : insets.bottom, ...(isWeb ? { height: 84 } : {}) },
        tabBarBackground: () => isIOS ? <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : isWeb ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} /> : null,
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="chart.line.uptrend.xyaxis" tintColor={color} size={24} /> : <Feather name="trending-up" size={22} color={color} /> }} />
      <Tabs.Screen name="listings" options={{ title: "Listings", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="building.2" tintColor={color} size={24} /> : <Feather name="briefcase" size={22} color={color} /> }} />
      <Tabs.Screen name="leads" options={{ title: "Leads", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="person.2" tintColor={color} size={24} /> : <Feather name="users" size={22} color={color} /> }} />
      <Tabs.Screen name="team" options={{ title: "Team", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="person.3" tintColor={color} size={24} /> : <Feather name="user-check" size={22} color={color} /> }} />
      <Tabs.Screen name="analytics" options={{ title: "Analytics", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="chart.pie" tintColor={color} size={24} /> : <Feather name="pie-chart" size={22} color={color} /> }} />
      <Tabs.Screen name="billing" options={{ title: "Billing", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="creditcard" tintColor={color} size={24} /> : <Feather name="credit-card" size={22} color={color} /> }} />
    </Tabs>
  );
}

export default function BrokerTabLayout() {
  if (isLiquidGlassAvailable()) return <NativeLayout />;
  return <ClassicLayout />;
}
