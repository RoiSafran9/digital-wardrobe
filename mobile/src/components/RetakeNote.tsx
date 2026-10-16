import React from "react";
import { Text, View } from "react-native";
import type { Tier } from "../api/types";
import { colors } from "../theme";

// A low-rated item needs a retake; on anything else the same field is only a tip.
export function RetakeNote({ tier, text }: { tier: Tier; text: string }) {
  const retake = tier === "low";
  return (
    <View style={{ marginTop: 12, backgroundColor: retake ? colors.destructiveBg : colors.tile, borderRadius: 14, padding: 12 }}>
      <Text style={{ color: retake ? colors.destructive : colors.secondaryLabel, fontSize: 14 }}>
        {retake ? `Retake: ${text}` : text}
      </Text>
    </View>
  );
}
