import { useState } from "react";
import { useRouter } from "expo-router";
import { postRun } from "./api/client";
import { haptics } from "./haptics";
import { pickPhoto } from "./photoPicker";
import { useLastRun } from "./store/lastRun";

// Pick or take a photo, upload it, and land on Home where "Just added" shows the new pieces.
export function useCapture(onDone?: () => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setLastRun } = useLastRun();
  const router = useRouter();

  async function capture(fromCamera: boolean) {
    setError(null);
    let uri: string | null;
    try {
      uri = await pickPhoto(fromCamera);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the camera.");
      return;
    }
    if (!uri) return;
    setLoading(true);
    try {
      setLastRun(await postRun(uri));
      haptics.success();
      onDone?.();
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return { capture, loading, error };
}
