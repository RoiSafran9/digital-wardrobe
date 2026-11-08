import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon, type IconName } from "../../src/components/Icon";
import { GlyphTile } from "../../src/components/onboarding/GlyphTile";
import { PressScale } from "../../src/motion/PressScale";
import { useCredits } from "../../src/credits/CreditsProvider";
import { useMorningReminder } from "../../src/morningReminder/MorningReminderProvider";
import { haptics } from "../../src/haptics";
import { Rise } from "../../src/motion/Rise";
import { pickPhoto } from "../../src/photoPicker";
import { entryOf, track } from "../../src/firstPieces/analytics";
import { colors, radius, type, weight } from "../../src/theme";
import { Button, Glass, GlassScreen, IconButton } from "../../src/ui";

export const START_TITLE = "Let's add your first 3 pieces";
// Unified Add Clothes: the same photo-type question and words as the rest of the app (the analytics
// keep their old values: laid out = path "near", someone wearing them = path "not_near").
export const TYPE_QUESTION = "What does your photo show?";

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

// One photo type: a glass card with its icon, name and what the photo looks like. Selected = ink fill.
function TypeCard({ icon, title, caption, selected, onPress }: { icon: IconName; title: string; caption: string; selected?: boolean; onPress: () => void }) {
  const fg = selected ? colors.background : colors.label;
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${caption}`} accessibilityState={{ selected: !!selected }} scaleTo={0.98}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: radius.list, backgroundColor: selected ? colors.label : undefined }}>
        {selected ? null : <Glass radius={radius.list} flat style={StyleSheet.absoluteFill} />}
        <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: selected ? "rgba(255,255,255,0.16)" : colors.tintSoft }}>
          <Icon name={icon} size={22} color={selected ? colors.background : colors.tint} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...type.headline, ...weight(700), color: fg }}>{title}</Text>
          <Text style={{ ...type.footnote, color: selected ? colors.background : colors.secondaryLabel }}>{caption}</Text>
        </View>
        <Icon name="chevron" size={15} color={selected ? colors.background : colors.tertiaryLabel} />
      </View>
    </PressScale>
  );
}

// First 3 Pieces, step one: what we're about to do, and what the photo shows. Clothes by themselves →
// the photo tray (Path A); someone wearing them → an outfit photo (Path B, only when the server offers it).
export default function FirstPiecesStart() {
  const router = useRouter();
  // photoType=worn (the morning reminder's tap): "Someone wearing them" is already chosen, nothing else starts.
  const { entry, photoType } = useLocalSearchParams<{ entry?: string; photoType?: string }>();
  const { outfit, generation } = useCredits();
  const { noteIntroSeen } = useMorningReminder();
  const [away, setAway] = useState(photoType === "worn");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { track("onboarding_started", { entry: entryOf(entry) }); noteIntroSeen(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
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
              <Text accessibilityRole="header" style={{ ...type.title3, color: colors.label, marginTop: 28, marginBottom: 12 }}>{TYPE_QUESTION}</Text>
              <View style={{ gap: 10 }}>
                <TypeCard icon="flat" title="Clothes by themselves" caption="Laid out, hanging, or shoes together." onPress={near} />
                <TypeCard icon="person2" title="Someone wearing them" caption="A person wearing the clothes or shoes." selected={away}
                  onPress={() => { haptics.selection(); if (!away) track("path_selected", { path: "not_near" }); setAway(true); }} />
              </View>
              {away ? (
                <Rise>
                  <Glass radius={radius.tile} style={{ marginTop: 10, padding: 16, gap: 8 }}>
                    <Button title="Take Photo" icon="camera" onPress={() => router.push({ pathname: "/capture/camera", params: { mode: "outfit", onboarding: "1" } })} />
                    <Button title="Choose from Library" icon="photos" variant="glass" onPress={outfitPhoto} />
                    <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 2 }}>Keep the clothing visible; full outfit in frame.</Text>
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
