import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "../Icon";
import { useCaptureJobs } from "../../store/captureJobs";
import { useFirstPiecesMaybe } from "../../firstPieces/FirstPiecesProvider";
import { idsParam } from "../../firstPieces/celebrate";
import { colors, type, weight } from "../../theme";
import { Glass } from "../../ui";

// The glass banner over Home's content (radius 20, 86% fill).
function Banner({ label, failed, onPress, children }: { label: string; failed: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ marginTop: 12, opacity: pressed ? 0.8 : 1 })}>
      <Glass radius={20} level="sheet" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
        {children}
        <Text style={{ ...type.subhead, ...weight(700), color: failed ? colors.destructive : colors.label, flex: 1 }}>{label}</Text>
        <Icon name="chevron" size={15} color={colors.tertiaryLabel} />
      </Glass>
    </Pressable>
  );
}

// The garment photo still being worked on (or finished while the user was elsewhere). Tapping it
// returns to the processing screen, which forwards to the results when they're ready.
export function CaptureBanner() {
  const router = useRouter();
  const { current } = useCaptureJobs();
  const firstPieces = useFirstPiecesMaybe();
  if (!current) return firstPieces?.round ? <RoundBanner /> : null;
  const label = current.status === "running" ? "Creating your pieces…"
    : current.status === "done" ? "Your pieces are ready — review them"
    : "Generation paused — tap to see why";
  return (
    <Banner label={label} failed={current.status === "failed"} onPress={() => router.push(current.status === "done" ? "/capture/results" : "/capture/processing")}>
      {current.status === "running" ? <ActivityIndicator color={colors.tint} /> : <Icon name={current.status === "done" ? "check" : "alert"} size={20} color={current.status === "failed" ? colors.destructive : colors.success} />}
    </Banner>
  );
}

// A First 3 Pieces round still being made (also one resumed after a restart), or finished while away.
function RoundBanner() {
  const router = useRouter();
  const { round, summary } = useFirstPiecesMaybe()!;
  if (!round || !summary) return null;
  const running = !summary.settled;
  const ready = summary.settled && summary.made > 0;
  const label = running ? "Creating your first pieces…" : ready ? "Your first pieces are ready — see them" : "Your pieces couldn't be made — tap to see why";
  const open = () => (ready && summary.notMade === 0
    ? router.push({ pathname: "/closet", params: { celebrate: "1", ids: idsParam(round.jobs.flatMap((j) => j.itemIds ?? [])), path: "near", at: String(Date.now()) } })
    : router.push("/first-pieces/processing"));
  const failed = !running && !ready;
  return (
    <Banner label={label} failed={failed} onPress={open}>
      {running ? <ActivityIndicator color={colors.tint} /> : <Icon name={ready ? "check" : "alert"} size={20} color={failed ? colors.destructive : colors.success} />}
    </Banner>
  );
}
