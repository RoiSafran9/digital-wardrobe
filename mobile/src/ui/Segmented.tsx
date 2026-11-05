import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { haptics } from "../haptics";
import { colors, radius, type, weight } from "../theme";
import { useReducedMotion } from "../useReducedMotion";
import { Glass } from "./Glass";

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  glass?: boolean;  // a floating glass track (over an image) instead of the soft fill
};

const PAD = 3;

// A capsule segmented control: the selected segment is a white pill that springs to the choice
// (a plain 200ms slide under Reduce Motion).
export function Segmented<T extends string>({ options, value, onChange, glass = false }: Props<T>) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    const anim = reduced
      ? Animated.timing(x, { toValue: index, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true })
      : Animated.spring(x, { toValue: index, damping: 14, stiffness: 180, mass: 1, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [index, reduced, x]);
  const segment = width ? (width - PAD * 2) / options.length : 0;
  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: "row", backgroundColor: glass ? undefined : colors.fill, borderRadius: radius.pill, padding: PAD }}
    >
      {glass ? <Glass radius={radius.pill} level="base" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
      {segment ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute", top: PAD, bottom: PAD, left: PAD, width: segment, borderRadius: radius.pill, backgroundColor: colors.card,
            shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4,
            transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, segment] }) }],
          }}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(o.value);
            }}
            style={{ flex: 1, minHeight: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, paddingHorizontal: 6 }}
          >
            <Text numberOfLines={1} style={{ ...type.subhead, ...weight(selected ? 600 : 500), color: colors.label }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
