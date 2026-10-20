import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { scanOutfit } from "../../src/api/client";
import type { OutfitScan } from "../../src/api/types";
import { PhotoWithBoxes } from "../../src/components/outfit/PhotoWithBoxes";
import { ScanBand } from "../../src/components/outfit/ScanBand";
import { haptics } from "../../src/haptics";
import { pickable } from "../../src/outfit/outfit";
import { rememberScan } from "../../src/outfit/scanCache";
import { colors, radius, type } from "../../src/theme";
import { BackButton, Button } from "../../src/ui";

export const SHOW_BOXES_MS = 1400;  // let the boxes land before moving on

// Outfit Photo, Stage 1 (free): upload the photo, find the garments on the person, show them, then
// open the pick screen. No image is generated and no credits are used here.
export default function DetectScreen() {
  const router = useRouter();
  const { uri, onboarding } = useLocalSearchParams<{ uri: string; onboarding?: string }>();
  const mode = onboarding === "1" ? { onboarding: "1" } : {};  // First 3 Pieces carries on through pick and review
  const [scan, setScan] = useState<OutfitScan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    scanOutfit(uri)
      .then((result) => {
        if (!live) return;
        rememberScan(result);
        haptics.success();
        setScan(result);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Upload failed. Try again."));
    return () => { live = false; };
  }, [uri]);

  useEffect(() => {
    if (!scan) return;
    const timer = setTimeout(() => router.replace({ pathname: "/outfit/pick", params: { scanId: scan.id, uri, ...mode } }), SHOW_BOXES_MS);
    return () => clearTimeout(timer);
  }, [scan]);

  const found = scan ? pickable(scan) : [];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 44, justifyContent: "center", paddingHorizontal: 20 }}>
        <BackButton label="Cancel" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <PhotoWithBoxes uri={uri} candidates={found} overlay={scan || error ? null : <ScanBand />} />
        {error ? (
          <View style={{ gap: 12 }}>
            <Text style={{ ...type.section, color: colors.label }}>Couldn't check this photo</Text>
            <Text style={{ ...type.body, color: colors.secondaryLabel }}>{error}</Text>
            <Button title="Try Another Outfit Photo" onPress={() => router.replace({ pathname: "/capture/camera", params: { mode: "outfit", ...mode } })} />
          </View>
        ) : (
          <View style={{ alignItems: "center", gap: 8 }}>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={{ ...type.section, color: colors.label }}>
              {scan ? (found.length === 1 ? "1 garment found" : `${found.length} garments found`) : "Finding garments…"}
            </Text>
            <View style={{ paddingHorizontal: 12, height: 28, borderRadius: radius.pill, backgroundColor: colors.grouped, justifyContent: "center" }}>
              <Text style={{ ...type.footnote, fontWeight: "600", color: colors.successText }}>Detection is free</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
