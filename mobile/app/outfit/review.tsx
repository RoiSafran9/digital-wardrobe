import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { deleteItem, getPendingItems, imageUrl, keepItem, regenerateItem } from "../../src/api/client";
import { NO_CREDITS } from "../../src/api/v1";
import { creditsLabel } from "../../src/credits/credits";
import { ActivityIndicator } from "react-native";
import type { ClosetItem } from "../../src/api/types";
import { groupOf } from "../../src/categoryGroups";
import { FlowBar, FlowFooter, PHOTO_BG } from "../../src/components/capture/FlowChrome";
import { ErrorNote } from "../../src/components/ErrorNote";
import { GarmentImage } from "../../src/components/GarmentImage";
import { TierBadge } from "../../src/components/TierBadge";
import { useCredits } from "../../src/credits/CreditsProvider";
import { garmentName } from "../../src/garmentName";
import { haptics } from "../../src/haptics";
import { AI_NOTE } from "../../src/outfit/outfit";
import { useCaptureJobs } from "../../src/store/captureJobs";
import { useOutfitJobsMaybe } from "../../src/jobs/OutfitJobsProvider";
import { idsParam } from "../../src/firstPieces/celebrate";
import { noteItemsSaved } from "../../src/morningReminder/closetSignal";
import { colors, hitSlopFor, radius, type, weight } from "../../src/theme";
import { Button, CostSheet, GlassScreen, GroupedList, InsufficientCreditsSheet, Row } from "../../src/ui";
import { useScreenViewed } from "../../src/activity/track";

// Outfit Photo results wait here until the user keeps or discards each one: the crop of their photo
// next to the generated image. Listed from the server, so it works after an app restart. Credits were
// charged when an image was made (owner decision D4). Regenerate remakes one result as a new front image (D14).
export default function ReviewScreen() {
  useScreenViewed("outfit_review");
  const { failed, onboarding } = useLocalSearchParams<{ failed?: string; onboarding?: string }>();
  const router = useRouter();
  const { billing, prices, refresh } = useCredits();
  const { setSaved } = useCaptureJobs();
  // The finished outfit jobs' results are listed here now: they leave the jobs banner.
  const outfitJobs = useOutfitJobsMaybe();
  useEffect(() => { outfitJobs?.reviewed(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const [items, setItems] = useState<ClosetItem[] | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [short, setShort] = useState(false);
  const [footer, setFooter] = useState(0);
  const unit = billing ? prices.garment : undefined;

  async function regenerate(target: ClosetItem) {
    setConfirmRegen(false);
    setRegenerating(target.item_id);
    setError(null);
    try {
      const fresh = await regenerateItem(target, unit ?? null);
      setItems((list) => (list ?? []).map((i) => (i.item_id === target.item_id ? fresh : i)));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't make a new image. Try again.";
      if (message === NO_CREDITS) setShort(true);
      else setError(message);
    } finally {
      setRegenerating(null);
      void refresh();
    }
  }

  const load = useCallback(() => {
    getPendingItems().then(setItems).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your pieces."));
  }, []);
  useEffect(load, [load]);

  const list = items ?? [];
  const item = list[at];
  const kept = list.filter((i) => !off.has(i.item_id));
  const last = at === list.length - 1;

  const setKeep = (i: ClosetItem, keep: boolean) => {
    haptics.selection();
    setOff((s) => { const n = new Set(s); keep ? n.delete(i.item_id) : n.add(i.item_id); return n; });
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      for (const i of list) {
        if (off.has(i.item_id)) await deleteItem(i);
        else await keepItem(i);
      }
      haptics.success();
      void refresh();
      if (kept.length) noteItemsSaved();  // kept pieces are now in the closet
      // First 3 Pieces: the kept pieces open the closet with the first-success popup instead of Saved.
      if (onboarding === "1" && kept.length) {
        router.replace({ pathname: "/closet", params: { celebrate: "1", ids: idsParam(kept.map((i) => i.item_id)), path: "not_near", at: String(Date.now()) } });
        return;
      }
      setSaved({ items: kept, creditsUsed: billing && prices.garment !== undefined ? list.length * prices.garment : null });
      router.replace("/capture/saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      load();
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <FlowBar
      title={list.length ? `Review ${at + 1} of ${list.length}` : "Review"}
      leftNode={list.length ? <Text style={{ ...type.subhead, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>{`${kept.length} kept`}</Text> : null}
      right={
        <Pressable onPress={() => router.replace("/closet")} accessibilityRole="button" hitSlop={hitSlopFor(28)}>
          <Text style={{ ...type.body, color: colors.tint }}>Later</Text>
        </Pressable>
      }
    />
  );
  const regenLabel = unit ? `↻ Regenerate · ${creditsLabel(unit)}` : "↻ Regenerate";

  return (
    <GlassScreen>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {header}
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: footer + 20, gap: 14 }}>
          {failed ? <ErrorNote message={`Couldn't make: ${failed}. Those weren't charged — try again, or photograph them laid flat.`} /> : null}
          {error ? <Text style={{ ...type.subhead, color: colors.destructive }}>{error}</Text> : null}
          {items === null && !error ? <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Loading…</Text> : null}
          {items !== null && list.length === 0 ? <Text style={{ ...type.body, color: colors.secondaryLabel }}>All reviewed.</Text> : null}

          {item ? (
            <>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ ...type.eyebrow, color: colors.secondaryLabel }}>Your photo</Text>
                  <View style={{ height: 250, borderRadius: radius.garment, overflow: "hidden", backgroundColor: PHOTO_BG }}>
                    <Image source={{ uri: imageUrl(item.crop_url) }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityLabel="Crop of your photo" />
                  </View>
                </View>
                <View style={{ flex: 1.4, gap: 6 }}>
                  <Text style={{ ...type.eyebrow, color: colors.secondaryLabel }}>Generated</Text>
                  <View style={{ height: 250, borderRadius: radius.garment, backgroundColor: colors.tile, overflow: "hidden" }}>
                    <GarmentImage key={item.generated_url} path={item.generated_url} cutoutPath={item.cutout_url} tile={colors.tile} style={{ width: "100%", height: "100%" }} />
                    {regenerating === item.item_id ? (
                      <View accessibilityLiveRegion="polite" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)", gap: 8 }}>
                        <ActivityIndicator color={colors.tint} />
                        <Text style={{ ...type.footnote, ...weight(600), color: "#131315" }}>Making a new image…</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 2 }}>
                <View style={{ flex: 1 }}>
                  <Text accessibilityRole="header" style={{ ...type.display(26), color: colors.label }}>{garmentName(item)}</Text>
                  <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{groupOf(item)}</Text>
                </View>
                <TierBadge tier={item.tier} />
              </View>
              <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{AI_NOTE}</Text>
              <GroupedList>
                <Row label="Keep" accessory={
                  <Switch accessibilityLabel={`Keep ${garmentName(item)}`} value={!off.has(item.item_id)} onValueChange={(v) => setKeep(item, v)} />
                } />
                <Pressable
                  accessibilityRole="button" accessibilityLabel={regenLabel}
                  accessibilityState={{ disabled: regenerating !== null }} disabled={regenerating !== null}
                  onPress={() => (unit ? setConfirmRegen(true) : void regenerate(item))}
                  style={({ pressed }) => ({ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12,
                    backgroundColor: pressed ? colors.fill : "transparent", opacity: regenerating !== null ? 0.4 : 1 })}
                >
                  <Text style={{ ...type.body, color: colors.tint, flex: 1 }}>↻ Regenerate</Text>
                  {unit ? <Text style={{ ...type.body, color: colors.secondaryLabel }}>{creditsLabel(unit)}</Text> : null}
                </Pressable>
              </GroupedList>
              {list.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {list.map((i, k) => (
                    <Pressable key={i.item_id} onPress={() => setAt(k)} accessibilityRole="button" accessibilityLabel={`Piece ${k + 1}`}
                      accessibilityState={{ selected: k === at }}
                      style={{ padding: 2, borderRadius: 14, borderWidth: 2, borderColor: k === at ? colors.tint : "transparent", opacity: off.has(i.item_id) ? 0.4 : 1 }}>
                      <GarmentImage path={i.generated_url} cutoutPath={i.cutout_url} tile={colors.tile} style={{ width: 48, height: 58, borderRadius: 10 }} />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
            </>
          ) : null}
        </ScrollView>
        <FlowFooter onHeight={setFooter}>
          {list.length ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Back" variant="glass" onPress={() => setAt(Math.max(0, at - 1))} disabled={at === 0} />
              </View>
              <View style={{ flex: 1 }}>
                {last
                  ? <Button title={`Save ${kept.length} to Closet`} onPress={save} loading={saving} />
                  : <Button title="Next" onPress={() => setAt(at + 1)} />}
              </View>
            </View>
          ) : (
            <Button title="Go to Closet" variant="glass" onPress={() => router.replace("/closet")} />
          )}
        </FlowFooter>
      </SafeAreaView>
      <CostSheet
        visible={confirmRegen}
        title="Make a new image"
        subtitle="A new catalog image from the same photo. It replaces the current one."
        lines={[{ label: "Front image", action: "garment", count: 1 }]}
        confirmLabel={unit ? `Regenerate · ${creditsLabel(unit)}` : "Regenerate"}
        onConfirm={() => item && void regenerate(item)}
        onClose={() => setConfirmRegen(false)}
        action="regenerate"
      />
      <InsufficientCreditsSheet action="regenerate" visible={short} needed={unit ?? 0} onClose={() => setShort(false)} />
    </GlassScreen>
  );
}
