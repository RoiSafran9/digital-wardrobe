import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { Icon } from "../Icon";
import { colors, radius, type, weight } from "../../theme";
import { Glass, ProgressBar, Shimmer } from "../../ui";
import { useReducedMotion } from "../../useReducedMotion";
import { PHOTO_BG } from "./FlowChrome";

export type Stage = { label: string; at: number };  // `at`: seconds since start

export const GARMENT_STAGES: Stage[] = [
  { label: "Finding each garment", at: 0 },
  { label: "Separating the pieces", at: 6 },
  { label: "Laying them flat", at: 14 },
  { label: "Adding final details", at: 32 },
];

// Long server work with nothing to show yet: the photo comes into focus as time passes, the stage
// list advances on a timed script, and the bar eases toward 90% — it never claims to be done.
// Laid out like the handoff's processing screen: the photo panel, the stage as a title, the bar, then a
// glass checklist (done = green check, current = spinner, pending = empty ring).
export function ProcessingCard({ photoUri, stages, title, estimateSeconds = 45, startedAt, note, count }: {
  photoUri: string; stages: Stage[]; title: string; estimateSeconds?: number; startedAt: number; note: string;
  count?: { done: number; total: number };  // real per-piece progress from the server, when known
}) {
  const reduced = useReducedMotion();
  const [elapsed, setElapsed] = useState((Date.now() - startedAt) / 1000);
  useEffect(() => {
    const timer = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 500);
    return () => clearInterval(timer);
  }, [startedAt]);
  const current = Math.max(0, stages.reduce((i, s, k) => (elapsed >= s.at ? k : i), 0));
  // Real progress when the server reports it, never past 90% until the work is actually done.
  const timed = 0.9 * (1 - Math.exp(-3 * elapsed / estimateSeconds));
  const progress = count && count.total > 0 ? Math.max(timed, 0.9 * (count.done / count.total)) : timed;
  const blur = Math.max(0, 1 - elapsed / estimateSeconds);

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <View style={{ height: 300, borderRadius: radius.hero, backgroundColor: PHOTO_BG, overflow: "hidden" }}>
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <Image source={{ uri: photoUri }} blurRadius={18} style={[StyleSheet.absoluteFill, { opacity: blur }]} resizeMode="cover" />
        <Shimmer />
        {count && count.total > 0 ? (
          <Glass testID="piece-count" radius={radius.pill} level="base" style={{ position: "absolute", top: 12, left: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ ...type.footnote, ...weight(700), color: colors.label, fontVariant: ["tabular-nums"] }}>{`${Math.min(count.done + 1, count.total)} of ${count.total}`}</Text>
          </Glass>
        ) : null}
      </View>

      <Text accessibilityRole="header" style={{ ...type.pageTitle, color: colors.label, marginTop: 18 }}>{`${stages[current].label}…`}</Text>
      <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 4 }}>{title}</Text>
      {reduced ? null : (
        <View style={{ marginTop: 12 }}>
          <ProgressBar value={progress} height={8} accessibilityLabel={stages[current].label} />
        </View>
      )}

      <Glass radius={radius.tile} style={{ marginTop: 16, paddingHorizontal: 16, paddingVertical: 6 }}>
        {stages.map((s, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <View key={s.label} accessible accessibilityLabel={`${s.label}${done ? ", done" : now ? ", in progress" : ""}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: colors.separator }}>
              <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
                {done ? <Icon name="check" size={20} color={colors.success} />
                  : now ? <ActivityIndicator size="small" color={colors.tint} />
                  : <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.separatorStrong }} />}
              </View>
              <Text style={{ ...type.callout, color: i <= current ? colors.label : colors.secondaryLabel }}>{s.label}</Text>
            </View>
          );
        })}
      </Glass>
      <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center", marginTop: 14, paddingHorizontal: 12 }}>{note}</Text>
    </View>
  );
}
