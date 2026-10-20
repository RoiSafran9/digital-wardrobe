import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { GARMENT_STAGES, ProcessingCard } from "../../src/components/capture/ProcessingCard";
import { Icon } from "../../src/components/Icon";
import { creditsLabel } from "../../src/credits/credits";
import { useCredits } from "../../src/credits/CreditsProvider";
import { useFirstPieces, type Round } from "../../src/firstPieces/FirstPiecesProvider";
import { idsParam } from "../../src/firstPieces/celebrate";
import { useNotify } from "../../src/notifications";
import { colors, hitSlopFor, radius, type } from "../../src/theme";
import { Button, CostSheet, InsufficientCreditsSheet } from "../../src/ui";
import { LEAVE_NOTE, LEAVE_NOTE_NOTIFY } from "../capture/processing";

export const ROUND_TITLE = "Creating your first pieces…";

export const madeIds = (round: Round) => round.jobs.flatMap((j) => j.itemIds ?? []);

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
    router.replace({ pathname: "/closet", params: { celebrate: "1", ids: idsParam(madeIds(round)), at: String(Date.now()) } });
  };
  const clean = !!summary && summary.settled && summary.made > 0 && summary.notMade === 0 && summary.unsent === 0;
  useEffect(() => { if (clean) toCloset(); }, [clean]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!round || !summary) {
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
  const unsentPieces = round.jobs.filter((j) => j.status === "unsent").reduce((n, j) => n + j.plan.indexes.length, 0);
  const done = round.jobs.reduce((n, j) => n + (j.status === "succeeded" ? j.plan.indexes.length : j.progress?.done ?? 0), 0);
  const errors = [...new Set(round.jobs.filter((j) => j.status === "failed" && j.error).map((j) => j.error as string))];
  const refundNote = billing ? "Credits for pieces that weren't made were returned." : null;

  const rows = (
    <View style={{ gap: 10, paddingHorizontal: 20 }}>
      {round.jobs.map((j, i) => {
        const n = j.plan.indexes.length;
        const status = j.status === "succeeded" ? `${Math.min(n, j.itemIds?.length ?? 0)} of ${n} made`
          : j.status === "failed" ? "Couldn't be made"
          : j.status === "unsent" ? "Not started"
          : j.progress ? `${j.progress.done} of ${j.progress.total}` : "Waiting…";
        return (
          <View key={j.key} accessible accessibilityLabel={`Photo ${i + 1}, ${status}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.list, backgroundColor: colors.grouped }}>
            <Image source={{ uri: j.photoUri }} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.tile }} />
            <Text style={{ ...type.subhead, color: colors.label, flex: 1 }}>{`${n} ${n === 1 ? "piece" : "pieces"}`}</Text>
            <Text style={{ ...type.footnote, fontWeight: "600", color: j.status === "failed" ? colors.destructive : colors.secondaryLabel }}>{status}</Text>
          </View>
        );
      })}
    </View>
  );

  // Finished, but not everything was made: say what happened, then go on to the closet.
  if (summary.settled && !clean && !round.stopped) {
    const nothing = summary.made === 0;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {leave}
        <ScrollView contentContainerStyle={{ paddingVertical: 16, gap: 18 }}>
          <View style={{ paddingHorizontal: 20, gap: 6 }}>
            <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label }}>
              {nothing ? "We couldn't make your pieces" : `${summary.made} ${summary.made === 1 ? "piece" : "pieces"} created`}
            </Text>
            <Text style={{ ...type.body, color: colors.secondaryLabel }}>
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
    );
  }

  const firstPhoto = round.jobs.find((j) => j.status === "running")?.photoUri ?? round.jobs[0]?.photoUri ?? "";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {leave}
      <ScrollView contentContainerStyle={{ paddingVertical: 16, gap: 20 }}>
        <ProcessingCard
          photoUri={firstPhoto} stages={GARMENT_STAGES} startedAt={round.startedAt}
          estimateSeconds={30 + summary.requested * 8}
          title={ROUND_TITLE}
          note={notifying ? LEAVE_NOTE_NOTIFY : LEAVE_NOTE}
          count={{ done, total: summary.requested }}
        />
        {round.stopped ? (
          <View style={{ marginHorizontal: 20, padding: 16, borderRadius: radius.list, backgroundColor: colors.grouped, gap: 10 }}>
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
            {summary.settled ? <Button title={summary.made ? "See My Closet" : "Back to Home"} variant="text"
              onPress={() => { if (summary.made) toCloset(); else { finishRound(); router.replace("/"); } }} /> : null}
          </View>
        ) : null}
        {rows}
      </ScrollView>
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
    </SafeAreaView>
  );
}
