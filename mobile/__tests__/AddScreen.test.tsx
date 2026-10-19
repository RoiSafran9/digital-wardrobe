import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AddScreen from "../app/(tabs)/add";
import { getPendingItems } from "../src/api/client";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";

jest.mock("../src/api/client");
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => { const { useEffect } = require("react"); useEffect(() => cb(), [cb]); },
}));

const wallet = (available: number) => ({ balance: available, held: 0, available, granted: 10, used: 0, entries: [], next_before: null });
function renderAdd(credits: Partial<CreditsValue> = {}) {
  const value: CreditsValue = { billing: false, prices: {}, credits: null, outfit: false, refresh: jest.fn(async () => {}), ...credits };
  return render(<CreditsContext.Provider value={value}><AddScreen /></CreditsContext.Provider>);
}

beforeEach(() => { jest.clearAllMocks(); mockParams = {}; (getPendingItems as jest.Mock).mockResolvedValue([]); });

test("garment card opens the camera; no prices while billing is off", () => {
  renderAdd();
  expect(screen.getByText("Choose how to start. Finding garments is always free.")).toBeTruthy();
  expect(screen.queryByText(/credit/)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Photograph Garments" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/capture/camera", params: { mode: "garments" } });
});

test("the outfit card appears only when the server offers outfits", () => {
  renderAdd();
  expect(screen.queryByRole("button", { name: "Import from Outfit Photo" })).toBeNull();
  screen.unmount();
  renderAdd({ outfit: true });
  fireEvent.press(screen.getByRole("button", { name: "Import from Outfit Photo" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/capture/camera", params: { mode: "outfit" } });
});

test("billing on: per-garment price and the balance with a price-list link", () => {
  renderAdd({ billing: true, prices: { garment: 1 }, credits: wallet(18), outfit: true });
  expect(screen.getByText("1 credit per garment")).toBeTruthy();
  expect(screen.getByText("Free detection · 1 credit per piece")).toBeTruthy();
  fireEvent.press(screen.getByText(/Balance: 18 credits/));
  expect(mockPush).toHaveBeenCalledWith("/account");
});

test("the first-piece hint shows when the starter screen sent the user here", () => {
  mockParams = { firstPiece: "1" };
  renderAdd();
  expect(screen.getByText("Your first piece")).toBeTruthy();
});

test("pending outfit results are offered", async () => {
  (getPendingItems as jest.Mock).mockResolvedValue([{}, {}]);
  renderAdd({ outfit: true });
  fireEvent.press(await screen.findByText("2 pieces waiting for review"));
  expect(mockPush).toHaveBeenCalledWith("/outfit/review");
});

test("Home's outfit link (mode=outfit) goes straight to the outfit camera", async () => {
  mockParams = { mode: "outfit", at: "1" };
  renderAdd({ outfit: true });
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: "/capture/camera", params: { mode: "outfit" } }));
});

test("a paused server says new images are paused", () => {
  renderAdd({ generation: false });
  expect(screen.getByText("New images are paused")).toBeTruthy();
});
