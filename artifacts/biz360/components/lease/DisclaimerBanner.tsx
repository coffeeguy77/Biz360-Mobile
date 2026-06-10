import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  /** Override the default disclaimer text. */
  text?: string;
}

export function DisclaimerBanner({ text }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.banner, { backgroundColor: "#1C1200", borderColor: "#92400E" }]}>
      <Feather name="alert-triangle" size={14} color="#F59E0B" style={{ marginTop: 1 }} />
      <Text style={[styles.text, { color: "#FCD34D" }]}>
        {text ??
          "This analysis is for informational purposes only and does not constitute legal advice. Always consult a qualified commercial lease solicitor before signing or negotiating any lease."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection:  "row",
    alignItems:     "flex-start",
    gap:            8,
    borderRadius:   12,
    borderWidth:    1,
    padding:        12,
  },
  text: {
    flex:        1,
    fontSize:    11,
    fontFamily:  "Inter_400Regular",
    lineHeight:  17,
  },
});
