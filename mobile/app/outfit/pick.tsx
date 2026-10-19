import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { generateOutfit, getOutfitScan, markRegion } from "../../src/api/client";
import { NO_CREDITS } from "../../src/api/v1";
import type { OutfitCandidate, OutfitScan } from "../../src/api/types";
import { groupFor } from "../../src/categoryGroups";
import { ProcessingCard, type Stage } from "../../src/components/capture/ProcessingCard";
import { Icon } from "../../src/components/Icon";
import { PhotoWithBoxes } from "../../src/components/outfit/PhotoWithBoxes";
import { creditsLabel } from "../../src/credits/credits";
import { useCredits } from "../../src/credits/CreditsProvider";
import { haptics } from "../../src/haptics";
import { candidateTitle, defaultPicks, pickable, sceneNote, visibilityNote } from "../../src/outfit/outfit";
import { cachedScan, rememberScan } from "../../src/outfit/scanCache";
import { MarkRegion, type PhotoBox } from "../../src/components/outfit/MarkRegion";
import { colors, hitSlopFor, radius, type } from "../../src/theme";
import { TextInput } from "react-native";
import { BackButton, Button, Chip, CostSheet, InsufficientCreditsSheet, Sheet } from "../../src/ui";

export const OUTFIT_STAGES: Stage[] = [
  { label: "Taking them off the photo", at: 0 },
  { label: "Laying them flat", at: 8 },
  { label: "Adding final details", at: 20 },
];

// Quick types for correcting or marking a garment; the free text takes anything else.
const TYPE_SHORTCUTS = ["shirt", "t-shirt", "sweater", "jacket", "coat", "jeans", "pants", "skirt", "dress", "shorts", "belt", "bag"];

// "Not sure — please check" when the garment is partly hidden or the model said it was unsure.
export function unsure(c: OutfitCandidate): boolean {
  return c.visibility !== "full" || !!c.uncertainty;
}

// Outfit Photo, between the stages: the garments found on the person. The user picks which to add,
// confirms the exact price, and only then are images made.
export default function PickScreen() {
  const { scanId, uri } = useLocalSearchParams<{ scanId: string; uri?: string }>();
  const router = useRouter();
  const { billing, prices, credits, refresh } = useCredits();
  const [scan, setScan] = useState<OutfitScan | null>(() => (scanId ? cachedScan(scanId) ?? null : null));
  const [picks, setPicks] = useState<string[] | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState<number | null>(null);  // start time while images are being made
  const [confirming, setConfirming] = useState(false);
  const [short, setShort] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<OutfitCandidate | null>(null);
  const [draft, setDraft] = useState("");
  const [marking, setMarking] = useState(false);
  const [markBox, setMarkBox] = useState<PhotoBox | null>(null);
  const [markType, setMarkType] = useState("");
  const [markBusy, setMarkBusy] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  async function addMarked() {
    if (!scan || !markBox || !markType.trim()) return;
    setMarkBusy(true);
    setMarkError(null);
    try {
      const before = new Set(scan.candidates.map((c) => c.id));
      const updated = await markRegion(scan.id, markBox, markType.trim());
      rememberScan(updated);
      setScan(updated);
      const added = updated.candidates.find((c) => !before.has(c.id));
      if (added) setPicks([...selected, added.id]);
      setMarking(false);
    } catch (e) {
      setMarkError(e instanceof Error ? e.message : "Couldn't add it. Try again.");
    } finally {
      setMarkBusy(false);
    }
  }

  useEffect(() => {
    if (scan || !scanId) return;
    getOutfitScan(scanId).then(setScan).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the scan."));
  }, [scan, scanId]);

  const candidates = useMemo(() => (scan ? pickable(scan).filter((c) => !removed.includes(c.id)) : []), [scan, removed]);
  const selected = (picks ?? defaultPicks(candidates)).filter((id) => candidates.some((c) => c.id === id));
  const unitPrice = billing ? prices.garment : undefined;
  const total = unitPrice !== undefined ? selected.length * unitPrice : 0;
  const available = credits?.available ?? 0;
  const affordable = unitPrice === undefined || total <= available;
  const note = scan ? sceneNote(scan) : null;

  const toggle = (id: string) => {
    haptics.selection();
    setPicks(selected.includes(id) ? selected.filter((p) => p !== id) : [...selected, id]);
  };

  const request = () => {
    if (!scan || selected.length === 0) return;
    if (unitPrice === undefined) return void create();
    if (!affordable) return setShort(true);
    setConfirming(true);
  };

  async function create() {
    if (!scan) return;
    setConfirming(false);
    setBusy(Date.now());
    setError(null);
    try {
      const ordered = candidates.map((c) => c.id).filter((id) => selected.includes(id));
      const fixes = Object.fromEntries(Object.entries(corrections).filter(([id]) => ordered.includes(id)));
      const result = await generateOutfit(scan.id, ordered, unitPrice ?? null, fixes);
      haptics.success();
      const failed = result.failed.map((id) => scan.candidates.find((c) => c.id === id)).filter(Boolean)
        .map((c) => candidateTitle(c as OutfitCandidate).toLowerCase());
      router.replace({ pathname: "/outfit/review", params: failed.length ? { failed: failed.join(", ") } : {} });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong. Try again.";
      if (message === NO_CREDITS) setShort(true);
      else if (/price changed/i.test(message)) {
        await refresh();
        setError("The price changed. Check it and confirm again.");
        setConfirming(true);
      } else setError(message);
      setBusy(null);
    } finally {
      void refresh();
    }
  }

  if (busy !== null) {
    const photo = uri ?? candidates[0]?.preview_url ?? "";
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ProcessingCard photoUri={photo} stages={OUTFIT_STAGES} startedAt={busy} estimateSeconds={12 + selected.length * 10}
          title={selected.length === 1 ? "Creating 1 catalog image" : `Creating ${selected.length} catalog images`}
          note="Keep the app open — this takes about half a minute per piece." />
      </SafeAreaView>
    );
  }

  const deselectCount = unitPrice ? Math.max(0, selected.length - Math.floor(available / unitPrice)) : 0;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 44, justifyContent: "center", paddingHorizontal: 20 }}>
        <BackButton label="Photos" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}>
        <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label }}>Select Garments</Text>
        {uri && candidates.length ? <PhotoWithBoxes uri={uri} candidates={candidates} selected={selected} onToggle={toggle} maxHeight={360} /> : null}
        {scan ? (
          <View style={{ gap: 4 }}>
            <Text style={{ ...type.section, color: colors.label }}>
              {candidates.length === 1 ? "We found 1 garment" : `We found ${candidates.length} garments`}
            </Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Choose which to digitize. Crops are from your photo; an image is made only for the ones you pick.</Text>
          </View>
        ) : null}
        {note ? <Note text={note} /> : null}
        {!scan && !error ? <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Loading…</Text> : null}
        {scan && candidates.length === 0 ? <Note text="No pieces to add were found. Try a photo where the clothes are clearly in view." /> : null}
        <View style={{ gap: 10 }}>
          {candidates.map((c, i) => (
            <CandidateRow key={c.id} index={i} candidate={corrections[c.id] ? { ...c, category: corrections[c.id] } : c} selected={selected.includes(c.id)}
              onPress={() => toggle(c.id)} onEdit={() => { setDraft(corrections[c.id] ?? c.category); setEditing(c); }} />
          ))}
        </View>
        {uri && scan && scan.candidates.length < 8 ? (
          <Pressable onPress={() => { setMarkBox(null); setMarkType(""); setMarkError(null); setMarking(true); }} accessibilityRole="button"
            style={{ height: 48, borderRadius: radius.list, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.separatorStrong, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ ...type.subhead, fontWeight: "600", color: colors.tint }}>+ Mark a missed garment</Text>
          </Pressable>
        ) : null}
        {error ? <Note text={error} destructive /> : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...type.headline, color: colors.label }}>{`${selected.length} selected`}</Text>
            {unitPrice !== undefined ? (
              <Text accessibilityLiveRegion="polite" style={{ ...type.footnote, color: affordable ? colors.secondaryLabel : colors.destructive }}>
                {`${creditsLabel(total)} · ${available} available`}
              </Text>
            ) : null}
          </View>
          <View style={{ width: 140 }}>
            <Button title="Generate" size="medium" onPress={request} disabled={!scan || selected.length === 0} />
          </View>
        </View>
      </View>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title="Correct this garment" floating>
        <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginBottom: 6 }}>Type</Text>
        <TextInput accessibilityLabel="Garment type" value={draft} onChangeText={setDraft} autoCapitalize="none" maxLength={40}
          style={{ ...type.body, color: colors.label, backgroundColor: colors.grouped, height: 48, borderRadius: radius.input, paddingHorizontal: 14 }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 18 }}>
          {TYPE_SHORTCUTS.map((t) => <Chip key={t} label={t} selected={draft.trim().toLowerCase() === t} onPress={() => setDraft(t)} />)}
        </View>
        <View style={{ gap: 6 }}>
          <Button title="Done" disabled={!draft.trim()} onPress={() => {
            if (editing) setCorrections((c) => ({ ...c, [editing.id]: draft.trim() }));
            setEditing(null);
          }} />
          <Button title="Not a garment" variant="destructive" onPress={() => {
            if (editing) setRemoved((r) => [...r, editing.id]);
            setEditing(null);
          }} />
        </View>
      </Sheet>
      <Sheet visible={marking} onClose={() => setMarking(false)} title="Mark a missed garment" floating>
        {uri ? <MarkRegion uri={uri} onBox={setMarkBox} /> : null}
        <TextInput accessibilityLabel="Missed garment type" placeholder="What is it? (e.g. belt)" placeholderTextColor={colors.tertiaryLabel}
          value={markType} onChangeText={setMarkType} autoCapitalize="none" maxLength={40}
          style={{ ...type.body, color: colors.label, backgroundColor: colors.grouped, height: 48, borderRadius: radius.input, paddingHorizontal: 14, marginTop: 14 }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 14 }}>
          {TYPE_SHORTCUTS.map((t) => <Chip key={t} label={t} selected={markType.trim().toLowerCase() === t} onPress={() => setMarkType(t)} />)}
        </View>
        {markError ? <Text style={{ ...type.footnote, color: colors.destructive, marginBottom: 10 }}>{markError}</Text> : null}
        <Button title="Add Garment" onPress={addMarked} disabled={!markBox || !markType.trim()} loading={markBusy} />
      </Sheet>
      <CostSheet
        visible={confirming}
        title={selected.length === 1 ? "Generate 1 garment" : `Generate ${selected.length} garments`}
        subtitle="High-quality front catalog images for the pieces you selected."
        lines={[{ label: "Front image", action: "garment", count: selected.length }]}
        note="Detection was free"
        confirmLabel={`Generate · ${creditsLabel(total)}`}
        onConfirm={create}
        onClose={() => setConfirming(false)}
      />
      <InsufficientCreditsSheet
        visible={short}
        needed={total}
        onClose={() => setShort(false)}
        onAdjust={deselectCount > 0 ? () => setShort(false) : undefined}
        body={deselectCount > 0 ? `Deselect ${deselectCount} ${deselectCount === 1 ? "garment" : "garments"} to continue with what you have.` : undefined}
      />
    </SafeAreaView>
  );
}

function CandidateRow({ candidate, index, selected, onPress, onEdit }: {
  candidate: OutfitCandidate; index: number; selected: boolean; onPress: () => void; onEdit: () => void;
}) {
  const note = visibilityNote(candidate);
  const title = candidateTitle(candidate);
  const doubt = unsure(candidate);
  return (
    <View style={{ backgroundColor: colors.grouped, borderRadius: radius.list, padding: 12, gap: 8 }}>
      <Pressable
        accessibilityRole="checkbox" accessibilityState={{ checked: selected }}
        accessibilityLabel={`${title}. ${candidate.description}${note ? `. ${note}` : ""}`}
        onPress={onPress}
        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        {/* A crop of the real photo keeps its background, so it sits on a tile. */}
        <View style={{ width: 62, height: 62, borderRadius: radius.button, overflow: "hidden", backgroundColor: colors.tile }}>
          {candidate.preview_url ? <Image source={{ uri: candidate.preview_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : null}
          <View style={{ position: "absolute", top: 4, left: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ ...type.caption, fontWeight: "700", color: colors.onTint }}>{index + 1}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...type.headline, color: colors.label }}>{title}</Text>
          <Text style={{ ...type.footnote, color: doubt ? colors.warningText : colors.secondaryLabel, marginTop: 2 }}>
            {`${groupFor(candidate.category)} · ${doubt ? "Not sure — please check" : "Clear match"}`}
          </Text>
          {note ? <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 2 }}>{note}</Text> : null}
        </View>
        <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
          backgroundColor: selected ? colors.tint : "transparent", borderWidth: selected ? 0 : 1.5, borderColor: colors.separatorStrong }}>
          {selected ? <Icon name="checkmark" size={15} color={colors.onTint} /> : null}
        </View>
      </Pressable>
      <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${title}`} hitSlop={hitSlopFor(22)} style={{ alignSelf: "flex-end" }}>
        <Text style={{ ...type.footnote, fontWeight: "600", color: colors.tint }}>Edit</Text>
      </Pressable>
    </View>
  );
}

function Note({ text, destructive }: { text: string; destructive?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, borderRadius: radius.button, padding: 12, backgroundColor: destructive ? colors.destructiveBg : colors.grouped }}>
      <Icon name="alert" size={18} color={destructive ? colors.destructive : colors.secondaryLabel} />
      <Text style={{ ...type.subhead, flex: 1, color: destructive ? colors.destructive : colors.secondaryLabel }}>{text}</Text>
    </View>
  );
}
