import React, { useRef } from "react";
import { Animated, Pressable, type AccessibilityRole, type AccessibilityState, type Insets, type StyleProp, type ViewStyle } from "react-native";
import { EASE_OUT } from "./Rise";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  hitSlop?: Insets;
  scaleTo?: number;
};

// Every tappable card: lands at 0.97 in 100ms, springs back with only a hint of bounce.
export function PressScale({ children, onPress, disabled, style, testID, accessibilityLabel, accessibilityRole, accessibilityState, hitSlop, scaleTo = 0.97 }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      onPressIn={() => Animated.timing(scale, { toValue: scaleTo, duration: 100, easing: EASE_OUT, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, speed: 30, bounciness: 4, useNativeDriver: true }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
