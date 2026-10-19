import React from "react";
import { Pressable, View, type ColorValue } from "react-native";
import { haptics } from "../haptics";
import { colors, hitSlopFor } from "../theme";

type Props = { color: ColorValue; label: string; selected: boolean; onPress: () => void; size?: number };

// A garment color. Selected = double ring: a background-colored gap, then an ink ring.
export function Swatch({ color, label, selected, onPress, size = 28 }: Props) {
  const ring = 2 + 1.5;
  return (
    <Pressable
      onPress={() => { haptics.selection(); onPress(); }}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      hitSlop={hitSlopFor(size + ring * 2, size + ring * 2)}
      style={{
        width: size + ring * 2, height: size + ring * 2, borderRadius: size, alignItems: "center", justifyContent: "center",
        borderWidth: selected ? 1.5 : 0, borderColor: colors.label,
      }}
    >
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: 1, borderColor: colors.separator }} />
    </Pressable>
  );
}
