import React, { useEffect, useRef } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "../useReducedMotion";

// The camera buttons breathe: 1 → 1.04 → 1 over 3s, forever. Still under Reduce Motion.
export function Breathe({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const half = { duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true };
    const loop = Animated.loop(Animated.sequence([Animated.timing(t, { ...half, toValue: 1 }), Animated.timing(t, { ...half, toValue: 0 })]));
    loop.start();
    return () => loop.stop();
  }, [reduced, t]);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

// A gentle hover for the garments on the Build My Look card: 0 → −8pt, 2.6s, back and forth, each one
// starting `delay` later. Still under Reduce Motion.
export function Float({ children, style, delay = 0 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const leg = { duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true };
    const loop = Animated.loop(Animated.sequence([Animated.timing(t, { ...leg, toValue: 1 }), Animated.timing(t, { ...leg, toValue: 0 })]));
    const timer = setTimeout(() => loop.start(), delay);
    return () => { clearTimeout(timer); loop.stop(); };
  }, [reduced, t, delay]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  return <Animated.View style={[style, { transform: [{ translateY }] }]}>{children}</Animated.View>;
}
