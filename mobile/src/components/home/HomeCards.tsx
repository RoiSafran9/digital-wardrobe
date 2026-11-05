import React from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import type { ClosetItem } from "../../api/types";
import { GarmentImage } from "../GarmentImage";
import { garmentName } from "../../garmentName";
import { Icon, type IconName } from "../Icon";
import { Breathe, Float } from "../../motion/Breathe";
import { PressScale } from "../../motion/PressScale";
import { Glass } from "../../ui";
import { colors, radius, shadow, type, weight } from "../../theme";

// A garment on its stone tile with a 2pt white border, for the small fans on Home's cards. The image
// itself is never tinted; the border and shadow belong to the tile.
export function FanPiece({ item, width, height, style }: { item: ClosetItem; width: number; height: number; style?: ViewStyle }) {
  return (
    <View style={[{ width, height, borderRadius: radius.image, borderWidth: 2, borderColor: "#FFFFFF", backgroundColor: colors.tile, ...shadow.lift }, style]}>
      <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
        style={{ flex: 1, borderRadius: radius.image - 2, backgroundColor: colors.tile }} />
    </View>
  );
}

function HeroButton({ icon, title, label, onPress }: { icon: IconName; title: string; label: string; onPress: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.97}
        style={{ height: 44, borderRadius: radius.button, backgroundColor: "rgba(255,255,255,0.2)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Icon name={icon} size={18} color="#FFFFFF" />
        <Text style={{ ...type.subhead, ...weight(600), color: "#FFFFFF" }}>{title}</Text>
      </PressScale>
    </View>
  );
}

// The blue Add clothes card: garments laid flat (camera, garment mode) or worn (camera, outfit mode,
// only when the server offers outfits). `caption` carries the server's price, if any.
export function AddHero({ caption, onFlat, onWorn }: { caption: string; onFlat: () => void; onWorn?: () => void }) {
  return (
    <Glass blue radius={radius.hero} style={{ marginTop: 10, padding: 14 }}
      decor={<View style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.14)" }} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Breathe style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
          <Icon name="camera" size={24} color={colors.tint} />
        </Breathe>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ ...type.title2, letterSpacing: -0.48, color: "#FFFFFF" }}>Add clothes</Text>
          <Text style={{ ...type.footnote, color: "rgba(255,255,255,0.88)" }}>{caption}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <HeroButton icon="flat" title="Laid flat" label="Add clothes laid flat, opens the camera" onPress={onFlat} />
        {onWorn ? <HeroButton icon="person2" title="Worn" label="Add clothes from an outfit you're wearing, opens the camera" onPress={onWorn} /> : null}
      </View>
    </Glass>
  );
}

const FAN = [
  { right: 86, top: 4, rotate: "-6deg" },
  { right: 44, top: 14, rotate: "7deg" },
  { right: 6, top: 0, rotate: "-2deg" },
];

// Build My Look: a glass card with three of the user's own pieces floating on the right.
export function LookHero({ count, pieces, onPress }: { count: number; pieces: ClosetItem[]; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Build My Look. Outfits from your ${count} ${count === 1 ? "piece" : "pieces"}.`} scaleTo={0.98} style={{ marginTop: 10 }}>
      <Glass radius={radius.hero} style={{ height: 132, padding: 14, flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, paddingLeft: 4, paddingTop: 2, justifyContent: "center" }}>
          <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.tintSoft }}>
            <Icon name="sparkles" size={12} color={colors.tint} />
            <Text style={{ ...type.caption, ...weight(700), color: colors.tint }}>AI stylist</Text>
          </View>
          <Text style={{ ...type.title2, color: colors.label, marginTop: 8 }}>Build My Look</Text>
          <Text style={{ ...type.footnote, color: colors.tabInactive, marginTop: 2 }}>{`Outfits from your ${count} ${count === 1 ? "piece" : "pieces"}`}</Text>
        </View>
        <View style={{ width: 150 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {pieces.slice(0, 3).map((item, k) => (
            <Float key={item.item_id + k} delay={k * 300} style={{ position: "absolute", right: FAN[k].right, top: FAN[k].top, transform: [{ rotate: FAN[k].rotate }] }}>
              <FanPiece item={item} width={68} height={84} />
            </Float>
          ))}
          <View style={{ position: "absolute", right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.label, alignItems: "center", justifyContent: "center" }}>
            <Icon name="arrowRight" size={16} color={colors.background} />
          </View>
        </View>
      </Glass>
    </PressScale>
  );
}

// One glass tile per category group: name, count, and a fan of up to three of its pieces bleeding off
// the bottom-right corner.
export function CategoryTile({ name, items, onPress }: { name: string; items: ClosetItem[]; onPress: () => void }) {
  const fan = items.slice(0, 3);
  return (
    <View style={{ width: "48.6%" }}>
      <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}, ${items.length}`} scaleTo={0.97}>
        <Glass radius={radius.tile} style={{ height: 132, padding: 14 }}
          decor={
            <View style={{ position: "absolute", right: -4, bottom: -12, flexDirection: "row" }}>
              {fan.map((item, k) => (
                <FanPiece key={item.item_id + k} item={item} width={62} height={78}
                  style={{ marginLeft: k ? -30 : 0, transform: [{ rotate: `${(k - (fan.length - 1) / 2) * 9}deg` }, { translateY: k * 4 }] }} />
              ))}
            </View>
          }>
          <Text style={{ ...type.title3, color: colors.label }} numberOfLines={1}>{name}</Text>
          <Text style={{ ...type.subhead, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>{items.length}</Text>
        </Glass>
      </PressScale>
    </View>
  );
}

// New this week: up to four of the newest pieces; tapping one opens its details.
export function NewThisWeek({ items, onOpen }: { items: ClosetItem[]; onOpen: (item: ClosetItem) => void }) {
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 24, marginBottom: 10, paddingHorizontal: 4 }}>
        <Text accessibilityRole="header" style={{ ...type.display(22), color: colors.label }}>New this week</Text>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>{items.length}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {items.slice(0, 4).map((item) => (
          <Pressable key={item.item_id + item.run_id} onPress={() => onOpen(item)} accessibilityRole="button" accessibilityLabel={garmentName(item)}
            style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}>
            <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
              style={{ aspectRatio: 4 / 5, borderRadius: radius.image, backgroundColor: colors.tile }} />
          </Pressable>
        ))}
        {Array.from({ length: Math.max(0, 4 - items.length) }, (_, i) => <View key={`gap${i}`} style={{ flex: 1 }} />)}
      </View>
    </View>
  );
}
