import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useCredits } from "../credits/CreditsProvider";
import { BILLING_OFF } from "../credits/credits";
import { colors, radius, type } from "../theme";
import { CreditsSheet, type CreditsSheetMode } from "./CreditsSheet";
import { Icon } from "./Icon";

// Account → AI Credits: what's available, what's held for running work, and an honest
// "used X of Y granted" (never a bare percentage, since grants can be topped up).
export function CreditsCard() {
  const { billing, credits } = useCredits();
  const [sheet, setSheet] = useState<CreditsSheetMode | null>(null);
  if (!credits) return null;

  const usedShare = credits.granted > 0 ? Math.min(1, credits.used / credits.granted) : 0;
  const row = (label: string, mode: CreditsSheetMode) => (
    <Pressable accessibilityRole="button" onPress={() => setSheet(mode)}
               style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12,
                        borderTopWidth: 0.5, borderTopColor: colors.separator }}>
      <Text style={{ ...type.body, color: colors.label }}>{label}</Text>
      <Icon name="chevron" size={14} color={colors.secondaryLabel} />
    </Pressable>
  );

  return (
    <View style={{ backgroundColor: colors.grouped, borderRadius: radius.card, paddingHorizontal: 16, paddingTop: 14, marginBottom: 20 }}>
      <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>AI Credits</Text>
      <Text accessibilityLabel={`${credits.available} AI credits available`}
            style={{ ...type.title2, color: colors.label, fontVariant: ["tabular-nums"], marginTop: 2 }}>
        {credits.available} available
      </Text>
      {credits.held > 0 ? (
        <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 2 }}>
          {credits.held} held for work in progress
        </Text>
      ) : null}
      {credits.granted > 0 ? (
        <View style={{ marginTop: 12 }}>
          <View style={{ height: 2, borderRadius: 1, backgroundColor: colors.separator }}>
            <View style={{ height: 2, borderRadius: 1, backgroundColor: colors.tint, width: `${usedShare * 100}%` }} />
          </View>
          <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 6, fontVariant: ["tabular-nums"] }}>
            Used {credits.used} of {credits.granted} credits granted
          </Text>
        </View>
      ) : null}
      {!billing ? <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 8 }}>{BILLING_OFF}</Text> : null}
      <View style={{ marginTop: 10 }}>
        {billing ? row("AI Price List", "prices") : null}
        {row("Credit activity", "activity")}
      </View>
      <CreditsSheet mode={sheet} onClose={() => setSheet(null)} />
    </View>
  );
}
