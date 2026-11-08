import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { creditsLabel } from "../../src/credits/credits";
import { useCredits } from "../../src/credits/CreditsProvider";
import { useFirstPieces, type Round } from "../../src/firstPieces/FirstPiecesProvider";
import { idsParam } from "../../src/firstPieces/celebrate";
import { useNotify } from "../../src/notifications";
import { colors, radius, type, weight } from "../../src/theme";
import { Button, CostSheet, Glass, GlassScreen, IconButton, InsufficientCreditsSheet, ProgressBar, Shimmer } from "../../src/ui";
import { LEAVE_NOTE, LEAVE_NOTE_NOTIFY } from "../capture/processing";

export const ROUND_TITLE = "Creating your first pieces…";

export const madeIds = (round: Round) => round.jobs.flatMap((j) => j.itemIds ?? []);

type Job = Round["jobs"][number];

// What the server says about one photo's job: never a stage or a percentage made up from time.
export function jobStatusText(job: Job): string {
  const n = job.plan.indexes.length;
  if (job.status === "succeeded") return `${Math.min(n, job.itemIds?.length ?? 0)} of ${n} made`;
  if (job.status === "failed") return "Couldn't be made";
  if (job.status === "unsent") return "Not started";
  if (job.offline) return "Reconnecting — still being made";
  if (!job.jobId) return "Sending…";
  const p = job.progress;
  if (p && p.total > 0) {
    if (p.done >= p.total) return "Saving to your closet…";
    const failed = p.made !== null && p.made !== undefined ? p.done - p.made : 0;
    return `${p.done} of ${p.total} done${failed > 0 ? ` · ${failed} couldn't be made` : ""}`;
  }
  return job.phase === "queued" ? "Waiting for a free spot…" : "Working on it…";
}

// One glass row per photo: its thumbnail (blurred under a shimmer until the job is done), the piece
// count, where the job is, and a thin bar only when the server has counted its pieces (green once done);
// otherwise a spinner.
function JobRow({ job, index }: { job: Job; index: number }) {
  const n = job.plan.indexes.length;
  const done = job.status === "succeeded";
  const status = jobStatusText(job);
  const counted = job.progress && job.progress.total > 0 ? Math.min(job.progress.done, job.progress.total) / job.progress.total : null;
  return (
    <Glass radius={radius.tile} style={{ padding: 10 }}>
      <View accessible accessibilityLabel={`Photo ${index + 1}, ${status}`} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 56, height: 68, borderRadius: radius.image, overflow: "hidden", backgroundColor: colors.tile }}>
          <Image source={{ uri: job.photoUri }} blurRadius={done ? 0 : 3} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          <Shimmer active={job.status === "running"} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...type.callout, ...weight(600), color: colors.label }}>{`${n} ${n === 1 ? "piece" : "pieces"}`}</Text>
          <Text style={{ ...type.footnote, ...weight(done || job.status === "failed" ? 600 : 400),
                         color: done ? colors.successText : job.status === "failed" ? colors.destructive : colors.secondaryLabel }}>{status}</Text>
          {done ? (
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.success, marginTop: 6 }} />
          ) : job.status === "running" ? (
            counted !== null
              ? <View style={{ marginTop: 6 }}><ProgressBar value={counted} height={6} accessibilityLabel={status} /></View>
              : <ActivityIndicator size="small" color={colors.tint} style={{ alignSelf: "flex-start", marginTop: 4 }} />
          ) : null}
        </View>
      </View>
    </Glass>
  );
}

// First 3 Pieces, Path A: the round's jobs, one per photo, with the server's piece counts. Leaving is
// fine (Home shows the round); a finished round opens the closet with the first-success popup.
export default function FirstPiecesProcessing() {
  const router = useRouter();
  const { billing, prices } = useCredits();
  const { enabled: notifying } = useNotify();
  const { round, summary, sendUnsent, retryFailed, finishRound } = useFirstPieces();
  const [shortSeen, setShortSeen] = useState(false);
  const [confirmPrice, setConfirmPrice] = useState(false);

  const toCloset = () => {
    if (!round) return;
    router.replace({ pathname: "/closet", params: { celebrate: "1", ids: idsParam(madeIds(round)), path: "near", at: String(Date.now()) } });
  };
  const clean = !!summary && summary.settled && summary.made > 0 && summary.notMade === 0 && summary.unsent === 0;
  useEffect(() => { if (clean) toCloset(); }, [clean]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!round || !summary) {
    return (
      <GlassScreen style={{ alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Button title="Back to Home" variant="glass" onPress={() => router.replace("/")} />
      </GlassScreen>
    );
  }

  const leave = (
    <View style={{ height: 52, justifyContent: "center", paddingHorizontal: 16 }}>
      <IconButton icon="chevronDown" label="Leave" onPress={() => router.replace("/")} />
    </View>
  );
  const unsentPieces = round.jobs.filter((j) => j.status === "unsent").reduce((n, j) => n + j.plan.indexes.length, 0);
  const errors = [...new Set(round.jobs.filter((j) => j.status === "failed" && j.error).map((j) => j.error as string))];
  const refundNote = billing ? "Credits for pieces that weren't made were returned." : null;

  const rows = (
    <View accessibilityLiveRegion="polite" style={{ gap: 10, paddingHorizontal: 20 }}>
      {round.jobs.map((j, i) => <JobRow key={j.key} job={j} index={i} />)}
    </View>
  );

  // Finished, but not everything was made: say what happened, then go on to the closet.
  if (summary.settled && !clean && !round.stopped) {
    const nothing = summary.made === 0;
    return (
      <GlassScreen>
        <SafeAreaView style={{ flex: 1 }}>
          {leave}
          <ScrollView contentContainerStyle={{ paddingTop: 6, paddingBottom: 16, gap: 20 }}>
            <View style={{ paddingHorizontal: 20, gap: 6 }}>
              <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label }}>
                {nothing ? "We couldn't make your pieces" : `${summary.made} ${summary.made === 1 ? "piece" : "pieces"} created`}
              </Text>
              <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>
                {[nothing ? null : `${summary.notMade + unsentPieces} couldn't be made.`, ...errors, summary.notMade ? refundNote : null].filter(Boolean).join(" ")}
              </Text>
            </View>
            {rows}
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 6 }}>
            {nothing ? (
              <>
                {summary.notMade ? <Button title="Try Again" onPress={() => void retryFailed()} /> : null}
                <Button title="Choose Other Photos" variant="text" onPress={() => { finishRound(); router.replace("/first-pieces/photos"); }} />
              </>
            ) : (
              <>
                <Button title="See My Closet" onPress={toCloset} />
                {summary.notMade ? <Button title="Try the Rest Again" variant="text" onPress={() => void retryFailed()} /> : null}
              </>
            )}
          </View>
        </SafeAreaView>
      </GlassScreen>
    );
  }

  return (
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        {leave}
        <ScrollView contentContainerStyle={{ paddingTop: 6, paddingBottom: 16, gap: 20 }}>
          <View style={{ paddingHorizontal: 20, gap: 6 }}>
            <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label }}>{ROUND_TITLE}</Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{notifying ? LEAVE_NOTE_NOTIFY : LEAVE_NOTE}</Text>
          </View>
          {round.stopped ? (
            <Glass radius={radius.tile} style={{ marginHorizontal: 20, padding: 16, gap: 10 }}>
              <Text style={{ ...type.headline, color: colors.label }}>
                {`${unsentPieces} ${unsentPieces === 1 ? "piece wasn't" : "pieces weren't"} started`}
              </Text>
              <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>
                {round.stopped === "credits" ? "Not enough AI credits for them. Ask the app owner for more."
                  : round.stopped === "price" ? "The price changed. Check it and confirm again."
                  : round.stopMessage ?? "Something went wrong."}
              </Text>
              {round.stopped === "price" ? <Button title="Check the Price" size="medium" onPress={() => setConfirmPrice(true)} />
                : round.stopped === "error" ? <Button title="Try Again" size="medium" onPress={() => void sendUnsent()} />
                : null}
              {summary.settled ? <Button title={summary.made ? "See My Closet" : "Back to Home"} variant="text" size="medium"
                onPress={() => { if (summary.made) toCloset(); else { finishRound(); router.replace("/"); } }} /> : null}
            </Glass>
          ) : null}
          {rows}
        </ScrollView>
      </SafeAreaView>
      <InsufficientCreditsSheet visible={round.stopped === "credits" && !shortSeen} needed={unsentPieces * (prices.garment ?? 0)}
        onClose={() => setShortSeen(true)} />
      <CostSheet
        visible={confirmPrice}
        title={`Create ${unsentPieces} ${unsentPieces === 1 ? "piece" : "pieces"}`}
        lines={[{ label: "Front image", action: "garment", count: unsentPieces }]}
        confirmLabel={`Create · ${creditsLabel(unsentPieces * (prices.garment ?? 0))}`}
        onConfirm={() => { setConfirmPrice(false); void sendUnsent(billing ? prices.garment ?? null : null); }}
        onClose={() => setConfirmPrice(false)}
      />
    </GlassScreen>
  );
}
