// Outfit Photo picking rules and wording, kept apart from the screens so they can be tested.
// Prices always come from the server (GET /v1/prices); nothing here is a price.
import type { OutfitCandidate, OutfitScan } from "../api/types";
import { creditsLabel } from "../credits/credits";

// v1 scope (owner decision D2, proposed): no shoes yet.
export function pickable(scan: OutfitScan): OutfitCandidate[] {
  return scan.candidates.filter((c) => c.category !== "shoes");
}

// Mostly hidden garments start unselected: their image would be mostly guessed (D3, proposed).
export function defaultPicks(candidates: OutfitCandidate[]): string[] {
  return candidates.filter((c) => c.visibility !== "low").map((c) => c.id);
}

export function candidateTitle(c: OutfitCandidate): string {
  return c.category.charAt(0).toUpperCase() + c.category.slice(1);
}

// Plain language, no made-up percentages.
export function visibilityNote(c: OutfitCandidate): string | null {
  if (c.visibility === "low") return "Mostly hidden — the image would be mostly guessed";
  if (c.visibility === "partial") return "Partly hidden — hidden parts will be completed";
  return null;
}

export function sceneNote(scan: OutfitScan): string | null {
  if (scan.scene_kind === "flat") return "This looks like clothes laid out, not worn. Garment photo works better for that.";
  if (scan.scene_kind === "none") return "No clothing found in this photo.";
  if ((scan.person_count ?? 1) > 1) return "More than one person: these are the main person's clothes.";
  return null;
}

export type Quote = { count: number; total: number | null; affordable: boolean; label: string };

// What creating the picked images costs. unitPrice undefined = billing off: count only, no money shown.
export function quote(count: number, unitPrice: number | undefined, available: number): Quote {
  const images = count === 1 ? "1 image" : `${count} images`;
  if (unitPrice === undefined) return { count, total: null, affordable: true, label: `${images} · free while billing is off` };
  const total = count * unitPrice;
  return { count, total, affordable: total <= available,
           label: `${images} · ${creditsLabel(total)} · ${available} available` };
}

// The garment-photo flow refuses a photo of someone wearing clothes ("No garment to add: worn on body").
// Then the app offers the outfit flow instead, at no extra cost.
export function isWornRejection(message: string | null | undefined): boolean {
  return !!message && /worn|wearing/i.test(message);
}

export const OUTFIT_LINK = "Wearing it? Add from an outfit photo";
export const TRY_AS_OUTFIT = "Try it as an outfit photo";

export const AI_NOTE = "AI image made from your photo. Parts hidden in the photo were completed.";
