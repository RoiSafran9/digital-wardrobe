import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getItems } from "../src/api/client";
import { useCredits } from "../src/credits/CreditsProvider";
import { PopIn } from "../src/motion/PopIn";
import { priceChips } from "../src/onboarding";
import { useProfile } from "../src/profile";
import { colors, radius, type, weight } from "../src/theme";
import { Button, Glass, GlassScreen } from "../src/ui";

// Shown once after a fresh sign-in when the server has granted this account credits (spec D7).
// Every number comes from the server: the balance and the prices.
export default function WelcomeCreditsScreen() {
  const router = useRouter();
  const { credits, prices } = useCredits();
  const name = useProfile().profile?.display_name?.trim();
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
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 12 }}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <PopIn>
              <Glass
                radius={95}
                decor={<View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.tintSoft }} />}
                style={{ width: 190, height: 190, alignItems: "center", justifyContent: "center" }}
              >
                <View accessible accessibilityLabel={`${available} AI credits`} style={{ alignItems: "center" }}>
                  <Text style={{ ...type.hero, color: colors.tint }}>{available}</Text>
                  <Text style={{ ...type.subhead, ...weight(600), color: colors.tint }}>AI credits</Text>
                </View>
              </Glass>
            </PopIn>
            <Text accessibilityRole="header" style={{ ...type.display(36), color: colors.label, textAlign: "center", marginTop: 26 }}>
              {name ? `A welcome gift, ${name}` : "A welcome gift"}
            </Text>
            <Text style={{ ...type.subhead, lineHeight: 21, color: colors.secondaryLabel, textAlign: "center", marginTop: 8, paddingHorizontal: 12 }}>
              {`${covers}Credits are only used when AI creates an image, and you'll always see the cost first.`}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 18 }}>
              {priceChips(prices).map((chip) => (
                <Glass key={chip} radius={radius.pill} level="base" style={{ paddingHorizontal: 10, height: 30, justifyContent: "center" }}>
                  <Text style={{ ...type.footnote, ...weight(600), color: colors.label }}>{chip}</Text>
                </Glass>
              ))}
            </View>
          </View>
          <View style={{ gap: 6, marginTop: 40 }}>
            {hasItems ? (
              <Button title="Add Clothes" onPress={() => router.replace("/add")} />
            ) : (
              <Button title="Add Your First 3 Pieces" onPress={() => router.replace({ pathname: "/first-pieces", params: { entry: "starter" } })} />
            )}
            <Button title="Explore first" variant="text" onPress={() => router.replace("/")} />
          </View>
        </View>
      </SafeAreaView>
    </GlassScreen>
  );
}
