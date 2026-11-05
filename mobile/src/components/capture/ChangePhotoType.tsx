import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { haptics } from "../../haptics";
import { useFirstPiecesMaybe } from "../../firstPieces/FirstPiecesProvider";
import {
  CHANGE_PHOTO_TYPE, CHOOSE_ANOTHER_PHOTO, PHOTO_TYPE_NAMES, RESCAN_FREE, TRY_AS_CLOTHES, TRY_AS_WORN,
  anotherPhotoRoute, otherType, photoTypeRoute, trackCorrection, type CorrectionStage, type PhotoType,
} from "../../photoType";
import { colors, type } from "../../theme";
import { Button } from "../../ui";

// Change Photo Type, before any paid generation: the same photo opens the other type's free scan, replacing
// this screen (no back-stack loop). `suggested` when the scan says the photo looks like the other type: a
// glass "Try as …" button instead of the small text one. Gone once generation starts (`disabled`) and after
// the first tap, so it can never switch twice or race the generate button.
export function ChangePhotoType({ from, stage, uri, onboarding = false, suggested = false, disabled = false }: {
  from: PhotoType; stage: CorrectionStage; uri?: string | null; onboarding?: boolean; suggested?: boolean; disabled?: boolean;
}) {
  const router = useRouter();
  const firstPieces = useFirstPiecesMaybe();
  const used = useRef(false);
  const [gone, setGone] = useState(false);
  const to = otherType(from);
  if (disabled || gone) return null;

  const change = () => {
    if (used.current) return;
    used.current = true;
    setGone(true);
    haptics.selection();
    trackCorrection(from, stage);
    // In First 3 Pieces a photo that turns out to be clothes by themselves joins the round's photo tray, so
    // its pieces count toward the round (cap, progress, celebration) like any other.
    if (uri && onboarding && to === "laid_out" && firstPieces) {
      firstPieces.addPhotos([uri]);
      return router.replace("/first-pieces/photos");
    }
    router.replace(uri ? photoTypeRoute(to, uri, onboarding) : anotherPhotoRoute(to, onboarding));
  };

  // Without the photo (it isn't in this route any more) the action starts again with a new photo of the
  // other type instead of opening a route that can't load.
  const name = PHOTO_TYPE_NAMES[to].toLowerCase();
  const title = !uri ? CHOOSE_ANOTHER_PHOTO : suggested ? (to === "worn" ? TRY_AS_WORN : TRY_AS_CLOTHES) : CHANGE_PHOTO_TYPE;
  const note = !uri ? `Opens the camera for ${name}.` : suggested ? RESCAN_FREE : `Switches to ${name}. ${RESCAN_FREE}`;
  return suggested ? (
    <View style={{ gap: 6 }}>
      <Button title={title} variant="glass" onPress={change} />
      <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>{note}</Text>
    </View>
  ) : (
    <View style={{ alignItems: "center" }}>
      <View style={{ minWidth: 200 }}>
        <Button title={title} variant="text" size="medium" onPress={change} />
      </View>
      <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>{note}</Text>
    </View>
  );
}
