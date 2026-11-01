import React from "react";
import { Text, View } from "react-native";
import type { ClosetItem, OutfitLook } from "../../api/types";
import { orderedSlots } from "../../outfitBuilder/filters";
import { PressScale } from "../../motion/PressScale";
import { colors, radius, shadow, type } from "../../theme";
import { GarmentImage } from "../GarmentImage";

const TILE = 76;

// A result card (02-UX-FLOWS.md U3): title, one-sentence rationale, and the real catalog photos of
// the look's own pieces laid out as a flat tile row — never a generated composite.
export function LookCard({ look, items, onPress }: { look: OutfitLook; items: Map<string, ClosetItem>; onPress: () => void }) {
  const slots = orderedSlots(look);
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${look.title}`}
      style={{ backgroundColor: colors.card, borderRadius: radius.list, padding: 16, gap: 12, ...shadow.tile }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {slots.map(({ slot, itemId }) => {
          const item = items.get(itemId);
          if (!item) return null;
          return (
            <View key={slot} style={{ width: TILE, height: TILE, borderRadius: radius.tile, backgroundColor: colors.tile, overflow: "hidden" }}>
              <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
                tile={colors.tile} style={{ width: TILE, height: TILE, borderRadius: radius.tile }} />
            </View>
          );
        })}
      </View>
      <View>
        <Text style={{ ...type.cardTitle, color: colors.label }}>{look.title}</Text>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 2 }}>{look.reason}</Text>
      </View>
    </PressScale>
  );
}
