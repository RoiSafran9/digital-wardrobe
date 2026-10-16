import React, { useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { postRun } from "../src/api/client";
import { useLastRun } from "../src/store/lastRun";
import { PillButton } from "../src/components/PillButton";
import { colors, fonts, radius } from "../src/theme";

export default function CaptureScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setLastRun } = useLastRun();
  const router = useRouter();

  async function pickAndUpload(fromCamera: boolean) {
    setError(null);
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("permission denied — enable camera/photos access in Settings");
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          // iOS gallery photos are HEIC; the backend can only decode JPEG/PNG.
          preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
        });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    setLoading(true);
    try {
      const run = await postRun(result.assets[0].uri);
      setLastRun(run);
      router.push("/results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <Text style={styles.eyebrow}>My wardrobe</Text>
      <Text style={styles.title}>Add a piece</Text>
      <Text style={styles.body}>Lay one item flat and snap it. We'll turn it into a clean catalog shot.</Text>

      <View style={styles.stage}>
        {loading ? (
          <View style={{ alignItems: "center", gap: 14 }}>
            <ActivityIndicator testID="upload-spinner" color={colors.ink} />
            <Text style={styles.stageText}>Pressing and folding…{"\n"}This takes up to a minute.</Text>
          </View>
        ) : (
          <Ionicons name="shirt-outline" size={44} color={colors.lineStrong} />
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
  eyebrow: { color: colors.muted, fontSize: 13, marginTop: 16 },
  title: { fontFamily: fonts.serif, fontSize: 40, color: colors.ink, marginTop: 4 },
  body: { color: colors.inkSoft, fontSize: 15, lineHeight: 22, marginTop: 10 },
  stage: {
    flex: 1, marginVertical: 24, borderRadius: radius.tile, borderWidth: 1.5, borderStyle: "dashed",
    borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center",
  },
  stageText: { color: colors.inkSoft, fontSize: 14, textAlign: "center", lineHeight: 20 },
  errorBox: {
    flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: colors.dangerBg,
    borderRadius: 14, padding: 12, marginBottom: 14,
  },
  errorText: { color: colors.danger, fontSize: 14, flex: 1 },
});
