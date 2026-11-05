import React from "react";
import { Text, View } from "react-native";
import type { ClosetItem } from "../api/types";
import { PressScale } from "../motion/PressScale";
import { colors, radius, shadow, type, weight } from "../theme";
import { GarmentImage } from "./GarmentImage";
import { Glass } from "../ui";

type Props = {
  item: ClosetItem;
  width: number;
  height: number;
  onPress?: () => void;
  label: string;  // VoiceOver: "Open <name>"
  rounded?: number;
  badge?: string | null;  // e.g. "360°"
  testID?: string;
};

// A garment on the stone tile with the handoff's soft shadow. The cutout sits straight on the tile;
// images that keep their own background are inset on it (GarmentImage decides). A badge ("360°") is a
// small glass pill in the tile's corner; nothing tints the garment itself.
export function GarmentTile({ item, width, height, onPress, label, rounded = radius.tile, badge, testID }: Props) {
  const body = (
    <View style={{ width, height, borderRadius: rounded, backgroundColor: colors.tile, ...shadow.tile }}>
      <GarmentImage
        path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
        tile={colors.tile} style={{ width, height, borderRadius: rounded }}
      />
      {badge ? (
        <Glass radius={radius.pill} level="sheet" flat style={{ position: "absolute", top: 8, right: 8, paddingHorizontal: 8, height: 22, justifyContent: "center" }}>
          <Text style={{ ...type.caption, ...weight(600), color: colors.label }}>{badge}</Text>
        </Glass>
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return <PressScale testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{body}</PressScale>;
}
