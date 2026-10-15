import React from "react";
import { Text, View } from "react-native";
import type { Tier } from "../api/types";

const TIER_STYLE: Record<Tier, { color: string; label: string }> = {
  high: { color: "#2e7d32", label: "Great" },
  medium: { color: "#f9a825", label: "OK" },
  low: { color: "#c62828", label: "Retake" },
};

export function TierBadge({ tier }: { tier: Tier }) {
  const { color, label } = TIER_STYLE[tier];
  return (
    <View style={{ backgroundColor: color, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: "white", fontWeight: "bold" }}>{label}</Text>
    </View>
  );
}
