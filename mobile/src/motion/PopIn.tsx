import React, { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { SHEET_EASE } from "../ui/Sheet";
import { useReducedMotion } from "../useReducedMotion";

type Props = { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle>; testID?: string };

// The handoff's pop-in: from 90% and 8pt low to rest, 0.6s, staggered by the caller (0.12s steps).
// Starts at 0.4 opacity like Rise, never from nothing. Reduce Motion keeps only the fade.
export function PopIn({ children, delay = 0, style, testID }: Props) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(t, { toValue: 1, duration: 600, delay, easing: SHEET_EASE, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [t, delay]);
  return (
    <Animated.View
      testID={testID}
      style={[style, {
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
        transform: reduced
          ? [{ translateY: 0 }, { scale: 1 }]
          : [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }, { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}
