import React, { useEffect } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { GARMENT_STAGES, ProcessingCard } from "../../src/components/capture/ProcessingCard";
import { Icon } from "../../src/components/Icon";
import { useCredits } from "../../src/credits/CreditsProvider";
import { TRY_AS_OUTFIT, isWornRejection } from "../../src/outfit/outfit";
import { useCaptureJobs } from "../../src/store/captureJobs";
import { useNotify } from "../../src/notifications";
import { colors, hitSlopFor, radius, type } from "../../src/theme";
import { Button, InsufficientCreditsSheet } from "../../src/ui";
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Button title="Back to Home" variant="secondary" onPress={() => router.replace("/")} />
      </SafeAreaView>
    );
  }

  const leave = (
    <View style={{ height: 44, justifyContent: "center", paddingHorizontal: 20 }}>
      <Pressable onPress={() => router.replace("/")} accessibilityRole="button" accessibilityLabel="Leave" hitSlop={hitSlopFor(32, 32)}
        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" }}>
        <Icon name="close" size={15} color={colors.label} />
      </Pressable>
    </View>
  );

  if (current.status === "failed" && !current.insufficient) {
    const worn = outfitOn && isWornRejection(current.error);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {leave}
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 18 }}>
          <View style={{ width: 160, height: 200 }}>
            <Image source={{ uri: current.photoUri }} style={{ width: "100%", height: "100%", borderRadius: radius.feature, opacity: 0.4 }} resizeMode="cover" />
            <View style={{ position: "absolute", top: -10, right: -10, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.destructive, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ ...type.headline, color: "#FFFFFF" }}>!</Text>
            </View>
          </View>
          <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>Generation paused</Text>
          <Text style={{ ...type.body, color: colors.secondaryLabel, textAlign: "center" }}>
            {[current.error, billing ? "Credits for unfinished items were returned to your balance." : null].filter(Boolean).join(" ")}
          </Text>
          <View style={{ alignSelf: "stretch", gap: 6, marginTop: 8 }}>
            {worn ? (
              <Button title={TRY_AS_OUTFIT} onPress={() => { const uri = current.photoUri; clear(); router.replace({ pathname: "/outfit/detect", params: { uri } }); }} />
            ) : (
              <Button title="Try Again" onPress={retry} />
            )}
            <Button title="Back to Preview" variant="text" onPress={() => { const uri = current.photoUri; clear(); router.replace({ pathname: "/capture/preview", params: { uri } }); }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const fronts = current.maxFronts;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {leave}
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 24 }}>
        <ProcessingCard
          photoUri={current.photoUri}
          stages={GARMENT_STAGES}
          startedAt={current.startedAt}
          title={fronts ? `Creating up to ${fronts} catalog ${fronts === 1 ? "image" : "images"}` : "Creating catalog images"}
          note={notifying ? LEAVE_NOTE_NOTIFY : LEAVE_NOTE}
          count={current.progress}
        />
      </ScrollView>
      <InsufficientCreditsSheet
        visible={!!current.insufficient}
        needed={(fronts ?? 1) * (prices.garment ?? 0)}
        onClose={() => { const uri = current.photoUri; clear(); router.replace({ pathname: "/capture/preview", params: { uri } }); }}
      />
    </SafeAreaView>
  );
}
