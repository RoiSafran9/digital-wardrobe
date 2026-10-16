import React, { useEffect, useRef } from "react";
import { Animated, Easing, type ViewStyle } from "react-native";
import { useReducedMotion } from "../useReducedMotion";

// Strong ease-out (≈ cubic-bezier(0.23, 1, 0.32, 1)): moves immediately, settles softly.
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

type Props = {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  offset?: number;  // starting translateY in px; dropped under Reduce Motion
  scaleFrom?: number;  // starting scale; dropped under Reduce Motion
  style?: ViewStyle;
  testID?: string;
};

// Entrance for content that appears in place of something else (side switch, edit mode,
// a collection laying itself out). Starts nearly visible — never from nothing.
export function FadeIn({ children, delay = 0, duration = 200, offset = 0, scaleFrom = 1, style, testID }: Props) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, { toValue: 1, duration, delay, easing: EASE_OUT, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [progress, duration, delay]);

  const move = reduced ? 0 : offset;
  const scale = reduced ? 1 : scaleFrom;
  return (
    <Animated.View
      testID={testID}
      style={[
        style,
        {
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
          transform: move
            ? [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [move, 0] }) }]
            : scale !== 1
              ? [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) }]
              : [{ translateY: 0 }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
