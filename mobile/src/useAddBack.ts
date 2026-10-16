import { useState } from "react";
import { ActionSheetIOS, Alert, Platform } from "react-native";
import { addBack } from "./api/client";
import type { ClosetItem } from "./api/types";
import { pickPhoto } from "./photoPicker";

// Shared "add a back photo" flow: choose camera/library, upload, report the updated item.
export function useAddBack(item: ClosetItem | null, onUpdated?: (item: ClosetItem) => void, onBusy?: (busy: boolean) => void) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(fromCamera: boolean) {
    if (!item || !onUpdated) return;
    setError(null);
    let uri: string | null;
    try {
      uri = await pickPhoto(fromCamera);
    } catch (e) {
      setError(e instanceof Error ? e.message : "couldn't open the camera");
      return;
    }
    if (!uri) return;
    setUploading(true);
    onBusy?.(true);
    try {
      onUpdated(await addBack(item, uri));
    } catch (e) {
      setError(e instanceof Error ? e.message : "couldn't add the back");
    } finally {
      setUploading(false);
      onBusy?.(false);
    }
  }

  // iOS chooses a photo source from an action sheet, not an alert box.
  function ask() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Add the back",
          message: "Lay the item flat, back side up.",
          options: ["Take photo", "Choose from library", "Cancel"],
          cancelButtonIndex: 2,
        },
        (index) => (index === 0 ? upload(true) : index === 1 ? upload(false) : undefined),
      );
      return;
    }
    Alert.alert("Add the back", "Lay the item flat, back side up.", [
      { text: "Take photo", onPress: () => upload(true) },
      { text: "Choose from library", onPress: () => upload(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return { ask, uploading, error };
}
