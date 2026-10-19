import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { deleteItem, getPendingItems, imageUrl, keepItem, regenerateItem } from "../../src/api/client";
import { NO_CREDITS } from "../../src/api/v1";
import { creditsLabel } from "../../src/credits/credits";
import { ActivityIndicator } from "react-native";
import type { ClosetItem } from "../../src/api/types";
import { groupOf } from "../../src/categoryGroups";
import { GarmentImage } from "../../src/components/GarmentImage";
import { TierBadge } from "../../src/components/TierBadge";
import { useCredits } from "../../src/credits/CreditsProvider";
import { garmentName } from "../../src/garmentName";
import { haptics } from "../../src/haptics";
import { AI_NOTE } from "../../src/outfit/outfit";
import { useCaptureJobs } from "../../src/store/captureJobs";
import { colors, hitSlopFor, radius, type } from "../../src/theme";
import { Button, CostSheet, InsufficientCreditsSheet } from "../../src/ui";

// Outfit Photo results wait here until the user keeps or discards each one: the crop of their photo
// next to the generated image. Listed from the server, so it works after an app restart. Credits were
// charged when an image was made (owner decision D4). Regenerate remakes one result as a new front image (D14).
export default function ReviewScreen() {
  const { failed } = useLocalSearchParams<{ failed?: string }>();
  const router = useRouter();
  const { billing, prices, refresh } = useCredits();
  const { setSaved } = useCaptureJobs();
  const [items, setItems] = useState<ClosetItem[] | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [short, setShort] = useState(false);
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
      setSaved({ items: kept, creditsUsed: billing && prices.garment !== undefined ? list.length * prices.garment : null });
      void refresh();
      router.replace("/capture/saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      load();
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}>
      <Text style={{ ...type.headline, color: colors.label }}>{list.length ? `Review ${at + 1} of ${list.length}` : "Review"}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {list.length ? <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{`${kept.length} kept`}</Text> : null}
        <Pressable onPress={() => router.replace("/closet")} accessibilityRole="button" hitSlop={hitSlopFor(28)}>
          <Text style={{ ...type.body, color: colors.tint }}>Later</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {failed ? (
          <View style={{ borderRadius: radius.button, padding: 12, backgroundColor: colors.destructiveBg }}>
            <Text style={{ ...type.subhead, color: colors.destructive }}>
              {`Couldn't make: ${failed}. Those weren't charged — try again, or photograph them laid flat.`}
            </Text>
          </View>
        ) : null}
        {error ? <Text style={{ ...type.subhead, color: colors.destructive }}>{error}</Text> : null}
        {items === null && !error ? <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Loading…</Text> : null}
        {items !== null && list.length === 0 ? <Text style={{ ...type.body, color: colors.secondaryLabel }}>All reviewed.</Text> : null}

        {item ? (
          <>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ ...type.eyebrow, color: colors.secondaryLabel }}>Your photo</Text>
                <View style={{ aspectRatio: 3 / 4, borderRadius: radius.list, overflow: "hidden", backgroundColor: colors.tile }}>
                  <Image source={{ uri: imageUrl(item.crop_url) }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityLabel="Crop of your photo" />
                </View>
              </View>
              <View style={{ flex: 1.1, gap: 6 }}>
                <Text style={{ ...type.eyebrow, color: colors.secondaryLabel }}>Generated</Text>
                <View style={{ aspectRatio: 4 / 5, borderRadius: radius.list, backgroundColor: colors.tile, overflow: "hidden" }}>
                  <GarmentImage key={item.generated_url} path={item.generated_url} cutoutPath={item.cutout_url} tile={colors.tile} style={{ width: "100%", height: "100%" }} />
                  {regenerating === item.item_id ? (
                    <View accessibilityLiveRegion="polite" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.6)", gap: 8 }}>
                      <ActivityIndicator color={colors.tint} />
                      <Text style={{ ...type.footnote, fontWeight: "600", color: "#131315" }}>Making a new image…</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>{garmentName(item)}</Text>
                <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{groupOf(item)}</Text>
              </View>
              <TierBadge tier={item.tier} />
            </View>
            <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{AI_NOTE}</Text>
            <Button
              title={unit ? `↻ Regenerate · ${creditsLabel(unit)}` : "↻ Regenerate"}
              variant="secondary" size="medium"
              disabled={regenerating !== null}
              onPress={() => (unit ? setConfirmRegen(true) : void regenerate(item))}
            />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.grouped, borderRadius: radius.list, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text style={{ ...type.body, color: colors.label }}>Keep</Text>
              <Switch accessibilityLabel={`Keep ${garmentName(item)}`} value={!off.has(item.item_id)} onValueChange={(v) => setKeep(item, v)} />
            </View>
            {list.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {list.map((i, k) => (
                  <Pressable key={i.item_id} onPress={() => setAt(k)} accessibilityRole="button" accessibilityLabel={`Piece ${k + 1}`}
                    accessibilityState={{ selected: k === at }}
                    style={{ borderRadius: 12, borderWidth: 2, borderColor: k === at ? colors.tint : "transparent", opacity: off.has(i.item_id) ? 0.4 : 1 }}>
                    <GarmentImage path={i.generated_url} cutoutPath={i.cutout_url} tile={colors.tile} style={{ width: 52, height: 64, borderRadius: 10 }} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      {list.length ? (
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }}>
          <View style={{ width: 92 }}>
            <Button title="Back" variant="secondary" onPress={() => setAt(Math.max(0, at - 1))} disabled={at === 0} />
          </View>
          <View style={{ flex: 1 }}>
            {last
              ? <Button title={`Save ${kept.length} to Closet`} onPress={save} loading={saving} />
              : <Button title="Next" onPress={() => setAt(at + 1)} />}
          </View>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
          <Button title="Go to Closet" variant="secondary" onPress={() => router.replace("/closet")} />
        </View>
      )}
      <CostSheet
        visible={confirmRegen}
        title="Make a new image"
        subtitle="A new catalog image from the same photo. It replaces the current one."
        lines={[{ label: "Front image", action: "garment", count: 1 }]}
        confirmLabel={unit ? `Regenerate · ${creditsLabel(unit)}` : "Regenerate"}
        onConfirm={() => item && void regenerate(item)}
        onClose={() => setConfirmRegen(false)}
      />
      <InsufficientCreditsSheet visible={short} needed={unit ?? 0} onClose={() => setShort(false)} />
    </SafeAreaView>
  );
}
