import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import type { ClosetItem, OutfitSlot, SwapAlternative } from "../../api/types";
import { SLOT_LABELS } from "../../outfitBuilder/filters";
import { garmentName } from "../../garmentName";
import { PressScale } from "../../motion/PressScale";
import { colors, radius, type } from "../../theme";
import { Button, Sheet } from "../../ui";
import { GarmentImage } from "../GarmentImage";

const TILE = 64;

type Props = {
  visible: boolean;
  onClose: () => void;
  slot: OutfitSlot | null;
  current: ClosetItem | null;
  loading: boolean;
  error: string | null;
  alternatives: SwapAlternative[];
  items: Map<string, ClosetItem>;
  onChoose: (itemId: string) => void;
};

// U5 — Swap This Piece (02-UX-FLOWS.md): ranked owned alternatives for the tapped slot, or a
// friendly "no alternatives yet" state. Never a stock photo, never another account's item.
export function SwapSheet({ visible, onClose, slot, current, loading, error, alternatives, items, onChoose }: Props) {
  const label = slot ? SLOT_LABELS[slot] : "";
  return (
    <Sheet visible={visible} onClose={onClose} title="Swap This Piece">
      {current ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: radius.tile, backgroundColor: colors.tile, overflow: "hidden" }}>
            <GarmentImage path={current.generated_url} cutoutPath={current.cutout_url} cropPath={current.crop_url}
              tile={colors.tile} style={{ width: 48, height: 48, borderRadius: radius.tile }} />
          </View>
          <View>
            <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>Currently in this look</Text>
            <Text style={{ ...type.subhead, fontWeight: "600", color: colors.label }}>{garmentName(current)}</Text>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <ActivityIndicator color={colors.secondaryLabel} />
        </View>
      ) : error ? (
        <Text style={{ ...type.body, color: colors.destructive, marginBottom: 16 }}>{error}</Text>
      ) : alternatives.length === 0 ? (
        <View style={{ paddingVertical: 8, gap: 16 }}>
          <Text style={{ ...type.body, color: colors.secondaryLabel }}>
            {`No other ${label.toLowerCase()} in your closet yet.`}
          </Text>
          <Button title="Keep This Piece" variant="secondary" size="medium" onPress={onClose} />
        </View>
      ) : (
        <>
          <Text style={{ ...type.eyebrow, color: colors.secondaryLabel, marginBottom: 10 }}>Other options from your closet</Text>
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 10, paddingBottom: 8 }}>
              {alternatives.map(({ item_id, reason }) => {
                const item = items.get(item_id);
                if (!item) return null;
                return (
                  <PressScale
                    key={item_id}
                    onPress={() => onChoose(item_id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${garmentName(item)}`}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.fill, borderRadius: radius.list, padding: 10 }}
                  >
                    <View style={{ width: TILE, height: TILE, borderRadius: radius.tile, backgroundColor: colors.tile, overflow: "hidden" }}>
                      <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
                        tile={colors.tile} style={{ width: TILE, height: TILE, borderRadius: radius.tile }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...type.subhead, fontWeight: "600", color: colors.label }}>{garmentName(item)}</Text>
                      <Text numberOfLines={2} style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 1 }}>{reason}</Text>
                    </View>
                  </PressScale>
                );
              })}
            </View>
          </ScrollView>
        </>
      )}
    </Sheet>
  );
}
