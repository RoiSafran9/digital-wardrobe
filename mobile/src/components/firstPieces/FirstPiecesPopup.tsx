import React from "react";
import { Pressable, Text, View } from "react-native";
import type { ClosetItem } from "../../api/types";
import { garmentName } from "../../garmentName";
import { PopIn } from "../../motion/PopIn";
import { colors, hitSlopFor, type } from "../../theme";
import { Button, Sheet } from "../../ui";
import { GarmentTile } from "../GarmentTile";
import { Icon } from "../Icon";

export const POPUP_TITLE = "Your first pieces are in!";
export const POPUP_BODY = "Your digital closet has officially started.";
const FAN = [-8, 0, 8];

// First 3 Pieces' first success, over the real closet: the user's own new pieces fanned out (closet tile
// rules: cutout, else the generated image, else the crop; no tints). One or two pieces count too.
export function FirstPiecesPopup({ visible, items, onExplore, onAddMore, onClose }: {
  visible: boolean; items: ClosetItem[]; onExplore: () => void; onAddMore: () => void; onClose: () => void;
}) {
  const shown = items.slice(0, 3);
  return (
    <Sheet visible={visible} onClose={onClose} floating testID="first-pieces-popup">
      <View style={{ alignItems: "flex-end", marginTop: -24 }}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={hitSlopFor(30, 30)}
          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={13} color={colors.label} />
        </Pressable>
      </View>
      <View style={{ height: 170, alignItems: "center", justifyContent: "center" }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {shown.map((item, i) => {
          const rotate = shown.length === 1 ? 0 : FAN[shown.length === 2 ? i * 2 : i];
          return (
            <PopIn key={item.item_id} delay={i * 120} style={{ position: "absolute", transform: [{ translateX: rotate * 9 }, { rotate: `${rotate}deg` }] }}>
              <View testID={`popup-${item.item_id}`}><GarmentTile item={item} width={104} height={130} rounded={18} label={garmentName(item)} /></View>
            </PopIn>
          );
        })}
      </View>
      <View style={{ gap: 6, alignItems: "center", marginTop: 8 }}>
        <Text accessibilityRole="header" style={{ ...type.pageTitle, color: colors.label, textAlign: "center" }}>{POPUP_TITLE}</Text>
        <Text style={{ ...type.body, color: colors.secondaryLabel, textAlign: "center" }}>{POPUP_BODY}</Text>
      </View>
      <View style={{ gap: 6, marginTop: 20 }}>
        <Button title="Explore My Closet" onPress={onExplore} />
        <Button title="Add More" variant="text" onPress={onAddMore} />
      </View>
    </Sheet>
  );
}
