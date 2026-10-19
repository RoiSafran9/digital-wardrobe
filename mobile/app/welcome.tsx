import React from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { GlyphTile } from "../src/components/onboarding/GlyphTile";
import type { IconName } from "../src/components/Icon";
import { PopIn } from "../src/motion/PopIn";
import { useOnboarding } from "../src/onboarding";
import { colors, type } from "../src/theme";
import { Button } from "../src/ui";

// Five tiles scattered like clothes on a bed; rotations −10°…+6°, popping in 0.05–0.45s.
const COLLAGE: { icon: IconName; left: number; top: number; w: number; h: number; rotate: number }[] = [
  { icon: "jacket", left: 0.04, top: 0.02, w: 0.36, h: 0.44, rotate: -6 },
  { icon: "garment", left: 0.5, top: 0.0, w: 0.4, h: 0.36, rotate: 4 },
  { icon: "hanger", left: 0.08, top: 0.5, w: 0.32, h: 0.42, rotate: -10 },
  { icon: "handbag", left: 0.46, top: 0.42, w: 0.4, h: 0.44, rotate: 6 },
  { icon: "shoe", left: 0.7, top: 0.76, w: 0.24, h: 0.2, rotate: -3 },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { seen, markSeen } = useOnboarding();
  const { width } = useWindowDimensions();
  if (seen === null) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (seen) return <Redirect href="/sign-in" />;

  const art = width - 40;
  const artHeight = art * 0.92;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: "space-between", paddingBottom: 12 }}>
        <View style={{ width: art, height: artHeight, marginTop: 12 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {COLLAGE.map((t, i) => (
            <PopIn key={i} delay={50 + i * 100} style={{ position: "absolute", left: t.left * art, top: t.top * artHeight }}>
              <GlyphTile icon={t.icon} size={{ width: t.w * art, height: t.h * artHeight }} style={{ transform: [{ rotate: `${t.rotate}deg` }] }} />
            </PopIn>
          ))}
        </View>
        <View style={{ gap: 14 }}>
          <Text accessibilityRole="header" style={{ ...type.display(46), color: colors.label }}>{"Your closet,\nbeautifully digital."}</Text>
          <Text style={{ ...type.body, lineHeight: 24, color: colors.secondaryLabel }}>
            Photograph the clothes you own. AI turns them into clean catalog images you can browse anywhere.
          </Text>
        </View>
        <View style={{ gap: 6, marginTop: 20 }}>
          <Button title="Get Started" onPress={() => router.push("/intro")} />
          <Button
            title="I already have an account"
            variant="text"
            onPress={async () => { await markSeen(); router.replace("/sign-in"); }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
