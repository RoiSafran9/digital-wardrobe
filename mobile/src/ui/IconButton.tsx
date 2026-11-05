import React from "react";
import type { ColorValue } from "react-native";
import { Icon, type IconName } from "../components/Icon";
import { PressScale } from "../motion/PressScale";
import { colors, hitSlopFor, radius } from "../theme";
import { Glass } from "./Glass";

type Props = {
  icon: IconName;
  label: string;  // icon-only controls always carry an accessibility label
  onPress: () => void;
  size?: number;
  dark?: boolean;  // over the camera or a photo: white glyph on white 16%
  color?: ColorValue;
  testID?: string;
};

// A round glass button for close, back and other icon-only actions at the top of a screen (40pt).
export function IconButton({ icon, label, onPress, size = 40, dark = false, color, testID }: Props) {
  return (
    <PressScale
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlopFor(size, size)}
      style={{ width: size, height: size, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: dark ? "rgba(255,255,255,0.16)" : undefined }}
    >
      {dark ? null : <Glass radius={radius.pill} level="base" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
      <Icon name={icon} size={Math.round(size / 2)} color={color ?? (dark ? "#FFFFFF" : colors.label)} />
    </PressScale>
  );
}
