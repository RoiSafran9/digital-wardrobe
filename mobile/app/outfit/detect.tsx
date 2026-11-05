import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { scanOutfit } from "../../src/api/client";
import type { OutfitScan } from "../../src/api/types";
import { FlowBar } from "../../src/components/capture/FlowChrome";
import { PhotoWithBoxes } from "../../src/components/outfit/PhotoWithBoxes";
import { ScanBand } from "../../src/components/outfit/ScanBand";
import { haptics } from "../../src/haptics";
import { pickable } from "../../src/outfit/outfit";
import { rememberScan } from "../../src/outfit/scanCache";
import { colors, radius, type, weight } from "../../src/theme";
import { Button, Glass, GlassScreen } from "../../src/ui";
import { useScreenViewed } from "../../src/activity/track";

export const SHOW_BOXES_MS = 1400;  // let the boxes land before moving on

// "Detection is free", floating on glass at the top of the photo.
function FreePill() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 12, left: 0, right: 0, alignItems: "center" }}>
      <Glass radius={radius.pill} level="base" style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
        <Text style={{ ...type.footnote, ...weight(700), color: colors.label }}>Detection is free</Text>
      </Glass>
    </View>
  );
}

// Outfit Photo, Stage 1 (free): upload the photo, find the garments on the person, show them, then
// open the pick screen. No image is generated and no credits are used here.
export default function DetectScreen() {
  useScreenViewed("outfit_detect");
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
  const title = error ? undefined : scan ? (found.length === 1 ? "1 garment found" : `${found.length} garments found`) : "Finding garments…";
  return (
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        <FlowBar left={{ icon: "chevronLeft", label: "Cancel", onPress: () => router.back() }} title={title} live />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24, gap: 20 }}>
          <PhotoWithBoxes framed uri={uri} candidates={found} maxHeight={520}
            overlay={error ? null : <>{scan ? null : <ScanBand />}<FreePill /></>} />
          {error ? (
            <View style={{ gap: 10 }}>
              <Text accessibilityRole="header" style={{ ...type.title2, color: colors.label }}>Couldn't check this photo</Text>
              <Text style={{ ...type.body, color: colors.secondaryLabel }}>{error}</Text>
              <View style={{ marginTop: 8 }}>
                <Button title="Try Another Outfit Photo" onPress={() => router.replace({ pathname: "/capture/camera", params: { mode: "outfit", ...mode } })} />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GlassScreen>
  );
}
