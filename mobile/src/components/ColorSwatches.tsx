import React from "react";
import { Text, View } from "react-native";
import { asList, capitalize, colors, swatchFor, type } from "../theme";

export function ColorSwatches({ value, size = 12 }: { value: string | string[]; size?: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {asList(value).map((name) => (
        <View key={name} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View
            style={{
              width: size, height: size, borderRadius: size / 2,
              backgroundColor: swatchFor(name), borderWidth: 1, borderColor: colors.separatorStrong,
            }}
          />
          <Text style={{ ...type.footnote, color: colors.label }}>{capitalize(name)}</Text>
        </View>
      ))}
    </View>
  );
}
