import React, { useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
};

export function PillButton({ label, onPress, variant = "secondary", icon, disabled }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const primary = variant === "primary";
  const fg = primary ? colors.paper : colors.ink;

  // Quick press-in, springy release: feels tactile without drawing attention.
  const pressTo = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: value === 1 ? 6 : 0 }).start();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => pressTo(0.97)}
      onPressOut={() => pressTo(1)}
      disabled={disabled}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          opacity: disabled ? 0.5 : 1,
          backgroundColor: primary ? colors.ink : "transparent",
          borderWidth: primary ? 0 : 1,
          borderColor: colors.lineStrong,
          borderRadius: radius.pill,
          paddingVertical: 15,
          paddingHorizontal: 20,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: 15, fontWeight: "500" }}>{label}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}
