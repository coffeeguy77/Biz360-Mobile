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
      <NativeTabs.Trigger name="listings"><Icon sf={{ default: "doc.badge.clock", selected: "doc.badge.clock.fill" }} /><Label>Listings</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="users"><Icon sf={{ default: "person.2", selected: "person.2.fill" }} /><Label>Users</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="brokers"><Icon sf={{ default: "briefcase", selected: "briefcase.fill" }} /><Label>Brokers</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="reports"><Icon sf={{ default: "flag", selected: "flag.fill" }} /><Label>Reports</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="revenue"><Icon sf={{ default: "dollarsign.circle", selected: "dollarsign.circle.fill" }} /><Label>Revenue</Label></NativeTabs.Trigger>
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
      <Tabs.Screen name="listings" options={{ title: "Listings", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="doc.badge.clock" tintColor={color} size={24} /> : <Feather name="clock" size={22} color={color} /> }} />
      <Tabs.Screen name="users" options={{ title: "Users", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="person.2" tintColor={color} size={24} /> : <Feather name="users" size={22} color={color} /> }} />
      <Tabs.Screen name="brokers" options={{ title: "Brokers", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="briefcase" tintColor={color} size={24} /> : <Feather name="briefcase" size={22} color={color} /> }} />
      <Tabs.Screen name="reports" options={{ title: "Reports", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="flag" tintColor={color} size={24} /> : <Feather name="flag" size={22} color={color} /> }} />
      <Tabs.Screen name="revenue" options={{ title: "Revenue", tabBarIcon: ({ color }) => isIOS ? <SymbolView name="dollarsign.circle" tintColor={color} size={24} /> : <Feather name="dollar-sign" size={22} color={color} /> }} />
    </Tabs>
  );
}

export default function AdminTabLayout() {
  if (isLiquidGlassAvailable()) return <NativeLayout />;
  return <ClassicLayout />;
}
