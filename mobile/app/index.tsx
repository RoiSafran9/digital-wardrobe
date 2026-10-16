import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { getItems } from "../src/api/client";
import type { ClosetItem } from "../src/api/types";
import { closetStats } from "../src/closetStats";
import { GarmentImage } from "../src/components/GarmentImage";
import { ItemSheet } from "../src/components/ItemSheet";
import { JustAdded } from "../src/components/JustAdded";
import { PillButton } from "../src/components/PillButton";
import { CAPTURE_STEPS, KEEP_OPEN, ProcessingStatus } from "../src/components/ProcessingStatus";
import { CountUp } from "../src/motion/CountUp";
import { Marquee } from "../src/motion/Marquee";
import { PressScale } from "../src/motion/PressScale";
import { Rise } from "../src/motion/Rise";
import { colors, hitSlopFor, radius, type } from "../src/theme";
import { useCapture } from "../src/useCapture";

const TILE = 96;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View accessible accessibilityLabel={label} style={{ flex: 1, backgroundColor: colors.card, borderRadius: radius.card, padding: 14 }}>
      <CountUp value={value} style={{ ...type.title2, color: colors.label }} />
      <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { capture, loading, error: captureError } = useCapture();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ list: ClosetItem[]; index: number } | null>(null);

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

  const stats = useMemo(() => closetStats(items, new Date()), [items]);
  const rowA = items.filter((_, i) => i % 2 === 0);
  const rowB = items.filter((_, i) => i % 2 === 1);
  const empty = loaded && !loadError && items.length === 0;

  const garment = (list: ClosetItem[]) => (item: ClosetItem, index: number) => (
    <PressScale accessibilityRole="button" accessibilityLabel={`Open ${item.facts.category.value}`} onPress={() => setOpen({ list, index })}>
      <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} style={{ width: TILE, height: TILE + 12 }} tile={colors.card} />
    </PressScale>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label }}>Wardrobe</Text>
          {items.length > 0 ? (
            <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 2 }}>
              {stats.pieces === 1 ? "1 piece" : `${stats.pieces} pieces`} · {stats.addedThisWeek} added this week
            </Text>
          ) : null}
        </View>

        {loadError ? (
          <View style={{ margin: 20, padding: 16, borderRadius: radius.card, backgroundColor: colors.destructiveBg, gap: 10 }}>
            <Text style={{ ...type.subhead, color: colors.destructive }}>{loadError}</Text>
            <PillButton label="Try again" onPress={load} />
          </View>
        ) : null}

        {items.length > 0 ? (
          <View style={{ marginTop: 18, gap: 10 }}>
            <Marquee items={rowA} itemWidth={TILE} renderItem={garment(rowA)} testID="row-a" />
            {rowB.length ? <Marquee items={rowB} itemWidth={TILE} renderItem={garment(rowB)} reverse speed={14} testID="row-b" /> : null}
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 20 }}>
          {empty ? (
            <Rise style={{ marginTop: 28 }}>
              <Text style={{ ...type.title2, color: colors.label }}>Start your closet</Text>
              <Text style={{ ...type.body, color: colors.secondaryLabel, marginTop: 6 }}>
                Photograph a piece, or a few side by side. Each one becomes a clean catalog shot.
              </Text>
            </Rise>
          ) : null}

          {items.length > 0 ? (
            <Rise style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <Stat label="Pieces" value={stats.pieces} />
              <Stat label="Categories" value={stats.categories.length} />
              <Stat label="Colors" value={stats.colors} />
            </Rise>
          ) : null}

          <View style={{ marginTop: 20, gap: 10 }}>
            {loading ? (
              <View style={{ backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: 24 }}>
                <ProcessingStatus steps={CAPTURE_STEPS} note={KEEP_OPEN} />
              </View>
            ) : (
              <>
                <PillButton label="Take photo" variant="primary" icon="camera" onPress={() => capture(true)} />
                <PillButton label="Choose from library" onPress={() => capture(false)} />
              </>
            )}
            {captureError ? <Text style={{ ...type.footnote, color: colors.destructive }}>{captureError}</Text> : null}
          </View>

          <View style={{ marginTop: 28 }}>
            <JustAdded onClosetChanged={load} />
          </View>

          {stats.categories.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ ...type.headline, color: colors.label, marginBottom: 10 }}>By category</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {stats.categories.map(({ name, count }) => (
                  <PressScale
                    key={name}
                    accessibilityRole="button"
                    accessibilityLabel={`${name}, ${count}`}
                    hitSlop={hitSlopFor(34)}
                    onPress={() => router.push({ pathname: "/closet", params: { category: name } })}
                    style={{ flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.card }}
                  >
                    <Text style={{ ...type.subhead, color: colors.label }}>{name}</Text>
                    <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{count}</Text>
                  </PressScale>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ItemSheet items={open?.list ?? []} index={open ? open.index : null} onClose={() => setOpen(null)}
        onUpdated={() => load()} onDeleted={() => { setOpen(null); load(); }} />
    </SafeAreaView>
  );
}
