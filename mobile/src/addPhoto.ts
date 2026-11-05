// One way to add clothes: the user says what the photo shows (two types), then where it comes from
// (camera or library). Each type keeps its own backend flow — "laid_out" is the garment scan
// (/capture/preview), "worn" the outfit scan (/outfit/detect). See docs/features/unified-add-clothes/.
// No prices, URIs or user data here: only the fixed choices and the routes they lead to.

export type AddPhotoType = "laid_out" | "worn";
export type PhotoSource = "camera" | "library";
export type CameraMode = "garments" | "outfit";  // the camera's existing route param

export const PHOTO_TYPES: Record<AddPhotoType, { title: string; body: string; mode: CameraMode; hint: string }> = {
  laid_out: {
    title: "Clothes by themselves",
    body: "Laid out, hanging, or shoes together.",
    mode: "garments",
    hint: "Lay clothes out or hang them. Shoes: low side angle.",
  },
  worn: {
    title: "Someone wearing them",
    body: "A person wearing the clothes or shoes.",
    mode: "outfit",
    hint: "Keep the clothing visible; full outfit in frame.",
  },
};

export const TAKE_PHOTO = "Take Photo";
export const CHOOSE_FROM_LIBRARY = "Choose from Library";
export const CHANGE_PHOTO_TYPE = "Change Photo Type";
export const RESCAN_FREE = "We'll scan this photo again for free.";
export const LOOKS_WORN = "This looks like someone wearing the clothes. Try as a worn photo.";
export const TRY_AS_WORN = "Try as a Worn Photo";
export const LOOKS_LAID_OUT = "These clothes look laid out. Try as clothes by themselves.";
export const TRY_AS_LAID_OUT = "Try as Clothes by Themselves";
export const TYPE_UNAVAILABLE = "This photo option is unavailable right now.";

export const otherType = (t: AddPhotoType): AddPhotoType => (t === "worn" ? "laid_out" : "worn");

// A route's `mode` (camera, Add deep links) as a photo type. Anything unknown, or "outfit" while the
// server has outfit import off, is the always-available laid-out type — never a disabled flow.
export function typeOfMode(mode: string | undefined, wornOn: boolean): AddPhotoType {
  return mode === "outfit" && wornOn ? "worn" : "laid_out";
}

// The types offered right now: worn only when the server offers outfit import.
export const availableTypes = (wornOn: boolean): AddPhotoType[] => (wornOn ? ["laid_out", "worn"] : ["laid_out"]);

// The camera for a type (First 3 Pieces' worn path carries onboarding through detect, pick and review).
export function cameraRoute(t: AddPhotoType, onboarding = false) {
  const mode = PHOTO_TYPES[t].mode;
  return { pathname: "/capture/camera" as const, params: onboarding ? { mode, onboarding: "1" } : { mode } };
}

// Where a photo of a type goes, from the camera or the library alike: the type's free scan.
export function photoRoute(t: AddPhotoType, uri: string, onboarding = false) {
  return t === "worn"
    ? { pathname: "/outfit/detect" as const, params: onboarding ? { uri, onboarding: "1" } : { uri } }
    : { pathname: "/capture/preview" as const, params: { uri } };
}
