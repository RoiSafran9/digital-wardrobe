import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "../Icon";
import { useCaptureJobs } from "../../store/captureJobs";
import { useFirstPiecesMaybe } from "../../firstPieces/FirstPiecesProvider";
import { idsParam } from "../../firstPieces/celebrate";
import { colors, radius, type } from "../../theme";

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
    <Pressable
      accessibilityRole="button" accessibilityLabel={label}
      onPress={() => router.push(current.status === "done" ? "/capture/results" : "/capture/processing")}
      style={{ marginHorizontal: 20, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.list, backgroundColor: current.status === "failed" ? colors.destructiveBg : colors.tintSoft }}
    >
      {current.status === "running" ? <ActivityIndicator color={colors.tint} /> : <Icon name={current.status === "done" ? "check" : "alert"} size={20} color={current.status === "failed" ? colors.destructive : colors.tint} />}
      <Text style={{ ...type.subhead, fontWeight: "600", color: current.status === "failed" ? colors.destructive : colors.label, flex: 1 }}>{label}</Text>
      <View><Icon name="chevron" size={14} color={colors.secondaryLabel} /></View>
    </Pressable>
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
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={open}
      style={{ marginHorizontal: 20, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.list, backgroundColor: failed ? colors.destructiveBg : colors.tintSoft }}>
      {running ? <ActivityIndicator color={colors.tint} /> : <Icon name={ready ? "check" : "alert"} size={20} color={failed ? colors.destructive : colors.tint} />}
      <Text style={{ ...type.subhead, fontWeight: "600", color: failed ? colors.destructive : colors.label, flex: 1 }}>{label}</Text>
      <View><Icon name="chevron" size={14} color={colors.secondaryLabel} /></View>
    </Pressable>
  );
}
