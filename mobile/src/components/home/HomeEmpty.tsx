import React from "react";
import { Text, View } from "react-native";
import { Icon } from "../Icon";
import { PressScale } from "../../motion/PressScale";
import { colors, radius, type, weight } from "../../theme";
import { Glass } from "../../ui";
import type { IconName } from "../Icon";

const FRAMES: IconName[] = ["garment", "jacket", "shoe"];

const TIPS = [
  "Lay pieces flat on a bed or floor in daylight.",
  "Several pieces in one photo is fine. Each becomes its own item; a pair of shoes counts as one.",
  "Full-body mirror photos work for outfits.",
];

// Three dashed frames waiting to be filled, then the labelled add rows (from the caller) and the tips.
// onFirstPieces (account mode): the guided First 3 Pieces flow, offered above the plain add rows.
export function HomeEmpty({ children, outfit, onFirstPieces }: { children: React.ReactNode; outfit: boolean; onFirstPieces?: () => void }) {
  const tips = outfit ? TIPS : TIPS.slice(0, 2);
  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 8, paddingHorizontal: 4 }}>
        <Text accessibilityRole="header" style={{ ...type.display(40), color: colors.label }}>Your closet starts here</Text>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>
          {outfit ? "Photograph a garment or import an outfit photo. Your first pieces take under a minute." : "Photograph a garment. Your first pieces take under a minute."}
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {FRAMES.map((icon, i) => (
          <View
            key={icon}
            style={{
              width: 86, height: 106, borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.separatorStrong,
              alignItems: "center", justifyContent: "center", transform: [{ rotate: `${(i - 1) * 6}deg` }, { translateY: i === 1 ? -6 : 0 }],
            }}
          >
            <Icon name={icon} size={32} color={colors.secondaryLabel} />
          </View>
        ))}
      </View>
      {onFirstPieces ? (
        <Glass blue radius={radius.hero} style={{ padding: 18, gap: 14 }}
          decor={<View style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.14)" }} />}>
          <View style={{ gap: 4 }}>
            <Text style={{ ...type.title2, color: "#FFFFFF" }}>Add your first 3 pieces</Text>
            <Text style={{ ...type.subhead, color: "rgba(255,255,255,0.88)" }}>A guided start. Finding your clothes is free.</Text>
          </View>
          <PressScale onPress={onFirstPieces} accessibilityRole="button" accessibilityLabel="Add your first 3 pieces" scaleTo={0.98}
            style={{ height: 50, borderRadius: radius.primary, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ ...type.headline, color: colors.tint }}>Get Started</Text>
          </PressScale>
        </Glass>
      ) : null}
      {children}
      <View style={{ gap: 12 }}>
        <Text style={{ ...type.eyebrow, color: colors.secondaryLabel, paddingHorizontal: 4 }}>Tips for great results</Text>
        {tips.map((tip, i) => (
          <View key={tip} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.tintSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ ...type.footnote, ...weight(700), color: colors.tint }}>{i + 1}</Text>
            </View>
            <Text style={{ ...type.subhead, color: colors.label, flex: 1 }}>{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
