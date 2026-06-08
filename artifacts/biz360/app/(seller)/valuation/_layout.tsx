import { Stack } from "expo-router";
import React from "react";
import { ValuationProvider } from "@/context/ValuationContext";

export default function ValuationLayout() {
  return (
    <ValuationProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ValuationProvider>
  );
}
