import React from "react";
import { Text, View } from "react-native";
import { useCredits } from "../credits/CreditsProvider";
import { PressScale } from "../motion/PressScale";
import { colors, hitSlopFor, radius, type, weight } from "../theme";
import { Glass } from "./Glass";

// Home's glass balance pill. Only when the server charges credits and the balance is known.
export function CreditPill({ onPress }: { onPress: () => void }) {
  const { billing, credits } = useCredits();
  if (!billing || !credits) return null;
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${credits.available} AI credits`}
      hitSlop={hitSlopFor(32)}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: radius.pill }}
    >
      <Glass radius={radius.pill} level="base" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.tint }} />
      <Text style={{ ...type.subhead, ...weight(600), color: colors.label, fontVariant: ["tabular-nums"] }}>{credits.available}</Text>
    </PressScale>
  );
}
