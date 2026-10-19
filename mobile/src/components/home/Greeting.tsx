import React from "react";
import { Text, View } from "react-native";
import { CreditPill } from "../../ui";
import { colors, type } from "../../theme";

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

export function dateEyebrow(now: Date): string {
  return now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
}

// Date eyebrow, an editorial greeting with the name chosen at sign-up, and the balance pill.
export function Greeting({ now, onCredits, name }: { now: Date; onCredits: () => void; name?: string | null }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8 }}>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ ...type.eyebrow, color: colors.secondaryLabel }}>{dateEyebrow(now)}</Text>
        <Text accessibilityRole="header" style={{ ...type.display(42), color: colors.label }}>{name ? `${greetingFor(now.getHours())},\n${name}` : greetingFor(now.getHours())}</Text>
      </View>
      <View style={{ paddingTop: 2 }}><CreditPill onPress={onCredits} /></View>
    </View>
  );
}
