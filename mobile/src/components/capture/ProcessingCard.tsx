import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { Icon } from "../Icon";
import { colors, radius, shadow, type } from "../../theme";
import { ProgressBar, Shimmer } from "../../ui";
import { useReducedMotion } from "../../useReducedMotion";

export type Stage = { label: string; at: number };  // `at`: seconds since start

export const GARMENT_STAGES: Stage[] = [
  { label: "Finding each garment", at: 0 },
  { label: "Separating the pieces", at: 6 },
  { label: "Laying them flat", at: 14 },
  { label: "Adding final details", at: 32 },
];

// Long server work with nothing to show yet: the photo comes into focus as time passes, the stage
// list advances on a timed script, and the bar eases toward 90% — it never claims to be done.
export function ProcessingCard({ photoUri, stages, title, estimateSeconds = 45, startedAt, note }: {
  photoUri: string; stages: Stage[]; title: string; estimateSeconds?: number; startedAt: number; note: string;
}) {
  const reduced = useReducedMotion();
  const [elapsed, setElapsed] = useState((Date.now() - startedAt) / 1000);
  useEffect(() => {
    const timer = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 500);
    return () => clearInterval(timer);
  }, [startedAt]);
  const current = Math.max(0, stages.reduce((i, s, k) => (elapsed >= s.at ? k : i), 0));
  const progress = 0.9 * (1 - Math.exp(-3 * elapsed / estimateSeconds));
  const blur = Math.max(0, 1 - elapsed / estimateSeconds);

  return (
    <View style={{ alignItems: "center", gap: 22 }}>
      <View style={{ width: 230, height: 288, borderRadius: radius.feature, backgroundColor: colors.tile, overflow: "hidden", ...shadow.tile }}>
        <Image source={{ uri: photoUri }} style={{ position: "absolute", width: "100%", height: "100%" }} resizeMode="cover" />
        <Image source={{ uri: photoUri }} blurRadius={18} style={{ position: "absolute", width: "100%", height: "100%", opacity: blur }} resizeMode="cover" />
        <Shimmer />
      </View>
      <View style={{ alignItems: "center", gap: 10 }}>
        <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>{`${stages[current].label}…`}</Text>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{title}</Text>
        {reduced ? null : (
          <View style={{ width: 260 }}>
            <ProgressBar value={progress} height={6} accessibilityLabel={stages[current].label} />
          </View>
        )}
      </View>
      <View style={{ gap: 12, alignSelf: "stretch", paddingHorizontal: 40 }}>
        {stages.map((s, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <View key={s.label} style={{ flexDirection: "row", alignItems: "center", gap: 12 }} accessibilityLabel={`${s.label}${done ? ", done" : now ? ", in progress" : ""}`} accessible>
              <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: done ? colors.success : "transparent", borderWidth: done ? 0 : 2, borderColor: now ? colors.fill : colors.fill }}>
                {done ? <Icon name="checkmark" size={12} color="#FFFFFF" /> : now ? <ActivityIndicator size="small" color={colors.tint} /> : null}
              </View>
              <Text style={{ ...type.body, color: i <= current ? colors.label : colors.secondaryLabel }}>{s.label}</Text>
            </View>
          );
        })}
      </View>
      <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center", paddingHorizontal: 32 }}>{note}</Text>
    </View>
  );
}
