import React from "react";
import { View } from "react-native";
import { colors } from "../theme";

type Props = { value: number; warning?: boolean; height?: number; accessibilityLabel?: string };

// A rounded bar on a fill track; amber when warning (low credits).
export function ProgressBar({ value, warning = false, height = 8, accessibilityLabel }: Props) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: colors.fill, overflow: "hidden" }}
    >
      <View style={{ width: `${v * 100}%`, height, borderRadius: height / 2, backgroundColor: warning ? colors.warning : colors.tint }} />
    </View>
  );
}
