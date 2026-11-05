import React, { useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "../../src/components/Icon";
import { useFirstPieces } from "../../src/firstPieces/FirstPiecesProvider";
import { ROUND_CAP } from "../../src/firstPieces/round";
import { haptics } from "../../src/haptics";
import { pickPhotos } from "../../src/photoPicker";
import { track } from "../../src/firstPieces/analytics";
import { colors, hitSlopFor, radius, type, weight } from "../../src/theme";
import { Button, Glass, GlassScreen, IconButton } from "../../src/ui";

const TIPS = [
  "Lay pieces flat on a bed or the floor, or hang them up. Set matching shoes side by side and shoot them from a low side angle, fully in frame.",
  "Several pieces in one photo is fine. Each becomes its own item; a pair of shoes counts as one.",
  "Daylight works best. Photograph each piece once.",
];
const GAP = 8;

// First 3 Pieces, Path A: collect garment photos (camera and/or library, as many as you like), check
// them, then find the pieces. Nothing is sent until "Find My Pieces". Photos are not kept if you leave.
export default function FirstPiecesPhotos() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { photos, addPhotos, removePhoto, reset } = useFirstPieces();
  const [error, setError] = useState<string | null>(null);
  const tile = (width - 40 - GAP * 2) / 3;

  const leave = () => {
    if (!photos.length) return router.back();
    Alert.alert("Leave?", "Your photos won't be kept.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => { track("onboarding_abandoned", { step: "photos" }); reset(); router.back(); } },
    ]);
  };
  const library = async () => {
    setError(null);
    try {
      const uris = await pickPhotos();
      if (uris.length) { haptics.light(); addPhotos(uris, "library"); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open your photos.");
    }
  };

  return (
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ height: 52, justifyContent: "center", paddingHorizontal: 16 }}>
          <IconButton icon="chevronLeft" label="Back" onPress={leave} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Text accessibilityRole="header" style={{ ...type.display(30), color: colors.label }}>Your photos</Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>
              {`Add as many as you like. Each round makes up to ${ROUND_CAP} pieces.`}
            </Text>
          </View>

          {photos.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
              {photos.map((p, i) => (
                <View key={p.id} style={{ width: tile, height: tile * 4 / 3 }}>
                  <Image source={{ uri: p.uri }} accessibilityLabel={`Photo ${i + 1}`}
                    style={{ width: "100%", height: "100%", borderRadius: radius.primary, backgroundColor: colors.tile }} resizeMode="cover" />
                  <Pressable onPress={() => { haptics.selection(); removePhoto(p.id); }} accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${i + 1}`} hitSlop={hitSlopFor(24, 24)}
                    style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
                    <Glass radius={12} level="sheet" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
                    <Icon name="close" size={13} color={colors.label} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ height: 150, borderRadius: radius.tile, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.separatorStrong,
                           alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Icon name="photos" size={28} color={colors.secondaryLabel} />
              <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>No photos yet</Text>
            </View>
          )}

          <View style={{ gap: 8 }}>
            <Button title="Take Garment Photos" variant="glass" icon="camera"
              onPress={() => router.push({ pathname: "/capture/camera", params: { mode: "garments", collect: "1" } })} />
            <Button title="Choose Garment Photos" variant="glass" icon="photos" onPress={library} />
            {error ? <Text style={{ ...type.footnote, color: colors.destructive }}>{error}</Text> : null}
          </View>

          <Glass radius={radius.tile} style={{ padding: 16, gap: 12 }}>
            <Text style={{ ...type.subhead, ...weight(700), color: colors.label }}>Tips for great results</Text>
            {TIPS.map((tip, i) => (
              <View key={tip} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                <View style={{ width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ ...type.caption, ...weight(700), color: colors.label }}>{i + 1}</Text>
                </View>
                <Text style={{ ...type.subhead, lineHeight: 21, color: colors.secondaryLabel, flex: 1 }}>{tip}</Text>
              </View>
            ))}
          </Glass>
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 8 }}>
          <Button title="Find My Pieces" disabled={!photos.length} onPress={() => {
            track("photos_collected", { count: photos.length, camera: photos.filter((p) => p.source === "camera").length,
                                        library: photos.filter((p) => p.source === "library").length });
            router.push("/first-pieces/pick");
          }} />
          <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>Finding them is free</Text>
        </View>
      </SafeAreaView>
    </GlassScreen>
  );
}
