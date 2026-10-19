import React from "react";
import { Text, View } from "react-native";
import { Icon } from "./Icon";
import { colors, radius, type } from "../theme";

export function ErrorNote({ message }: { message: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: colors.destructiveBg, borderRadius: radius.button, padding: 12 }}>
      <Icon name="alert" size={18} color={colors.destructive} />
      <Text style={{ ...type.subhead, color: colors.destructive, flex: 1 }}>{message}</Text>
    </View>
  );
}
