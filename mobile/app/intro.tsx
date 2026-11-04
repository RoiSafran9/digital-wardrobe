import React, { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions, type ScrollViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "../src/components/Icon";
import { GlyphTile } from "../src/components/onboarding/GlyphTile";
import type { IconName } from "../src/components/Icon";
import { useOnboarding } from "../src/onboarding";
import { colors, hitSlopFor, radius, type } from "../src/theme";
import { Button } from "../src/ui";

const PAGES = [
  { title: "Snap any garment", body: "Lay clothes on a bed or floor. AI separates each piece and creates a clean catalog image.", art: PhotoToCatalog },
  { title: "Or import an outfit", body: "Use a photo of yourself. Pick which pieces to digitize. Finding them is free.", art: OutfitBoxes },
  { title: "Browse what you own", body: "Filter by category and color, flip to the back, or spin a piece in 360°.", art: ClosetGrid },
];

export default function IntroScreen() {
  const router = useRouter();
  const { markSeen } = useOnboarding();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;

  const finish = async () => {
    await markSeen();
    router.replace("/sign-in");
  };
  const goTo = (i: number) => {
    setPage(i);
    scroller.current?.scrollTo({ x: i * width, animated: true });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 44, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 20 }}>
        <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Skip" hitSlop={hitSlopFor(28, 50)}>
          <Text style={{ ...type.body, color: colors.secondaryLabel }}>Skip</Text>
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
        {PAGES.map(({ title, body, art: Art }) => (
          <View key={title} style={{ width, paddingHorizontal: 20 }}>
            <View style={{ height: 400, borderRadius: radius.hero, backgroundColor: colors.grouped, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <Art />
            </View>
            <Text accessibilityRole="header" style={{ ...type.pageTitle, color: colors.label, marginTop: 28 }}>{title}</Text>
            <Text style={{ ...type.body, lineHeight: 24, color: colors.secondaryLabel, marginTop: 8 }}>{body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 20 }}>
        <View accessible accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`} style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
          {PAGES.map((p, i) => (
            <View key={p.title} style={{ height: 7, width: i === page ? 22 : 7, borderRadius: 4, backgroundColor: i === page ? colors.tint : colors.fill }} />
          ))}
        </View>
        <Button title={last ? "Continue" : "Next"} onPress={last ? finish : () => goTo(page + 1)} />
      </View>
    </SafeAreaView>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center", marginTop: 8 }}>{children}</Text>;
}

function PhotoToCatalog() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View>
        <GlyphTile icon="garment" size={{ width: 120, height: 150 }} dashed style={{ transform: [{ rotate: "-4deg" }] }} />
        <Label>your photo</Label>
      </View>
      <Icon name="arrowRight" size={22} color={colors.tint} />
      <View>
        <GlyphTile icon="garment" size={{ width: 120, height: 150 }} />
        <Label>catalog image</Label>
      </View>
    </View>
  );
}

function OutfitBoxes() {
  return (
    <View style={{ width: 190, height: 300, borderRadius: radius.tile, backgroundColor: colors.tile, alignItems: "center", justifyContent: "center" }}>
      <Icon name="person2" size={200} color={colors.separatorStrong} />
      {[{ top: 70, h: 90 }, { top: 165, h: 110 }].map((b, i) => (
        <View key={i} style={{ position: "absolute", top: b.top, left: 45, width: 100, height: b.h, borderRadius: 10, borderWidth: 2, borderColor: colors.tint, backgroundColor: colors.tintSoft }} />
      ))}
    </View>
  );
}

const GRID: IconName[] = ["garment", "jacket", "hanger", "handbag", "shoe", "garment", "jacket", "hanger", "handbag"];
function ClosetGrid() {
  return (
    <View style={{ width: 252, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {GRID.map((icon, i) => <GlyphTile key={i} icon={icon} size={{ width: 77, height: 96 }} style={{ shadowOpacity: 0.04 }} />)}
    </View>
  );
}
