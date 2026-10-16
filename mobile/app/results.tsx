import React, { useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ItemCard } from "../src/components/ItemCard";
import { ItemSheet } from "../src/components/ItemSheet";
import { PillButton } from "../src/components/PillButton";
import { useLastRun } from "../src/store/lastRun";
import { colors, fonts } from "../src/theme";

export default function ResultsScreen() {
  const { lastRun } = useLastRun();
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!lastRun || lastRun.items.length === 0) {
    const retake = lastRun !== null;
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper, padding: 24, justifyContent: "center" }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.ink, textAlign: "center" }}>
          {retake ? "No pieces found" : "Nothing new yet"}
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 15, textAlign: "center", marginTop: 8, marginBottom: 24 }}>
          {retake
            ? "Try again with one item laid flat in good light."
            : "No run yet — photograph a piece to see it here."}
        </Text>
        <PillButton label="Add a piece" variant="primary" icon="camera-outline" onPress={() => router.push("/")} />
      </SafeAreaView>
    );
  }

  const count = lastRun.items.length;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.paper }}>
      <FlatList
        data={lastRun.items}
        keyExtractor={(item) => item.item_id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 28 }}
        ListHeaderComponent={
          <View>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Just added</Text>
            <Text style={{ fontFamily: fonts.serif, fontSize: 34, color: colors.ink, marginTop: 2 }}>
              {count === 1 ? "1 new piece" : `${count} new pieces`}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => <ItemCard item={item} onPress={() => setSelectedIndex(index)} />}
        ListFooterComponent={
          <View style={{ gap: 12 }}>
            {lastRun.failed.length > 0 ? (
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
                {lastRun.failed.length} item(s) failed to process
              </Text>
            ) : null}
            <PillButton label="See in closet" onPress={() => router.push("/closet")} />
          </View>
        }
      />
      <ItemSheet items={lastRun.items} index={selectedIndex} onClose={() => setSelectedIndex(null)} />
    </SafeAreaView>
  );
}
