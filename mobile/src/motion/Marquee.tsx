import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "../useReducedMotion";

type Props<T> = {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemWidth: number;
  gap?: number;
  speed?: number;      // points per second; slow on purpose
  reverse?: boolean;
  testID?: string;
};

// An endless, slow drift of garments. The list is repeated until one copy is wider than the
// screen, then doubled so the loop wraps seamlessly. Touch pauses it; Reduce Motion keeps it still.
export function Marquee<T>({ items, renderItem, itemWidth, gap = 10, speed = 18, reverse, testID }: Props<T>) {
  const { width: screen } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const x = useRef(new Animated.Value(0)).current;

  const unit = itemWidth + gap;
  const copies = items.length ? Math.max(1, Math.ceil(screen / (unit * items.length))) : 0;
  const one = useMemo(() => Array.from({ length: copies }, () => items).flat(), [items, copies]);
  const span = one.length * unit;

  useEffect(() => {
    if (reduced || paused || !span) return;
    x.setValue(reverse ? -span : 0);
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: reverse ? 0 : -span,
        duration: (span / speed) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [x, span, speed, reverse, reduced, paused]);

  if (!items.length) return null;
  const track = [...one, ...one];
  return (
    <Pressable testID={testID} onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)} style={{ overflow: "hidden" }}>
      <Animated.View
        testID={testID ? `${testID}-track` : "marquee-track"}
        style={{ flexDirection: "row", gap, transform: [{ translateX: reduced ? 0 : x }] }}
      >
        {track.map((item, i) => (
          <View key={i} style={{ width: itemWidth }}>{renderItem(item, i % items.length)}</View>
        ))}
      </Animated.View>
    </Pressable>
  );
}
