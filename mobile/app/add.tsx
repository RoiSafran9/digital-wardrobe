import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, type IconName } from "../src/components/Icon";
import { PillButton } from "../src/components/PillButton";
import { CAPTURE_STEPS, KEEP_OPEN, ProcessingStatus } from "../src/components/ProcessingStatus";
import { colors, radius, type } from "../src/theme";
import { useCapture } from "../src/useCapture";

const TIPS: { icon: IconName; label: string; detail: string }[] = [
  { icon: "flat", label: "Lay it flat", detail: "On a bed or the floor, front side up" },
  { icon: "above", label: "Shoot from above", detail: "Keep the whole piece in the frame" },
  { icon: "several", label: "A few at once works", detail: "Side by side; each becomes its own piece" },
];

export default function AddScreen() {
  const { capture, loading, error } = useCapture();

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <Text style={styles.title}>Add a piece</Text>
      <Text style={styles.body}>Each piece becomes a clean catalog shot in your closet.</Text>

      <View style={styles.stage}>
        {loading ? (
          <ProcessingStatus steps={CAPTURE_STEPS} note={KEEP_OPEN} />
        ) : (
          <View style={{ gap: 18 }}>
            {TIPS.map((tip) => (
              <View key={tip.label} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <Icon name={tip.icon} size={22} color={colors.secondaryLabel} />
                <View>
                  <Text style={styles.tipLabel}>{tip.label}</Text>
                  <Text style={styles.tipDetail}>{tip.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Icon name="alert" size={18} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <PillButton label="Take photo" variant="primary" icon="camera" onPress={() => capture(true)} disabled={loading} />
        <PillButton label="Choose from library" onPress={() => capture(false)} disabled={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24, paddingBottom: 24 },
  title: { ...type.largeTitle, color: colors.label, marginTop: 20 },
  body: { ...type.body, color: colors.secondaryLabel, marginTop: 8 },
  tipLabel: { ...type.headline, color: colors.label },
  tipDetail: { ...type.footnote, color: colors.secondaryLabel, marginTop: 2 },
  stage: {
    flex: 1, marginVertical: 24, borderRadius: radius.card, backgroundColor: colors.card,
    alignItems: "center", justifyContent: "center", padding: 20,
  },
  errorBox: {
    flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: colors.destructiveBg,
    borderRadius: 14, padding: 12, marginBottom: 14,
  },
  errorText: { color: colors.destructive, fontSize: 14, flex: 1 },
});
