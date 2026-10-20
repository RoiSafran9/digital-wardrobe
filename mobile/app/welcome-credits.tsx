import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getItems } from "../src/api/client";
import { useCredits } from "../src/credits/CreditsProvider";
import { PopIn } from "../src/motion/PopIn";
import { priceChips } from "../src/onboarding";
import { colors, radius, type } from "../src/theme";
import { Button } from "../src/ui";

// Shown once after a fresh sign-in when the server has granted this account credits (spec D7).
// Every number comes from the server: the balance and the prices.
export default function WelcomeCreditsScreen() {
  const router = useRouter();
  const { credits, prices } = useCredits();
  // A new closet goes into First 3 Pieces; an account that already has pieces (a new device) goes to Add.
  const [hasItems, setHasItems] = useState(false);
  useEffect(() => {
    let live = true;
    getItems().then((r) => live && setHasItems(r.items.length > 0)).catch(() => {});
    return () => { live = false; };
  }, []);
  const available = credits?.available ?? 0;
  const fronts = prices.garment ? Math.floor(available / prices.garment) : null;
  const covers = fronts ? `Your starter pack covers about ${fronts} ${fronts === 1 ? "garment" : "garments"}. ` : "";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}>
          <PopIn>
            <View
              accessible
              accessibilityLabel={`${available} AI credits`}
              style={{ width: 168, height: 168, borderRadius: 84, backgroundColor: colors.tintSoft, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ ...type.hero, color: colors.tint }}>{available}</Text>
              <Text style={{ ...type.subhead, fontWeight: "600", color: colors.tint }}>AI credits</Text>
            </View>
          </PopIn>
          <Text accessibilityRole="header" style={{ ...type.display(40), color: colors.label, textAlign: "center", marginTop: 8 }}>A welcome gift</Text>
          <Text style={{ ...type.body, lineHeight: 24, color: colors.secondaryLabel, textAlign: "center" }}>
            {`${covers}Credits are only used when AI creates an image, and you'll always see the cost first.`}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {priceChips(prices).map((chip) => (
              <View key={chip} style={{ paddingHorizontal: 12, height: 30, borderRadius: radius.pill, backgroundColor: colors.grouped, justifyContent: "center" }}>
                <Text style={{ ...type.footnote, fontWeight: "600", color: colors.label }}>{chip}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ gap: 6 }}>
          {hasItems ? (
            <Button title="Add Clothes" onPress={() => router.replace("/add")} />
          ) : (
            <Button title="Add Your First 3 Pieces" onPress={() => router.replace({ pathname: "/first-pieces", params: { entry: "starter" } })} />
          )}
          <Button title="Explore first" variant="text" onPress={() => router.replace("/")} />
        </View>
      </View>
    </SafeAreaView>
  );
}
