import React from "react";
import { Pressable, Text, View } from "react-native";
import { haptics } from "../haptics";
import { colors, radius, type } from "../theme";

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

// iOS segmented control: a fill track with the selected segment lifted onto a card.
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: colors.fill, borderRadius: radius.segment + 2, padding: 2 }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(o.value);
            }}
            style={{
              flex: 1, minHeight: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.segment,
              backgroundColor: selected ? colors.card : "transparent",
              ...(selected ? { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 1.5 } : null),
            }}
          >
            <Text style={{ ...type.subhead, fontWeight: selected ? "600" : "500", color: colors.label }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
