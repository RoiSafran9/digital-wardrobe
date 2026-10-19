import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { getItems } from "../../src/api/client";
import type { ClosetItem } from "../../src/api/types";
import { CATEGORY_GROUPS, groupOf } from "../../src/categoryGroups";
import { Icon } from "../../src/components/Icon";
import { AddRows, AddToCloset, type PhotoActions } from "../../src/components/home/AddToCloset";
import { CaptureBanner } from "../../src/components/home/CaptureBanner";
import { CategoryRows, type CategoryRow } from "../../src/components/home/CategoryRows";
import { Greeting } from "../../src/components/home/Greeting";
import { HomeEmpty } from "../../src/components/home/HomeEmpty";
import { useCredits } from "../../src/credits/CreditsProvider";
import { pickPhoto } from "../../src/photoPicker";
import { colors, radius, TAB_BAR_HEIGHT, type } from "../../src/theme";
import { Button } from "../../src/ui";

// One row per category group with pieces, in the groups' fixed order, with the group's first piece.
export function categoryRows(items: ClosetItem[]): CategoryRow[] {
  const byGroup = new Map<string, ClosetItem[]>();
  for (const item of items) {
    const g = groupOf(item);
    byGroup.set(g, [...(byGroup.get(g) ?? []), item]);
  }
  return CATEGORY_GROUPS.filter((g) => byGroup.has(g)).map((g) => ({ name: g, count: byGroup.get(g)!.length, first: byGroup.get(g)![0] }));
}

export default function HomeScreen() {
  const router = useRouter();
  const { outfit: outfitOn } = useCredits();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setItems((await getItems()).items);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your closet.");
    } finally {
      setLoaded(true);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rows = useMemo(() => categoryRows(items), [items]);
  const empty = loaded && items.length === 0;

  // Both pickers open the same system library, but each knows which flow it feeds (garment or outfit).
  const pickInto = (flow: "garment" | "outfit") => async () => {
    setPickError(null);
    try {
      const uri = await pickPhoto(false);
      if (!uri) return;
      router.push(flow === "garment"
        ? { pathname: "/capture/preview", params: { uri, flow } }
        : { pathname: "/outfit/detect", params: { uri, flow } });
    } catch (e) {
      setPickError(e instanceof Error ? e.message : "Couldn't open your photos.");
    }
  };
  const actions: PhotoActions = {
    onGarmentCamera: () => router.push({ pathname: "/capture/camera", params: { mode: "garments" } }),
    onGarmentLibrary: pickInto("garment"),
    onOutfitPhoto: outfitOn ? pickInto("outfit") : undefined,
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 28 }}>
        <Greeting now={new Date()} onCredits={() => router.push("/account")} />
        <CaptureBanner />

        {loadError ? (
          <View style={{ margin: 20, padding: 16, borderRadius: radius.list, backgroundColor: colors.destructiveBg, gap: 10 }}>
            <Text style={{ ...type.subhead, color: colors.destructive }}>{loadError}</Text>
            <Button title="Try again" size="medium" variant="secondary" onPress={load} />
          </View>
        ) : null}

        {empty ? (
          <View style={{ marginTop: 20 }}>
            <HomeEmpty outfit={!!outfitOn}><AddRows {...actions} /></HomeEmpty>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            <Pressable
              onPress={() => router.push({ pathname: "/closet", params: { search: "1", at: String(Date.now()) } })}
              accessibilityRole="search" accessibilityLabel={`Search ${items.length} pieces`}
              style={{ marginTop: 22, height: 44, borderRadius: radius.input, backgroundColor: colors.fill, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }}
            >
              <Icon name="search" size={17} color={colors.secondaryLabel} />
              <Text style={{ ...type.callout, color: colors.secondaryLabel }}>{`Search ${items.length} ${items.length === 1 ? "piece" : "pieces"}`}</Text>
            </Pressable>

            <Text accessibilityRole="header" style={{ ...type.eyebrow, color: colors.secondaryLabel, paddingTop: 26, paddingBottom: 10 }}>Add to closet</Text>
            <AddToCloset {...actions} />

            {rows.length ? (
              <>
                <Text accessibilityRole="header" style={{ ...type.eyebrow, color: colors.secondaryLabel, paddingTop: 28, paddingBottom: 6 }}>Your closet</Text>
                <CategoryRows rows={rows} onOpen={(g) => router.push({ pathname: "/closet", params: { group: g, at: String(Date.now()) } })} />
              </>
            ) : null}
          </View>
        )}
        {pickError ? <Text style={{ ...type.footnote, color: colors.destructive, paddingHorizontal: 20, marginTop: 10 }}>{pickError}</Text> : null}
      </ScrollView>

    </SafeAreaView>
  );
}
