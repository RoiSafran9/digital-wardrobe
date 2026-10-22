// First 3 Pieces activation steps, now part of the app's activity events (src/activity/track.ts).
export { track } from "../activity/track";
export type { Events, Path } from "../activity/track";
import type { Path } from "../activity/track";

export const entryOf = (raw: string | undefined) => (raw === "auto" || raw === "starter" || raw === "home" ? raw : undefined);
export const pathOf = (raw: string | undefined): Path | undefined => (raw === "near" || raw === "not_near" ? raw : undefined);
