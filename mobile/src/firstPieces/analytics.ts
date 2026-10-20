import { postEvent } from "../api/client";

// First 3 Pieces activation steps (the server keeps the same list: api/events.py). Only counts and fixed
// choices, never photos, text or device details. Fire and forget: analytics never blocks or breaks the flow.
export type Path = "near" | "not_near";
export type Events = {
  onboarding_started: { entry?: "auto" | "starter" | "home" };
  path_selected: { path: Path };
  photos_collected: { count: number; camera: number; library: number };
  detection_completed: { photos: number; found: number; unusable: number; limited: number };
  generation_started: { pieces: number; photos: number; round: number; path: Path };
  first_garment_saved: { path?: Path };
  first_3_saved: { path?: Path };
  popup_shown: { saved: number };
  popup_add_more: Record<string, never>;
  onboarding_abandoned: { step: "start" | "photos" | "pick" | "processing" | "outfit" };
};

export function track<E extends keyof Events>(event: E, props: Events[E]): void {
  const clean = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) as Record<string, string | number>;
  Promise.resolve().then(() => postEvent(event, clean)).catch(() => {});
}

export const entryOf = (raw: string | undefined) => (raw === "auto" || raw === "starter" || raw === "home" ? raw : undefined);
export const pathOf = (raw: string | undefined): Path | undefined => (raw === "near" || raw === "not_near" ? raw : undefined);
