import React from "react";
import { Linking } from "react-native";
import { InfoPage, type InfoSection } from "../src/components/InfoPage";
import { APP_NAME } from "../src/appName";
import { useCredits } from "../src/credits/CreditsProvider";
import { SUPPORT_EMAIL } from "../src/support";
import { Button } from "../src/ui";
import { useScreenViewed } from "../src/activity/track";

export function helpSections(outfit: boolean, billing: boolean): InfoSection[] {
  return [
    { title: "Garment photos", body: [
      "Lay one or more pieces flat on a bed or the floor, or hang them, and photograph them from above in good light.",
      "Each piece becomes its own item: a clean catalog image of that exact garment, with its colors, prints and text kept as they are.",
      "A blurry, dark or very small photo is refused before any image is made, with a hint for the retake.",
    ] },
    ...(outfit ? [{ title: "Outfit photos", body: [
      "Choose a photo of you wearing an outfit. Finding the pieces is free.",
      "Pick the pieces you want, correct anything that looks off, then confirm. An image is made only for the pieces you picked.",
      "Review each result next to your photo and keep the ones that look like yours.",
    ] }] : []),
    { title: "Back image and 360° view", body: [
      "Open a piece and add a photo of its back to get a matching back image.",
      "A 360° view shows the piece on an invisible body from four sides. It is made by AI and labelled as AI.",
    ] },
    ...(billing ? [{ title: "AI Credits", body: [
      "Finding garments is free. Each image AI creates — a front, a back, or a 360° view — uses credits, and you always see the cost first.",
      "Failed attempts don't use credits. Your balance and the price list are in Account.",
    ] }] : []),
    { title: "Editing and removing", body: [
      "Tap Edit on a piece to change its name, type, colors, pattern, details or printed text.",
      "Removing a piece takes it out of your closet.",
    ] },
  ];
}

export default function HelpScreen() {
  useScreenViewed("help");
  const { outfit, billing } = useCredits();
  return (
    <InfoPage title="Help" intro={`How ${APP_NAME} turns your photos into a closet.`} sections={helpSections(!!outfit, billing)}>
      {SUPPORT_EMAIL ? (
        <Button title="Contact Support" variant="secondary" onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
      ) : null}
    </InfoPage>
  );
}
