import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { pickPhoto } from "../src/photoPicker";
import { useRouter } from "expo-router";
import { postRun } from "../src/api/client";
import { useLastRun } from "../src/store/lastRun";
import { PillButton } from "../src/components/PillButton";
import { CAPTURE_STEPS, KEEP_OPEN, ProcessingStatus } from "../src/components/ProcessingStatus";
import { colors, fonts, radius } from "../src/theme";

const TIPS: { icon: keyof typeof Ionicons.glyphMap; label: string; detail: string }[] = [
  { icon: "layers-outline", label: "Lay it flat", detail: "On a bed or the floor, front side up" },
  { icon: "phone-portrait-outline", label: "Shoot from above", detail: "Keep the whole piece in the frame" },
  { icon: "albums-outline", label: "A few at once works", detail: "Side by side; each becomes its own piece" },
];

export default function CaptureScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setLastRun } = useLastRun();
  const router = useRouter();

  async function pickAndUpload(fromCamera: boolean) {
    setError(null);
    let uri: string | null;
    try {
      uri = await pickPhoto(fromCamera);
    } catch (e) {
      setError(e instanceof Error ? e.message : "couldn't open the camera");
      return;
    }
    if (!uri) {
      return;
    }

    setLoading(true);
    try {
      const run = await postRun(uri);
      setLastRun(run);
      router.push("/closet");  // new pieces show under "Just added" at the top
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setLoading(false);
    }
  }

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
                <Ionicons name={tip.icon} size={22} color={colors.inkSoft} />
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
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <PillButton label="Take photo" variant="primary" icon="camera-outline" onPress={() => pickAndUpload(true)} disabled={loading} />
        <PillButton label="Choose from library" onPress={() => pickAndUpload(false)} disabled={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 24, paddingBottom: 24 },
  title: { fontFamily: fonts.serif, fontSize: 42, lineHeight: 48, color: colors.ink, marginTop: 20 },
  body: { color: colors.inkSoft, fontSize: 15, lineHeight: 22, marginTop: 10 },
  tipLabel: { color: colors.ink, fontSize: 15 },
  tipDetail: { color: colors.inkSoft, fontSize: 13, marginTop: 2 },
  stage: {
    flex: 1, marginVertical: 24, borderRadius: radius.tile, borderWidth: 1.5, borderStyle: "dashed",
    borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: colors.dangerBg,
    borderRadius: 14, padding: 12, marginBottom: 14,
  },
  errorText: { color: colors.danger, fontSize: 14, flex: 1 },
});
