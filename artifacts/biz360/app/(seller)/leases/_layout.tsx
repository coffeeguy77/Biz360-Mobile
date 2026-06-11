import { Stack } from "expo-router";
import React from "react";

export default function LeasesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="upload" />
      <Stack.Screen name="library" />
      <Stack.Screen name="builder" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="templates" />
      <Stack.Screen name="template-detail/[id]" />
      <Stack.Screen name="lease-detail/[id]" />
      <Stack.Screen name="draft-detail/[id]" />
      <Stack.Screen name="clause-detail/[id]" />
    </Stack>
  );
}
