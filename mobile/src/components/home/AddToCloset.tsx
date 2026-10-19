import React from "react";
import { Text, View } from "react-native";
import { Icon } from "../Icon";
import { GlyphTile } from "../onboarding/GlyphTile";
import { colors, radius, type } from "../../theme";
import { PressScale } from "../../motion/PressScale";

export type PhotoActions = {
  onGarmentCamera: () => void;
  onGarmentLibrary: () => void;
  onOutfitPhoto?: () => void;  // only when the server offers outfit import
};

function SmallButton({ title, onPress, primary, label }: { title: string; onPress: () => void; primary?: boolean; label: string }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scaleTo={0.97}
      style={{ flex: 1, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: primary ? colors.tint : colors.card }}>
      <Text style={{ ...type.footnote, fontWeight: "600", color: primary ? colors.onTint : colors.label }}>{title}</Text>
    </PressScale>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <View style={{ position: "absolute", left: 8, bottom: 8, backgroundColor: colors.card, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 }}>
      <Text style={{ ...type.tag, color: colors.secondaryLabel }}>{children}</Text>
    </View>
  );
}

function Tile({ tag, art, title, caption, children }: { tag: string; art: React.ReactNode; title: string; caption: string; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.grouped, borderRadius: radius.tile, overflow: "hidden" }}>
      <View style={{ height: 130, backgroundColor: colors.tile }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {art}
        </View>
        <Tag>{tag}</Tag>
      </View>
      <View style={{ padding: 12, gap: 10, flex: 1, justifyContent: "space-between" }}>
        <View style={{ gap: 2 }}>
          <Text style={{ ...type.subhead, fontWeight: "700", color: colors.label }}>{title}</Text>
          <Text style={{ ...type.caption, color: colors.secondaryLabel }}>{caption}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>{children}</View>
      </View>
    </View>
  );
}

const flatLay = (
  <View style={{ flexDirection: "row", gap: 6 }}>
    {(["garment", "jacket", "shoe"] as const).map((icon, i) => (
      <GlyphTile key={icon} icon={icon} size={{ width: 40, height: 52 }} style={{ transform: [{ rotate: `${(i - 1) * 6}deg` }], shadowOpacity: 0.05 }} />
    ))}
  </View>
);

const worn = (
  <View style={{ width: 66, height: 110, alignItems: "center", justifyContent: "center" }}>
    <Icon name="person2" size={104} color={colors.separatorStrong} />
    <View style={{ position: "absolute", top: 22, left: 14, width: 38, height: 32, borderRadius: 6, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.tint }} />
    <View style={{ position: "absolute", top: 58, left: 17, width: 32, height: 40, borderRadius: 6, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.tint }} />
  </View>
);

// Home's "Add to closet": every photo button says which kind of photo it wants — garments laid flat
// (Flow A) or a photo of someone wearing an outfit (Flow B). See CHANGE_home_photo_type.md.
export function AddToCloset({ onGarmentCamera, onGarmentLibrary, onOutfitPhoto }: PhotoActions) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Tile tag="FLAT LAY" art={flatLay} title="Garments" caption="Each piece becomes an item">
          <SmallButton title="Camera" primary onPress={onGarmentCamera} label="Add garments, flat lay photo, Camera" />
          <SmallButton title="Library" onPress={onGarmentLibrary} label="Add garments, flat lay photo, Library" />
        </Tile>
      </View>
      {onOutfitPhoto ? (
        <View style={{ flex: 1 }}>
          <Tile tag="WORN" art={worn} title="Outfit photo" caption="We find each piece you wear">
            <SmallButton title="Choose Photo" onPress={onOutfitPhoto} label="Add from outfit photo, Choose photo" />
          </Tile>
        </View>
      ) : null}
    </View>
  );
}

function Pill({ title, onPress, primary, label }: { title: string; onPress: () => void; primary?: boolean; label: string }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ height: 34, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: primary ? colors.tint : colors.fill }}>
      <Text style={{ ...type.footnote, fontWeight: "600", color: primary ? colors.onTint : colors.label }}>{title}</Text>
    </PressScale>
  );
}

function LabelledRow({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: radius.primary, paddingVertical: 12, paddingHorizontal: 14 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ ...type.subhead, fontWeight: "600", color: colors.label }}>{title}</Text>
        <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{caption}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>{children}</View>
    </View>
  );
}

// The empty closet's version: two labelled rows instead of a generic photo pair.
export function AddRows({ onGarmentCamera, onGarmentLibrary, onOutfitPhoto }: PhotoActions) {
  return (
    <View style={{ gap: 10 }}>
      <LabelledRow title="Garment photo" caption="Laid flat or on a hanger">
        <Pill title="Camera" primary onPress={onGarmentCamera} label="Garment photo, Camera" />
        <Pill title="Library" onPress={onGarmentLibrary} label="Garment photo, Library" />
      </LabelledRow>
      {onOutfitPhoto ? (
        <LabelledRow title="Outfit photo" caption="You wearing it">
          <Pill title="Choose Photo" onPress={onOutfitPhoto} label="Outfit photo, Choose photo" />
        </LabelledRow>
      ) : null}
    </View>
  );
}
