import React from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import type { ClosetItem, OutfitSlot, SwapAlternative } from "../../api/types";
import { SLOT_LABELS } from "../../outfitBuilder/filters";
import { garmentName } from "../../garmentName";
import { PressScale } from "../../motion/PressScale";
import { colors, radius, type, weight } from "../../theme";
import { Button, Sheet } from "../../ui";
import { GarmentImage } from "../GarmentImage";

const TILE_W = 96;
const TILE_H = 118;
const RING = 2.5;  // the current piece's tint outline
const RING_GAP = 2;

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

// A garment on its stone tile, inside a ring that is tint for the piece in the look and clear for the rest.
function Candidate({ item, current, note, label, onPress }: {
  item: ClosetItem; current: boolean; note?: string; label: string; onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: current }}
      style={{ width: TILE_W + (RING + RING_GAP) * 2, alignItems: "center" }}>
      <View style={{ padding: RING_GAP, borderWidth: RING, borderColor: current ? colors.tint : "transparent", borderRadius: radius.garment + RING + RING_GAP }}>
        <View style={{ width: TILE_W, height: TILE_H, borderRadius: radius.garment, backgroundColor: colors.tile, overflow: "hidden" }}>
          <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
            tile={colors.tile} style={{ width: TILE_W, height: TILE_H, borderRadius: radius.garment }} />
        </View>
      </View>
      <Text numberOfLines={1} style={{ ...type.footnote, ...weight(600), color: colors.label, marginTop: 4, maxWidth: TILE_W }}>{garmentName(item)}</Text>
      {note ? <Text numberOfLines={2} style={{ ...type.caption, color: colors.secondaryLabel, textAlign: "center", maxWidth: TILE_W }}>{note}</Text> : null}
    </PressScale>
  );
}

// U5 — Swap a piece (02-UX-FLOWS.md): the piece in the look first, outlined, then the server's ranked
// owned alternatives for that slot in a sideways row; tap one to use it. Or a friendly "no
// alternatives yet" state. Never a stock photo, never another account's item.
export function SwapSheet({ visible, onClose, slot, current, loading, error, alternatives, items, onChoose }: Props) {
  const label = slot ? SLOT_LABELS[slot].toLowerCase() : "";
  const options = alternatives.flatMap((a) => {
    const item = items.get(a.item_id);
    return item ? [{ id: a.item_id, item, reason: a.reason }] : [];
  });
  return (
    <Sheet visible={visible} onClose={onClose} floating>
      <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>{`Swap ${label}`}</Text>
      <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 2, marginBottom: 14 }}>
        {loading ? "Looking in your closet…" : options.length
          ? `${options.length} other ${options.length === 1 ? "option" : "options"} from your closet`
          : current ? "Currently in this look" : ""}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20 - RING - RING_GAP, gap: 6, alignItems: "flex-start" }}>
        {current ? (
          <Candidate item={current} current label={`${garmentName(current)}, currently in this look`} onPress={onClose} />
        ) : null}
        {loading ? (
          <View style={{ width: TILE_W, height: TILE_H, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.secondaryLabel} />
          </View>
        ) : error ? null : options.map(({ id, item, reason }) => (
          <Candidate key={id} item={item} current={false} note={reason} label={`Use ${garmentName(item)}`} onPress={() => onChoose(id)} />
        ))}
      </ScrollView>

      {error ? (
        <Text style={{ ...type.body, color: colors.destructive, marginTop: 14 }}>{error}</Text>
      ) : !loading && options.length === 0 ? (
        <Text style={{ ...type.body, color: colors.secondaryLabel, marginTop: 14 }}>{`No other ${label} in your closet yet.`}</Text>
      ) : null}
      <View style={{ marginTop: 10 }}>
        <Button title="Keep This Piece" variant="text" size="medium" onPress={onClose} />
      </View>
    </Sheet>
  );
}
