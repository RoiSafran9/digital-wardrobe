import React from "react";
import { FlatList, Text, View } from "react-native";
import { ItemCard } from "../src/components/ItemCard";
import { useLastRun } from "../src/store/lastRun";

export default function ResultsScreen() {
  const { lastRun } = useLastRun();

  if (!lastRun || lastRun.items.length === 0) {
    return (
      <View>
        <Text>No run yet — go capture a photo.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={lastRun.items}
      keyExtractor={(item) => item.item_id}
      renderItem={({ item }) => <ItemCard item={item} />}
      ListFooterComponent={
        lastRun.failed.length > 0 ? (
          <Text>{lastRun.failed.length} item(s) failed to process</Text>
        ) : null
      }
    />
  );
}
