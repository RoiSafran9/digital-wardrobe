import React, { useRef, useState, useEffect } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CAMERA_INK, FlowBar, Viewfinder } from "../../src/components/capture/FlowChrome";
import { Icon, type IconName } from "../../src/components/Icon";
import { useCredits } from "../../src/credits/CreditsProvider";
import { haptics } from "../../src/haptics";
import { useFirstPiecesMaybe } from "../../src/firstPieces/FirstPiecesProvider";
import { PressScale } from "../../src/motion/PressScale";
import { pickPhoto, pickPhotos } from "../../src/photoPicker";
import { hitSlopFor, radius, type, weight } from "../../src/theme";
import { useReducedMotion } from "../../src/useReducedMotion";
import { Button } from "../../src/ui";
import { track, trackPermission, useScreenViewed } from "../../src/activity/track";

type Mode = "garments" | "outfit";
const MODES: { value: Mode; label: string; icon: IconName }[] = [
  { value: "garments", label: "Garments", icon: "flat" },
  { value: "outfit", label: "Outfit", icon: "person2" },
];

// Unified Add Clothes (docs/features/unified-add-clothes): when the type was chosen before the camera
// opened (Home's Laid flat / Worn, First 3 Pieces) the camera never asks again. Only the tab bar's camera
// opens without one, and then the Garments / Outfit switch chooses it. The title names the type.
export const TITLES: Record<Mode, string> = { garments: "Clothes by themselves", outfit: "Someone wearing them" };
export const HINTS: Record<Mode, string> = {
  garments: "Lay clothes out or hang them. Shoes: low side angle.",
  outfit: "Keep the clothing visible; full outfit in frame.",
};

// Where a photo goes next: garments to the preview and quote, outfits to the free scan (in First 3
// Pieces' onboarding mode when it came from there).
export function nextRoute(mode: Mode, uri: string, onboarding = false) {
  return mode === "outfit"
    ? { pathname: "/outfit/detect" as const, params: onboarding ? { uri, onboarding: "1" } : { uri } }
    : { pathname: "/capture/preview" as const, params: { uri } };
}

// The Garments / Outfit switch under the viewfinder, only when the camera opened without a type (the tab
// bar's camera): a white segment on white 14% that springs to the choice (a 200ms slide under Reduce
// Motion). Each option carries its icon, the same as Home's Laid flat / Worn.
function ModeSwitch({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const reduced = useReducedMotion();
  const [spots, setSpots] = useState<Partial<Record<Mode, { x: number; width: number }>>>({});
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const spot = spots[value];
  useEffect(() => {
    if (!spot) return;
    if (!placed.current) {
      placed.current = true;
      x.setValue(spot.x);
      w.setValue(spot.width);
      return;
    }
    const to = (v: Animated.Value, toValue: number) => (reduced
      ? Animated.timing(v, { toValue, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: false })
      : Animated.spring(v, { toValue, damping: 14, stiffness: 180, mass: 1, useNativeDriver: false }));
    const anim = Animated.parallel([to(x, spot.x), to(w, spot.width)]);
    anim.start();
    return () => anim.stop();
  }, [spot?.x, spot?.width, reduced, x, w]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 3, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.14)" }}>
      {spot ? (
        <Animated.View pointerEvents="none" style={{ position: "absolute", top: 3, bottom: 3, left: x, width: w, borderRadius: radius.pill, backgroundColor: CAMERA_INK }} />
      ) : null}
      {MODES.map((m) => {
        const on = m.value === value;
        return (
          <Pressable key={m.value} accessibilityRole="tab" accessibilityLabel={m.label} accessibilityState={{ selected: on }} hitSlop={hitSlopFor(31, 80)}
            onLayout={(e) => { const { x: left, width } = e.nativeEvent.layout; setSpots((s) => ({ ...s, [m.value]: { x: left, width } })); }}
            onPress={() => { if (on) return; haptics.selection(); onChange(m.value); }}
            style={{ paddingVertical: 7, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: on && !spot ? CAMERA_INK : "transparent" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name={m.icon} size={16} color={on ? "#000000" : CAMERA_INK} />
              <Text style={{ ...type.toast, color: on ? "#000000" : CAMERA_INK }}>{m.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CameraScreen() {
  useScreenViewed("camera");
  const router = useRouter();
  const { outfit: outfitOn } = useCredits();
  const params = useLocalSearchParams<{ mode?: string; collect?: string; onboarding?: string }>();
  // First 3 Pieces, Path A: each shot joins the photo tray and the camera stays open until Done.
  const firstPieces = useFirstPiecesMaybe();
  const collecting = params.collect === "1" && !!firstPieces;
  const [taken, setTaken] = useState<string[]>([]);
  // No mode in the route (the tab bar's camera) → let the user choose, when outfits are offered.
  const choosing = !params.mode && !collecting && !!outfitOn;
  const [picked, setPicked] = useState<Mode>("garments");
  const mode: Mode = choosing ? picked : params.mode === "outfit" && outfitOn ? "outfit" : "garments";
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  // In a full-screen modal over the camera the reported inset can come back as 0; never let the
  // close button sit under the status bar or Dynamic Island, where it can't be tapped.
  const top = Math.max(insets.top, 54) + 6;
  const bottom = Math.max(insets.bottom, 20);
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => (router.canGoBack() ? router.back() : router.replace("/first-pieces/photos"));
  useEffect(() => {
    if (permission && permission.status !== "undetermined") trackPermission("camera", permission.granted);
  }, [permission?.status, permission?.granted]);  // eslint-disable-line react-hooks/exhaustive-deps

  const go = (uri: string, from: "camera" | "library") => {
    if (!collecting) {
      track("capture_source", { flow: mode === "outfit" ? "outfit" : "garment", from });
      return router.replace(nextRoute(mode, uri, params.onboarding === "1"));
    }
    firstPieces!.addPhotos([uri], "camera");
    setTaken((t) => [...t, uri]);
  };

  async function shoot() {
    if (busy) return;
    setBusy(true);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.8 });
      haptics.light();
      if (photo?.uri) go(photo.uri, "camera");
    } catch {
      setError("Couldn't take the photo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function library() {
    setError(null);
    try {
      if (collecting) {
        const uris = await pickPhotos();
        if (uris.length) { firstPieces!.addPhotos(uris, "library"); done(); }
        return;
      }
      const uri = await pickPhoto(false);
      if (uri) go(uri, "library");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open your photos.");
    }
  }

  const close = { icon: "close" as const, label: "Close camera", onPress: () => (router.canGoBack() ? router.back() : router.replace("/")) };
  const errorText = error ? <Text style={{ ...type.footnote, color: "#FF8A8A", textAlign: "center", paddingHorizontal: 20 }}>{error}</Text> : null;

  if (permission && !permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000000", paddingTop: top, paddingBottom: bottom }}>
        <StatusBar style="light" />
        <FlowBar dark left={close} />
        <Viewfinder>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 36 }}>
            <Icon name="camera" size={40} color="rgba(255,255,255,0.6)" />
            <Text accessibilityRole="header" style={{ ...type.title3, color: CAMERA_INK, textAlign: "center", marginTop: 4 }}>Camera access is off</Text>
            <Text style={{ ...type.subhead, color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
              Allow the camera to photograph your clothes, or pick a photo you already took.
            </Text>
          </View>
        </Viewfinder>
        <View style={{ minHeight: 170, justifyContent: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 12 }}>
          {errorText}
          {permission.canAskAgain ? <Button title="Allow Camera" onPress={() => void requestPermission()} /> : null}
          <Button title="Choose from Library" variant="secondary" icon="photos" onPress={library} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000000", paddingTop: top, paddingBottom: bottom }}>
      <StatusBar style="light" />
      <FlowBar dark left={close} title={TITLES[mode]}
        right={collecting ? (
          <Pressable onPress={done} accessibilityRole="button" accessibilityLabel={`Done, ${taken.length} ${taken.length === 1 ? "photo" : "photos"}`} hitSlop={hitSlopFor(36, 60)}
            style={{ height: 36, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: CAMERA_INK, justifyContent: "center" }}>
            <Text style={{ ...type.subhead, ...weight(700), color: "#000000" }}>Done</Text>
          </Pressable>
        ) : null} />

      <Viewfinder>
        {permission?.granted ? <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" /> : null}
        <View pointerEvents="none" style={{ position: "absolute", top: 20, left: 20, right: 20, alignItems: "center" }}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.5)" }}>
            <Text style={{ ...type.footnote, ...weight(600), color: CAMERA_INK, textAlign: "center" }}>{HINTS[mode]}</Text>
          </View>
        </View>
      </Viewfinder>

      <View style={{ minHeight: 170, alignItems: "center", justifyContent: "center", gap: 18, paddingVertical: 12 }}>
        {errorText}
        {collecting ? (
          <Text accessibilityLiveRegion="polite" style={{ ...type.footnote, ...weight(600), color: CAMERA_INK, textAlign: "center" }}>
            {taken.length ? `${taken.length} ${taken.length === 1 ? "photo" : "photos"} added · keep going or tap Done` : "Take as many photos as you like"}
          </Text>
        ) : choosing ? (
          <ModeSwitch value={mode} onChange={setPicked} />
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 36 }}>
          <Pressable onPress={library} accessibilityRole="button" accessibilityLabel="Choose from Library" hitSlop={hitSlopFor(44, 44)}
            style={{ width: 64, alignItems: "center", gap: 6 }}>
            {({ pressed }) => (
              <>
                <View style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)", backgroundColor: pressed ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="photos" size={20} color={CAMERA_INK} />
                </View>
                <Text style={{ ...type.caption, ...weight(600), color: CAMERA_INK }}>Library</Text>
              </>
            )}
          </Pressable>
          <PressScale onPress={shoot} disabled={busy || !permission?.granted} accessibilityRole="button" accessibilityLabel={mode === "outfit" ? "Take outfit photo" : "Take garment photo"} scaleTo={0.92}
            style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: CAMERA_INK, padding: 4, opacity: busy ? 0.6 : 1 }}>
            <View style={{ flex: 1, borderRadius: 30, backgroundColor: CAMERA_INK }} />
          </PressScale>
          {collecting && taken.length ? (
            <Image source={{ uri: taken[taken.length - 1] }} accessibilityLabel="Last photo taken"
              style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderColor: CAMERA_INK }} />
          ) : <View style={{ width: 64 }} />}
        </View>
      </View>
    </View>
  );
}
