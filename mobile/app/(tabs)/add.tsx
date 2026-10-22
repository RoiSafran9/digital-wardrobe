import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPendingItems } from "../../src/api/client";
import { Icon, type IconName } from "../../src/components/Icon";
import { GlyphTile } from "../../src/components/onboarding/GlyphTile";
import { useCredits } from "../../src/credits/CreditsProvider";
import { creditsLabel } from "../../src/credits/credits";
import { PressScale } from "../../src/motion/PressScale";
import { colors, hitSlopFor, radius, TAB_BAR_HEIGHT, type } from "../../src/theme";
import { useScreenViewed } from "../../src/activity/track";

const FIRST_PIECE = [
  "Lay one garment flat on a bed or the floor.",
  "Take the photo from above, in daylight.",
  "Check the preview, then create its catalog image.",
];

function MethodCard({ title, body, price, art, onPress }: { title: string; body: string; price: string | null; art: React.ReactNode; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={title} scaleTo={0.98}
      style={{ borderRadius: radius.feature, backgroundColor: colors.grouped, overflow: "hidden" }}>
      <View style={{ height: 176, alignItems: "center", justifyContent: "center", backgroundColor: colors.tile }}>{art}</View>
      <View style={{ padding: 18, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ ...type.cardTitle, color: colors.label }}>{title}</Text>
          <Icon name="chevron" size={15} color={colors.secondaryLabel} />
        </View>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{body}</Text>
        {price ? <Text style={{ ...type.footnote, fontWeight: "600", color: colors.tint, marginTop: 2 }}>{price}</Text> : null}
      </View>
    </PressScale>
  );
}

const ROW: IconName[] = ["garment", "jacket", "shoe"];

export default function AddScreen() {
  useScreenViewed("add");
  const router = useRouter();
  const { outfit: outfitOn, billing, prices, credits, generation } = useCredits();
  const { mode, firstPiece, at } = useLocalSearchParams<{ mode?: string; firstPiece?: string; at?: string }>();
  const [pending, setPending] = useState(0);

  // Home's outfit link and a worn-photo rejection used to land here in outfit mode; go straight to it.
  useEffect(() => {
    if (mode === "outfit" && outfitOn) router.push({ pathname: "/capture/camera", params: { mode: "outfit" } });
  }, [mode, at, outfitOn]);

  // Outfit results the user hasn't kept or discarded yet (also after an app restart).
  useFocusEffect(React.useCallback(() => {
    if (!outfitOn) return;
    let live = true;
    getPendingItems().then((items) => live && setPending(items.length)).catch(() => {});
    return () => { live = false; };
  }, [outfitOn]));

  const front = billing ? prices.garment : undefined;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: TAB_BAR_HEIGHT + 24, gap: 16 }}>
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label }}>Add Clothes</Text>
          <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Choose how to start. Finding garments is always free.</Text>
        </View>

        {generation === false ? (
          <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.grouped, borderRadius: radius.list, padding: 16, gap: 4 }}>
            <Text style={{ ...type.headline, color: colors.label }}>New images are paused</Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Making new AI images is paused for now. Your closet still works — try again later.</Text>
          </View>
        ) : null}

        {firstPiece ? (
          <View style={{ backgroundColor: colors.tintSoft, borderRadius: radius.list, padding: 16, gap: 10 }}>
            <Text style={{ ...type.headline, color: colors.label }}>Your first piece</Text>
            {FIRST_PIECE.map((tip, i) => (
              <View key={tip} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ ...type.caption, fontWeight: "700", color: colors.onTint }}>{i + 1}</Text>
                </View>
                <Text style={{ ...type.subhead, color: colors.label, flex: 1 }}>{tip}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {pending > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push("/outfit/review")}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.grouped, borderRadius: radius.list, padding: 16 }}>
            <Text style={{ ...type.body, color: colors.label, flex: 1 }}>
              {pending === 1 ? "1 piece waiting for review" : `${pending} pieces waiting for review`}
            </Text>
            <Icon name="chevron" size={15} color={colors.secondaryLabel} />
          </Pressable>
        ) : null}

        <MethodCard
          title="Photograph Garments"
          body="Lay one or more pieces on a flat surface. Each becomes its own item."
          price={front !== undefined ? `${creditsLabel(front)} per garment` : null}
          onPress={() => router.push({ pathname: "/capture/camera", params: { mode: "garments" } })}
          art={<View style={{ flexDirection: "row", gap: 10 }}>{ROW.map((icon, i) => <GlyphTile key={i} icon={icon} size={{ width: 74, height: 92 }} style={{ transform: [{ rotate: `${(i - 1) * 5}deg` }] }} />)}</View>}
        />
        {outfitOn ? (
          <MethodCard
            title="Import from Outfit Photo"
            body="Use a photo of you wearing an outfit, then pick the pieces to keep."
            price={front !== undefined ? `Free detection · ${creditsLabel(front)} per piece` : "Free detection"}
            onPress={() => router.push({ pathname: "/capture/camera", params: { mode: "outfit" } })}
            art={
              <View style={{ width: 110, height: 150, borderRadius: radius.tile, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
                <Icon name="person2" size={120} color={colors.separatorStrong} />
                <View style={{ position: "absolute", top: 32, left: 28, width: 54, height: 46, borderRadius: 8, borderWidth: 2, borderColor: colors.tint, backgroundColor: colors.tintSoft }} />
                <View style={{ position: "absolute", top: 82, left: 32, width: 46, height: 56, borderRadius: 8, borderWidth: 2, borderColor: colors.tint, backgroundColor: colors.tintSoft }} />
              </View>
            }
          />
        ) : null}

        {billing && credits ? (
          <Pressable accessibilityRole="button" hitSlop={hitSlopFor(24)} onPress={() => router.push("/account")} style={{ alignSelf: "center" }}>
            <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>
              {`Balance: ${creditsLabel(credits.available)} · `}<Text style={{ color: colors.tint }}>Price list</Text>
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
