import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { deleteItem, getPendingItems, keepItem } from "../../src/api/client";
import type { ClosetItem } from "../../src/api/types";
import { GarmentImage } from "../../src/components/GarmentImage";
import { PillButton } from "../../src/components/PillButton";
import { TierBadge } from "../../src/components/TierBadge";
import { haptics } from "../../src/haptics";
import { AI_NOTE } from "../../src/outfit/outfit";
import { colors, radius, type } from "../../src/theme";

// Outfit Photo results wait here until the user keeps or discards each one. Listed from the server,
// so it works after an app restart. Credits were charged when an image was made (owner decision D4).
export default function ReviewScreen() {
  const { failed } = useLocalSearchParams<{ failed?: string }>();
  const router = useRouter();
  const [items, setItems] = useState<ClosetItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(() => {
    getPendingItems().then(setItems).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your pieces."));
  }, []);
  useEffect(load, [load]);

  async function act(item: ClosetItem, keep: boolean) {
    setWorking(item.item_id);
    setError(null);
    try {
      if (keep) await keepItem(item);
      else await deleteItem(item);
      haptics.success();
      setItems((list) => (list ?? []).filter((i) => i.item_id !== item.item_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setWorking(null);
    }
  }

  async function keepAll() {
    for (const item of items ?? []) await act(item, true);
  }

  const done = items !== null && items.length === 0;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label, marginTop: 20 }}>Review</Text>
        <Text style={{ ...type.body, color: colors.secondaryLabel, marginTop: 8 }}>{AI_NOTE} Keep the ones that look like yours.</Text>
        {failed ? (
          <View style={{ marginTop: 16, borderRadius: 14, padding: 12, backgroundColor: colors.destructiveBg }}>
            <Text style={{ ...type.subhead, color: colors.destructive }}>
              Couldn't make: {failed}. Those weren't charged — try again, or photograph them laid flat.
            </Text>
          </View>
        ) : null}
        {error ? <Text style={{ ...type.subhead, color: colors.destructive, marginTop: 12 }}>{error}</Text> : null}
        {items === null && !error ? <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 20 }}>Loading…</Text> : null}
        {done ? <Text style={{ ...type.body, color: colors.secondaryLabel, marginTop: 20 }}>All reviewed.</Text> : null}

        <View style={{ gap: 14, marginTop: 20 }}>
          {(items ?? []).map((item) => (
            <View key={item.item_id} style={{ backgroundColor: colors.card, borderRadius: radius.card, padding: 16, gap: 12 }}>
              <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url}
                            tile={colors.tile} style={{ width: "100%", aspectRatio: 1 }} />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ ...type.headline, color: colors.label }}>
                  {String(item.facts.category.value).replace(/^./, (ch) => ch.toUpperCase())}
                </Text>
                <TierBadge tier={item.tier} />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <PillButton label="Discard" onPress={() => act(item, false)} disabled={working !== null} />
                </View>
                <View style={{ flex: 1 }}>
                  <PillButton label="Keep" variant="primary" onPress={() => act(item, true)} disabled={working !== null} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 10 }}>
        {(items?.length ?? 0) > 1 ? <PillButton label="Keep all" variant="primary" onPress={keepAll} disabled={working !== null} /> : null}
        <PillButton label={done ? "Go to closet" : "Later"} onPress={() => router.replace("/closet")} />
      </View>
    </SafeAreaView>
  );
}
