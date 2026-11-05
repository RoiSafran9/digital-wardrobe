import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPendingItems } from "../../src/api/client";
import { availableTypes, cameraRoute, photoRoute, type AddPhotoType, type PhotoSource } from "../../src/addPhoto";
import { PhotoTypeChooser } from "../../src/components/add/PhotoTypeChooser";
import { Icon } from "../../src/components/Icon";
import { useCredits } from "../../src/credits/CreditsProvider";
import { creditsLabel } from "../../src/credits/credits";
import { haptics } from "../../src/haptics";
import { pickPhoto } from "../../src/photoPicker";
import { colors, hitSlopFor, radius, TAB_BAR_HEIGHT, type } from "../../src/theme";
import { track, useScreenViewed } from "../../src/activity/track";

const FIRST_PIECE = [
  "Lay one piece out on a bed or the floor, hang it up, or set a pair of shoes side by side.",
  "Shoot clothes straight on and shoes from a low side angle, in daylight.",
  "Check the preview, then create its catalog image.",
];

// The Add hub (docs/features/unified-add-clothes): what the photo shows (clothes by themselves, or
// someone wearing them), then Take Photo or Choose from Library — the same two for either type. The
// library opens straight away; only Take Photo opens the camera. `mode` (old links) preselects a type.
export default function AddScreen() {
  useScreenViewed("add");
  const router = useRouter();
  const { outfit: outfitOn, billing, prices, credits, generation } = useCredits();
  const { mode, firstPiece, at } = useLocalSearchParams<{ mode?: string; firstPiece?: string; at?: string }>();
  const [pending, setPending] = useState(0);
  const [chosen, setChosen] = useState<AddPhotoType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const types = availableTypes(!!outfitOn);
  const selected = chosen && types.includes(chosen) ? chosen : null;

  // A link that names a type selects it and waits for the source; it never opens the camera by itself.
  useEffect(() => {
    if (mode === "outfit" && outfitOn) setChosen("worn");
    else if (mode === "garments") setChosen("laid_out");
  }, [mode, at, outfitOn]);

  // Outfit results the user hasn't kept or discarded yet (also after an app restart).
  useFocusEffect(React.useCallback(() => {
    if (!outfitOn) return;
    let live = true;
    getPendingItems().then((items) => live && setPending(items.length)).catch(() => {});
    return () => { live = false; };
  }, [outfitOn]));

  const select = (t: AddPhotoType) => {
    haptics.selection();
    setError(null);
    if (selected === t) return setChosen(null);  // tap again to put the sources away
    track("add_photo_type_selected", { type: t, entry: "add" });
    setChosen(t);
  };
  const source = async (t: AddPhotoType, from: PhotoSource) => {
    setError(null);
    if (from === "camera") return router.push(cameraRoute(t));
    try {
      const uri = await pickPhoto(false);
      if (!uri) return;  // cancelled: the type stays selected
      track("capture_source", { flow: t === "worn" ? "outfit" : "garment", from: "library" });
      router.push(photoRoute(t, uri));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open your photos.");
    }
  };

  const front = billing ? prices.garment : undefined;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: TAB_BAR_HEIGHT + 24, gap: 16 }}>
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label }}>Add Clothes</Text>
          <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Choose what your photo shows.</Text>
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

        <PhotoTypeChooser types={types} selected={selected} onSelect={select} onSource={source} />
        {error ? <Text accessibilityLiveRegion="polite" style={{ ...type.footnote, color: colors.destructive }}>{error}</Text> : null}

        <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>
          {front !== undefined
            ? `Finding the pieces is free · ${creditsLabel(front)} per piece you create`
            : "Finding the pieces is free. Each piece becomes its own item; a pair of shoes counts as one."}
        </Text>

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
