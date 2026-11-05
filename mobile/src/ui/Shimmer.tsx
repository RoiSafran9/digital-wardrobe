import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReducedMotion } from "../useReducedMotion";

// A soft light sweep across a placeholder while AI work runs, sized to the placeholder (a small thumbnail
// gets a sweep, not a pulse). Off under Reduce Motion.
export function Shimmer({ active = true }: { active?: boolean }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
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
    <View pointerEvents="none" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      {width ? <Animated.View
        style={{
          position: "absolute", top: 0, bottom: 0, width: width * 0.6,
          backgroundColor: "rgba(255,255,255,0.5)",
          transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.6, width] }) }, { skewX: "-12deg" }],
        }}
      /> : null}
    </View>
  );
}
