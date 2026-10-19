import React from "react";
import { Pressable, Text } from "react-native";
import { Icon } from "../components/Icon";
import { colors, hitSlopFor, type } from "../theme";

// "‹ Back" at the top of a flow screen.
export function BackButton({ onPress, label = "Back" }: { onPress: () => void; label?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlopFor(28, 60)}
      style={{ flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", height: 28 }}
    >
      <Icon name="chevronLeft" size={20} color={colors.tint} />
      <Text style={{ ...type.body, color: colors.tint }}>{label}</Text>
    </Pressable>
  );
}
