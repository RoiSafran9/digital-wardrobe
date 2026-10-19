import { useState } from "react";
import { useRouter } from "expo-router";
import { scanOutfit } from "../api/client";
import { haptics } from "../haptics";
import { pickPhoto } from "../photoPicker";
import { rememberScan } from "./scanCache";

// Outfit Photo, Stage 1 (free): pick or take a photo of someone wearing clothes, find the garments,
// then open the pick screen. No image is generated and no credits are used here.
export function useOutfitScan() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function scan(fromCamera: boolean) {
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
      const result = await scanOutfit(uri);
      rememberScan(result);
      haptics.success();
      router.push({ pathname: "/outfit/pick", params: { scanId: result.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return { scan, loading, error };
}
