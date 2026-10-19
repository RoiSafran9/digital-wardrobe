import React from "react";
import { Text, View } from "react-native";
import { useCredits } from "../credits/CreditsProvider";
import { PressScale } from "../motion/PressScale";
import { colors, hitSlopFor, radius, type } from "../theme";

// Home's balance pill. Only when the server charges credits and the balance is known.
export function CreditPill({ onPress }: { onPress: () => void }) {
  const { billing, credits } = useCredits();
  if (!billing || !credits) return null;
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${credits.available} AI credits`}
      hitSlop={hitSlopFor(32)}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.fill }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.tint }} />
      <Text style={{ ...type.subhead, fontWeight: "600", color: colors.label, fontVariant: ["tabular-nums"] }}>{credits.available}</Text>
    </PressScale>
  );
}
