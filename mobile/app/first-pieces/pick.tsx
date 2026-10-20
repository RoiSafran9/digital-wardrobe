import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { PhotoWithBoxes } from "../../src/components/outfit/PhotoWithBoxes";
import { ScanBand } from "../../src/components/outfit/ScanBand";
import { creditsLabel } from "../../src/credits/credits";
import { useCredits } from "../../src/credits/CreditsProvider";
import { useFirstPieces } from "../../src/firstPieces/FirstPiecesProvider";
import { FIRST_GOAL, ROUND_CAP, roundQuote, type RoundPhoto, type RoundPiece } from "../../src/firstPieces/round";
import { garmentName } from "../../src/garmentName";
import { haptics } from "../../src/haptics";
import { isWornRejection, TRY_AS_OUTFIT } from "../../src/outfit/outfit";
import { colors, radius, type } from "../../src/theme";
import { BackButton, Button, CostSheet, InsufficientCreditsSheet, useToast } from "../../src/ui";

export const CAP_TOAST = `Up to ${ROUND_CAP} per round — deselect one first.`;

const pieceLabel = (photo: RoundPhoto, index: number) => {
  const p = photo.scan?.pieces.find((x) => x.index === index);
  return p ? garmentName({ facts: { category: { value: p.category }, colors: { value: p.colors } } } as never) : "Piece";
};

// Why a photo has nothing to pick, in plain words.
function photoNote(photo: RoundPhoto): string | null {
  switch (photo.state) {
    case "unusable": return `This photo can't be used: ${photo.scan?.quality?.reason ?? "try again"}. Lay each piece flat, in good light.`;
    case "none": return photo.scan?.reason ?? "No pieces found in this photo.";
    case "limited": return "Not checked yet: too many photo checks this hour. Try again in a few minutes.";
    case "failed": return "Couldn't check this photo.";
    default: return null;
  }
}

// First 3 Pieces, Path A: find the pieces in every photo (free), pick up to five for this round across
// all of them, confirm the cost, then start one generate job per photo.
export default function FirstPiecesPick() {
  const router = useRouter();
  const toast = useToast();
  const { billing, prices, credits, generation, outfit } = useCredits();
  const { photos, pieces, selected, round, scanAll, togglePiece, removePhoto, submitRound } = useFirstPieces();
  const [confirming, setConfirming] = useState(false);
  const [short, setShort] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void scanAll(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const scanning = photos.some((p) => p.state === "waiting" || p.state === "scanning");
  const unitPrice = billing ? prices.garment : undefined;
  const quote = roundQuote(selected.length, unitPrice, credits?.available ?? 0);
  const byPhoto = useMemo(() => {
    const map = new Map<string, RoundPiece[]>();
    for (const p of pieces) map.set(p.photoId, [...(map.get(p.photoId) ?? []), p]);
    return map;
  }, [pieces]);
  const retryable = photos.some((p) => p.state === "limited" || p.state === "failed");

  const toggle = (key: string) => {
    haptics.selection();
    if (!togglePiece(key)) toast.show(CAP_TOAST);
  };
  const request = () => {
    if (!selected.length || round) return;
    if (!quote.affordable) return setShort(true);
    if (unitPrice === undefined) return void create();
    setConfirming(true);
  };
  async function create() {
    setConfirming(false);
    setBusy(true);
    try {
      await submitRound(unitPrice ?? null);
      haptics.success();
      router.replace("/first-pieces/processing");
    } finally {
      setBusy(false);
    }
  }

  const title = scanning ? "Finding your pieces…"
    : pieces.length === 0 ? "We couldn't find clothes in these photos"
    : pieces.length === 1 ? "We found 1 piece" : `We found ${pieces.length} pieces`;
  const hint = scanning ? "Finding them is free."
    : pieces.length === 0 ? "Try photos with each piece laid flat or on a hanger, in good light."
    : pieces.length > ROUND_CAP ? `Pick up to ${ROUND_CAP} for this round. You can add the rest next.`
    : pieces.length < FIRST_GOAL ? "Tap a piece to leave it out. Add another photo to reach 3."
    : "Tap a piece to leave it out.";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}>
        <BackButton label="Photos" onPress={() => router.back()} />
        {pieces.length ? (
          <Text accessibilityLiveRegion="polite" style={{ ...type.subhead, fontWeight: "600", color: selected.length >= ROUND_CAP ? colors.tint : colors.secondaryLabel }}>
            {`${selected.length} of ${Math.min(ROUND_CAP, pieces.length)} selected`}
          </Text>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 18 }}>
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={{ ...type.section, color: colors.label }}>{title}</Text>
          <Text style={{ ...type.subhead, color: scanning ? colors.successText : colors.secondaryLabel }}>{hint}</Text>
        </View>

        {photos.map((photo, n) => {
          const mine = byPhoto.get(photo.id) ?? [];
          const note = photoNote(photo);
          const busyPhoto = photo.state === "waiting" || photo.state === "scanning";
          if (photo.state === "found" && !mine.length) return null;  // all its pieces were made in an earlier round
          return (
            <View key={photo.id} style={{ gap: 10 }}>
              <PhotoWithBoxes uri={photo.uri} photoSize={photo.scan?.image}
                candidates={mine.map((p) => ({ id: p.key, box: photo.scan!.pieces.find((x) => x.index === p.index)!.box }))}
                selected={busyPhoto ? undefined : selected} onToggle={toggle}
                overlay={busyPhoto ? <ScanBand /> : null} maxHeight={note ? 160 : 320} />
              {mine.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {mine.map((p) => {
                    const on = selected.includes(p.key);
                    const label = pieceLabel(photo, p.index);
                    return (
                      <Pressable key={p.key} onPress={() => toggle(p.key)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                        accessibilityLabel={`Photo ${n + 1}, ${label}`}
                        style={{ height: 34, paddingHorizontal: 12, borderRadius: radius.pill, justifyContent: "center",
                                 backgroundColor: on ? colors.tintSoft : colors.fill, borderWidth: 1.5, borderColor: on ? colors.tint : "transparent" }}>
                        <Text style={{ ...type.subhead, color: on ? colors.label : colors.secondaryLabel }}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {note ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{note}</Text>
                  {photo.state === "none" && outfit && isWornRejection(photo.scan?.reason) ? (
                    <Button title={TRY_AS_OUTFIT} variant="secondary" size="medium"
                      onPress={() => router.push({ pathname: "/outfit/detect", params: { uri: photo.uri, flow: "outfit", onboarding: "1" } })} />
                  ) : null}
                  {photo.state === "unusable" || photo.state === "none" ? (
                    <Button title="Remove Photo" variant="text" onPress={() => removePhoto(photo.id)} />
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}

        {retryable && !scanning ? <Button title="Check Again" variant="secondary" onPress={() => void scanAll()} /> : null}

        {!scanning && unitPrice !== undefined && selected.length ? (
          <View style={{ backgroundColor: colors.grouped, borderRadius: radius.list, padding: 16, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ ...type.body, color: colors.label }}>{`Front catalog image × ${selected.length}`}</Text>
              <Text style={{ ...type.body, color: colors.label }}>{creditsLabel(quote.total ?? 0)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Balance after</Text>
              <Text style={{ ...type.subhead, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>
                {creditsLabel(Math.max(0, (credits?.available ?? 0) - (quote.total ?? 0)))}
              </Text>
            </View>
          </View>
        ) : null}
        {generation === false ? (
          <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Making new AI images is paused for now. Try again later.</Text>
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }}>
        {!scanning && pieces.length === 0 ? (
          <Button title="Add Photos" onPress={() => router.back()} />
        ) : (
          <>
            <Button
              title={quote.total !== null
                ? `Create ${selected.length} ${selected.length === 1 ? "Piece" : "Pieces"} · ${creditsLabel(quote.total)}`
                : `Create ${selected.length} ${selected.length === 1 ? "Piece" : "Pieces"}`}
              onPress={request} loading={busy}
              disabled={scanning || !selected.length || generation === false || !!round}
            />
            {!scanning ? <Button title="Add More Photos" variant="text" onPress={() => router.back()} /> : null}
          </>
        )}
      </View>
      <CostSheet
        visible={confirming}
        title={selected.length === 1 ? "Create 1 piece" : `Create ${selected.length} pieces`}
        subtitle="Front catalog images for the pieces you picked."
        lines={[{ label: "Front image", action: "garment", count: selected.length }]}
        note="Finding them was free"
        confirmLabel={`Create · ${creditsLabel(quote.total ?? 0)}`}
        onConfirm={create}
        onClose={() => setConfirming(false)}
      />
      <InsufficientCreditsSheet
        visible={short} needed={quote.total ?? 0} onClose={() => setShort(false)}
        onAdjust={quote.leaveOut > 0 && quote.leaveOut < selected.length ? () => setShort(false) : undefined}
        body={quote.leaveOut > 0 && quote.leaveOut < selected.length
          ? `Leave out ${quote.leaveOut} ${quote.leaveOut === 1 ? "piece" : "pieces"} to continue with what you have.` : undefined}
      />
    </SafeAreaView>
  );
}
