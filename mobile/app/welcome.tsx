import React from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { GlyphTile } from "../src/components/onboarding/GlyphTile";
import type { IconName } from "../src/components/Icon";
import { Float } from "../src/motion/Breathe";
import { PopIn } from "../src/motion/PopIn";
import { useOnboarding } from "../src/onboarding";
import { colors, type } from "../src/theme";
import { Button, GlassScreen } from "../src/ui";

// Five glass tiles scattered like clothes on a bed, laid out on the handoff's 362×300 board (rotations
// −8°…+10°): each pops in 0.12s after the last, then drifts gently on its own beat.
const COLLAGE: { icon: IconName; x: number; y: number; rotate: number; drift: number }[] = [
  { icon: "garment", x: 30, y: 30, rotate: -8, drift: 0 },
  { icon: "shoe", x: 220, y: 10, rotate: 7, drift: 300 },
  { icon: "handbag", x: 120, y: 140, rotate: -3, drift: 600 },
  { icon: "hanger", x: 250, y: 180, rotate: 10, drift: 150 },
  { icon: "jacket", x: 10, y: 210, rotate: 5, drift: 450 },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { seen, markSeen } = useOnboarding();
  const { width, height } = useWindowDimensions();
  if (seen === null) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (seen) return <Redirect href="/sign-in" />;

  // The board is a 402×874 phone; smaller phones shrink the collage so the buttons still fit.
  const s = Math.min(1, (width - 40) / 362, height / 874);
  return (
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <View style={{ height: 300 * s }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {COLLAGE.map((t, i) => (
              <Float key={i} delay={t.drift} style={{ position: "absolute", left: t.x * s, top: t.y * s }}>
                <PopIn delay={i * 120}>
                  <GlyphTile glass icon={t.icon} size={{ width: 92 * s, height: 112 * s }} style={{ transform: [{ rotate: `${t.rotate}deg` }] }} />
                </PopIn>
              </Float>
            ))}
          </View>
          <Text accessibilityRole="header" style={{ ...type.display(42), color: colors.label, marginTop: 10 }}>{"Your closet,\nbeautifully digital."}</Text>
          <Text style={{ ...type.body, lineHeight: 24, color: colors.secondaryLabel, marginTop: 12 }}>
            Photograph the clothes you own. AI turns them into clean catalog images you can browse anywhere.
          </Text>
          <View style={{ flex: 1, minHeight: 34 }} />
          <View style={{ gap: 6 }}>
            <Button title="Get Started" onPress={() => router.push("/intro")} />
            <Button
              title="I already have an account"
              variant="text"
              onPress={async () => { await markSeen(); router.replace("/sign-in"); }}
            />
          </View>
        </View>
      </SafeAreaView>
    </GlassScreen>
  );
}
