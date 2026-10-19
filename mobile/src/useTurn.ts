import { useEffect, useRef, useState } from "react";
import { useCredits } from "./credits/CreditsProvider";
import { canAfford } from "./credits/credits";
import { NO_CREDITS } from "./api/v1";
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
  const [insufficient, setInsufficient] = useState(false);
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
      const message = e instanceof Error ? e.message : "Couldn't start the 360 view.";
      if (message === NO_CREDITS) setInsufficient(true);
      else setError(message);
    } finally {
      void refreshCredits();
    }
  }

  // The caller confirms the price (CostSheet) before starting; billing off starts straight away.
  const start = () => begin();

  return {
    start, turn, error, price, affordable: canAfford(credits, price),
    insufficient, clearInsufficient: () => setInsufficient(false),
  };
}
