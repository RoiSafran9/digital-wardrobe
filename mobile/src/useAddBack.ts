import { useState } from "react";
import { ActionSheetIOS, Alert, Platform } from "react-native";
import { addBack } from "./api/client";
import type { ClosetItem } from "./api/types";
import { pickPhoto } from "./photoPicker";
import { useCredits } from "./credits/CreditsProvider";
import { canAfford, creditsLabel } from "./credits/credits";
import { NO_CREDITS } from "./api/v1";

// Shared "add a back photo" flow: choose camera/library, upload, report the updated item. The price is
// confirmed by the caller (CostSheet) before ask(); a server "not enough credits" sets `insufficient`.
export function useAddBack(item: ClosetItem | null, onUpdated?: (item: ClosetItem) => void, onBusy?: (busy: boolean) => void) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState(false);
  const { billing, prices, credits, refresh: refreshCredits } = useCredits();
  const price = billing ? prices.back : undefined;

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
      const message = e instanceof Error ? e.message : "couldn't add the back";
      if (message === NO_CREDITS) setInsufficient(true);
      else setError(message);
    } finally {
      setUploading(false);
      onBusy?.(false);
      void refreshCredits();
    }
  }

  // iOS chooses a photo source from an action sheet, not an alert box.
  function ask() {
    setError(null);
    const message = price
      ? `Lay the item flat, back side up. Uses ${creditsLabel(price)} · ${credits?.available ?? 0} available.`
      : "Lay the item flat, back side up.";
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Add the back",
          message,
          options: ["Take photo", "Choose from library", "Cancel"],
          cancelButtonIndex: 2,
        },
        (index) => (index === 0 ? upload(true) : index === 1 ? upload(false) : undefined),
      );
      return;
    }
    Alert.alert("Add the back", message, [
      { text: "Take photo", onPress: () => upload(true) },
      { text: "Choose from library", onPress: () => upload(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return {
    ask, uploading, error, price, affordable: canAfford(credits, price),
    insufficient, clearInsufficient: () => setInsufficient(false),
  };
}
