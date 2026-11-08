import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlowBar } from "../../src/components/capture/FlowChrome";
import { ProcessingCard } from "../../src/components/capture/ProcessingCard";
import { ErrorNote } from "../../src/components/ErrorNote";
import { useCredits } from "../../src/credits/CreditsProvider";
import { useOutfitJobs, type OutfitJob } from "../../src/jobs/OutfitJobsProvider";
import { useNotify } from "../../src/notifications";
import { colors, type } from "../../src/theme";
import { Button, GlassScreen } from "../../src/ui";

export const OUTFIT_LEAVE_NOTE = "You can leave this screen — we'll keep your garments ready for review.";
export const OUTFIT_LEAVE_NOTE_NOTIFY = "You can leave this screen. We'll notify you when your garments are ready for review.";

const failedNames = (job: OutfitJob) => (job.failed ?? []).map((id) => (job.names[id] ?? "a garment").toLowerCase());

// One outfit photo's images being made on the server (the job details behind the banner). It follows the
// job's real status and counts; finishing never moves the user on by itself — it says "Ready for review"
// and waits for them. Results still go through review before anything joins the closet.
export default function OutfitProgressScreen() {
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key?: string }>();
  const { jobs, dismiss } = useOutfitJobs();
  const { billing } = useCredits();
  const { enabled: notifying } = useNotify();
  const job = jobs.find((j) => j.key === key) ?? null;
  const leave = <FlowBar left={{ icon: "chevronDown", label: "Leave", onPress: () => router.replace("/") }} />;

  if (!job) {
    return (
      <GlassScreen style={{ alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Button title="Back to Home" variant="glass" onPress={() => router.replace("/")} />
      </GlassScreen>
    );
  }

  const n = job.candidateIds.length;
  const failed = failedNames(job);
  if (job.state === "succeeded") {
    const made = job.itemIds?.length ?? 0;
    const review = () => router.replace({ pathname: "/outfit/review", params: {
      ...(failed.length ? { failed: failed.join(", ") } : {}), ...(job.onboarding ? { onboarding: "1" } : {}) } });
    return (
      <GlassScreen>
        <SafeAreaView style={{ flex: 1 }}>
          {leave}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24, gap: 14 }}>
            <View accessibilityLiveRegion="polite" style={{ gap: 6 }}>
              <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label }}>Ready for review</Text>
              <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>
                {`${made} ${made === 1 ? "garment is" : "garments are"} waiting for you to keep or discard. Nothing joins your closet until you do.`}
              </Text>
            </View>
            {failed.length ? <ErrorNote message={`Couldn't make: ${failed.join(", ")}. Those weren't charged — try again, or photograph them laid flat.`} /> : null}
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 6 }}>
            <Button title="Review Now" onPress={review} />
            <Button title="Later" variant="text" onPress={() => router.replace("/")} />
          </View>
        </SafeAreaView>
      </GlassScreen>
    );
  }

  if (job.state === "failed") {
    return (
      <GlassScreen>
        <SafeAreaView style={{ flex: 1 }}>
          {leave}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24, gap: 14 }}>
            <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label }}>We couldn't make your garments</Text>
            <ErrorNote message={[job.error ?? "Something went wrong.", billing ? "Credits held for them were returned." : null].filter(Boolean).join(" ")} />
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
            <Button title="Back to Home" onPress={() => { dismiss(job.key); router.replace("/"); }} />
          </View>
        </SafeAreaView>
      </GlassScreen>
    );
  }

  return (
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        {leave}
        <ScrollView contentContainerStyle={{ paddingTop: 6, paddingBottom: 24 }}>
          <ProcessingCard
            kind="outfit"
            photoUri={job.photoUri ?? ""}
            view={{ state: job.state, progress: job.progress, offline: job.offline }}
            title={n === 1 ? "Creating 1 catalog image" : `Creating ${n} catalog images`}
            note={notifying ? OUTFIT_LEAVE_NOTE_NOTIFY : OUTFIT_LEAVE_NOTE}
          />
        </ScrollView>
      </SafeAreaView>
    </GlassScreen>
  );
}
