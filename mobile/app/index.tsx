import React, { useState } from "react";
import { View, Button, Text, ActivityIndicator, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { postRun } from "../src/api/client";
import { useLastRun } from "../src/store/lastRun";

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
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });

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
    <View style={styles.container}>
      <Button title="Take Photo" onPress={() => pickAndUpload(true)} disabled={loading} />
      <Button title="Pick From Library" onPress={() => pickAndUpload(false)} disabled={loading} />
      {loading ? <ActivityIndicator testID="upload-spinner" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  error: { color: "#c62828" },
});
