import React, { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions, type ScrollViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon, type IconName } from "../src/components/Icon";
import { GlyphTile } from "../src/components/onboarding/GlyphTile";
import { useOnboarding } from "../src/onboarding";
import { colors, hitSlopFor, radius, type } from "../src/theme";
import { Button, Glass, GlassScreen } from "../src/ui";

// Pages one and two show one big glyph on a tint wash; page three a small closet grid (glyphs, never
// photos, so nothing looks like someone's real clothes).
const PAGES: { title: string; body: string; icon?: IconName }[] = [
  { title: "Snap any garment", body: "Lay clothes on a bed or floor. AI separates each piece and creates a clean catalog image.", icon: "camera" },
  { title: "Or import an outfit", body: "Use a photo of yourself. Pick which pieces to digitize. Finding them is free.", icon: "person2" },
  { title: "Browse what you own", body: "Filter by category and color, flip to the back, or spin a piece in 360°." },
];
const GRID: IconName[] = ["garment", "shoe", "jacket", "handbag"];

export default function IntroScreen() {
  const router = useRouter();
  const { markSeen } = useOnboarding();
  const { width, height } = useWindowDimensions();
  const scroller = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;
  const card = Math.min(380, Math.round(height * 0.44));  // the board's 380pt card, shorter on small phones

  const finish = async () => {
    await markSeen();
    router.replace("/sign-in");
  };
  const goTo = (i: number) => {
    setPage(i);
    scroller.current?.scrollTo({ x: i * width, animated: true });
  };

  return (
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ height: 44, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 20 }}>
          <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Skip" hitSlop={hitSlopFor(28, 50)}>
            <Text style={{ ...type.body, color: colors.tint }}>Skip</Text>
          </Pressable>
        </View>
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={{ flexGrow: 0 }}
        >
          {PAGES.map(({ title, body, icon }) => (
            <View key={title} style={{ width, paddingHorizontal: 20, paddingTop: 12 }}>
              <Glass radius={radius.sheet} style={{ height: card, alignItems: "center", justifyContent: "center" }}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {icon ? (
                    <View style={{ width: 150, height: 150, borderRadius: 75, backgroundColor: colors.tintSoft, alignItems: "center", justifyContent: "center" }}>
                      <Icon name={icon} size={70} color={colors.tint} />
                    </View>
                  ) : (
                    <View style={{ width: 220, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      {GRID.map((g) => <GlyphTile key={g} icon={g} radius={16} size={{ width: 105, height: Math.min(131, (card - 70) / 2) }} />)}
                    </View>
                  )}
                </View>
              </Glass>
              <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label, marginTop: 28 }}>{title}</Text>
              <Text style={{ ...type.body, lineHeight: 24, color: colors.secondaryLabel, marginTop: 8 }}>{body}</Text>
            </View>
          ))}
        </ScrollView>
        <View accessible accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`} style={{ flexDirection: "row", gap: 6, paddingHorizontal: 20, marginTop: 26 }}>
          {PAGES.map((p, i) => (
            <View key={p.title} style={{ height: 7, width: i === page ? 22 : 7, borderRadius: 4, backgroundColor: i === page ? colors.tint : colors.separatorStrong }} />
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <Button title={last ? "Continue" : "Next"} onPress={last ? finish : () => goTo(page + 1)} />
        </View>
      </SafeAreaView>
    </GlassScreen>
  );
}
