import React from "react";
import { Text, View } from "react-native";
import type { ClosetItem } from "../../api/types";
import { PopIn } from "../../motion/PopIn";
import { colors, radius, shadow, type } from "../../theme";
import { Button, IconButton, Sheet } from "../../ui";
import { GarmentImage } from "../GarmentImage";

export const POPUP_TITLE = "Your first pieces are in!";
export const POPUP_BODY = "Your digital closet has officially started.";

// First 3 Pieces' first success, over the real closet: the user's own new pieces fanned out like prints
// on a table (closet tile rules: cutout, else the generated image, else the crop; no tints). One or two
// pieces count too.
export function FirstPiecesPopup({ visible, items, onExplore, onAddMore, onClose }: {
  visible: boolean; items: ClosetItem[]; onExplore: () => void; onAddMore: () => void; onClose: () => void;
}) {
  const shown = items.slice(0, 3);
  return (
    <Sheet visible={visible} onClose={onClose} floating testID="first-pieces-popup">
      <View style={{ position: "absolute", top: 12, right: 14, zIndex: 1 }}>
        <IconButton icon="close" label="Close" size={30} onPress={onClose} />
      </View>
      <View style={{ height: 150, alignItems: "center" }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {/* A zero-width anchor at the center; each piece sits 70pt from its neighbour, tilted 9° per step. */}
        <View style={{ width: 0, height: 150 }}>
          {shown.map((item, i) => {
            const k = i - (shown.length - 1) / 2;
            return (
              <PopIn key={item.item_id} delay={i * 120} style={{ position: "absolute", top: 8, left: k * 70 - 48 }}>
                <View testID={`popup-${item.item_id}`}
                  style={{ width: 96, height: 118, borderRadius: 18, borderWidth: 3, borderColor: colors.card, backgroundColor: colors.tile,
                           transform: [{ rotate: `${k * 9}deg` }], ...shadow.lift }}>
                  <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
                    style={{ flex: 1, borderRadius: 15, backgroundColor: colors.tile }} />
                </View>
              </PopIn>
            );
          })}
        </View>
      </View>
      <View style={{ gap: 6, alignItems: "center", marginTop: 10 }}>
        <Text accessibilityRole="header" style={{ ...type.display(30), color: colors.label, textAlign: "center" }}>{POPUP_TITLE}</Text>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, textAlign: "center" }}>{POPUP_BODY}</Text>
      </View>
      <View style={{ gap: 6, marginTop: 18 }}>
        <Button title="Explore My Closet" onPress={onExplore} />
        <Button title="Add More" variant="text" onPress={onAddMore} />
      </View>
    </Sheet>
  );
}
