import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { colors, type } from "../theme";
import { useReducedMotion } from "../useReducedMotion";

export type ProcessingStep = { label: string; at: number };  // `at`: seconds since start

type Props = {
  steps: ProcessingStep[];
  note: string;
  // Roughly how long the whole job takes; the bar eases toward 90% over this time.
  estimateSeconds?: number;
};

// Long server work (15-60s) with nothing to show: name the stage we're probably in and
// keep a calm bar moving, so the wait reads as progress rather than a hang.
export function ProcessingStatus({ steps, note, estimateSeconds = 45 }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (reduced) return;
    // Exponential ease-out: quick early movement, then it creeps — never claims "done".
    const anim = Animated.timing(progress, {
      toValue: 0.9,
      duration: estimateSeconds * 1000,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, estimateSeconds, reduced]);

  const current = [...steps].reverse().find((s) => elapsed >= s.at) ?? steps[0];

  return (
    <View style={{ alignItems: "center", gap: 14, width: "100%", paddingHorizontal: 24 }}>
      <Text style={{ ...type.headline, color: colors.label, textAlign: "center" }}>
        {current.label}
      </Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={current.label}
        style={{ width: "70%", height: 2, borderRadius: 1, backgroundColor: colors.separator, overflow: "hidden" }}
      >
        {reduced ? null : (
          <Animated.View
            style={{
              height: 2,
              width: "100%",
              backgroundColor: colors.tint,
              transformOrigin: "left",
              transform: [{ scaleX: progress }],
            }}
          />
        )}
      </View>
      {note ? <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>{note}</Text> : null}
    </View>
  );
}

export const CAPTURE_STEPS: ProcessingStep[] = [
  { label: "Finding your pieces", at: 0 },
  { label: "Smoothing them out", at: 6 },
  { label: "Cutting them out", at: 22 },
];

export const BACK_STEPS: ProcessingStep[] = [
  { label: "Reading the back", at: 0 },
  { label: "Pressing it flat", at: 5 },
  { label: "Cutting it out", at: 16 },
];

export const KEEP_OPEN = "Keep the app open — this can take up to a minute.";
