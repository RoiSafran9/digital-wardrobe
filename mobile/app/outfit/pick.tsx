import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { generateOutfit, getOutfitScan } from "../../src/api/client";
import type { OutfitCandidate, OutfitScan } from "../../src/api/types";
import { Icon } from "../../src/components/Icon";
import { PillButton } from "../../src/components/PillButton";
import { KEEP_OPEN, OUTFIT_STEPS, ProcessingStatus } from "../../src/components/ProcessingStatus";
import { ASK_FOR_MORE } from "../../src/credits/credits";
import { useCredits } from "../../src/credits/CreditsProvider";
import { haptics } from "../../src/haptics";
import { candidateTitle, defaultPicks, pickable, quote, sceneNote, visibilityNote } from "../../src/outfit/outfit";
import { cachedScan } from "../../src/outfit/scanCache";
import { colors, radius, type } from "../../src/theme";

// Outfit Photo, between the stages: the garments found on the person, as crops of the real photo.
// The user picks which to add, sees the exact price, and only then are images made.
export default function PickScreen() {
  const { scanId } = useLocalSearchParams<{ scanId: string }>();
  const router = useRouter();
  const { billing, prices, credits, refresh } = useCredits();
  const [scan, setScan] = useState<OutfitScan | null>(() => (scanId ? cachedScan(scanId) ?? null : null));
  const [picks, setPicks] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scan || !scanId) return;
    getOutfitScan(scanId).then(setScan).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the scan."));
  }, [scan, scanId]);

  const candidates = useMemo(() => (scan ? pickable(scan) : []), [scan]);
  const selected = picks ?? defaultPicks(candidates);
  const unitPrice = billing ? prices.garment : undefined;
  const cost = quote(selected.length, unitPrice, credits?.available ?? 0);
  const note = scan ? sceneNote(scan) : null;

  const toggle = (id: string) =>
    setPicks(selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id]);

  async function create() {
    if (!scan) return;
    setBusy(true);
    setError(null);
    try {
      const ordered = candidates.map((c) => c.id).filter((id) => selected.includes(id));
      const result = await generateOutfit(scan.id, ordered, unitPrice ?? null);
      haptics.success();
      const failed = result.failed.map((id) => candidates.find((c) => c.id === id)).filter(Boolean)
        .map((c) => candidateTitle(c as OutfitCandidate).toLowerCase());
      router.replace({ pathname: "/outfit/review", params: failed.length ? { failed: failed.join(", ") } : {} });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  if (busy) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: "center" }}>
        <View style={{ backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: 24 }}>
          <ProcessingStatus steps={OUTFIT_STEPS} note={KEEP_OPEN} estimateSeconds={12 + selected.length * 10} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={{ marginTop: 12, alignSelf: "flex-start" }}>
          <Text style={{ ...type.body, color: colors.tint }}>Cancel</Text>
        </Pressable>
        <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label, marginTop: 8 }}>Pick pieces</Text>
        <Text style={{ ...type.body, color: colors.secondaryLabel, marginTop: 8 }}>
          Crops from your photo. Choose the pieces to add; an image is made only for those.
        </Text>

        {note ? <Note text={note} /> : null}
        {!scan && !error ? <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 20 }}>Loading…</Text> : null}
        {scan && candidates.length === 0 ? <Note text="No pieces to add were found. Try a photo where the clothes are clearly in view." /> : null}

        <View style={{ gap: 10, marginTop: 20 }}>
          {candidates.map((c) => (
            <CandidateRow key={c.id} candidate={c} selected={selected.includes(c.id)} onPress={() => toggle(c.id)} />
          ))}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 10, backgroundColor: colors.background }}>
        {error ? <Note text={error} destructive /> : null}
        {selected.length > 0 ? (
          <Text accessibilityLiveRegion="polite" style={{ ...type.footnote, color: cost.affordable ? colors.secondaryLabel : colors.destructive, textAlign: "center" }}>
            {cost.label}{cost.affordable ? "" : ` — not enough credits. ${ASK_FOR_MORE}`}
          </Text>
        ) : null}
        <PillButton
          label={selected.length === 1 ? "Create 1 image" : `Create ${selected.length} images`}
          variant="primary" onPress={create} disabled={!scan || selected.length === 0 || !cost.affordable}
        />
        <PillButton label="None of these" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

function CandidateRow({ candidate, selected, onPress }: { candidate: OutfitCandidate; selected: boolean; onPress: () => void }) {
  const note = visibilityNote(candidate);
  const title = candidateTitle(candidate);
  return (
    <Pressable
      accessibilityRole="checkbox" accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${candidate.description}${note ? `. ${note}` : ""}`}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.card, borderRadius: radius.card, padding: 12 }}
    >
      {/* A crop of the real photo keeps its background, so it sits on a tile. */}
      <View style={{ width: 72, height: 88, borderRadius: radius.tile, overflow: "hidden", backgroundColor: colors.tile }}>
        {candidate.preview_url ? (
          <Image source={{ uri: candidate.preview_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...type.headline, color: colors.label }}>{title}</Text>
        <Text numberOfLines={2} style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 2 }}>{candidate.description}</Text>
        {note ? <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 4 }}>{note}</Text> : null}
        {candidate.uncertainty ? <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 2 }}>{candidate.uncertainty}</Text> : null}
      </View>
      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
                     backgroundColor: selected ? colors.tint : "transparent", borderWidth: selected ? 0 : 1.5, borderColor: colors.separatorStrong }}>
        {selected ? <Icon name="checkmark" size={15} color={colors.onTint} /> : null}
      </View>
    </Pressable>
  );
}

function Note({ text, destructive }: { text: string; destructive?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: destructive ? 0 : 16, borderRadius: 14, padding: 12,
                   backgroundColor: destructive ? colors.destructiveBg : colors.tile }}>
      <Icon name="alert" size={18} color={destructive ? colors.destructive : colors.secondaryLabel} />
      <Text style={{ ...type.subhead, flex: 1, color: destructive ? colors.destructive : colors.secondaryLabel }}>{text}</Text>
    </View>
  );
}
