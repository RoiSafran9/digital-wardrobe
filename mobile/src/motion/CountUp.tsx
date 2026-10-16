import React, { useEffect, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useReducedMotion } from "../useReducedMotion";

// A number that counts up once (ease-out), so the closet feels like it's being tallied.
export function CountUp({ value, duration = 600, style, testID }: { value: number; duration?: number; style?: StyleProp<TextStyle>; testID?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) { setShown(value); return; }
    const start = Date.now();
    const timer = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration, reduced]);
  return <Text testID={testID} style={[{ fontVariant: ["tabular-nums"] }, style]}>{shown}</Text>;
}
