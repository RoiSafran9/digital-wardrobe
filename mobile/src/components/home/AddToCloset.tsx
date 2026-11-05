import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, type, weight } from "../../theme";
import { Glass } from "../../ui";
import { PressScale } from "../../motion/PressScale";

export type PhotoActions = {
  onGarmentCamera: () => void;
  onGarmentLibrary: () => void;
  onOutfitPhoto?: () => void;  // only when the server offers outfit import
};

function Pill({ title, onPress, primary, label }: { title: string; onPress: () => void; primary?: boolean; label: string }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ height: 34, paddingHorizontal: 16, minWidth: 64, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: primary ? colors.tint : colors.fill }}>
      <Text style={{ ...type.footnote, ...weight(600), color: primary ? colors.onTint : colors.label }}>{title}</Text>
    </PressScale>
  );
}

function LabelledRow({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ ...type.subhead, ...weight(600), color: colors.label }}>{title}</Text>
        <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{caption}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>{children}</View>
    </View>
  );
}

// The empty closet's add options: a glass list of labelled rows, each saying which photo it wants.
export function AddRows({ onGarmentCamera, onGarmentLibrary, onOutfitPhoto }: PhotoActions) {
  return (
    <Glass radius={radius.list}>
      <LabelledRow title="Garment photo" caption="Clothes laid flat or hung, and shoes">
        <Pill title="Camera" primary onPress={onGarmentCamera} label="Garment photo, Camera" />
        <Pill title="Library" onPress={onGarmentLibrary} label="Garment photo, Library" />
      </LabelledRow>
      {onOutfitPhoto ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: 16 }} /> : null}
      {onOutfitPhoto ? (
        <LabelledRow title="Outfit photo" caption="You wearing it">
          <Pill title="Choose Photo" onPress={onOutfitPhoto} label="Outfit photo, Choose photo" />
        </LabelledRow>
      ) : null}
    </Glass>
  );
}
