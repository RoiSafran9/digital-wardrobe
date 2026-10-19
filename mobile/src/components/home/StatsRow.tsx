import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CountUp } from "../../motion/CountUp";
import { colors, type } from "../../theme";

// Three numbers divided by hairlines: Pieces / Categories / New this week.
export function StatsRow({ stats }: { stats: { label: string; value: number }[] }) {
  return (
    <View style={{ flexDirection: "row", marginHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.separator }}>
      {stats.map(({ label, value }, i) => (
        <View
          key={label}
          accessible
          accessibilityLabel={`${label}, ${value}`}
          style={{ flex: 1, paddingVertical: 14, paddingLeft: i ? 14 : 0, borderLeftWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: colors.separator }}
        >
          <CountUp value={value} style={{ ...type.stat, color: colors.label }} />
          <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 2 }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}
