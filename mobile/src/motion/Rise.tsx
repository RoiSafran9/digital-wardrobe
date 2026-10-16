import React, { useEffect, useRef } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "../useReducedMotion";

// Strong ease-out: moves at once, settles softly.
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

type Props = { children: React.ReactNode; delay?: number; distance?: number; style?: StyleProp<ViewStyle>; testID?: string };

// Content rises into place. Starts nearly visible (opacity 0.4), never from nothing.
export function Rise({ children, delay = 0, distance = 12, style, testID }: Props) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(t, { toValue: 1, duration: 320, delay, easing: EASE_OUT, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [t, delay]);
  const move = reduced ? 0 : distance;
  return (
    <Animated.View
      testID={testID}
      style={[style, {
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
        transform: [{ translateY: move ? t.interpolate({ inputRange: [0, 1], outputRange: [move, 0] }) : 0 }],
      }]}
    >
      {children}
    </Animated.View>
  );
}
