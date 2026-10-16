import React from "react";
import { Pressable, Text, View } from "react-native";
import { TierBadge } from "./TierBadge";
import { ColorSwatches } from "./ColorSwatches";
import { GarmentImage } from "./GarmentImage";
import type { RunItem, ClosetItem } from "../api/types";
import { asList, capitalize, colors, fonts } from "../theme";

export function ItemCard({ item, onPress }: { item: RunItem | ClosetItem; onPress?: () => void }) {
  const retakeInstruction = "retake_instruction" in item ? item.retake_instruction : null;
  const pattern = capitalize(asList(item.facts.pattern.value).join(", "));
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} style={{ width: "100%", aspectRatio: 1 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.ink, flexShrink: 1 }}>
          {capitalize(asList(item.facts.category.value)[0] ?? "Item")}
        </Text>
        <TierBadge tier={item.tier} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
        <ColorSwatches value={item.facts.colors.value} size={10} />
        {pattern ? <Text style={{ color: colors.muted, fontSize: 13 }}>· {pattern}</Text> : null}
      </View>
      {retakeInstruction ? (
        <View style={{ marginTop: 12, backgroundColor: colors.dangerBg, borderRadius: 14, padding: 12 }}>
          <Text style={{ color: colors.danger, fontSize: 14 }}>Retake: {retakeInstruction}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
