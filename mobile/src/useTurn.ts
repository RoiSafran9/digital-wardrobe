import { useEffect, useRef, useState } from "react";
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
  const turn = item?.turn ?? null;
  const latest = useRef({ item, onUpdated });
  latest.current = { item, onUpdated };

  useEffect(() => {
    if (!item || turn?.state !== "running") return;
    let alive = true;
    const timer = setInterval(async () => {
      try {
        const next = await getTurn(item);
        const { item: current, onUpdated: report } = latest.current;
        if (alive && current && next.state !== "running") report?.({ ...current, turn: next });
      } catch {
        // A missed poll is fine; the next one tries again.
      }
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [item?.run_id, item?.photo_name, item?.item_id, turn?.state]);

  async function start() {
    if (!item || !onUpdated) return;
    setError(null);
    try {
      onUpdated({ ...item, turn: await startTurn(item) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the 360 view.");
    }
  }

  return { start, turn, error };
}
