import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { Feather } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function NativeTabLayout() {
  const { user } = useAuth();
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="discover">
        <Icon sf={{ default: "magnifyingglass.circle", selected: "magnifyingglass.circle.fill" }} />
        <Label>Discover</Label>
      </NativeTabs.Trigger>
      {user && (
        <NativeTabs.Trigger name="saved">
          <Icon sf={{ default: "bookmark", selected: "bookmark.fill" }} />
          <Label>Saved</Label>
        </NativeTabs.Trigger>
      )}
      <NativeTabs.Trigger name="messages">
        <Icon sf={{ default: "message", selected: "message.fill" }} />
        <Label>Messages</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const safeAreaInsets = useSafeAreaInsets();

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
          paddingBottom: isWeb ? 0 : safeAreaInsets.bottom,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="magnifyingglass.circle" tintColor={color} size={24} /> : <Feather name="search" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="bookmark" tintColor={color} size={24} /> : <Feather name="bookmark" size={22} color={color} />,
          tabBarButton: user ? undefined : () => null,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="message" tintColor={color} size={24} /> : <Feather name="message-circle" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="person" tintColor={color} size={24} /> : <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function BuyerTabLayout() {
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
