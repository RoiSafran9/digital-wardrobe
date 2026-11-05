// Change Photo Type (docs/features/unified-add-clothes, 01 §3.5 and 02 §2): before any paid generation a
// photo added as the wrong type can switch to the other one. The same local photo goes to the other free
// scan; nothing from this scan (its id, picks or price) comes along, and nothing is generated or charged.
// The photo travels only in the in-app route; it is never logged or tracked.
import { track } from "./activity/track";

export type PhotoType = "laid_out" | "worn";
export type CorrectionStage = "garment_preview" | "outfit_detect" | "outfit_pick";

export const PHOTO_TYPE_NAMES: Record<PhotoType, string> = {
  laid_out: "Clothes by themselves",
  worn: "Someone wearing them",
};

export const CHANGE_PHOTO_TYPE = "Change Photo Type";
export const RESCAN_FREE = "We'll scan this photo again for free.";
export const LOOKS_WORN = "This looks like someone wearing the clothes. Try as a worn photo.";
export const TRY_AS_WORN = "Try as a worn photo";
export const LOOKS_LAID_OUT = "These clothes look laid out. Try as clothes by themselves.";
export const TRY_AS_CLOTHES = "Try as clothes by themselves";
export const CHOOSE_ANOTHER_PHOTO = "Choose Another Photo";

export function otherType(type: PhotoType): PhotoType {
  return type === "worn" ? "laid_out" : "worn";
}

// Where the same photo goes as the other type: worn → the free outfit scan, laid out → the garment preview
// and its free pre-scan. First 3 Pieces' onboarding mode comes along.
export function photoTypeRoute(to: PhotoType, uri: string, onboarding = false) {
  const params = onboarding ? { uri, onboarding: "1" } : { uri };
  return to === "worn"
    ? { pathname: "/outfit/detect" as const, params }
    : { pathname: "/capture/preview" as const, params };
}

// No photo to carry over: the camera for the other type, instead of a route that can't open.
export function anotherPhotoRoute(to: PhotoType, onboarding = false) {
  const mode = to === "worn" ? "outfit" : "garments";
  return { pathname: "/capture/camera" as const, params: onboarding ? { mode, onboarding: "1" } : { mode } };
}

// The one correction event: fixed choices only, never the photo or anything from it.
export function trackCorrection(from: PhotoType, stage: CorrectionStage): void {
  track("add_photo_type_corrected", { from, to: otherType(from), stage });
}
