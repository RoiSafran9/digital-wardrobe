import React, { useEffect } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { FlowBar, PHOTO_BG } from "../../src/components/capture/FlowChrome";
import { GARMENT_STAGES, ProcessingCard } from "../../src/components/capture/ProcessingCard";
import { useCredits } from "../../src/credits/CreditsProvider";
import { TRY_AS_OUTFIT, isWornRejection } from "../../src/outfit/outfit";
import { useCaptureJobs } from "../../src/store/captureJobs";
import { useNotify } from "../../src/notifications";
import { colors, radius, type } from "../../src/theme";
import { Button, GlassScreen, InsufficientCreditsSheet } from "../../src/ui";
import { useScreenViewed } from "../../src/activity/track";

export const LEAVE_NOTE = "You can leave this screen — your pieces will appear in your closet.";
export const LEAVE_NOTE_NOTIFY = "You can leave this screen. We'll notify you when your pieces are ready.";

export default function ProcessingScreen() {
  useScreenViewed("processing");
  const router = useRouter();
  const { current, retry, clear } = useCaptureJobs();
  const { billing, outfit: outfitOn, prices } = useCredits();
  const { enabled: notifying } = useNotify();

  useEffect(() => {
    if (current?.status === "done") router.replace("/capture/results");
  }, [current?.status]);

  if (!current) {
    return (
      <GlassScreen style={{ alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Button title="Back to Home" variant="glass" onPress={() => router.replace("/")} />
      </GlassScreen>
    );
  }

  // The job keeps going on the server; leaving only closes this screen (Home shows its progress).
  const leave = <FlowBar left={{ icon: "chevronDown", label: "Leave", onPress: () => router.replace("/") }} />;

  if (current.status === "failed" && !current.insufficient) {
    const worn = outfitOn && isWornRejection(current.error);
    return (
      <GlassScreen>
        <SafeAreaView style={{ flex: 1 }}>
          {leave}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24 }}>
            <View style={{ height: 300, borderRadius: radius.hero, overflow: "hidden", backgroundColor: PHOTO_BG, alignItems: "center", justifyContent: "center" }}>
              <Image source={{ uri: current.photoUri }} style={[StyleSheet.absoluteFill, { opacity: 0.4 }]} resizeMode="cover" />
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.destructive, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ ...type.display(30), color: "#FFFFFF" }}>!</Text>
              </View>
            </View>
            <Text accessibilityRole="header" style={{ ...type.pageTitle, color: colors.label, marginTop: 18 }}>Generation paused</Text>
            <Text style={{ ...type.subhead, lineHeight: 22, color: colors.secondaryLabel, marginTop: 6 }}>
              {[current.error, billing ? "Credits for unfinished items were returned to your balance." : null].filter(Boolean).join(" ")}
            </Text>
            <View style={{ gap: 6, marginTop: 22 }}>
              {worn ? (
                <Button title={TRY_AS_OUTFIT} onPress={() => { const uri = current.photoUri; clear(); router.replace({ pathname: "/outfit/detect", params: { uri } }); }} />
              ) : (
                <Button title="Try Again" onPress={retry} />
              )}
              <Button title="Back to Preview" variant="text" onPress={() => { const uri = current.photoUri; clear(); router.replace({ pathname: "/capture/preview", params: { uri } }); }} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </GlassScreen>
    );
  }

  const fronts = current.maxFronts;
  return (
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        {leave}
        <ScrollView contentContainerStyle={{ paddingTop: 6, paddingBottom: 24 }}>
          <ProcessingCard
            photoUri={current.photoUri}
            stages={GARMENT_STAGES}
            startedAt={current.startedAt}
            title={fronts ? `Creating up to ${fronts} catalog ${fronts === 1 ? "image" : "images"}` : "Creating catalog images"}
            note={notifying ? LEAVE_NOTE_NOTIFY : LEAVE_NOTE}
            count={current.progress}
          />
        </ScrollView>
      </SafeAreaView>
      <InsufficientCreditsSheet
        visible={!!current.insufficient}
        needed={(fronts ?? 1) * (prices.garment ?? 0)}
        onClose={() => { const uri = current.photoUri; clear(); router.replace({ pathname: "/capture/preview", params: { uri } }); }}
      />
    </GlassScreen>
  );
}
