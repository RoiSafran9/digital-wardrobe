import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TierBadge } from "./TierBadge";
import { ColorSwatches } from "./ColorSwatches";
import { GarmentImage } from "./GarmentImage";
import { PillButton } from "./PillButton";
import { RetakeNote } from "./RetakeNote";
import type { RunItem, ClosetItem } from "../api/types";
import { useAddBack } from "../useAddBack";
import { asList, capitalize, colors, fonts } from "../theme";

type Props = {
  item: RunItem | ClosetItem;
  onPress?: () => void;
  // When given (and the item is addressable), the card offers adding a back photo.
  onUpdated?: (item: ClosetItem) => void;
};

function addressable(item: RunItem | ClosetItem): item is ClosetItem {
  return "run_id" in item && "photo_name" in item;
}

export function ItemCard({ item, onPress, onUpdated }: Props) {
  const retakeInstruction = "retake_instruction" in item ? item.retake_instruction : null;
  const pattern = capitalize(asList(item.facts.pattern.value).join(", "));
  const target = onUpdated && addressable(item) ? item : null;
  const { ask, uploading, error } = useAddBack(target, onUpdated);
  const hasBack = target !== null && !!target.back;

  return (
    <View>
      <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} style={{ width: "100%", aspectRatio: 1 }} />
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
        {retakeInstruction ? <RetakeNote tier={item.tier} text={retakeInstruction} /> : null}
      </Pressable>

      {target ? (
        <View style={{ marginTop: 12 }}>
          {hasBack ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="checkmark-circle" size={16} color={colors.inkSoft} />
              <Text style={{ color: colors.inkSoft, fontSize: 13 }}>Back added</Text>
            </View>
          ) : uploading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}>
              <ActivityIndicator color={colors.ink} />
              <Text style={{ color: colors.inkSoft, fontSize: 14 }}>Pressing the back… up to a minute</Text>
            </View>
          ) : (
            <PillButton label="Add back photo" icon="camera-reverse-outline" onPress={ask} />
          )}
          {error ? <Text style={{ color: colors.danger, fontSize: 14, marginTop: 8 }}>{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
