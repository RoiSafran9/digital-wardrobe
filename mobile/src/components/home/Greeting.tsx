import React from "react";
import { Text, View } from "react-native";
import { CreditPill } from "../../ui";
import { colors, type } from "../../theme";

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

// Home's header: the greeting (with the name chosen at sign-up) as an eyebrow, the piece count as the
// headline, and the glass balance pill.
export function Greeting({ now, onCredits, name, count = null }: { now: Date; onCredits: () => void; name?: string | null; count?: number | null }) {
  const greeting = name ? `${greetingFor(now.getHours())}, ${name}` : greetingFor(now.getHours());
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 4 }}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ ...type.eyebrow, color: colors.secondaryLabel }}>{greeting}</Text>
        {count !== null ? (
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 4 }} accessible accessibilityLabel={`${count} ${count === 1 ? "piece" : "pieces"}`}>
            <Text style={{ ...type.hero, color: colors.label }}>{count}</Text>
            <Text style={{ ...type.title2, color: colors.secondaryLabel }}>{count === 1 ? "piece" : "pieces"}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ marginBottom: 10 }}><CreditPill onPress={onCredits} /></View>
    </View>
  );
}
