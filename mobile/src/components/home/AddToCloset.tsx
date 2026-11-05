import React from "react";
import { Text, View } from "react-native";
import { Icon } from "../Icon";
import { colors, radius, type } from "../../theme";
import { PressScale } from "../../motion/PressScale";

// Home's one way in: it opens the Add tab, where the user says what the photo shows and where it comes
// from. Home itself asks neither (docs/features/unified-add-clothes/01-PRODUCT-UX-SPEC.md §3.1).
export function AddClothesButton({ onPress }: { onPress: () => void }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Add Clothes" scaleTo={0.98}
      style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.list, backgroundColor: colors.grouped }}>
      <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}>
        <Icon name="add" size={20} color={colors.onTint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...type.headline, color: colors.label }}>Add Clothes</Text>
        <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 1 }}>From a new photo or your library.</Text>
      </View>
      <Icon name="chevron" size={16} color={colors.secondaryLabel} />
    </PressScale>
  );
}
