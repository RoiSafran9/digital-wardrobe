import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import FirstPiecesStart from "../app/first-pieces";
import { postEvent } from "../src/api/client";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { entryOf, track } from "../src/firstPieces/analytics";

jest.mock("../src/api/client", () => ({ postEvent: jest.fn(async () => {}) }));
jest.mock("../src/photoPicker", () => ({ pickPhoto: jest.fn() }));
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ entry: "starter" }),
}));
const sent = () => (postEvent as jest.Mock).mock.calls;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

test("events carry only their allow-listed props and never throw", async () => {
  (postEvent as jest.Mock).mockRejectedValueOnce(new Error("offline"));
  track("photos_collected", { count: 3, camera: 2, library: 1 });
  track("first_garment_saved", { path: undefined });
  await flush();
  expect(sent()).toEqual([["photos_collected", { count: 3, camera: 2, library: 1 }], ["first_garment_saved", {}]]);
  expect(entryOf("auto")).toBe("auto");
  expect(entryOf("anything else")).toBeUndefined();
});

test("the Start screen reports that onboarding started, the path chosen, and leaving", async () => {
  const value: CreditsValue = { billing: false, prices: {}, credits: null, outfit: true, generation: true, refresh: jest.fn(async () => {}) };
  render(<CreditsContext.Provider value={value}><FirstPiecesStart /></CreditsContext.Provider>);
  fireEvent.press(screen.getByRole("button", { name: "Not right now" }));
  fireEvent.press(screen.getByRole("button", { name: "Not right now" }));  // counted once
  fireEvent.press(screen.getByRole("button", { name: "Close" }));
  await flush();
  expect(sent()).toEqual([
    ["onboarding_started", { entry: "starter" }],
    ["path_selected", { path: "not_near" }],
    ["onboarding_abandoned", { step: "start" }],
  ]);
});
