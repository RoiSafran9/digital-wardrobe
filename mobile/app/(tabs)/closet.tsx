import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getItems } from "../../src/api/client";
import { GarmentImage } from "../../src/components/GarmentImage";
import { ItemSheet } from "../../src/components/ItemSheet";
import { PillButton } from "../../src/components/PillButton";
import { Rise } from "../../src/motion/Rise";
import type { ClosetItem } from "../../src/api/types";
import { categoryOf } from "../../src/categories";
import { asList, capitalize, colors, hitSlopFor, radius, type } from "../../src/theme";
import { PressScale } from "../../src/motion/PressScale";

const ALL = "All";

function sameItem(a: ClosetItem, b: ClosetItem): boolean {
  return a.run_id === b.run_id && a.photo_name === b.photo_name && a.item_id === b.item_id;
}

export default function ClosetScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [category, setCategory] = useState(ALL);
  const params = useLocalSearchParams<{ category?: string; at?: string }>();
  // Home's category chips open the closet pre-filtered; normalize like everywhere else.
  useEffect(() => {
    if (!params.category) return;
    setCategory(categoryOf({ facts: { category: { value: params.category } } } as never));
  }, [params.category, params.at]);  // `at` changes on every chip tap, so the same chip re-applies

  const [loadError, setLoadError] = useState<string | null>(null);

  // Never let a failed fetch become an uncaught rejection: show it, offer a retry.
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

  // Tabs stay mounted, so reload on every focus to pick up items from new runs.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const categories = useMemo(() => [ALL, ...new Set(items.map(categoryOf))], [items]);
  // A category that's gone (deleted, recategorized) falls back to everything, never a blank closet.
  const active = categories.includes(category) ? category : ALL;
  const visible = active === ALL ? items : items.filter((item) => categoryOf(item) === active);

  const header = (
    <View style={{ paddingTop: 8, paddingBottom: 16 }}>
      <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label }}>Closet</Text>
      <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 2, marginBottom: 12 }}>
        {items.length === 1 ? "1 piece" : `${items.length} pieces`}
      </Text>
      {loadError ? (
        <View style={{ padding: 16, borderRadius: radius.card, backgroundColor: colors.destructiveBg, gap: 10, marginBottom: 12 }}>
          <Text style={{ ...type.subhead, color: colors.destructive }}>{loadError}</Text>
          <PillButton label="Try again" onPress={load} />
        </View>
      ) : null}
      {items.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 8 }}>
          {categories.map((name) => {
            const selected = name === active;
            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityState={{ selected: selected }}
                onPress={() => setCategory(name)}
                hitSlop={hitSlopFor(30)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill,
                  backgroundColor: selected ? colors.tint : colors.card,
                }}
              >
                <Text style={{ ...type.subhead, color: selected ? colors.onTint : colors.label }}>{name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={visible}
        numColumns={2}
        keyExtractor={(item) => `${item.run_id}-${item.item_id}`}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        columnWrapperStyle={{ gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.secondaryLabel} />}
        ListEmptyComponent={
          loaded && !loadError && items.length === 0 ? (
            <View style={{ paddingTop: 48, alignItems: "center", gap: 8 }}>
              <Text style={{ ...type.title2, color: colors.label }}>Your closet is empty</Text>
              <Text style={{ ...type.body, color: colors.secondaryLabel, textAlign: "center", marginBottom: 16 }}>
                Photograph a piece and it'll land here as a clean catalog shot.
              </Text>
              <PillButton label="Add a piece" variant="primary" icon="camera" onPress={() => router.push("/add")} />
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          // The collection lays itself out: short stagger, capped so long closets don't wait.
          <Rise delay={Math.min(index, 8) * 30} style={{ flex: 1 / 2 }}>
          <PressScale
            testID={`thumb-${item.run_id}-${item.item_id}`}
            onPress={() => setSelectedIndex(index)}
            style={{ marginBottom: 22 }}
          >
            <View>
              <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} tile={colors.card} style={{ width: "100%", aspectRatio: 0.85 }} />
              {item.turn?.state === "done" ? (
                <View
                  testID={`badge-360-${item.run_id}-${item.item_id}`}
                  accessibilityLabel="Has a 360 view"
                  style={{ position: "absolute", top: 8, right: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.background }}
                >
                  <Text style={{ ...type.caption, fontWeight: "600", color: colors.label }}>360</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ ...type.subhead, color: colors.label, marginTop: 8 }}>{categoryOf(item)}</Text>
            <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 1 }} numberOfLines={1}>
              {asList(item.facts.colors.value).map(capitalize).join(", ")}
            </Text>
          </PressScale>
          </Rise>
        )}
      />
      {/* Swipes through the grid as currently filtered. */}
      <ItemSheet
        items={visible}
        index={selectedIndex}
        onClose={() => setSelectedIndex(null)}
        onUpdated={(updated) =>
          setItems((all) => all.map((i) => (sameItem(i, updated) ? updated : i)))
        }
        onDeleted={(removed) => {
          setSelectedIndex(null);
          setItems((all) => all.filter((i) => !sameItem(i, removed)));
        }}
      />
    </SafeAreaView>
  );
}
