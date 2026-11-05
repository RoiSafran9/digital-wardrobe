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
import { colors, hitSlopFor, radius, TAB_BAR_HEIGHT, type, weight } from "../../src/theme";
import { Glass, GlassScreen } from "../../src/ui";
import { useScreenViewed } from "../../src/activity/track";

const FIRST_PIECE = [
  "Lay one garment flat on a bed or the floor, or set a pair of shoes side by side.",
  "Shoot clothes from above and shoes from a low side angle, in daylight.",
  "Check the preview, then create its catalog image.",
];

// One way to add clothes: a glass card with its art on top, then the title, how it works and the price.
function MethodCard({ title, body, price, art, onPress }: { title: string; body: string; price: string | null; art: React.ReactNode; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={title} scaleTo={0.98}>
      <Glass radius={radius.hero}>
        <View style={{ height: 168, alignItems: "center", justifyContent: "center" }}>{art}</View>
        <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ ...type.title3, color: colors.label, flexShrink: 1 }}>{title}</Text>
            <Icon name="chevron" size={15} color={colors.tertiaryLabel} />
          </View>
          <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{body}</Text>
          {price ? <Text style={{ ...type.footnote, ...weight(600), color: colors.tint, marginTop: 2 }}>{price}</Text> : null}
        </View>
      </Glass>
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
    <GlassScreen>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: TAB_BAR_HEIGHT + 28, gap: 12 }}>
          <View style={{ gap: 2, paddingHorizontal: 4, marginBottom: 6 }}>
            <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label }}>Add Clothes</Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Choose how to start. Finding garments is always free.</Text>
          </View>

          {generation === false ? (
            <Glass radius={radius.list} style={{ padding: 16, gap: 4 }}>
              <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
                <Text style={{ ...type.headline, color: colors.label }}>New images are paused</Text>
                <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Making new AI images is paused for now. Your closet still works — try again later.</Text>
              </View>
            </Glass>
          ) : null}

          {firstPiece ? (
            <Glass radius={radius.list} style={{ padding: 16, gap: 10 }}>
              <Text style={{ ...type.headline, color: colors.label }}>Your first piece</Text>
              {FIRST_PIECE.map((tip, i) => (
                <View key={tip} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ ...type.caption, ...weight(700), color: colors.onTint }}>{i + 1}</Text>
                  </View>
                  <Text style={{ ...type.subhead, color: colors.label, flex: 1 }}>{tip}</Text>
                </View>
              ))}
            </Glass>
          ) : null}

          {pending > 0 ? (
            <PressScale accessibilityRole="button" onPress={() => router.push("/outfit/review")} scaleTo={0.98}>
              <Glass radius={radius.list} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 16 }}>
                <Text style={{ ...type.body, color: colors.label, flex: 1 }}>
                  {pending === 1 ? "1 piece waiting for review" : `${pending} pieces waiting for review`}
                </Text>
                <Icon name="chevron" size={15} color={colors.tertiaryLabel} />
              </Glass>
            </PressScale>
          ) : null}

          <MethodCard
            title="Photograph Clothes & Shoes"
            body="Lay pieces flat, or set shoes together. Each piece becomes its own item; a pair of shoes counts as one."
            price={front !== undefined ? `${creditsLabel(front)} per piece` : null}
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
                <View style={{ width: 110, height: 150, borderRadius: radius.tile, backgroundColor: colors.tile, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="person2" size={120} color={colors.separatorStrong} />
                  <View style={{ position: "absolute", top: 32, left: 28, width: 54, height: 46, borderRadius: 10, borderWidth: 2, borderColor: colors.tint, backgroundColor: colors.tintSoft }} />
                  <View style={{ position: "absolute", top: 82, left: 32, width: 46, height: 56, borderRadius: 10, borderWidth: 2, borderColor: colors.tint, backgroundColor: colors.tintSoft }} />
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
    </GlassScreen>
  );
}
