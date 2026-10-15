import React from "react";
import { Image, Text, View } from "react-native";
import { TierBadge } from "./TierBadge";
import { imageUrl } from "../api/client";
import type { RunItem, ClosetItem } from "../api/types";

function factText(value: string | string[]): string {
  return Array.isArray(value) ? value.join(", ") : value;
}

export function ItemCard({ item }: { item: RunItem | ClosetItem }) {
  const retakeInstruction = "retake_instruction" in item ? item.retake_instruction : null;
  return (
    <View style={{ padding: 12, borderWidth: 1, borderColor: "#ddd", borderRadius: 8 }}>
      <Image source={{ uri: imageUrl(item.generated_url) }} style={{ width: "100%", height: 200 }} resizeMode="contain" />
      <TierBadge tier={item.tier} />
      <Text>Category: {factText(item.facts.category.value)}</Text>
      <Text>Colors: {factText(item.facts.colors.value)}</Text>
      <Text>Pattern: {factText(item.facts.pattern.value)}</Text>
      {retakeInstruction ? <Text style={{ color: "#c62828" }}>Retake: {retakeInstruction}</Text> : null}
    </View>
  );
}
