import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getItems, getOutfitSuggestions, getSwapOptions } from "../../src/api/client";
import type { ClosetItem, OutfitFilters, OutfitLook, OutfitSlot, SwapAlternative } from "../../src/api/types";
import { GarmentImage } from "../../src/components/GarmentImage";
import { Icon, type IconName } from "../../src/components/Icon";
import { LookDeck } from "../../src/components/outfitBuilder/LookDeck";
import { OptionTile } from "../../src/components/outfitBuilder/OptionTile";
import { SwapSheet } from "../../src/components/outfitBuilder/SwapSheet";
import { garmentName } from "../../src/garmentName";
import {
  COLOR_PREF_OPTIONS, DEFAULT_FILTERS, OCCASION_OPTIONS, SLOT_LABELS, STYLE_OPTIONS, VIBE_OPTIONS,
  WEATHER_OPTIONS, orderedSlots, type Option,
} from "../../src/outfitBuilder/filters";
import { Float } from "../../src/motion/Breathe";
import { PopIn } from "../../src/motion/PopIn";
import { PressScale } from "../../src/motion/PressScale";
import { Rise } from "../../src/motion/Rise";
import { track, useScreenViewed } from "../../src/activity/track";
import { colors, radius, shadow, type, weight } from "../../src/theme";
import { Button, Glass, GlassScreen, IconButton } from "../../src/ui";
import { useReducedMotion } from "../../src/useReducedMotion";
import { JobsBanner } from "../../src/components/jobs/JobsBanner";

// The server takes at most 30 shown looks (api/schemas.OutfitSuggestionsIn); keep the latest.
const MAX_SHOWN = 30;

type Phase = "loading_closet" | "closet_empty" | "closet_error" | "form" | "generating" | "no_match" | "results" | "detail";

const TILE_GAP = 8;

// One question per step, in the form's order (02-UX-FLOWS.md U1). Every answer starts at Any, so Next
// never waits on a choice.
type Question = { key: keyof OutfitFilters; title: string; options: Option<string>[] };
const QUESTIONS: Question[] = [
  { key: "occasion", title: "What are you dressing for?", options: OCCASION_OPTIONS },
  { key: "style", title: "Which style feels right?", options: STYLE_OPTIONS },
  { key: "vibe", title: "What's the vibe?", options: VIBE_OPTIONS },
  { key: "weather", title: "What's the weather like?", options: WEATHER_OPTIONS },
  { key: "colors", title: "Any colors in mind?", options: COLOR_PREF_OPTIONS },
];

// "Work · Casual · Mild": the answers that aren't Any, for the chip over the looks.
function answersSummary(filters: OutfitFilters): string {
  const picked = QUESTIONS.flatMap((q) => {
    const value = filters[q.key];
    const option = value === "any" ? undefined : q.options.find((o) => o.value === value);
    return option ? [option.label] : [];
  });
  return picked.length ? picked.join(" · ") : "Anything goes";
}

// Shown while the looks are made: plain garment-type tiles, never pieces from the closet, so nothing
// looks chosen before the server has chosen it (02-UX-FLOWS.md U2).
const WAITING: IconName[] = ["garment", "jacket", "hanger", "shoe"];

function TopBar({ back, onLeft, right }: { back: boolean; onLeft: () => void; right?: React.ReactNode }) {
  return (
    <View style={{ height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16 }}>
      <IconButton icon={back ? "chevronLeft" : "close"} label={back ? "Back" : "Close"} onPress={onLeft} />
      {right ?? <View style={{ width: 40 }} />}
    </View>
  );
}

function StepDots({ step, count }: { step: number; count: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, k) => (
        <View key={k} style={{ width: k === step ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: k <= step ? colors.tint : colors.separatorStrong }} />
      ))}
    </View>
  );
}

// A question's answers as a three-column grid of tiles, so every answer is visible at once.
function AnswerGrid({ question, value, onChange }: { question: Question; value: string; onChange: (v: string) => void }) {
  const { width } = useWindowDimensions();
  const tileWidth = Math.floor((width - 40 - TILE_GAP * 2) / 3);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: TILE_GAP }}>
      {question.options.map((o, k) => (
        <PopIn key={o.value} delay={k * 40}>
          <OptionTile option={o} width={tileWidth} selected={o.value === value} onPress={() => onChange(o.value)} />
        </PopIn>
      ))}
    </View>
  );
}

export default function BuildMyLookScreen() {
  useScreenViewed("build_my_look");
  const router = useRouter();
  const reduced = useReducedMotion();
  const { height: screenHeight } = useWindowDimensions();
  const deckHeight = Math.max(280, Math.min(360, Math.round(screenHeight * 0.41)));

  const [items, setItems] = useState<ClosetItem[]>([]);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id ?? i.item_id, i])), [items]);

  const [phase, setPhase] = useState<Phase>("loading_closet");
  const [closetError, setClosetError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OutfitFilters>(DEFAULT_FILTERS);
  const [step, setStep] = useState(0);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [limitation, setLimitation] = useState<string | null>(null);
  const [looks, setLooks] = useState<OutfitLook[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  // Every look shown for the current choices (as the server made them), sent with Generate Again so it
  // finds new ones. Kept on this screen only; a new choice or Build Looks starts over.
  const [shown, setShown] = useState<string[][]>([]);

  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [swapSlot, setSwapSlot] = useState<OutfitSlot | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<SwapAlternative[]>([]);

  const loadCloset = useCallback(async () => {
    setPhase("loading_closet");
    setClosetError(null);
    try {
      const { items: closet } = await getItems();
      setItems(closet);
      setPhase(closet.length === 0 ? "closet_empty" : "form");
    } catch (e) {
      setClosetError(e instanceof Error ? e.message : "Couldn't load your closet.");
      setPhase("closet_error");
    }
  }, []);
  useEffect(() => { loadCloset(); }, [loadCloset]);

  const generate = useCallback(async (again = false) => {
    setPhase("generating");
    setGenerateError(null);
    try {
      const result = again ? await getOutfitSuggestions(filters, shown) : await getOutfitSuggestions(filters);
      // Request telemetry (look_generation_requested) is a server event — the route already
      // records it with the real filters, result count and fallback flag; nothing to send here.
      if (result.looks.length === 0) {
        setLimitation(result.limitations[0] ?? "We couldn't find a good match for all these choices.");
        setPhase("no_match");
      } else {
        const made = result.looks.map((l) => l.item_ids);
        // Nothing new left (the server says so and repeats its best): start over from these.
        setShown((before) => (again && result.limitations.length === 0 ? [...before, ...made].slice(-MAX_SHOWN) : made));
        setLimitation(result.limitations[0] ?? null);
        setLooks(result.looks);
        setDeckIndex(0);
        setPhase("results");
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "We couldn't make new looks right now.");
      setPhase(again ? "results" : "form");
    }
  }, [filters, shown]);

  const openLook = (index: number) => {
    track("look_opened", { position: index });
    setSelected(index);
    setPhase("detail");
  };

  const look = selected !== null ? looks[selected] : null;

  // Swapping works on one look: the one open in detail, or the top card of the deck.
  const openSwap = async (index: number, slot: OutfitSlot, targetItemId: string) => {
    const target = looks[index];
    if (!target) return;
    setSwapIndex(index);
    setSwapSlot(slot);
    setSwapLoading(true);
    setSwapError(null);
    setSwapAlternatives([]);
    try {
      const options = await getSwapOptions({ slots: target.slots as Record<string, string>, item_ids: target.item_ids },
        targetItemId, filters);
      setSwapAlternatives(options.alternatives);
    } catch (e) {
      setSwapError(e instanceof Error ? e.message : "We couldn't load alternatives right now.");
    } finally {
      setSwapLoading(false);
    }
  };

  const closeSwap = () => setSwapSlot(null);

  const chooseAlternative = (newItemId: string) => {
    if (swapIndex === null || !swapSlot) return;
    setLooks((all) => all.map((l, i) => {
      if (i !== swapIndex) return l;
      const oldId = l.slots[swapSlot];
      return {
        ...l, slots: { ...l.slots, [swapSlot]: newItemId },
        item_ids: l.item_ids.map((id) => (id === oldId ? newItemId : id)),
      };
    }));
    track("swap_applied", { slot: swapSlot });
    setSwapSlot(null);
  };

  const back = () => {
    if (phase === "detail") { setPhase("results"); setSelected(null); return; }
    if (phase === "results" || phase === "no_match") { setPhase("form"); return; }
    if (phase === "form" && step > 0) { setStep(step - 1); return; }
    router.back();
  };
  const goesBack = phase === "detail" || phase === "results" || phase === "no_match" || (phase === "form" && step > 0);

  const swapLook = swapIndex !== null ? looks[swapIndex] : null;
  const currentSwapItem = swapSlot && swapLook ? itemsById.get(swapLook.slots[swapSlot] ?? "") ?? null : null;
  const question = QUESTIONS[step];
  const lastStep = step === QUESTIONS.length - 1;
  const deckLook = looks.length ? looks[deckIndex % looks.length] : null;
  const summary = answersSummary(filters);

  return (
    <GlassScreen>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <TopBar back={goesBack} onLeft={back} right={phase === "results" || phase === "detail" ? (
          <Glass radius={radius.pill} level="base" style={{ flexShrink: 1, paddingVertical: 7, paddingHorizontal: 12 }}>
            <Text numberOfLines={1} accessibilityLabel={`Your choices: ${summary}`} style={{ ...type.footnote, ...weight(600), color: colors.label }}>{summary}</Text>
          </Glass>
        ) : undefined} />
        <View style={{ paddingHorizontal: 20 }}>
          <JobsBanner style={{ marginTop: 4 }} />
        </View>

        {phase === "loading_closet" ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.secondaryLabel} />
          </View>
        ) : phase === "closet_error" ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 }}>
            <Text style={{ ...type.body, color: colors.destructive, textAlign: "center" }}>{closetError}</Text>
            <Button title="Try again" size="medium" variant="glass" onPress={loadCloset} />
          </View>
        ) : phase === "closet_empty" ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 }}>
            <View style={{ width: 120, height: 150, borderRadius: radius.garment, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.separatorStrong, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Icon name="garment" size={32} color={colors.secondaryLabel} />
            </View>
            <Text accessibilityRole="header" style={{ ...type.display(26), color: colors.label, textAlign: "center" }}>Your looks start in your closet.</Text>
            <Text style={{ ...type.body, color: colors.secondaryLabel, textAlign: "center", marginBottom: 8 }}>
              Add a few pieces to see outfits made just for you.
            </Text>
            <View style={{ width: 220 }}>
              <Button title="Add Clothes" icon="camera" onPress={() => router.push("/add")} />
            </View>
          </View>
        ) : phase === "generating" ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 22, paddingHorizontal: 32 }}>
            <View style={{ flexDirection: "row", gap: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {WAITING.map((icon, k) => (
                <Float key={icon} delay={k * 150}>
                  <View style={{ width: 64, height: 80, borderRadius: radius.primary, backgroundColor: colors.tile, alignItems: "center", justifyContent: "center", ...shadow.tile }}>
                    <Icon name={icon} size={26} color={colors.secondaryLabel} />
                  </View>
                </Float>
              ))}
            </View>
            {reduced ? <ActivityIndicator color={colors.secondaryLabel} /> : null}
            <Text accessibilityLiveRegion="polite" style={{ ...type.headline, color: colors.label }}>Putting your looks together…</Text>
          </View>
        ) : phase === "no_match" ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 32 }}>
            <Text style={{ ...type.title2, color: colors.label, textAlign: "center" }}>{limitation}</Text>
            <Button title="Adjust Preferences" variant="glass" size="medium" onPress={() => { setStep(0); setPhase("form"); }} />
          </View>
        ) : phase === "results" && deckLook ? (
          <ScrollView scrollEnabled={!dragging} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 }}>
            <Text accessibilityRole="header" style={{ ...type.display(30), color: colors.label }}>
              {looks.length === 1 ? "1 look for you" : `${looks.length} looks for you`}
            </Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 2 }}>
              {looks.length > 1 ? "Swipe for the next one. Tap a look to open it." : "Tap the look to open it."}
            </Text>
            {limitation ? (
              <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 6 }}>{limitation}</Text>
            ) : looks.length < 3 ? (
              <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 6 }}>
                These are the combinations that match what you picked.
              </Text>
            ) : null}
            <View style={{ marginTop: 14 }}>
              <LookDeck looks={looks} items={itemsById} index={deckIndex} onIndexChange={setDeckIndex}
                onOpen={openLook} height={deckHeight} onDragging={setDragging} />
            </View>
            <Text style={{ ...type.eyebrow, color: colors.secondaryLabel, marginTop: 24 }}>Tap any piece to swap it</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {orderedSlots(deckLook).map(({ slot, itemId }) => {
                const item = itemsById.get(itemId);
                if (!item) return null;
                return (
                  <PressScale key={slot} onPress={() => openSwap(deckIndex % looks.length, slot, itemId)}
                    accessibilityRole="button" accessibilityLabel={`Swap ${garmentName(item)}`}>
                    <Glass radius={radius.primary} style={{ padding: 4 }}>
                      <View style={{ width: 56, height: 66, borderRadius: radius.primary - 4, backgroundColor: colors.tile, overflow: "hidden" }}>
                        <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
                          tile={colors.tile} style={{ width: 56, height: 66, borderRadius: radius.primary - 4 }} />
                      </View>
                    </Glass>
                  </PressScale>
                );
              })}
            </View>
            {generateError ? <Text style={{ ...type.subhead, color: colors.destructive, marginTop: 16 }}>{generateError}</Text> : null}
            <View style={{ marginTop: 24 }}>
              <Button title="Generate Again" variant="glass" size="medium" onPress={() => generate(true)} />
            </View>
          </ScrollView>
        ) : phase === "detail" && look && selected !== null ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, gap: 18 }}>
            <View>
              <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label }}>{look.title}</Text>
              <Text style={{ ...type.body, color: colors.secondaryLabel, marginTop: 6 }}>{look.reason}</Text>
            </View>
            <Text style={{ ...type.eyebrow, color: colors.secondaryLabel }}>Tap any piece to swap it</Text>
            <View style={{ gap: 10 }}>
              {orderedSlots(look).map(({ slot, itemId }) => {
                const item = itemsById.get(itemId);
                if (!item) return null;
                return (
                  <Glass key={slot} radius={radius.list} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 12 }}>
                    <View style={{ width: 84, height: 96, borderRadius: radius.image, backgroundColor: colors.tile, overflow: "hidden" }}>
                      <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
                        tile={colors.tile} style={{ width: 84, height: 96, borderRadius: radius.image }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{SLOT_LABELS[slot]}</Text>
                      <Text style={{ ...type.cardTitle, color: colors.label }}>{garmentName(item)}</Text>
                    </View>
                    <Button title="Swap" size="medium" variant="soft" onPress={() => openSwap(selected, slot, itemId)} />
                  </Glass>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 }}>
            <Rise key={`q${step}`}>
              <StepDots step={step} count={QUESTIONS.length} />
              <Text style={{ ...type.eyebrow, color: colors.secondaryLabel, marginTop: 14 }}>{`Build My Look · ${step + 1} of ${QUESTIONS.length}`}</Text>
              <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label, marginTop: 6 }}>{question.title}</Text>
            </Rise>
            <View key={`a${step}`} style={{ marginTop: 22 }}>
              <AnswerGrid question={question} value={filters[question.key]}
                onChange={(v) => setFilters((f) => ({ ...f, [question.key]: v }) as OutfitFilters)} />
            </View>
            {generateError ? <Text style={{ ...type.subhead, color: colors.destructive, marginTop: 16 }}>{generateError}</Text> : null}
            <View style={{ flex: 1, minHeight: 24 }} />
            <Button title={lastStep ? "Build Looks" : "Next"} onPress={() => (lastStep ? generate() : setStep(step + 1))} />
            <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center", marginTop: 10 }}>
              Made with clothes you already own.
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>

      <SwapSheet
        visible={swapSlot !== null}
        onClose={closeSwap}
        slot={swapSlot}
        current={currentSwapItem}
        loading={swapLoading}
        error={swapError}
        alternatives={swapAlternatives}
        items={itemsById}
        onChoose={chooseAlternative}
      />
    </GlassScreen>
  );
}
