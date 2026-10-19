import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import AddScreen from "../app/(tabs)/add";
import PickScreen from "../app/outfit/pick";
import ReviewScreen from "../app/outfit/review";
import { deleteItem, generateOutfit, getOutfitScan, getPendingItems, keepItem, postRun, scanOutfit } from "../src/api/client";
import type { ClosetItem, OutfitCandidate, OutfitScan } from "../src/api/types";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { LastRunProvider } from "../src/store/lastRun";

jest.mock("expo-image-picker");
jest.mock("../src/api/client");
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const cand = (id: string, category: string, visibility: OutfitCandidate["visibility"] = "full"): OutfitCandidate => ({
  id, category, visibility, layer: "single", colors: ["black"], pattern: "solid", visible_text: "", description: `a ${category}`,
  hidden_parts: [], uncertainty: "", preview_url: `https://sb.test/${id}.jpg`,
});
const SCAN: OutfitScan = {
  id: "scan-1", status: "succeeded", error: null, scene_kind: "worn", person_count: 1, expires_at: null,
  candidates: [cand("c1", "blazer"), cand("c2", "shirt", "low"), cand("c3", "trousers"), cand("c4", "shoes")],
};
const f = (v: string) => ({ value: v, confidence: 1, basis: "observed" as const });
const item = (id: string, category: string): ClosetItem => ({
  id, item_id: id, run_id: "20261019-100000", photo_name: "", tier: "high",
  facts: { category: f(category), colors: f("black"), pattern: f("solid"), visible_text: f(""), trims: f(""), visible_parts: f(""), occluded_parts: f("") } as any,
  crop_url: "https://sb.test/c.jpg", generated_url: "https://sb.test/g.png", cutout_url: null, review_state: "pending",
});

function withCredits(ui: React.ReactElement, credits: Partial<CreditsValue> = {}) {
  const value: CreditsValue = { billing: false, prices: {}, credits: null, outfit: true, refresh: jest.fn(async () => {}), ...credits };
  return render(<CreditsContext.Provider value={value}><LastRunProvider>{ui}</LastRunProvider></CreditsContext.Provider>);
}
const wallet = (available: number) => ({ balance: available, held: 0, available, granted: 10, used: 0, entries: [], next_before: null });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  (getPendingItems as jest.Mock).mockResolvedValue([]);
});

test("the outfit mode appears only when the server offers it", () => {
  withCredits(<AddScreen />, { outfit: false });
  expect(screen.queryByLabelText("Outfit photo")).toBeNull();
});

test("outfit mode scans the photo (no generation) and opens the pick screen", async () => {
  (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: "file:///o.jpg" }] });
  (scanOutfit as jest.Mock).mockResolvedValue(SCAN);
  withCredits(<AddScreen />);
  fireEvent.press(screen.getByLabelText("Outfit photo"));
  expect(screen.queryByText("Pieces in this photo")).toBeNull();
  fireEvent.press(screen.getByText("Choose from library"));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: "/outfit/pick", params: { scanId: "scan-1" } }));
  expect(scanOutfit).toHaveBeenCalledWith("file:///o.jpg");
  expect(postRun).not.toHaveBeenCalled();
});

test("pending results are offered on the Add tab", async () => {
  (getPendingItems as jest.Mock).mockResolvedValue([item("i1", "blazer"), item("i2", "trousers")]);
  withCredits(<AddScreen />);
  fireEvent.press(screen.getByLabelText("Outfit photo"));
  fireEvent.press(await screen.findByText("2 pieces waiting for review"));
  expect(mockPush).toHaveBeenCalledWith("/outfit/review");
});

test("the pick screen hides shoes, leaves mostly hidden pieces unselected and shows the server's price", async () => {
  mockParams = { scanId: "scan-1" };
  (getOutfitScan as jest.Mock).mockResolvedValue(SCAN);
  withCredits(<PickScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(5) });
  await screen.findByText("Blazer");
  expect(screen.queryByText("Shoes")).toBeNull();
  expect(screen.getByText(/mostly guessed/)).toBeTruthy();
  const checked = screen.getAllByRole("checkbox").map((c) => c.props.accessibilityState.checked);
  expect(checked).toEqual([true, false, true]);
  expect(screen.getByText("2 images · 2 credits · 5 available")).toBeTruthy();
  fireEvent.press(screen.getByLabelText(/^Shirt/));
  expect(screen.getByText("3 images · 3 credits · 5 available")).toBeTruthy();
});

test("creating sends only the picks and the price shown, then opens review", async () => {
  mockParams = { scanId: "scan-1" };
  (getOutfitScan as jest.Mock).mockResolvedValue(SCAN);
  (generateOutfit as jest.Mock).mockResolvedValue({ items: [item("i1", "blazer")], failed: ["c3"] });
  withCredits(<PickScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(5) });
  await screen.findByText("Blazer");
  fireEvent.press(screen.getByText("Create 2 images"));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/review", params: { failed: "trousers" } }));
  expect(generateOutfit).toHaveBeenCalledWith("scan-1", ["c1", "c3"], 1);
});

test("not enough credits blocks creating; billing off sends no price", async () => {
  mockParams = { scanId: "scan-1" };
  (getOutfitScan as jest.Mock).mockResolvedValue(SCAN);
  const view = withCredits(<PickScreen />, { billing: true, prices: { garment: 2 }, credits: wallet(3) });
  await screen.findByText("Blazer");
  expect(screen.getByText(/not enough credits/)).toBeTruthy();
  fireEvent.press(screen.getByText("Create 2 images"));
  expect(generateOutfit).not.toHaveBeenCalled();
  view.unmount();

  (generateOutfit as jest.Mock).mockResolvedValue({ items: [], failed: [] });
  withCredits(<PickScreen />);
  await screen.findByText("Blazer");
  expect(screen.getByText("2 images · free while billing is off")).toBeTruthy();
  fireEvent.press(screen.getByText("Create 2 images"));
  await waitFor(() => expect(generateOutfit).toHaveBeenCalledWith("scan-1", ["c1", "c3"], null));
});

test("review keeps or discards each result and reports failed picks", async () => {
  mockParams = { failed: "trousers" };
  (getPendingItems as jest.Mock).mockResolvedValue([item("i1", "blazer"), item("i2", "shirt")]);
  (keepItem as jest.Mock).mockResolvedValue({});
  (deleteItem as jest.Mock).mockResolvedValue(undefined);
  withCredits(<ReviewScreen />);
  await screen.findByText("Blazer");
  expect(screen.getByText(/Couldn't make: trousers/)).toBeTruthy();
  fireEvent.press(screen.getAllByText("Keep")[0]);
  await waitFor(() => expect(keepItem).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText("Blazer")).toBeNull());
  expect(keepItem).toHaveBeenCalledWith(expect.objectContaining({ item_id: "i1" }));
  fireEvent.press(screen.getByText("Discard"));
  await waitFor(() => screen.getByText("All reviewed."));
  expect(deleteItem).toHaveBeenCalledWith(expect.objectContaining({ item_id: "i2" }));
  fireEvent.press(screen.getByText("Go to closet"));
  expect(mockReplace).toHaveBeenCalledWith("/closet");
});

test("a photo refused as worn offers the outfit flow on Add", async () => {
  (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: "file:///o.jpg" }] });
  (postRun as jest.Mock).mockRejectedValue(new Error("No garment to add: worn on body"));
  withCredits(<AddScreen />);
  fireEvent.press(screen.getByText("Choose from library"));
  fireEvent.press(await screen.findByText("Try it as an outfit photo"));
  expect(screen.getByText(/Someone wearing the outfit/)).toBeTruthy();
});

test("Add opens in outfit mode when Home's link asks for it", () => {
  mockParams = { mode: "outfit", at: "1" };
  withCredits(<AddScreen />);
  expect(screen.getByLabelText("Outfit photo").props.accessibilityState.selected).toBe(true);
});
