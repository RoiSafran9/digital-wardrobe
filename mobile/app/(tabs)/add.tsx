import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, type IconName } from "../../src/components/Icon";
import { PillButton } from "../../src/components/PillButton";
import { CAPTURE_STEPS, KEEP_OPEN, ProcessingStatus, SCAN_STEPS } from "../../src/components/ProcessingStatus";
import { colors, hitSlopFor, radius, type } from "../../src/theme";
import { getPendingItems } from "../../src/api/client";
import { useCredits } from "../../src/credits/CreditsProvider";
import { useOutfitScan } from "../../src/outfit/useOutfitScan";
import { useCapture } from "../../src/useCapture";
import { FrontsPicker } from "../../src/components/FrontsPicker";
import { useFrontsChoice } from "../../src/credits/useFrontsChoice";

const TIPS: { icon: IconName; label: string; detail: string }[] = [
  { icon: "flat", label: "Lay it flat", detail: "On a bed or the floor, front side up" },
  { icon: "above", label: "Shoot from above", detail: "Keep the whole piece in the frame" },
  { icon: "several", label: "A few at once works", detail: "Side by side; each becomes its own piece" },
];

const OUTFIT_TIPS: { icon: IconName; label: string; detail: string }[] = [
  { icon: "account", label: "Someone wearing the outfit", detail: "One person, the clothes clearly in view" },
  { icon: "above", label: "Head to toe if you can", detail: "Pieces cut off by the frame get completed" },
  { icon: "check", label: "Pick what to add", detail: "You choose the pieces before any image is made" },
];

type Mode = "garment" | "outfit";

// "Garment photo" (laid flat, as before) or "Outfit photo" (someone wearing it). Only shown when the
// server offers the outfit flow.
function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const segment = (value: Mode, label: string) => {
    const selected = mode === value;
    return (
      <Pressable
        key={value} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }}
        onPress={() => onChange(value)} hitSlop={hitSlopFor(32, 120)}
        style={{ flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center", backgroundColor: selected ? colors.card : "transparent" }}
      >
        <Text style={{ ...type.subhead, fontWeight: selected ? "600" : "400", color: colors.label }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: "row", marginTop: 16, padding: 2, borderRadius: 10, backgroundColor: colors.tile }}>
      {segment("garment", "Garment photo")}
      {segment("outfit", "Outfit photo")}
    </View>
  );
}

export default function AddScreen() {
  const { capture, loading: capturing, error: captureError } = useCapture();
  const outfitScan = useOutfitScan();
  const fronts = useFrontsChoice();
  const { outfit: outfitOn } = useCredits();
  const [chosen, setMode] = useState<Mode>("garment");
  const mode: Mode = outfitOn ? chosen : "garment";
  const router = useRouter();
  const [pending, setPending] = useState(0);

  // Outfit results the user hasn't kept or discarded yet (also after an app restart).
  useEffect(() => {
    if (mode !== "outfit") return;
    let live = true;
    getPendingItems().then((items) => live && setPending(items.length)).catch(() => {});
    return () => { live = false; };
  }, [mode]);

  const outfit = mode === "outfit";
  const loading = outfit ? outfitScan.loading : capturing;
  const error = outfit ? outfitScan.error : captureError;
  const tips = outfit ? OUTFIT_TIPS : TIPS;

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>Add a piece</Text>
      <Text style={styles.body}>
        {outfit ? "Add pieces from a photo of someone wearing them." : "Each piece becomes a clean catalog shot in your closet."}
      </Text>
      {outfitOn ? <ModeSwitch mode={mode} onChange={setMode} /> : null}
      {outfit && pending > 0 && !loading ? (
        <Pressable accessibilityRole="button" onPress={() => router.push("/outfit/review")} style={styles.pending}>
          <Text style={{ ...type.body, color: colors.label, flex: 1 }}>
            {pending === 1 ? "1 piece waiting for review" : `${pending} pieces waiting for review`}
          </Text>
          <Icon name="chevron" size={16} color={colors.secondaryLabel} />
        </Pressable>
      ) : null}

      <View style={styles.stage}>
        {loading ? (
          <ProcessingStatus steps={outfit ? SCAN_STEPS : CAPTURE_STEPS} note={KEEP_OPEN} estimateSeconds={outfit ? 10 : 45} />
        ) : (
          <View style={{ gap: 18 }}>
            {tips.map((tip) => (
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
        {!loading && !outfit ? <FrontsPicker choice={fronts} /> : null}
        {outfit ? (
          <>
            <PillButton label="Take photo" variant="primary" icon="camera" onPress={() => outfitScan.scan(true)} disabled={loading} />
            <PillButton label="Choose from library" onPress={() => outfitScan.scan(false)} disabled={loading} />
          </>
        ) : (
          <>
            <PillButton label="Take photo" variant="primary" icon="camera" onPress={() => capture(true, fronts.maxFronts)} disabled={loading || fronts.blocked} />
            <PillButton label="Choose from library" onPress={() => capture(false, fronts.maxFronts)} disabled={loading || fronts.blocked} />
          </>
        )}
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
  pending: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, backgroundColor: colors.card,
    borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 12, minHeight: 44,
  },
});
