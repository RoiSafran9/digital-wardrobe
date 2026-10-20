import React, { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "../../src/components/Icon";
import { useFirstPieces } from "../../src/firstPieces/FirstPiecesProvider";
import { ROUND_CAP } from "../../src/firstPieces/round";
import { haptics } from "../../src/haptics";
import { pickPhotos } from "../../src/photoPicker";
import { colors, hitSlopFor, radius, type } from "../../src/theme";
import { BackButton, Button } from "../../src/ui";

const TIPS = [
  "Lay pieces flat on a bed or the floor, or hang them up.",
  "Several pieces in one photo is fine. Each becomes its own item.",
  "Daylight works best. Photograph each piece once.",
];
const GAP = 10;

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
      { text: "Leave", style: "destructive", onPress: () => { reset(); router.back(); } },
    ]);
  };
  const library = async () => {
    setError(null);
    try {
      const uris = await pickPhotos();
      if (uris.length) { haptics.light(); addPhotos(uris); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open your photos.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 20 }}>
        <BackButton label="Back" onPress={leave} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 18 }}>
        <View style={{ gap: 6 }}>
          <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label }}>Your photos</Text>
          <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>
            {`Add as many as you like. Each round makes up to ${ROUND_CAP} pieces.`}
          </Text>
        </View>

        {photos.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
            {photos.map((p, i) => (
              <View key={p.id} style={{ width: tile, height: tile * 1.25 }}>
                <Image source={{ uri: p.uri }} accessibilityLabel={`Photo ${i + 1}`}
                  style={{ width: "100%", height: "100%", borderRadius: radius.tile, backgroundColor: colors.tile }} resizeMode="cover" />
                <Pressable onPress={() => { haptics.selection(); removePhoto(p.id); }} accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${i + 1}`} hitSlop={hitSlopFor(26, 26)}
                  style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.card,
                           alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator }}>
                  <Icon name="close" size={11} color={colors.label} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ height: 150, borderRadius: radius.feature, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.separatorStrong,
                         alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon name="photos" size={28} color={colors.secondaryLabel} />
            <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>No photos yet</Text>
          </View>
        )}

        <View style={{ gap: 8 }}>
          <Button title="Take Garment Photos" variant="secondary"
            onPress={() => router.push({ pathname: "/capture/camera", params: { mode: "garments", collect: "1" } })} />
          <Button title="Choose Garment Photos" variant="secondary" onPress={library} />
          {error ? <Text style={{ ...type.footnote, color: colors.destructive }}>{error}</Text> : null}
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ ...type.eyebrow, color: colors.secondaryLabel }}>Tips for great results</Text>
          {TIPS.map((tip, i) => (
            <View key={tip} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={{ width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.grouped, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ ...type.footnote, fontWeight: "600", color: colors.label }}>{i + 1}</Text>
              </View>
              <Text style={{ ...type.subhead, color: colors.label, flex: 1 }}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }}>
        <Button title="Find My Pieces" onPress={() => router.push("/first-pieces/pick")} disabled={!photos.length} />
        <Text style={{ ...type.footnote, fontWeight: "600", color: colors.successText, textAlign: "center" }}>Finding them is free</Text>
      </View>
    </SafeAreaView>
  );
}
