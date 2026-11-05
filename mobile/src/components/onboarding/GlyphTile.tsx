import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Icon, type IconName } from "../Icon";
import { colors, radius as radii, shadow } from "../../theme";
import { Glass } from "../../ui/Glass";

type Props = {
  icon?: IconName;  // none: an empty frame waiting for a piece
  size: { width: number; height: number };
  style?: StyleProp<ViewStyle>;
  dashed?: boolean;
  glass?: boolean;  // a frosted tile (Welcome's collage) instead of the stone one
  radius?: number;
};

// A neutral stand-in tile for onboarding art: an SF Symbol garment on the stone tile (or on glass).
// Never a photo, so nothing suggests these are the user's (or anyone's) real clothes.
export function GlyphTile({ icon, size, style, dashed, glass, radius = glass ? radii.tile : radii.garment }: Props) {
  const glyph = icon ? <Icon name={icon} size={Math.round(Math.min(size.width, size.height) * 0.42)} color={colors.secondaryLabel} /> : null;
  if (glass) {
    return <Glass radius={radius} style={[{ ...size, alignItems: "center", justifyContent: "center" }, style]}>{glyph}</Glass>;
  }
  return (
    <View
      style={[{
        ...size, borderRadius: radius, backgroundColor: colors.tile, alignItems: "center", justifyContent: "center",
        ...(dashed ? { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.separatorStrong } : shadow.tile),
      }, style]}
    >
      {glyph}
    </View>
  );
}
