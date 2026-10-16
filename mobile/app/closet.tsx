import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getItems } from "../src/api/client";
import { GarmentImage } from "../src/components/GarmentImage";
import { ItemSheet } from "../src/components/ItemSheet";
import { PillButton } from "../src/components/PillButton";
import { JustAdded } from "../src/components/JustAdded";
import { Rise } from "../src/motion/Rise";
import type { ClosetItem } from "../src/api/types";
import { categoryOf } from "../src/categories";
import { asList, capitalize, colors, hitSlopFor, radius } from "../src/theme";

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

  const load = useCallback(async () => {
    const response = await getItems();
    setItems(response.items);
    setLoaded(true);
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
  const visible = category === ALL ? items : items.filter((item) => categoryOf(item) === category);

  const header = (
    <View style={{ paddingTop: 8, paddingBottom: 16 }}>
      <Text style={{ fontSize: 34, color: colors.label }}>Your closet</Text>
      <Text style={{ color: colors.secondaryLabel, fontSize: 13, marginTop: 2, marginBottom: 20 }}>
        {items.length === 1 ? "1 piece" : `${items.length} pieces`}
      </Text>
      <JustAdded onClosetChanged={load} />
      {items.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 8 }}>
          {categories.map((name) => {
            const active = name === category;
            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setCategory(name)}
                hitSlop={hitSlopFor(30)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill,
                  backgroundColor: active ? colors.label : "transparent",
                  borderWidth: 1, borderColor: active ? colors.label : colors.separatorStrong,
                }}
              >
                <Text style={{ color: active ? colors.background : colors.secondaryLabel, fontSize: 13 }}>{name}</Text>
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
          loaded && items.length === 0 ? (
            <View style={{ paddingTop: 48, alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 22, color: colors.label }}>Your closet is empty</Text>
              <Text style={{ color: colors.secondaryLabel, fontSize: 14, textAlign: "center", marginBottom: 16 }}>
                Photograph a piece and it'll land here as a clean catalog shot.
              </Text>
              <PillButton label="Add a piece" variant="primary" icon="camera" onPress={() => router.push("/")} />
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          // The collection lays itself out: short stagger, capped so long closets don't wait.
          <Rise delay={Math.min(index, 8) * 30} style={{ flex: 1 / 2 }}>
          <Pressable
            testID={`thumb-${item.run_id}-${item.item_id}`}
            onPress={() => setSelectedIndex(index)}
            style={({ pressed }) => ({ marginBottom: 22, transform: [{ scale: pressed ? 0.97 : 1 }] })}
          >
            <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} style={{ width: "100%", aspectRatio: 0.85 }} />
            <Text style={{ color: colors.label, fontSize: 14, marginTop: 8 }}>{categoryOf(item)}</Text>
            <Text style={{ color: colors.secondaryLabel, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
              {asList(item.facts.colors.value).map(capitalize).join(", ")}
            </Text>
          </Pressable>
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
