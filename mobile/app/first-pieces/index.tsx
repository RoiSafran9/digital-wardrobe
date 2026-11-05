import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { availableTypes, cameraRoute, photoRoute, type AddPhotoType, type PhotoSource } from "../../src/addPhoto";
import { PhotoTypeChooser } from "../../src/components/add/PhotoTypeChooser";
import { Icon } from "../../src/components/Icon";
import { useCredits } from "../../src/credits/CreditsProvider";
import { haptics } from "../../src/haptics";
import { pickPhoto } from "../../src/photoPicker";
import { entryOf, track } from "../../src/firstPieces/analytics";
import { colors, hitSlopFor, radius, type } from "../../src/theme";

export const START_TITLE = "Let's add your first 3 pieces";
export const TYPE_QUESTION = "What will your photos show?";

// First 3 Pieces, step one: what we're about to do, and what the photos show — the same two types as
// the Add tab. Clothes by themselves → the multi-photo tray (Path A, reported as path "near"); someone
// wearing them → Take Photo / Choose from Library into the outfit scan in onboarding mode (Path B,
// "not_near", only when the server offers it).
export default function FirstPiecesStart() {
  const router = useRouter();
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  const { outfit, generation } = useCredits();
  const [worn, setWorn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wornReported = useRef(false);  // path_selected "not_near" once, as before
  const types = availableTypes(!!outfit);

  useEffect(() => { track("onboarding_started", { entry: entryOf(entry) }); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => {
    track("onboarding_abandoned", { step: "start" });
    if (router.canGoBack()) router.back(); else router.replace("/");
  };
  const select = (t: AddPhotoType) => {
    haptics.selection();
    setError(null);
    if (t === "laid_out") {
      track("path_selected", { path: "near" });
      track("add_photo_type_selected", { type: t, entry: "first_pieces" });
      return router.push({ pathname: "/first-pieces/photos", params: entry ? { entry } : {} });
    }
    if (worn) return setWorn(false);  // tap again to put the sources away
    if (!wornReported.current) {
      wornReported.current = true;
      track("path_selected", { path: "not_near" });
      track("add_photo_type_selected", { type: t, entry: "first_pieces" });
    }
    setWorn(true);
  };
  const source = async (t: AddPhotoType, from: PhotoSource) => {
    setError(null);
    if (from === "camera") return router.push(cameraRoute(t, true));
    try {
      const uri = await pickPhoto(false);
      if (!uri) return;
      track("capture_source", { flow: "outfit", from: "library" });
      router.push(photoRoute(t, uri, true));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open your photos.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 44, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 20 }}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={hitSlopFor(32, 32)}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={15} color={colors.label} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 24 }}>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 64, height: 80, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed",
                                   borderColor: colors.tint, backgroundColor: colors.tintSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ ...type.headline, color: colors.tint }}>{i + 1}</Text>
            </View>
          ))}
        </View>
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label }}>{START_TITLE}</Text>
          <Text style={{ ...type.body, color: colors.secondaryLabel }}>It takes about a minute. Finding your clothes is free.</Text>
        </View>

        {generation === false ? (
          <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.grouped, borderRadius: radius.list, padding: 16, gap: 4 }}>
            <Text style={{ ...type.headline, color: colors.label }}>New images are paused</Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>You can collect photos now and create your pieces once it's back.</Text>
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          {types.length > 1 ? <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>{TYPE_QUESTION}</Text> : null}
          <PhotoTypeChooser types={types} selected={worn ? "worn" : null} onSelect={select} onSource={source} />
        </View>
        {error ? <Text style={{ ...type.footnote, color: colors.destructive }}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
