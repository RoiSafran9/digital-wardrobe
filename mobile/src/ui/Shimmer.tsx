import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "../useReducedMotion";

// A soft light sweep across a placeholder while AI work runs. Off under Reduce Motion.
export function Shimmer({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;
  const on = active && !reduced;
  useEffect(() => {
    if (!on) return;
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [on, t]);
  if (!on) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <Animated.View
        style={{
          position: "absolute", top: 0, bottom: 0, width: width * 0.6,
          backgroundColor: "rgba(255,255,255,0.35)",
          transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.6, width] }) }, { skewX: "-12deg" }],
        }}
      />
    </View>
  );
}
