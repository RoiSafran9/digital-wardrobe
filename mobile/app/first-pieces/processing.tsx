import React, { useEffect, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { GARMENT_STAGES } from "../../src/components/capture/ProcessingCard";
import { creditsLabel } from "../../src/credits/credits";
import { useCredits } from "../../src/credits/CreditsProvider";
import { useFirstPieces, type Round } from "../../src/firstPieces/FirstPiecesProvider";
import { idsParam } from "../../src/firstPieces/celebrate";
import { useNotify } from "../../src/notifications";
import { colors, radius, type, weight } from "../../src/theme";
import { Button, CostSheet, Glass, GlassScreen, IconButton, InsufficientCreditsSheet, Shimmer } from "../../src/ui";
import { LEAVE_NOTE, LEAVE_NOTE_NOTIFY } from "../capture/processing";

export const ROUND_TITLE = "Creating your first pieces…";

export const madeIds = (round: Round) => round.jobs.flatMap((j) => j.itemIds ?? []);

type Job = Round["jobs"][number];

// Server work with nothing to show yet eases toward 90% on a timer, faster once the server reports
// pieces done; it never claims to be finished until the job is.
function jobProgress(job: Job, elapsed: number): number {
  if (job.status === "succeeded") return 1;
  if (job.status !== "running") return 0;
  const timed = 0.9 * (1 - Math.exp(-3 * elapsed / (30 + job.plan.indexes.length * 8)));
  return job.progress && job.progress.total > 0 ? Math.max(timed, 0.9 * (job.progress.done / job.progress.total)) : timed;
}

// One glass row per photo: its thumbnail (blurred under a shimmer until the job is done), the piece
// count, where the job is, and a thin bar (green once done).
function JobRow({ job, index, elapsed }: { job: Job; index: number; elapsed: number }) {
  const n = job.plan.indexes.length;
  const done = job.status === "succeeded";
  const stage = GARMENT_STAGES.reduce((label, s) => (elapsed >= s.at ? s.label : label), GARMENT_STAGES[0].label);
  const status = done ? `${Math.min(n, job.itemIds?.length ?? 0)} of ${n} made`
    : job.status === "failed" ? "Couldn't be made"
    : job.status === "unsent" ? "Not started"
    : job.progress ? `${job.progress.done} of ${job.progress.total}` : `${stage}…`;
  const value = jobProgress(job, elapsed);
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
          {job.status === "failed" ? null : (
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.fill, marginTop: 6, overflow: "hidden" }}>
              <View style={{ width: `${value * 100}%`, height: 6, borderRadius: 3, backgroundColor: done ? colors.success : colors.tint }} />
            </View>
          )}
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
  const running = !!round?.jobs.some((j) => j.status === "running");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [running]);

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

  const elapsed = Math.max(0, (now - round.startedAt) / 1000);
  const rows = (
    <View style={{ gap: 10, paddingHorizontal: 20 }}>
      {round.jobs.map((j, i) => <JobRow key={j.key} job={j} index={i} elapsed={elapsed} />)}
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
