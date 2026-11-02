// Build My Look's filter vocabulary and copy (docs/features/ai-outfit-builder/02-UX-FLOWS.md U1).
// Every group includes "Any"/"No preference" and can be cleared; the server's defaults match (api/schemas.OutfitFiltersIn).
import type { IconName } from "../components/Icon";
import type { OutfitColorPref, OutfitFilters, OutfitLook, OutfitOccasion, OutfitSlot, OutfitStyle, OutfitVibe, OutfitWeather } from "../api/types";

export const DEFAULT_FILTERS: OutfitFilters = { occasion: "any", style: "any", vibe: "any", weather: "any", colors: "any" };

export function hasAnyPreference(filters: OutfitFilters): boolean {
  return Object.values(filters).some((v) => v !== "any");
}

// Each option shows a bold outline icon above its label; the Colors question shows three swatches instead.
export type Option<T extends string> = { value: T; label: string } & ({ icon: IconName } | { swatches: string[] });

export const OCCASION_OPTIONS: Option<OutfitOccasion>[] = [
  { value: "any", label: "Any", icon: "shuffle" }, { value: "everyday", label: "Everyday", icon: "coffee" },
  { value: "work", label: "Work", icon: "briefcase" }, { value: "date", label: "Date", icon: "heart" },
  { value: "going_out", label: "Going Out", icon: "wineglass" }, { value: "formal", label: "Formal", icon: "crown" },
];

export const STYLE_OPTIONS: Option<OutfitStyle>[] = [
  { value: "any", label: "Any", icon: "shuffle" }, { value: "casual", label: "Casual", icon: "garment" },
  { value: "smart_casual", label: "Smart Casual", icon: "jacket" }, { value: "elegant", label: "Elegant", icon: "sparkle" },
  { value: "streetwear", label: "Streetwear", icon: "sneaker" }, { value: "sporty", label: "Sporty", icon: "run" },
];

export const VIBE_OPTIONS: Option<OutfitVibe>[] = [
  { value: "any", label: "Any", icon: "shuffle" }, { value: "relaxed", label: "Relaxed", icon: "leaf" },
  { value: "confident", label: "Confident", icon: "star" }, { value: "minimal", label: "Minimal", icon: "circle" },
  { value: "bold", label: "Bold", icon: "bolt" },
];

export const WEATHER_OPTIONS: Option<OutfitWeather>[] = [
  { value: "any", label: "Any", icon: "shuffle" }, { value: "hot", label: "Hot", icon: "hot" },
  { value: "warm", label: "Warm", icon: "sun" }, { value: "mild", label: "Mild", icon: "cloudSun" },
  { value: "cold", label: "Cold", icon: "snowflake" }, { value: "rainy", label: "Rainy", icon: "rain" },
];

export const COLOR_PREF_OPTIONS: Option<OutfitColorPref>[] = [
  { value: "any", label: "Any", icon: "shuffle" },
  { value: "neutral", label: "Neutral", swatches: ["#D9C7AE", "#A39E93", "#E9E1D3"] },
  { value: "colorful", label: "Colorful", swatches: ["#F0655B", "#F5C342", "#2BA39A"] },
  { value: "dark", label: "Dark", swatches: ["#131315", "#4A4A4F", "#1F2D4D"] },
  { value: "light", label: "Light", swatches: ["#FFFFFF", "#F6F0E2", "#CFE0F2"] },
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
