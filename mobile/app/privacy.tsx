import React from "react";
import { InfoPage, type InfoSection } from "../src/components/InfoPage";
import { APP_NAME } from "../src/appName";

// What actually happens to your data, from docs/ARCHITECTURE.md and AGENTS.md (Privacy). Keep it in
// step with them; nothing here may promise more than the code does.
export const PRIVACY_SECTIONS: InfoSection[] = [
  { title: "What is stored", body: [
    "Your email and the name you chose, the photos you upload, the catalog images, cutouts, back images and 360° views made from them, the details of each piece, and your AI Credits activity.",
    "Usage records: the steps your account takes in the app (for example signing in, onboarding, scanning a photo, creating, editing or removing a piece, and errors) and how each AI job went (time, result, estimated cost), with the app version — never your photos, the details of your pieces, text you type, your email or your device's identifiers. Kept for 180 days; cost records 400 days, separated from your account if you delete it; server logs 14 days.",
    "For outfit photos, the photo of you is not added to your closet: it is kept only to make the pieces you pick and is marked for removal after 24 hours. Only crops of the garments are kept with your pieces.",
  ] },
  { title: "Who can see it", body: [
    "Only you. Every wardrobe is private to its account: the database and file storage only let your account read your rows and files, and images are shown through links that expire within an hour.",
    "The app's developer can see the steps your account took (usage records), never your photos. Usage records aren't shared with anyone or used for advertising.",
  ] },
  { title: "AI processing", body: [
    "To find garments and make images, your photos are sent to Google's Gemini AI service. Background removal runs on the wardrobe server, not on an outside service.",
  ] },
  { title: "Where it lives", body: [
    "Your account, wardrobe and files are kept in a Supabase project in the EU (Ireland). The app's server currently runs on the app owner's computer.",
  ] },
  { title: "Removing and deleting", body: [
    "Removing a piece takes it out of your closet; it can still be restored by the app owner.",
    "Delete Account (in Account) permanently removes your account, every piece, every photo, your credits and your usage records.",
  ] },
];

export default function PrivacyScreen() {
  return (
    <InfoPage
      title="Privacy"
      intro={`What ${APP_NAME} keeps, who can see it, and how to remove it.`}
      sections={PRIVACY_SECTIONS}
      footer="This is a plain-language summary of how the app handles your data, not a legal privacy policy."
    />
  );
}
