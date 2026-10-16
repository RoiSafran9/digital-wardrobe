import React, { useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { colors, radius, type } from "../theme";
import { EASE_OUT } from "../motion/Rise";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  icon?: IconName;
  disabled?: boolean;
};

export function PillButton({ label, onPress, variant = "secondary", icon, disabled }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const primary = variant === "primary";
  const fg = primary ? colors.onTint : colors.tint;

  // Press lands at once (100ms); release springs back with only a hint of bounce.
  const pressIn = () => Animated.timing(scale, { toValue: 0.97, duration: 100, easing: EASE_OUT, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          opacity: disabled ? 0.5 : 1,
          backgroundColor: primary ? colors.tint : colors.card,
          borderRadius: radius.card,
          paddingVertical: 15,
          paddingHorizontal: 20,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <Text style={{ ...type.headline, color: fg }}>{label}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}
