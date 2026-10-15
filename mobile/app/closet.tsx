import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { FlatList, Image, Pressable, RefreshControl, Modal, View } from "react-native";
import { getItems, imageUrl } from "../src/api/client";
import { ItemCard } from "../src/components/ItemCard";
import type { ClosetItem } from "../src/api/types";

export default function ClosetScreen() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ClosetItem | null>(null);

  const load = useCallback(async () => {
    const response = await getItems();
    setItems(response.items);
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

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        numColumns={3}
        keyExtractor={(item) => `${item.run_id}-${item.item_id}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <Pressable testID={`thumb-${item.run_id}-${item.item_id}`} onPress={() => setSelected(item)}>
            <Image source={{ uri: imageUrl(item.generated_url) }} style={{ width: 100, height: 100 }} />
          </Pressable>
        )}
      />
      <Modal visible={selected !== null} onRequestClose={() => setSelected(null)}>
        {selected ? <ItemCard item={selected} /> : null}
      </Modal>
    </View>
  );
}
