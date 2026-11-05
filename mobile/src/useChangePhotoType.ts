import { useRouter } from "expo-router";
import { otherType, photoRoute, type AddPhotoType } from "./addPhoto";
import { track, type Events } from "./activity/track";
import { useFirstPiecesMaybe } from "./firstPieces/FirstPiecesProvider";

type Stage = Events["add_photo_type_corrected"]["stage"];

// The user picked the wrong photo type: send the SAME photo to the other type's free scan. Replaces the
// current screen (no back-stack loop) and carries nothing over — no scan id, picks or price — so the new
// scan starts clean and nothing is charged until the user confirms there. First 3 Pieces: a laid-out
// photo joins its photo tray, which scans the round's photos itself.
export function useChangePhotoType() {
  const router = useRouter();
  const firstPieces = useFirstPiecesMaybe();
  return (from: AddPhotoType, uri: string, stage: Stage, onboarding = false) => {
    const to = otherType(from);
    track("add_photo_type_corrected", { from, to, stage });
    if (onboarding && to === "laid_out" && firstPieces) {
      firstPieces.addPhotos([uri]);
      return router.replace("/first-pieces/photos");
    }
    router.replace(photoRoute(to, uri, onboarding));
  };
}
