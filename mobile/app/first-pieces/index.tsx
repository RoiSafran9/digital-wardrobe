import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GlyphTile } from "../../src/components/onboarding/GlyphTile";
import { useCredits } from "../../src/credits/CreditsProvider";
import { haptics } from "../../src/haptics";
import { Rise } from "../../src/motion/Rise";
import { pickPhoto } from "../../src/photoPicker";
import { entryOf, track } from "../../src/firstPieces/analytics";
import { colors, radius, type, weight } from "../../src/theme";
import { Button, Glass, GlassScreen, IconButton } from "../../src/ui";

export const START_TITLE = "Let's add your first 3 pieces";
export const NEAR_QUESTION = "Are you near your wardrobe?";

// Three empty frames waiting for the first pieces, each with its number on an accent badge.
function Frames() {
  return (
    <View style={{ flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 10 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {[1, 2, 3].map((n) => (
        <View key={n}>
          <GlyphTile dashed size={{ width: 96, height: 120 }} />
          <View style={{ position: "absolute", top: 8, left: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ ...type.footnote, ...weight(700), color: colors.onTint }}>{n}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// First 3 Pieces, step one: what we're about to do, and where the clothes are. Near the wardrobe →
// photograph garments (Path A); not near it → an outfit photo (Path B, only when the server offers it).
export default function FirstPiecesStart() {
  const router = useRouter();
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  const { outfit, generation } = useCredits();
  const [away, setAway] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { track("onboarding_started", { entry: entryOf(entry) }); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => {
    track("onboarding_abandoned", { step: "start" });
    if (router.canGoBack()) router.back(); else router.replace("/");
  };
  const near = () => { haptics.selection(); track("path_selected", { path: "near" }); router.push({ pathname: "/first-pieces/photos", params: entry ? { entry } : {} }); };
  const outfitPhoto = async () => {
    setError(null);
    try {
      const uri = await pickPhoto(false);
      if (uri) router.push({ pathname: "/outfit/detect", params: { uri, flow: "outfit", onboarding: "1" } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open your photos.");
    }
  };

  return (
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ height: 52, justifyContent: "center", paddingHorizontal: 16 }}>
          <IconButton icon="close" label="Close" onPress={close} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <Frames />
          <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label, marginTop: 30 }}>{START_TITLE}</Text>
          <Text style={{ ...type.body, color: colors.secondaryLabel, marginTop: 8 }}>It takes about a minute. Finding your clothes is free.</Text>

          {generation === false ? (
            <View accessibilityLiveRegion="polite" style={{ marginTop: 20 }}>
              <Glass radius={radius.list} style={{ padding: 16, gap: 4 }}>
                <Text style={{ ...type.headline, color: colors.label }}>New images are paused</Text>
                <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>You can collect photos now and create your pieces once it's back.</Text>
              </Glass>
            </View>
          ) : null}

          {outfit ? (
            <>
              <Glass radius={radius.tile} style={{ marginTop: 28, padding: 16 }}>
                <Text accessibilityRole="header" style={{ ...type.headline, ...weight(700), color: colors.label }}>{NEAR_QUESTION}</Text>
                <View style={{ gap: 8, marginTop: 14 }}>
                  <Button title="Yes, I'm near it" icon="camera" onPress={near} />
                  <Button title="Not right now" variant="soft"
                    onPress={() => { haptics.selection(); if (!away) track("path_selected", { path: "not_near" }); setAway(true); }} />
                </View>
              </Glass>
              {away ? (
                <Rise>
                  <Glass radius={radius.tile} style={{ marginTop: 10, padding: 16, gap: 8 }}>
                    <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginBottom: 6 }}>Use what you're wearing, or an outfit photo you have.</Text>
                    <Button title="Take Outfit Photo" icon="camera" onPress={() => router.push({ pathname: "/capture/camera", params: { mode: "outfit", onboarding: "1" } })} />
                    <Button title="Choose Outfit Photo" icon="photos" variant="glass" onPress={outfitPhoto} />
                    <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 2 }}>A photo of someone wearing the clothes, full body in view.</Text>
                  </Glass>
                </Rise>
              ) : null}
            </>
          ) : (
            <View style={{ marginTop: 28 }}>
              <Button title="Get Started" icon="camera" onPress={near} />
            </View>
          )}
          {error ? <Text style={{ ...type.footnote, color: colors.destructive, marginTop: 12 }}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </GlassScreen>
  );
}
