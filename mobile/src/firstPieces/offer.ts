import { useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getItems, getPendingItems } from "../api/client";
import { shouldOffer } from "./round";

export const offeredKey = (userId: string) => `firstPieces.offered.${userId}`;

// The starter-credits screen leads into First 3 Pieces itself, so showing it counts as the offer.
export async function markOffered(userId: string): Promise<void> {
  await AsyncStorage.setItem(offeredKey(userId), "1").catch(() => {});
}

type Input = {
  userId: string | null;
  signedIn: boolean;
  named: boolean;
  starterDecided: boolean;
  generation: boolean;
  loaded: boolean;    // the server's prices and balance are in (so `generation` is real)
  inflight: boolean;  // a First 3 Pieces round is being tracked
  open: () => void;
};

// Opens First 3 Pieces by itself, once per account on this device, for a new account whose closet is
// still empty (checked on the server, so people with pieces never see it — also on another device).
export function useFirstPiecesOffer(i: Input) {
  const checked = useRef<string | null>(null);
  const { userId, signedIn, named, starterDecided, generation, loaded, inflight, open } = i;
  useEffect(() => {
    if (!userId || !signedIn || !named || !starterDecided || !loaded || checked.current === userId) return;
    checked.current = userId;
    (async () => {
      const offered = (await AsyncStorage.getItem(offeredKey(userId)).catch(() => null)) === "1";
      if (offered || inflight || !generation) return;
      const [closet, pending] = await Promise.all([getItems(), getPendingItems()]);
      if (!shouldOffer({ signedIn, named, starterDecided, generation, inflight, offered,
                         closetCount: closet.items.length, pendingCount: pending.length })) return;
      await markOffered(userId);
      open();
    })().catch(() => {});  // can't tell: don't interrupt; Home's empty state still offers it
  }, [userId, signedIn, named, starterDecided, generation, loaded, inflight, open]);
}
