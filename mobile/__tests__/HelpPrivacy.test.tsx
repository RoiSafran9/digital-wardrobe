import React from "react";
import { render, screen } from "@testing-library/react-native";
import HelpScreen, { helpSections } from "../app/help";
import PrivacyScreen from "../app/privacy";

jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));

test("help covers outfits and credits only when they exist", () => {
  const titles = (o: boolean, b: boolean) => helpSections(o, b).map((s) => s.title);
  expect(titles(false, false)).toEqual(["Garment photos", "Back image and 360° view", "Editing and removing"]);
  expect(titles(true, true)).toContain("Outfit photos");
  expect(titles(true, true)).toContain("AI Credits");
});

test("help shows no contact row without a support email", () => {
  render(<HelpScreen />);
  expect(screen.getByText("Help")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Contact Support" })).toBeNull();
});

test("privacy says it's a summary and explains who can see your data", () => {
  render(<PrivacyScreen />);
  expect(screen.getByText("Who can see it")).toBeTruthy();
  expect(screen.getByText(/not a legal privacy policy/)).toBeTruthy();
  expect(screen.getByText(/Delete Account/)).toBeTruthy();
});
