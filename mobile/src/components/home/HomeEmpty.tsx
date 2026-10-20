import React from "react";
import { Text, View } from "react-native";
import { Icon } from "../Icon";
import { PressScale } from "../../motion/PressScale";
import { colors, radius, type } from "../../theme";

const TIPS = [
  "Lay pieces flat on a bed or floor in daylight.",
  "Several garments in one photo is fine. Each becomes its own item.",
  "Full-body mirror photos work for outfits.",
];

// Three dashed frames waiting to be filled, then the labelled add rows (from the caller) and the tips.
// onFirstPieces (account mode): the guided First 3 Pieces flow, offered above the plain add rows.
export function HomeEmpty({ children, outfit, onFirstPieces }: { children: React.ReactNode; outfit: boolean; onFirstPieces?: () => void }) {
  const tips = outfit ? TIPS : TIPS.slice(0, 2);
  return (
    <View style={{ paddingHorizontal: 20, gap: 22 }}>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 8 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              width: 78, height: 98, borderRadius: 18, borderWidth: 1.5, borderStyle: "dashed",
              borderColor: i === 1 ? colors.tint : colors.separatorStrong, backgroundColor: i === 1 ? colors.tintSoft : "transparent",
              alignItems: "center", justifyContent: "center", transform: [{ rotate: `${(i - 1) * 6}deg` }, { translateY: i === 1 ? -6 : 0 }],
            }}
          >
            {i === 1 ? <Icon name="add" size={26} color={colors.tint} /> : null}
          </View>
        ))}
      </View>
      <View style={{ gap: 6, alignItems: "center" }}>
        <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>Your closet starts here</Text>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, textAlign: "center" }}>
          {outfit ? "Photograph a garment or import an outfit photo. Your first pieces take under a minute." : "Photograph a garment. Your first pieces take under a minute."}
        </Text>
      </View>
      {onFirstPieces ? (
        <PressScale onPress={onFirstPieces} accessibilityRole="button" accessibilityLabel="Add your first 3 pieces" scaleTo={0.98}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: radius.list, backgroundColor: colors.tint }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ ...type.headline, color: colors.onTint }}>Add your first 3 pieces</Text>
            <Text style={{ ...type.subhead, color: colors.onTint }}>A guided start. Finding your clothes is free.</Text>
          </View>
          <Icon name="chevron" size={15} color={colors.onTint} />
        </PressScale>
      ) : null}
      {children}
      <View style={{ gap: 12 }}>
        <Text style={{ ...type.eyebrow, color: colors.secondaryLabel }}>Tips for great results</Text>
        {tips.map((tip, i) => (
          <View key={tip} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.grouped, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ ...type.footnote, fontWeight: "600", color: colors.label }}>{i + 1}</Text>
            </View>
            <Text style={{ ...type.subhead, color: colors.label, flex: 1 }}>{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
