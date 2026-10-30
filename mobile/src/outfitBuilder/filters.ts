// Build My Look's filter vocabulary and copy (docs/features/ai-outfit-builder/02-UX-FLOWS.md U1).
// Every group includes "Any"/"No preference" and can be cleared; the server's defaults match (api/schemas.OutfitFiltersIn).
import type { OutfitColorPref, OutfitFilters, OutfitLook, OutfitOccasion, OutfitSlot, OutfitStyle, OutfitVibe, OutfitWeather } from "../api/types";

export const DEFAULT_FILTERS: OutfitFilters = { occasion: "any", style: "any", vibe: "any", weather: "any", colors: "any" };

export function hasAnyPreference(filters: OutfitFilters): boolean {
  return Object.values(filters).some((v) => v !== "any");
}

type Option<T extends string> = { value: T; label: string };

export const OCCASION_OPTIONS: Option<OutfitOccasion>[] = [
  { value: "any", label: "Any" }, { value: "everyday", label: "Everyday" }, { value: "work", label: "Work" },
  { value: "date", label: "Date" }, { value: "going_out", label: "Going Out" }, { value: "formal", label: "Formal" },
];

export const STYLE_OPTIONS: Option<OutfitStyle>[] = [
  { value: "any", label: "Any" }, { value: "casual", label: "Casual" }, { value: "smart_casual", label: "Smart Casual" },
  { value: "elegant", label: "Elegant" }, { value: "streetwear", label: "Streetwear" }, { value: "sporty", label: "Sporty" },
];

export const VIBE_OPTIONS: Option<OutfitVibe>[] = [
  { value: "any", label: "Any" }, { value: "relaxed", label: "Relaxed" }, { value: "confident", label: "Confident" },
  { value: "minimal", label: "Minimal" }, { value: "bold", label: "Bold" },
];

export const WEATHER_OPTIONS: Option<OutfitWeather>[] = [
  { value: "any", label: "Any" }, { value: "hot", label: "Hot" }, { value: "warm", label: "Warm" },
  { value: "mild", label: "Mild" }, { value: "cold", label: "Cold" }, { value: "rainy", label: "Rainy" },
];

export const COLOR_PREF_OPTIONS: Option<OutfitColorPref>[] = [
  { value: "any", label: "Any" }, { value: "neutral", label: "Neutral" }, { value: "colorful", label: "Colorful" },
  { value: "dark", label: "Dark" }, { value: "light", label: "Light" },
];

export const SLOT_LABELS = {
  top: "Top", bottom: "Bottom", one_piece: "One-Piece", outerwear: "Outerwear", footwear: "Footwear",
} as const;

// Body-slot layout order (02-UX-FLOWS.md U4): top, optional outerwear, bottom, optional shoes;
// or one-piece, optional outerwear, shoes.
export function orderedSlots(look: Pick<OutfitLook, "slots">): { slot: OutfitSlot; itemId: string }[] {
  const order: OutfitSlot[] = look.slots.one_piece
    ? ["one_piece", "outerwear", "footwear"]
    : ["top", "outerwear", "bottom", "footwear"];
  return order.flatMap((slot) => (look.slots[slot] ? [{ slot, itemId: look.slots[slot]! }] : []));
}
