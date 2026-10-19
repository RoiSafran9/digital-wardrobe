import React from "react";
import { Text, View } from "react-native";
import type { ClosetItem } from "../api/types";
import { PressScale } from "../motion/PressScale";
import { colors, radius, shadow, type } from "../theme";
import { GarmentImage } from "./GarmentImage";

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
// images that keep their own background are inset on it (GarmentImage decides).
export function GarmentTile({ item, width, height, onPress, label, rounded = radius.tile, badge, testID }: Props) {
  const body = (
    <View style={{ width, height, borderRadius: rounded, backgroundColor: colors.tile, ...shadow.tile }}>
      <GarmentImage
        path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
        tile={colors.tile} style={{ width, height, borderRadius: rounded }}
      />
      {badge ? (
        <View style={{ position: "absolute", top: 10, right: 10, paddingHorizontal: 8, height: 22, borderRadius: radius.pill, backgroundColor: colors.card, justifyContent: "center" }}>
          <Text style={{ ...type.caption, fontWeight: "600", color: colors.label }}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return <PressScale testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{body}</PressScale>;
}
