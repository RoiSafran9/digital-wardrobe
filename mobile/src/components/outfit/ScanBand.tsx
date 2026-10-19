import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useReducedMotion } from "../../useReducedMotion";

// A soft accent band sweeping down and up the photo while garments are found (2.4s loop).
// Still under Reduce Motion: a faint wash instead.
export function ScanBand() {
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced || !height) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(t, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced, height, t]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setHeight(e.nativeEvent.layout.height)} testID="scan-band">
      {reduced ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(31,107,255,0.08)" }]} />
      ) : (
        <Animated.View style={{ position: "absolute", left: 0, right: 0, height: 90, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-45, Math.max(0, height - 45)] }) }] }}>
          <LinearGradient colors={["rgba(31,107,255,0)", "rgba(31,107,255,0.22)", "rgba(31,107,255,0)"]} style={{ flex: 1 }} />
        </Animated.View>
      )}
    </View>
  );
}
