import React from "react";
import { Text } from "react-native";
import { PressScale } from "../motion/PressScale";
import { haptics } from "../haptics";
import { colors, hitSlopFor, radius, type } from "../theme";

type Props = {
  label: string;
  count?: number;
  selected?: boolean;
  onPress: () => void;
  variant?: "filled" | "outlined";  // filled: filter chips; outlined: Home's category pills
};

// A capsule. Selected = ink fill with inverted text (the handoff's filter chips).
export function Chip({ label, count, selected = false, onPress, variant = "filled" }: Props) {
  const fg = selected ? colors.background : colors.label;
  return (
    <PressScale
      onPress={() => { haptics.selection(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      accessibilityState={{ selected }}
      hitSlop={hitSlopFor(34)}
      style={{
        flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 14, borderRadius: radius.pill,
        backgroundColor: selected ? colors.label : variant === "filled" ? colors.fill : "transparent",
        borderWidth: variant === "outlined" && !selected ? 1 : 0, borderColor: colors.separatorStrong,
      }}
    >
      <Text style={{ ...type.subhead, fontWeight: "500", color: fg }}>{label}</Text>
      {count === undefined ? null : (
        <Text style={{ ...type.subhead, color: selected ? colors.background : colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>{count}</Text>
      )}
    </PressScale>
  );
}
