import React from "react";
import { Text, View } from "react-native";
import type { Tier } from "../api/types";
import { TIER_STYLE, radius } from "../theme";

export function TierBadge({ tier }: { tier: Tier }) {
  const { label, bg, fg } = TIER_STYLE[tier];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "500" }}>{label}</Text>
    </View>
  );
}
