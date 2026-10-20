import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon, type IconName } from "../../src/components/Icon";
import { useCredits } from "../../src/credits/CreditsProvider";
import { haptics } from "../../src/haptics";
import { PressScale } from "../../src/motion/PressScale";
import { pickPhoto } from "../../src/photoPicker";
import { colors, hitSlopFor, radius, type } from "../../src/theme";
import { Button } from "../../src/ui";

export const START_TITLE = "Let's add your first 3 pieces";
export const NEAR_QUESTION = "Are you near your wardrobe?";

function Choice({ icon, title, body, selected, onPress }: { icon: IconName; title: string; body: string; selected?: boolean; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected: !!selected }} scaleTo={0.98}
      style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.list,
               backgroundColor: selected ? colors.tintSoft : colors.grouped, borderWidth: 1.5, borderColor: selected ? colors.tint : "transparent" }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={22} color={colors.tint} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...type.headline, color: colors.label }}>{title}</Text>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{body}</Text>
      </View>
      <Icon name="chevron" size={15} color={colors.secondaryLabel} />
    </PressScale>
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

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const near = () => { haptics.selection(); router.push({ pathname: "/first-pieces/photos", params: entry ? { entry } : {} }); };
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

        {outfit ? (
          <View style={{ gap: 12 }}>
            <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>{NEAR_QUESTION}</Text>
            <Choice icon="hanger" title="Yes, I'm near it" body="Photograph a few pieces. Several in one photo is fine." onPress={near} />
            <Choice icon="person2" title="Not right now" body="Use what you're wearing, or an outfit photo you have." selected={away}
              onPress={() => { haptics.selection(); setAway(true); }} />
            {away ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Button title="Take Outfit Photo" onPress={() => router.push({ pathname: "/capture/camera", params: { mode: "outfit", onboarding: "1" } })} />
                <Button title="Choose Outfit Photo" variant="secondary" onPress={outfitPhoto} />
                <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>A photo of someone wearing the clothes, full body in view.</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Button title="Get Started" onPress={near} />
        )}
        {error ? <Text style={{ ...type.footnote, color: colors.destructive }}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
