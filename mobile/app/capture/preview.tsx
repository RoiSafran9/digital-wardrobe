import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "../../src/components/Icon";
import { creditsLabel } from "../../src/credits/credits";
import { useFrontsChoice } from "../../src/credits/useFrontsChoice";
import { useCaptureJobs } from "../../src/store/captureJobs";
import { colors, hitSlopFor, radius, type } from "../../src/theme";
import { BackButton, Button, InsufficientCreditsSheet } from "../../src/ui";

// The photo, then the quote. Following the approved rule (CREDITS §6, spec D6), the user approves the
// most front images they'll pay for; the server makes at most that many and charges only what it made.
export default function PreviewScreen() {
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const { start } = useCaptureJobs();
  const fronts = useFrontsChoice();
  const [short, setShort] = useState(false);
  const { active, fronts: n, max, price, available } = fronts;

  const generate = () => {
    if (fronts.blocked) return setShort(true);
    start(uri, fronts.maxFronts);
    router.replace("/capture/processing");
  };

  const step = (label: string, icon: "add" | "remove", enabled: boolean, next: number) => (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !enabled }} disabled={!enabled}
      onPress={() => fronts.setFronts(next)} hitSlop={hitSlopFor(34, 34)}
      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", opacity: enabled ? 1 : 0.4 }}
    >
      <Icon name={icon} size={16} color={colors.tint} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}>
        <BackButton label="Retake" onPress={() => router.back()} />
        <Text style={{ ...type.headline, color: colors.label }}>Preview</Text>
        <View style={{ width: 70 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        <Image source={{ uri }} accessibilityLabel="Your photo" style={{ width: "100%", aspectRatio: 1, borderRadius: radius.feature, backgroundColor: colors.tile }} resizeMode="cover" />

        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>Ready to create</Text>
          <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>
            Each piece in the photo becomes its own catalog image. Finding them is free.
          </Text>
        </View>

        {active ? (
          <View style={{ backgroundColor: colors.grouped, borderRadius: radius.list, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ ...type.body, color: colors.label }}>Pieces in this photo</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                {step("Fewer pieces", "remove", n > 1, n - 1)}
                <Text accessibilityLabel={`${n} pieces`} style={{ ...type.headline, color: colors.label, fontVariant: ["tabular-nums"], minWidth: 22, textAlign: "center" }}>{n}</Text>
                {step("More pieces", "add", n < max, n + 1)}
              </View>
            </View>
            <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, paddingTop: 12, gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...type.body, color: colors.label }}>{`Front catalog image × ${n}`}</Text>
                <Text style={{ ...type.body, color: colors.label }}>{creditsLabel(n * price)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Balance after</Text>
                <Text style={{ ...type.subhead, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>{creditsLabel(Math.max(0, available - n * price))}</Text>
              </View>
            </View>
            <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>
              You pay only for the pieces made, up to this number; extra pieces aren't made.
            </Text>
          </View>
        ) : null}
        <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>
          You can review every piece once it's ready.
        </Text>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }}>
        <Button
          title={active ? `Generate up to ${n} ${n === 1 ? "Item" : "Items"} · ${creditsLabel(n * price)}` : "Create Catalog Images"}
          onPress={generate}
        />
      </View>
      <InsufficientCreditsSheet visible={short} needed={price} onClose={() => setShort(false)} />
    </SafeAreaView>
  );
}
