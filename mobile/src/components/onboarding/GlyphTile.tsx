import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Icon, type IconName } from "../Icon";
import { colors, radius, shadow } from "../../theme";

// A neutral stand-in tile for onboarding art: an SF Symbol garment on the stone tile. Never a photo,
// so nothing suggests these are the user's (or anyone's) real clothes.
export function GlyphTile({ icon, size, style, dashed }: { icon: IconName; size: { width: number; height: number }; style?: StyleProp<ViewStyle>; dashed?: boolean }) {
  return (
    <View
      style={[{
        ...size, borderRadius: radius.tile, backgroundColor: colors.tile, alignItems: "center", justifyContent: "center",
        ...(dashed ? { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.separatorStrong } : shadow.tile),
      }, style]}
    >
      <Icon name={icon} size={Math.round(Math.min(size.width, size.height) * 0.45)} color={colors.secondaryLabel} />
    </View>
  );
}
