import { useState } from "react";
import { affordableFronts, MAX_FRONTS } from "./credits";
import { useCredits } from "./CreditsProvider";

// How many front images the user approves paying for before a capture (billing on only).
// The count stays within what they can afford; maxFronts is what goes to the server.
export function useFrontsChoice() {
  const { billing, prices, credits } = useCredits();
  const price = prices.garment;
  const active = billing && price !== undefined;
  const available = credits?.available ?? 0;
  const max = active ? affordableFronts(available, price) : MAX_FRONTS;
  const [chosen, setFronts] = useState(1);
  const fronts = Math.max(1, Math.min(chosen, max));
  return {
    active,
    price: price ?? 0,
    available,
    fronts,
    max,
    setFronts,
    blocked: active && max < 1,  // can't pay for even one front
    maxFronts: active ? fronts : undefined,
  };
}

export type FrontsChoice = ReturnType<typeof useFrontsChoice>;
