import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "../../src/components/Icon";
import { useCredits } from "../../src/credits/CreditsProvider";
import { haptics } from "../../src/haptics";
import { pickPhoto } from "../../src/photoPicker";
import { hitSlopFor, radius, type } from "../../src/theme";
import { Button } from "../../src/ui";

type Mode = "garments" | "outfit";
// The camera is always dark, whatever the appearance; these are fixed, not theme colors.
const INK = "#FFFFFF";
const MODE_ON = "#FFD60A";  // the system camera's selected-mode yellow

export const HINTS: Record<Mode, string> = {
  garments: "Lay pieces flat · daylight works best",
  outfit: "Full body in view · good light",
};

// Where a photo goes next: garments to the preview and quote, outfits to the free scan.
export function nextRoute(mode: Mode, uri: string) {
  return mode === "outfit"
    ? { pathname: "/outfit/detect" as const, params: { uri } }
    : { pathname: "/capture/preview" as const, params: { uri } };
}

export default function CameraScreen() {
  const router = useRouter();
  const { outfit: outfitOn } = useCredits();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === "outfit" && outfitOn ? "outfit" : "garments");
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  // In a full-screen modal over the camera the reported inset can come back as 0; never let the
  // close button sit under the status bar or Dynamic Island, where it can't be tapped.
  const top = Math.max(insets.top, 54) + 6;
  const bottom = Math.max(insets.bottom, 20);
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (uri: string) => router.replace(nextRoute(mode, uri));

  async function shoot() {
    if (busy) return;
    setBusy(true);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.8 });
      haptics.light();
      if (photo?.uri) go(photo.uri);
    } catch {
      setError("Couldn't take the photo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function library() {
    setError(null);
    try {
      const uri = await pickPhoto(false);
      if (uri) go(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open your photos.");
    }
  }

  const close = (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} accessibilityRole="button" accessibilityLabel="Close camera" hitSlop={hitSlopFor(40, 40)}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
      <Icon name="close" size={16} color={INK} />
    </Pressable>
  );

  if (permission && !permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", paddingHorizontal: 20, paddingTop: top, paddingBottom: bottom }}>
        {close}
        <View style={{ flex: 1, justifyContent: "center", gap: 14 }}>
          <Text style={{ ...type.section, color: INK }}>Camera access is off</Text>
          <Text style={{ ...type.body, color: "rgba(255,255,255,0.75)" }}>
            Allow the camera to photograph your clothes, or pick a photo you already took.
          </Text>
          {permission.canAskAgain ? <Button title="Allow Camera" onPress={() => void requestPermission()} /> : null}
          <Button title={mode === "outfit" ? "Choose Outfit Photo" : "Choose Garment Photo"} variant="secondary" onPress={library} />
          {error ? <Text style={{ ...type.footnote, color: "#FF8A8A" }}>{error}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {permission?.granted ? <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" /> : null}
      <View style={{ flex: 1, justifyContent: "space-between", paddingTop: top, paddingBottom: bottom }}>
        <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {close}
          <Text style={{ ...type.subhead, fontWeight: "600", color: INK }}>{mode === "outfit" ? "Outfit" : "Garments"}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Corner brackets frame where the clothes should go. */}
        <View pointerEvents="none" style={{ marginHorizontal: 36, aspectRatio: 0.8, alignSelf: "stretch" }}>
          {(["tl", "tr", "bl", "br"] as const).map((c) => (
            <View key={c} style={{
              position: "absolute", width: 34, height: 34, borderColor: INK,
              top: c[0] === "t" ? 0 : undefined, bottom: c[0] === "b" ? 0 : undefined,
              left: c[1] === "l" ? 0 : undefined, right: c[1] === "r" ? 0 : undefined,
              borderTopWidth: c[0] === "t" ? 3 : 0, borderBottomWidth: c[0] === "b" ? 3 : 0,
              borderLeftWidth: c[1] === "l" ? 3 : 0, borderRightWidth: c[1] === "r" ? 3 : 0,
              borderTopLeftRadius: c === "tl" ? 14 : 0, borderTopRightRadius: c === "tr" ? 14 : 0,
              borderBottomLeftRadius: c === "bl" ? 14 : 0, borderBottomRightRadius: c === "br" ? 14 : 0,
            }} />
          ))}
          <View style={{ position: "absolute", top: 14, alignSelf: "center", paddingHorizontal: 12, height: 30, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center" }}>
            <Text style={{ ...type.footnote, fontWeight: "600", color: INK }}>{HINTS[mode]}</Text>
          </View>
        </View>

        <View style={{ paddingBottom: 12, gap: 18 }}>
          {error ? <Text style={{ ...type.footnote, color: "#FF8A8A", textAlign: "center" }}>{error}</Text> : null}
          {outfitOn ? (
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 22 }}>
              {(["garments", "outfit"] as const).map((m) => (
                <Pressable key={m} onPress={() => { haptics.selection(); setMode(m); }} accessibilityRole="tab"
                  accessibilityLabel={m === "garments" ? "Garments" : "Outfit"} accessibilityState={{ selected: mode === m }} hitSlop={hitSlopFor(24, 80)}>
                  <Text style={{ ...type.footnote, fontWeight: "700", letterSpacing: 1, color: mode === m ? MODE_ON : INK }}>
                    {m === "garments" ? "GARMENTS" : "OUTFIT"}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 36 }}>
            <Pressable onPress={library} accessibilityRole="button" accessibilityLabel={mode === "outfit" ? "Choose an outfit photo from your library" : "Choose a garment photo from your library"} hitSlop={hitSlopFor(48, 48)}
              style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
              <Icon name="closet" size={22} color={INK} />
            </Pressable>
            <Pressable onPress={shoot} disabled={busy || !permission?.granted} accessibilityRole="button" accessibilityLabel={mode === "outfit" ? "Take outfit photo" : "Take garment photo"}
              style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: INK, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
              <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: INK }} />
            </Pressable>
            <View style={{ width: 48 }} />
          </View>
        </View>
      </View>
    </View>
  );
}
