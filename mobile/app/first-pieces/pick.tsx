import React, { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "../../src/components/Icon";
import { ScanBand } from "../../src/components/outfit/ScanBand";
import { creditsLabel } from "../../src/credits/credits";
import { useCredits } from "../../src/credits/CreditsProvider";
import { useFirstPieces } from "../../src/firstPieces/FirstPiecesProvider";
import { track } from "../../src/firstPieces/analytics";
import { CAP_TOAST, FIRST_GOAL, ROUND_CAP, roundQuote, type RoundPhoto, type RoundPiece } from "../../src/firstPieces/round";
import { pieceLabel as scanPieceLabel } from "../../src/footwear";
import { haptics } from "../../src/haptics";
import { PressScale } from "../../src/motion/PressScale";
import { isWornRejection, TRY_AS_OUTFIT } from "../../src/outfit/outfit";
import { colors, radius, type, weight } from "../../src/theme";
import { Button, CostSheet, Glass, GlassScreen, IconButton, InsufficientCreditsSheet, useToast } from "../../src/ui";

export { CAP_TOAST };

const pieceLabel = (photo: RoundPhoto, index: number) => {
  const p = photo.scan?.pieces.find((x) => x.index === index);
  return p ? scanPieceLabel(p) : "Piece";
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

type Box = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };
const GAP = 10;

// The photo's pixel size: the scan's when it reports one (the boxes were measured on it), else measured.
function usePhotoSize(uri: string, known?: Size | null): Size | null {
  const [measured, setMeasured] = useState<Size | null>(null);
  useEffect(() => {
    if (known) return;
    let live = true;
    try {
      Image.getSize(uri, (width, height) => { if (live) setMeasured({ width, height }); }, () => {});
    } catch {
      // Unknown size: the tile stays an empty stone frame.
    }
    return () => { live = false; };
  }, [uri, known]);
  return known ?? measured;
}

// One found piece: the user's own photo framed on that piece's box with a little room around it, on the
// stone tile. A piece left out dims to 45% under an empty glass check.
function PieceTile({ uri, box, photoSize, width, selected, name, label, onPress }: {
  uri: string; box: Box; photoSize?: Size | null; width: number; selected: boolean; name: string; label: string; onPress: () => void;
}) {
  const height = width * 1.25;
  const size = usePhotoSize(uri, photoSize);
  const s = box.width > 0 && box.height > 0 ? Math.min(width / (box.width * 1.16), height / (box.height * 1.16)) : 0;
  return (
    <View style={{ width }}>
      <PressScale onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={label}>
        <View style={{ width, height, borderRadius: radius.garment, overflow: "hidden", backgroundColor: colors.tile }}>
          {size && s ? (
            <Image source={{ uri }} style={{
              position: "absolute", width: size.width * s, height: size.height * s, opacity: selected ? 1 : 0.45,
              left: width / 2 - (box.x + box.width / 2) * s, top: height / 2 - (box.y + box.height / 2) * s,
            }} />
          ) : null}
          <View style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
                         backgroundColor: selected ? colors.tint : undefined }}>
            {selected ? <Icon name="checkmark" size={18} color={colors.onTint} />
              : <Glass radius={15} flat style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
          </View>
        </View>
      </PressScale>
      <Text numberOfLines={1} accessibilityElementsHidden importantForAccessibility="no"
        style={{ ...type.subhead, ...weight(600), color: selected ? colors.label : colors.secondaryLabel, marginTop: 6, paddingHorizontal: 2 }}>{name}</Text>
    </View>
  );
}

// A photo still being checked: the whole photo under the scan band, in the grid where its pieces will land.
function ScanningTile({ uri, width, label }: { uri: string; width: number; label: string }) {
  return (
    <View style={{ width, height: width * 1.25, borderRadius: radius.garment, overflow: "hidden", backgroundColor: colors.tile }}>
      <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityLabel={label} />
      <ScanBand />
    </View>
  );
}

// First 3 Pieces, Path A: find the pieces in every photo (free), pick up to five for this round across
// all of them, confirm the cost, then start one generate job per photo.
export default function FirstPiecesPick() {
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const tile = (width - 40 - GAP) / 2;
  const { billing, prices, credits, generation, outfit } = useCredits();
  const { photos, pieces, selected, round, scanAll, togglePiece, removePhoto, submitRound } = useFirstPieces();
  const [confirming, setConfirming] = useState(false);
  const [short, setShort] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void scanAll(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const scanning = photos.some((p) => p.state === "waiting" || p.state === "scanning");
  const wasScanning = React.useRef(false);
  useEffect(() => {
    if (scanning) wasScanning.current = true;
    else if (wasScanning.current) {
      wasScanning.current = false;
      track("detection_completed", { photos: photos.length, found: pieces.length,
        unusable: photos.filter((p) => p.state === "unusable").length, limited: photos.filter((p) => p.state === "limited").length });
    }
  }, [scanning]);  // eslint-disable-line react-hooks/exhaustive-deps
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

  const noted = photos.map((photo, n) => ({ photo, n, note: photoNote(photo) })).filter((x) => x.note);

  return (
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} />
          {pieces.length ? (
            <Text accessibilityLiveRegion="polite" style={{ ...type.subhead, ...weight(600), color: selected.length >= ROUND_CAP ? colors.tint : colors.secondaryLabel }}>
              {`${selected.length} of ${Math.min(ROUND_CAP, pieces.length)} selected`}
            </Text>
          ) : null}
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 20, gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={{ ...type.pageTitle, color: colors.label }}>{title}</Text>
            <Text style={{ ...type.subhead, color: scanning ? colors.successText : colors.secondaryLabel }}>{hint}</Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: GAP, rowGap: 14 }}>
            {photos.flatMap((photo, n) => {
              if (photo.state === "waiting" || photo.state === "scanning") {
                return [<ScanningTile key={photo.id} uri={photo.uri} width={tile} label={`Photo ${n + 1}`} />];
              }
              return (byPhoto.get(photo.id) ?? []).map((p) => {
                const name = pieceLabel(photo, p.index);
                return (
                  <PieceTile key={p.key} uri={photo.uri} photoSize={photo.scan?.image} width={tile}
                    box={photo.scan!.pieces.find((x) => x.index === p.index)!.box}
                    selected={selected.includes(p.key)} name={name} label={`Photo ${n + 1}, ${name}`} onPress={() => toggle(p.key)} />
                );
              });
            })}
          </View>

          {noted.map(({ photo, n, note }) => (
            <Glass key={photo.id} radius={radius.tile} style={{ padding: 12, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Image source={{ uri: photo.uri }} accessibilityLabel={`Photo ${n + 1}`}
                  style={{ width: 56, height: 68, borderRadius: radius.image, backgroundColor: colors.tile }} resizeMode="cover" />
                <Text style={{ ...type.subhead, color: colors.secondaryLabel, flex: 1 }}>{note}</Text>
              </View>
              {photo.state === "none" && outfit && isWornRejection(photo.scan?.reason) ? (
                <Button title={TRY_AS_OUTFIT} variant="soft" size="medium"
                  onPress={() => router.push({ pathname: "/outfit/detect", params: { uri: photo.uri, flow: "outfit", onboarding: "1" } })} />
              ) : null}
              {photo.state === "unusable" || photo.state === "none" ? (
                <Button title="Remove Photo" variant="text" size="medium" onPress={() => removePhoto(photo.id)} />
              ) : null}
            </Glass>
          ))}

          {retryable && !scanning ? <Button title="Check Again" variant="glass" onPress={() => void scanAll()} /> : null}

          {!scanning && unitPrice !== undefined && selected.length ? (
            <Glass radius={radius.list} style={{ padding: 16, gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...type.body, color: colors.label }}>{`Front catalog image × ${selected.length}`}</Text>
                <Text style={{ ...type.body, color: colors.label, fontVariant: ["tabular-nums"] }}>{creditsLabel(quote.total ?? 0)}</Text>
              </View>
              <View style={{ height: 0.5, backgroundColor: colors.separator }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Balance after</Text>
                <Text style={{ ...type.subhead, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>
                  {creditsLabel(Math.max(0, (credits?.available ?? 0) - (quote.total ?? 0)))}
                </Text>
              </View>
            </Glass>
          ) : null}
          {generation === false ? (
            <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Making new AI images is paused for now. Try again later.</Text>
          ) : null}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 6 }}>
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
      </SafeAreaView>
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
    </GlassScreen>
  );
}
