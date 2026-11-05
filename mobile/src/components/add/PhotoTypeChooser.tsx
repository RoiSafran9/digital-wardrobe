import React from "react";
import { Text, View } from "react-native";
import { Icon } from "../Icon";
import { GlyphTile } from "../onboarding/GlyphTile";
import { PressScale } from "../../motion/PressScale";
import { colors, radius, type } from "../../theme";
import { Button } from "../../ui";
import { CHANGE_PHOTO_TYPE, CHOOSE_FROM_LIBRARY, PHOTO_TYPES, RESCAN_FREE, TAKE_PHOTO, type AddPhotoType, type PhotoSource } from "../../addPhoto";

// Small art so the two types read at a glance: pieces on their own, or a figure wearing them.
function Art({ t }: { t: AddPhotoType }) {
  if (t === "laid_out") {
    return (
      <View style={{ flexDirection: "row", gap: 4 }}>
        {(["hanger", "garment", "shoe"] as const).map((icon, i) => (
          <GlyphTile key={icon} icon={icon} size={{ width: 26, height: 34 }} style={{ transform: [{ rotate: `${(i - 1) * 6}deg` }], shadowOpacity: 0.05 }} />
        ))}
      </View>
    );
  }
  return (
    <View style={{ width: 86, alignItems: "center" }}>
      <Icon name="person2" size={52} color={colors.secondaryLabel} />
    </View>
  );
}

function TypeCard({ t, selected, onPress }: { t: AddPhotoType; selected: boolean; onPress: () => void }) {
  const { title, body } = PHOTO_TYPES[t];
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${body}`} accessibilityState={{ selected }} scaleTo={0.98}
      style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 88, padding: 14, borderRadius: radius.list,
               backgroundColor: selected ? colors.tintSoft : colors.grouped, borderWidth: 1.5, borderColor: selected ? colors.tint : "transparent" }}>
      <View style={{ width: 86, height: 60, borderRadius: radius.button, backgroundColor: colors.tile, alignItems: "center", justifyContent: "center" }}
        importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Art t={t} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...type.headline, color: colors.label }}>{title}</Text>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{body}</Text>
      </View>
      <Icon name={selected ? "checkmark" : "chevron"} size={15} color={selected ? colors.tint : colors.secondaryLabel} />
    </PressScale>
  );
}

// The same two source buttons for either type.
export function SourceChoice({ onSource }: { onSource: (s: PhotoSource) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Button title={TAKE_PHOTO} icon="camera" onPress={() => onSource("camera")} />
      <Button title={CHOOSE_FROM_LIBRARY} icon="photos" variant="secondary" onPress={() => onSource("library")} />
    </View>
  );
}

// "What does your photo show?": one card per available type; the selected one shows Take Photo /
// Choose from Library right under it. A type whose `onSelect` navigates away (First 3 Pieces' tray)
// simply never becomes `selected`.
export function PhotoTypeChooser({ types, selected, onSelect, onSource }: {
  types: AddPhotoType[];
  selected: AddPhotoType | null;
  onSelect: (t: AddPhotoType) => void;
  onSource: (t: AddPhotoType, s: PhotoSource) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      {types.map((t) => (
        <View key={t} style={{ gap: 10 }}>
          <TypeCard t={t} selected={selected === t} onPress={() => onSelect(t)} />
          {selected === t ? <SourceChoice onSource={(s) => onSource(t, s)} /> : null}
        </View>
      ))}
    </View>
  );
}

// Before anything is paid for: run this same photo through the other type's free scan instead.
export function ChangePhotoType({ to, onPress }: { to: AddPhotoType; onPress: () => void }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Button title={CHANGE_PHOTO_TYPE} variant="text" size="medium" onPress={onPress} />
      <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>
        {`Try as ${PHOTO_TYPES[to].title.toLowerCase()}. ${RESCAN_FREE}`}
      </Text>
    </View>
  );
}
