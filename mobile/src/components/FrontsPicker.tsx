import React from "react";
import { Pressable, Text, View } from "react-native";
import { ASK_FOR_MORE, creditsLabel } from "../credits/credits";
import type { FrontsChoice } from "../credits/useFrontsChoice";
import { colors, hitSlopFor, radius, type } from "../theme";
import { Icon } from "./Icon";

// "Pieces in this photo": the front images the user agrees to pay for before taking the photo.
// Shown only while billing is on.
export function FrontsPicker({ choice }: { choice: FrontsChoice }) {
  if (!choice.active) return null;
  const { fronts, max, price, available, setFronts, blocked } = choice;

  if (blocked) {
    return (
      <View style={{ backgroundColor: colors.destructiveBg, borderRadius: 14, padding: 12 }}>
        <Text style={{ ...type.subhead, color: colors.destructive }}>
          Not enough AI credits for a photo ({creditsLabel(price)} per piece, {available} available). {ASK_FOR_MORE}
        </Text>
      </View>
    );
  }

  const step = (label: string, icon: "add" | "remove", enabled: boolean, next: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => setFronts(next)}
      hitSlop={hitSlopFor(36, 36)}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.tile, alignItems: "center",
               justifyContent: "center", opacity: enabled ? 1 : 0.5 }}
    >
      <Icon name={icon} size={16} color={colors.tint} />
    </Pressable>
  );

  return (
    <View style={{ backgroundColor: colors.grouped, borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...type.body, color: colors.label }}>Pieces in this photo</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {step("Fewer pieces", "remove", fronts > 1, fronts - 1)}
          <Text accessibilityLabel={`${fronts} pieces`} style={{ ...type.headline, color: colors.label, fontVariant: ["tabular-nums"], minWidth: 22, textAlign: "center" }}>
            {fronts}
          </Text>
          {step("More pieces", "add", fronts < max, fronts + 1)}
        </View>
      </View>
      <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 8 }}>
        Up to {fronts === 1 ? "1 front image" : `${fronts} front images`} · {creditsLabel(fronts * price)} · {available} available.
        You pay only for the pieces made; extra pieces aren't made.
      </Text>
    </View>
  );
}
