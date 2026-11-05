import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { ClosetItem } from "../../src/api/types";
import { GarmentImage } from "../../src/components/GarmentImage";
import { Icon } from "../../src/components/Icon";
import { creditsLabel } from "../../src/credits/credits";
import { garmentName } from "../../src/garmentName";
import { PopIn } from "../../src/motion/PopIn";
import { useCaptureJobs } from "../../src/store/captureJobs";
import { colors, radius, type } from "../../src/theme";
import { Button, GlassScreen } from "../../src/ui";

// Where each of up to three pieces lands in the fan: offset from the middle, and tilt.
function fanSpot(i: number, n: number): { dx: number; rotate: number } {
  if (n === 1) return { dx: 0, rotate: 0 };
  if (n === 2) return { dx: i ? 38 : -38, rotate: i ? 9 : -9 };
  return { dx: (i - 1) * 70, rotate: (i - 1) * 9 };
}

// A finished piece on its stone tile with a white edge and a soft drop shadow. The image is never tinted.
function FanTile({ item }: { item: ClosetItem }) {
  return (
    <View accessible accessibilityLabel={garmentName(item)} style={{
      width: 112, height: 138, borderRadius: radius.garment, borderWidth: 3, borderColor: colors.card, backgroundColor: colors.tile,
      shadowColor: "#000", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.15, shadowRadius: 14,
    }}>
      <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} tile={colors.tile}
        style={{ flex: 1, borderRadius: radius.garment - 3, backgroundColor: colors.tile }} />
    </View>
  );
}

// The end of both add flows: the pieces that joined the closet, fanned out.
export default function SavedScreen() {
  const router = useRouter();
  const { saved, setSaved } = useCaptureJobs();
  const items = saved?.items ?? [];
  const n = items.length;
  const shown = items.slice(0, 3);
  const leave = (to: "/closet" | "/add") => { setSaved(null); router.replace(to); };
  return (
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", paddingHorizontal: 20, paddingTop: 70, paddingBottom: 12 }}>
          <View style={{ width: 260, height: 190 }}>
            {shown.map((item, i) => {
              const { dx, rotate } = fanSpot(i, shown.length);
              return (
                <PopIn key={i} delay={i * 120} style={{ position: "absolute", top: 20, left: 74 + dx, transform: [{ rotate: `${rotate}deg` }] }}>
                  <FanTile item={item} />
                </PopIn>
              );
            })}
            <PopIn delay={shown.length * 120} style={{ position: "absolute", bottom: 0, left: 107 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.success, borderWidth: 3, borderColor: colors.card, alignItems: "center", justifyContent: "center" }}>
                <Icon name="checkmark" size={22} color="#FFFFFF" />
              </View>
            </PopIn>
          </View>
          <Text accessibilityRole="header" style={{ ...type.display(36), color: colors.label, textAlign: "center", marginTop: 24 }}>Added to your closet</Text>
          <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 6, textAlign: "center" }}>
            {[`${n} new ${n === 1 ? "piece" : "pieces"}`, saved?.creditsUsed ? `${creditsLabel(saved.creditsUsed)} used` : null].filter(Boolean).join(" · ")}
          </Text>
          <View style={{ alignSelf: "stretch", marginTop: 40, gap: 6 }}>
            <Button title="View Closet" onPress={() => leave("/closet")} />
            <Button title="Add More Clothes" variant="text" onPress={() => leave("/add")} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </GlassScreen>
  );
}
