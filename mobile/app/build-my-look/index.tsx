import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getItems, getOutfitSuggestions, getSwapOptions } from "../../src/api/client";
import type { ClosetItem, OutfitFilters, OutfitLook, OutfitSlot, SwapAlternative } from "../../src/api/types";
import { GarmentImage } from "../../src/components/GarmentImage";
import { LookCard } from "../../src/components/outfitBuilder/LookCard";
import { SwapSheet } from "../../src/components/outfitBuilder/SwapSheet";
import { garmentName } from "../../src/garmentName";
import {
  COLOR_PREF_OPTIONS, DEFAULT_FILTERS, OCCASION_OPTIONS, SLOT_LABELS, STYLE_OPTIONS, VIBE_OPTIONS,
  WEATHER_OPTIONS, orderedSlots,
} from "../../src/outfitBuilder/filters";
import { track, useScreenViewed } from "../../src/activity/track";
import { colors, radius, TAB_BAR_HEIGHT, type } from "../../src/theme";
import { BackButton, Button, Chip } from "../../src/ui";

type Phase = "loading_closet" | "closet_empty" | "closet_error" | "form" | "generating" | "no_match" | "results" | "detail";

function FilterGroup<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ ...type.eyebrow, color: colors.secondaryLabel }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
        ))}
      </ScrollView>
    </View>
  );
}

export default function BuildMyLookScreen() {
  useScreenViewed("build_my_look");
  const router = useRouter();

  const [items, setItems] = useState<ClosetItem[]>([]);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id ?? i.item_id, i])), [items]);

  const [phase, setPhase] = useState<Phase>("loading_closet");
  const [closetError, setClosetError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OutfitFilters>(DEFAULT_FILTERS);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [limitation, setLimitation] = useState<string | null>(null);
  const [looks, setLooks] = useState<OutfitLook[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

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

  const generate = useCallback(async () => {
    setPhase("generating");
    setGenerateError(null);
    try {
      const result = await getOutfitSuggestions(filters);
      // Request telemetry (look_generation_requested) is a server event — the route already
      // records it with the real filters, result count and fallback flag; nothing to send here.
      if (result.looks.length === 0) {
        setLimitation(result.limitations[0] ?? "We couldn't find a good match for all these choices.");
        setPhase("no_match");
      } else {
        setLooks(result.looks);
        setPhase("results");
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "We couldn't make new looks right now.");
      setPhase("form");
    }
  }, [filters]);

  const openLook = (index: number) => {
    track("look_opened", { position: index });
    setSelected(index);
    setPhase("detail");
  };

  const look = selected !== null ? looks[selected] : null;

  const openSwap = async (slot: OutfitSlot, targetItemId: string) => {
    if (!look) return;
    setSwapSlot(slot);
    setSwapLoading(true);
    setSwapError(null);
    setSwapAlternatives([]);
    try {
      const options = await getSwapOptions({ slots: look.slots as Record<string, string>, item_ids: look.item_ids },
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
    if (selected === null || !swapSlot) return;
    setLooks((all) => all.map((l, i) => {
      if (i !== selected) return l;
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
    router.back();
  };

  const currentSwapItem = swapSlot && look ? itemsById.get(look.slots[swapSlot] ?? "") ?? null : null;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <BackButton onPress={back} />
      </View>

      {phase === "loading_closet" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.secondaryLabel} />
        </View>
      ) : phase === "closet_error" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 }}>
          <Text style={{ ...type.body, color: colors.destructive, textAlign: "center" }}>{closetError}</Text>
          <Button title="Try again" size="medium" variant="secondary" onPress={loadCloset} />
        </View>
      ) : phase === "closet_empty" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 }}>
          <Text style={{ ...type.section, color: colors.label, textAlign: "center" }}>Your looks start in your closet.</Text>
          <Text style={{ ...type.body, color: colors.secondaryLabel, textAlign: "center", marginBottom: 8 }}>
            Add a few pieces to see outfits made just for you.
          </Text>
          <Button title="Add Clothes" icon="camera" onPress={() => router.push("/add")} />
        </View>
      ) : phase === "generating" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
          <ActivityIndicator color={colors.secondaryLabel} />
          <Text style={{ ...type.body, color: colors.secondaryLabel }}>Putting your looks together…</Text>
        </View>
      ) : phase === "no_match" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 32 }}>
          <Text style={{ ...type.section, color: colors.label, textAlign: "center" }}>{limitation}</Text>
          <Button title="Adjust Preferences" variant="secondary" size="medium" onPress={() => setPhase("form")} />
        </View>
      ) : phase === "results" ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + 24, gap: 16 }}>
          <View>
            <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label }}>Your Looks</Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 2 }}>
              {looks.length === 1 ? "1 idea from your closet" : `${looks.length} ideas from your closet`}
            </Text>
          </View>
          {looks.length < 3 ? (
            <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>
              These are the combinations that match what you picked.
            </Text>
          ) : null}
          {looks.map((l, i) => <LookCard key={l.look_id} look={l} items={itemsById} onPress={() => openLook(i)} />)}
          <Button title="Generate Again" variant="secondary" size="medium" onPress={generate} />
        </ScrollView>
      ) : phase === "detail" && look ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + 24, gap: 18 }}>
          <View>
            <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label }}>{look.title}</Text>
            <Text style={{ ...type.body, color: colors.secondaryLabel, marginTop: 4 }}>{look.reason}</Text>
          </View>
          <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>Tap any piece to swap it</Text>
          <View style={{ gap: 14 }}>
            {orderedSlots(look).map(({ slot, itemId }) => {
              const item = itemsById.get(itemId);
              if (!item) return null;
              return (
                <View key={slot} style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.card, borderRadius: radius.list, padding: 14 }}>
                  <View style={{ width: 92, height: 92, borderRadius: radius.tile, backgroundColor: colors.tile, overflow: "hidden" }}>
                    <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
                      tile={colors.tile} style={{ width: 92, height: 92, borderRadius: radius.tile }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{SLOT_LABELS[slot]}</Text>
                    <Text style={{ ...type.headline, color: colors.label }}>{garmentName(item)}</Text>
                  </View>
                  <Button title="Swap" size="medium" variant="secondary" onPress={() => openSwap(slot, itemId)} />
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + 24, gap: 24 }}>
          <View>
            <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label }}>What are you dressing for?</Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 4 }}>
              Pick what matters today. We'll use only pieces from your closet.
            </Text>
          </View>
          {generateError ? <Text style={{ ...type.subhead, color: colors.destructive }}>{generateError}</Text> : null}
          <FilterGroup label="Occasion" options={OCCASION_OPTIONS} value={filters.occasion}
            onChange={(v) => setFilters((f) => ({ ...f, occasion: v }))} />
          <FilterGroup label="Style" options={STYLE_OPTIONS} value={filters.style}
            onChange={(v) => setFilters((f) => ({ ...f, style: v }))} />
          <FilterGroup label="Vibe" options={VIBE_OPTIONS} value={filters.vibe}
            onChange={(v) => setFilters((f) => ({ ...f, vibe: v }))} />
          <FilterGroup label="Weather" options={WEATHER_OPTIONS} value={filters.weather}
            onChange={(v) => setFilters((f) => ({ ...f, weather: v }))} />
          <FilterGroup label="Colors" options={COLOR_PREF_OPTIONS} value={filters.colors}
            onChange={(v) => setFilters((f) => ({ ...f, colors: v }))} />
          <View style={{ gap: 8 }}>
            <Button title="Generate Looks" onPress={generate} />
            <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>
              Made with clothes you already own.
            </Text>
          </View>
        </ScrollView>
      )}

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
    </SafeAreaView>
  );
}
