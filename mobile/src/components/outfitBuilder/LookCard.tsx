import React from "react";
import { Text, View, type ViewStyle } from "react-native";
import type { ClosetItem, OutfitLook } from "../../api/types";
import { orderedSlots } from "../../outfitBuilder/filters";
import { PressScale } from "../../motion/PressScale";
import { colors, radius, shadow, type } from "../../theme";
import { GarmentImage } from "../GarmentImage";

export const LOOK_CARD_RADIUS = 30;
const GAP = 6;

// One piece of the collage on its stone tile. The image itself is never tinted.
function Piece({ item, style }: { item: ClosetItem; style: ViewStyle }) {
  return (
    <View style={[{ borderRadius: radius.garment, backgroundColor: colors.tile, overflow: "hidden" }, style]}>
      <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
        tile={colors.tile} style={{ flex: 1, borderRadius: radius.garment }} />
    </View>
  );
}

// The look's own catalog images as a flat collage (02-UX-FLOWS.md U3: never a generated composite):
// the first piece large on the left, the rest stacked on the right, in body-slot order.
function Collage({ pieces }: { pieces: ClosetItem[] }) {
  if (!pieces.length) return <View style={{ flex: 1, borderRadius: radius.garment, backgroundColor: colors.tile }} />;
  const [first, ...rest] = pieces;
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: GAP }}>
      <Piece item={first} style={{ flex: rest.length ? 1.35 : 1 }} />
      {rest.length ? (
        <View style={{ flex: 1, gap: GAP }}>
          {rest.map((item, k) => <Piece key={item.item_id + k} item={item} style={{ flex: 1 }} />)}
        </View>
      ) : null}
    </View>
  );
}

// A look in the swipe deck: a white card with the collage, the look's name, its piece count and the
// one-sentence rationale. Tapping it opens the look. `peek` draws it behind the top card, inert.
export function LookCard({ look, items, height, onPress, peek = false, children }: {
  look: OutfitLook; items: Map<string, ClosetItem>; height: number; onPress?: () => void; peek?: boolean; children?: React.ReactNode;
}) {
  const pieces = orderedSlots(look).map(({ itemId }) => items.get(itemId)).filter((i): i is ClosetItem => !!i);
  const body = (
    <>
      <View style={{ flex: 1 }}>
        <Collage pieces={pieces} />
        {children}
      </View>
      <View style={{ paddingTop: 12, paddingHorizontal: 6, paddingBottom: 4, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <Text numberOfLines={1} style={{ ...type.cardTitle, color: colors.label, flexShrink: 1 }}>{look.title}</Text>
          <Text style={{ ...type.footnote, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>
            {pieces.length === 1 ? "1 piece" : `${pieces.length} pieces`}
          </Text>
        </View>
        {look.reason ? <Text numberOfLines={2} style={{ ...type.footnote, color: colors.secondaryLabel }}>{look.reason}</Text> : null}
      </View>
    </>
  );
  const card = { height, backgroundColor: colors.card, borderRadius: LOOK_CARD_RADIUS, padding: 10, ...shadow.tile };
  if (peek || !onPress) {
    return <View style={card} accessibilityElementsHidden={peek} importantForAccessibility={peek ? "no-hide-descendants" : "auto"}>{body}</View>;
  }
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${look.title}`} scaleTo={0.98} style={card}>
      {body}
    </PressScale>
  );
}
