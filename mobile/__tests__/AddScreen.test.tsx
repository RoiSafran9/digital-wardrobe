import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AddScreen from "../app/(tabs)/add";
import { getPendingItems } from "../src/api/client";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { pickPhoto } from "../src/photoPicker";

jest.mock("../src/api/client");
jest.mock("../src/photoPicker", () => ({ pickPhoto: jest.fn() }));
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

const LAID_OUT = "Clothes by themselves. Laid out, hanging, or shoes together.";
const WORN = "Someone wearing them. A person wearing the clothes or shoes.";

beforeEach(() => { jest.clearAllMocks(); mockParams = {}; (getPendingItems as jest.Mock).mockResolvedValue([]); });

test("one question: what the photo shows; no sources until a type is chosen; no prices while billing is off", async () => {
  await renderAdd({ outfit: true });
  expect(screen.getByRole("header", { name: "Add Clothes" })).toBeTruthy();
  expect(screen.getByText("Choose what your photo shows.")).toBeTruthy();
  expect(screen.getByRole("button", { name: LAID_OUT })).toBeTruthy();
  expect(screen.getByRole("button", { name: WORN })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Take Photo" })).toBeNull();
  expect(screen.queryByText(/credit/)).toBeNull();
  expect(mockPush).not.toHaveBeenCalled();
});

test("clothes by themselves: Take Photo opens the laid-out camera; the library goes straight to the free scan", async () => {
  (pickPhoto as jest.Mock).mockResolvedValue("file:///lib.jpg");
  await renderAdd({ outfit: true });
  await fireEvent.press(screen.getByRole("button", { name: LAID_OUT }));
  expect(screen.getByRole("button", { name: LAID_OUT })).toBeSelected();
  await fireEvent.press(screen.getByRole("button", { name: "Take Photo" }));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/capture/camera", params: { mode: "garments" } });
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose from Library" })));
  expect(pickPhoto).toHaveBeenCalledWith(false);  // the library only: no camera screen, no camera permission
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/capture/preview", params: { uri: "file:///lib.jpg" } });
});

test("someone wearing them: the same two sources, into the outfit camera and the free outfit scan", async () => {
  (pickPhoto as jest.Mock).mockResolvedValue("file:///worn.jpg");
  await renderAdd({ outfit: true });
  await fireEvent.press(screen.getByRole("button", { name: WORN }));
  await fireEvent.press(screen.getByRole("button", { name: "Take Photo" }));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/capture/camera", params: { mode: "outfit" } });
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose from Library" })));
  expect(pickPhoto).toHaveBeenCalledWith(false);
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/outfit/detect", params: { uri: "file:///worn.jpg" } });
});

test("a cancelled library or refused access stays on the hub with the type still chosen", async () => {
  (pickPhoto as jest.Mock).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("permission denied — enable camera/photos access in Settings"));
  await renderAdd({ outfit: true });
  await fireEvent.press(screen.getByRole("button", { name: WORN }));
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose from Library" })));
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose from Library" })));
  expect(screen.getByText(/permission denied/)).toBeTruthy();
  expect(screen.getByRole("button", { name: WORN })).toBeSelected();
  expect(screen.getByRole("button", { name: "Take Photo" })).toBeTruthy();
  // Tapping the chosen type again puts the sources away.
  await fireEvent.press(screen.getByRole("button", { name: WORN }));
  expect(screen.queryByRole("button", { name: "Take Photo" })).toBeNull();
});

test("with outfit import off only the laid-out type is offered", async () => {
  await renderAdd();
  expect(screen.getByRole("button", { name: LAID_OUT })).toBeTruthy();
  expect(screen.queryByRole("button", { name: WORN })).toBeNull();
  expect(screen.queryByText(/Someone wearing/)).toBeNull();
});

test("billing on: free scan, the per-piece price and the balance with a price-list link", async () => {
  await renderAdd({ billing: true, prices: { garment: 1 }, credits: wallet(18), outfit: true });
  expect(screen.getByText("Finding the pieces is free · 1 credit per piece you create")).toBeTruthy();
  await fireEvent.press(screen.getByText(/Balance: 18 credits/));
  expect(mockPush).toHaveBeenCalledWith("/account");
});

test("the first-piece hint shows when the starter screen sent the user here", async () => {
  mockParams = { firstPiece: "1" };
  await renderAdd();
  expect(screen.getByText("Your first piece")).toBeTruthy();
});

test("pending outfit results are offered", async () => {
  (getPendingItems as jest.Mock).mockResolvedValue([{}, {}]);
  await renderAdd({ outfit: true });
  await fireEvent.press(await screen.findByText("2 pieces waiting for review"));
  expect(mockPush).toHaveBeenCalledWith("/outfit/review");
});

test("an old outfit link (mode=outfit) selects the worn type and waits; it never opens the camera by itself", async () => {
  mockParams = { mode: "outfit", at: "1" };
  await renderAdd({ outfit: true });
  await waitFor(() => expect(screen.getByRole("button", { name: WORN })).toBeSelected());
  expect(screen.getByRole("button", { name: "Take Photo" })).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
});

test("an outfit link while outfit import is off selects nothing, never a dead route", async () => {
  mockParams = { mode: "outfit", at: "1" };
  await renderAdd();
  expect(screen.queryByRole("button", { name: "Take Photo" })).toBeNull();
  expect(mockPush).not.toHaveBeenCalled();
});

test("a paused server says new images are paused", async () => {
  await renderAdd({ generation: false });
  expect(screen.getByText("New images are paused")).toBeTruthy();
});
