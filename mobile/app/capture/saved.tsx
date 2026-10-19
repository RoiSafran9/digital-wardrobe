import React from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { GarmentTile } from "../../src/components/GarmentTile";
import { Icon } from "../../src/components/Icon";
import { creditsLabel } from "../../src/credits/credits";
import { garmentName } from "../../src/garmentName";
import { PopIn } from "../../src/motion/PopIn";
import { useCaptureJobs } from "../../src/store/captureJobs";
import { colors, type } from "../../src/theme";
import { Button } from "../../src/ui";

const FAN = [-9, 0, 9];

// The end of both add flows: the pieces that joined the closet, fanned out.
export default function SavedScreen() {
  const router = useRouter();
  const { saved, setSaved } = useCaptureJobs();
  const items = saved?.items ?? [];
  const n = items.length;
  const shown = items.slice(0, 3);
  const leave = (to: "/closet" | "/add") => { setSaved(null); router.replace(to); };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 22, paddingHorizontal: 20 }}>
        <View style={{ height: 200, width: 280, alignItems: "center", justifyContent: "center" }}>
          {shown.map((item, i) => {
            const rotate = shown.length === 1 ? 0 : FAN[shown.length === 2 ? i * 2 : i];
            return (
              <PopIn key={i} delay={i * 120} style={{ position: "absolute", left: 140 - 60 + (rotate * 6), transform: [{ rotate: `${rotate}deg` }] }}>
                <GarmentTile item={item} width={120} height={150} rounded={20} label={garmentName(item)} />
              </PopIn>
            );
          })}
          <View style={{ position: "absolute", bottom: 0, right: 70, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.background }}>
            <Icon name="checkmark" size={18} color="#FFFFFF" />
          </View>
        </View>
        <Text accessibilityRole="header" style={{ ...type.display(40), color: colors.label, textAlign: "center" }}>Added to your closet</Text>
        <Text style={{ ...type.body, color: colors.secondaryLabel }}>
          {[`${n} new ${n === 1 ? "piece" : "pieces"}`, saved?.creditsUsed ? `${creditsLabel(saved.creditsUsed)} used` : null].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 6 }}>
        <Button title="View Closet" onPress={() => leave("/closet")} />
        <Button title="Add More Clothes" variant="text" onPress={() => leave("/add")} />
      </View>
    </SafeAreaView>
  );
}
