import React, { useRef } from "react";
import { Animated, Pressable, type AccessibilityRole, type Insets, type StyleProp, type ViewStyle } from "react-native";
import { EASE_OUT } from "./Rise";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  hitSlop?: Insets;
};

// Every tappable card: lands at 0.97 in 100ms, springs back with only a hint of bounce.
export function PressScale({ children, onPress, disabled, style, testID, accessibilityLabel, accessibilityRole, hitSlop }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      onPressIn={() => Animated.timing(scale, { toValue: 0.97, duration: 100, easing: EASE_OUT, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, speed: 30, bounciness: 4, useNativeDriver: true }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
