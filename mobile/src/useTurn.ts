import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useCredits } from "./credits/CreditsProvider";
import { ASK_FOR_MORE, canAfford, creditsLabel } from "./credits/credits";
import { getTurn, startTurn } from "./api/client";
import type { ClosetItem, Turn, TurnAngle } from "./api/types";

export const POLL_MS = 2000;

export const TURN_LABELS: Record<TurnAngle, string> = {
  front: "Front", right: "Right side", back: "Back", left: "Left side",
};

// Starts the 360 job and polls it while the sheet is open; progress lives on the item
// (via onUpdated), so closing and reopening the sheet resumes where it was.
export function useTurn(item: ClosetItem | null, onUpdated?: (item: ClosetItem) => void) {
  const [error, setError] = useState<string | null>(null);
  const { billing, prices, credits, refresh: refreshCredits } = useCredits();
  const price = billing ? prices.turn : undefined;
  const turn = item?.turn ?? null;
  const latest = useRef({ item, onUpdated });
  latest.current = { item, onUpdated };

  useEffect(() => {
    if (!item || turn?.state !== "running") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    // Each check waits for the previous answer, so a busy server never gets a pile of them.
    const poll = async () => {
      try {
        const next = await getTurn(item);
        const { item: current, onUpdated: report } = latest.current;
        if (!alive) return;
        if (current && next.state !== "running") {
          void refreshCredits();  // charged (done) or given back (failed)
          return report?.({ ...current, turn: next });
        }
      } catch {
        // A missed check is fine; the next one tries again.
      }
      if (alive) timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, POLL_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [item?.run_id, item?.photo_name, item?.item_id, turn?.state]);

  async function begin() {
    if (!item || !onUpdated) return;
    setError(null);
    try {
      onUpdated({ ...item, turn: await startTurn(item) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the 360 view.");
    } finally {
      void refreshCredits();
    }
  }

  // With billing on, a 360 is the priciest action: say what it costs and ask first.
  function start() {
    if (!price) return begin();
    if (!canAfford(credits, price)) {
      setError(`A 360 view uses ${creditsLabel(price)}; you have ${credits?.available ?? 0}. ${ASK_FOR_MORE}`);
      return;
    }
    Alert.alert("Make a 360 view?", `Uses ${creditsLabel(price)}. You have ${credits?.available ?? 0}.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Make 360", onPress: () => { void begin(); } },
    ]);
  }

  return { start, turn, error, price };
}
