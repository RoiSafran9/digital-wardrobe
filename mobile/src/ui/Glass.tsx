import React from "react";
import { Image, StyleSheet, View, useColorScheme, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { colors, radius as radii, shadow } from "../theme";

type Level = "base" | "card" | "sheet";
const FILL: Record<Level, typeof colors.glass> = { base: colors.glass, card: colors.glassCard, sheet: colors.glassSheet };

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  level?: Level;  // fill strength: base 58%, card 68% (cards, lists), sheet 90% (sheets, banners over content)
  blue?: boolean;  // the blue glass of the Add hero and the camera tile
  decor?: React.ReactNode;  // art drawn inside the clipped shape, under the content (bleeding garments, circles)
  flat?: boolean;  // no shadow (glass nested in glass, or inside a scrolling row)
  testID?: string;
};

// The handoff's frosted surface: a system blur with a white fill on top, a 0.5pt light border, a soft
// shadow and a 1pt inner highlight along the top. The shadow sits on the outer view; the blur and the
// decor are clipped by an inner one, so the shape never clips its own shadow.
export function Glass({ children, style, radius = radii.tile, level = "card", blue = false, decor, flat = false, testID }: Props) {
  return (
    <View testID={testID} style={[{ borderRadius: radius }, flat ? null : shadow.glass, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}>
        {blue ? null : <BlurView intensity={40} tint="systemChromeMaterial" style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: blue ? colors.glassTint : FILL[level] }]} />
        {decor}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: colors.glassHighlight }} />
      </View>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 0.5, borderColor: blue ? "rgba(255,255,255,0.4)" : colors.glassBorder }]}
      />
      {children}
    </View>
  );
}

const BACKDROP = require("../../assets/backdrop.png");

// The two soft color blobs behind the glass (Home, Closet, Me, onboarding). A pre-blurred image, so no
// live blur runs behind the scroll. Dark mode keeps the plain black background.
export function Backdrop() {
  const scheme = useColorScheme();
  if (scheme === "dark") return null;
  return <Image source={BACKDROP} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

// A full screen with the blobs behind its content.
export function GlassScreen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      <Backdrop />
      {children}
    </View>
  );
}
