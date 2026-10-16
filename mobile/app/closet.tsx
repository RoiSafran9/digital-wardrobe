import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getItems } from "../src/api/client";
import { GarmentImage } from "../src/components/GarmentImage";
import { ItemSheet } from "../src/components/ItemSheet";
import { PillButton } from "../src/components/PillButton";
import type { ClosetItem } from "../src/api/types";
import { asList, capitalize, colors, fonts, radius } from "../src/theme";

const ALL = "All";

function categoryOf(item: ClosetItem): string {
  return capitalize(asList(item.facts.category.value)[0] ?? "Other");
}

export default function ClosetScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ClosetItem | null>(null);
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
      <Text style={{ fontFamily: fonts.serif, fontSize: 34, color: colors.ink }}>Your closet</Text>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
        {items.length === 1 ? "1 piece" : `${items.length} pieces`}
      </Text>
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
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill,
                  backgroundColor: active ? colors.ink : "transparent",
                  borderWidth: 1, borderColor: active ? colors.ink : colors.lineStrong,
                }}
              >
                <Text style={{ color: active ? colors.paper : colors.inkSoft, fontSize: 13 }}>{name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <FlatList
        data={visible}
        numColumns={2}
        keyExtractor={(item) => `${item.run_id}-${item.item_id}`}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        columnWrapperStyle={{ gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
        ListEmptyComponent={
          loaded && items.length === 0 ? (
            <View style={{ paddingTop: 48, alignItems: "center", gap: 8 }}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.ink }}>Your closet is empty</Text>
              <Text style={{ color: colors.inkSoft, fontSize: 14, textAlign: "center", marginBottom: 16 }}>
                Photograph a piece and it'll land here as a clean catalog shot.
              </Text>
              <PillButton label="Add a piece" variant="primary" icon="camera-outline" onPress={() => router.push("/")} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`thumb-${item.run_id}-${item.item_id}`}
            onPress={() => setSelected(item)}
            style={({ pressed }) => ({ flex: 1 / 2, marginBottom: 18, transform: [{ scale: pressed ? 0.97 : 1 }] })}
          >
            <GarmentImage path={item.generated_url} style={{ width: "100%", aspectRatio: 0.85 }} />
            <Text style={{ color: colors.ink, fontSize: 14, marginTop: 8 }}>{categoryOf(item)}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
              {asList(item.facts.colors.value).map(capitalize).join(", ")}
            </Text>
          </Pressable>
        )}
      />
      <ItemSheet item={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}
