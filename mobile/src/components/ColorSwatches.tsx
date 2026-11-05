import React from "react";
import { Text, View, type ColorValue } from "react-native";
import { asList, capitalize, colors, radius, swatchFor, type } from "../theme";

type ChipProps = {
  label: string;  // what VoiceOver reads, e.g. "Pattern: Solid"
  text: string;
  prefix?: string;  // a quiet lead-in inside the chip, e.g. "Back"
  dot?: ColorValue;  // a 12pt swatch before the text
};

// One fact about a garment as a white 32pt chip (the item screen's facts row). The chip carries its
// field name for VoiceOver, so it needs no visible one.
export function FactChip({ label, text, prefix, dot }: ChipProps) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 32, maxWidth: "100%", paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.card }}
    >
      {dot ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dot, borderWidth: 1, borderColor: colors.separator }} /> : null}
      {prefix ? <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{prefix}</Text> : null}
      <Text numberOfLines={1} style={{ ...type.subhead, color: colors.label, flexShrink: 1 }}>{text}</Text>
    </View>
  );
}

// The garment's colors, one chip each with a dot of its swatch. Returned bare so they wrap in the same
// row as the other fact chips.
export function ColorSwatches({ value }: { value: string | string[] }) {
  return (
    <>
      {asList(value).map((name) => (
        <FactChip key={name} label={`Color: ${capitalize(name)}`} text={capitalize(name)} dot={swatchFor(name)} />
      ))}
    </>
  );
}
