import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import PickScreen from "../app/outfit/pick";
import DetectScreen from "../app/outfit/detect";
import ReviewScreen from "../app/outfit/review";
import { deleteItem, generateOutfit, getOutfitScan, getPendingItems, keepItem, postRun, scanOutfit } from "../src/api/client";
import type { ClosetItem, OutfitCandidate, OutfitScan } from "../src/api/types";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { CaptureJobsProvider } from "../src/store/captureJobs";

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
  hidden_parts: [], uncertainty: "", box: { x: 10, y: 10, width: 100, height: 120 }, preview_url: `https://sb.test/${id}.jpg`,
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
  return render(<CreditsContext.Provider value={value}><CaptureJobsProvider>{ui}</CaptureJobsProvider></CreditsContext.Provider>);
}
const wallet = (available: number) => ({ balance: available, held: 0, available, granted: 10, used: 0, entries: [], next_before: null });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  (getPendingItems as jest.Mock).mockResolvedValue([]);
});

test("the pick screen hides shoes, leaves mostly hidden pieces unselected and shows the server's price", async () => {
  mockParams = { scanId: "scan-1" };
  (getOutfitScan as jest.Mock).mockResolvedValue(SCAN);
  withCredits(<PickScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(5) });
  await screen.findByText("Blazer");
  expect(screen.queryByText("Shoes")).toBeNull();
  expect(screen.getByText("We found 3 garments")).toBeTruthy();
  expect(screen.getByText(/mostly guessed/)).toBeTruthy();
  expect(screen.getByText("Tops · Not sure — please check")).toBeTruthy();
  expect(screen.getByText("Outerwear · Clear match")).toBeTruthy();
  const checked = screen.getAllByRole("checkbox").map((c) => c.props.accessibilityState.checked);
  expect(checked).toEqual([true, false, true]);
  expect(screen.getByText("2 selected")).toBeTruthy();
  expect(screen.getByText("2 credits · 5 available")).toBeTruthy();
  fireEvent.press(screen.getByLabelText(/^Shirt\./));
  expect(screen.getByText("3 credits · 5 available")).toBeTruthy();
});

test("Not a garment takes a detection off the list", async () => {
  mockParams = { scanId: "scan-1" };
  (getOutfitScan as jest.Mock).mockResolvedValue(SCAN);
  withCredits(<PickScreen />);
  await screen.findByText("Blazer");
  fireEvent.press(screen.getByRole("button", { name: "Blazer is not a garment" }));
  expect(screen.queryByText("Blazer")).toBeNull();
  expect(screen.getByText("1 selected")).toBeTruthy();
});

test("creating confirms the cost first, then sends only the picks and the price shown", async () => {
  mockParams = { scanId: "scan-1" };
  (getOutfitScan as jest.Mock).mockResolvedValue(SCAN);
  (generateOutfit as jest.Mock).mockResolvedValue({ items: [item("i1", "blazer")], failed: ["c3"] });
  withCredits(<PickScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(5) });
  await screen.findByText("Blazer");
  fireEvent.press(screen.getByRole("button", { name: "Generate" }));
  expect(generateOutfit).not.toHaveBeenCalled();
  expect(screen.getByText("Balance 5 → 3")).toBeTruthy();
  expect(screen.getByText("Detection was free")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Generate · 2 credits" }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/review", params: { failed: "trousers" } }));
  expect(generateOutfit).toHaveBeenCalledWith("scan-1", ["c1", "c3"], 1);
});

test("too few credits: says how many to deselect; billing off sends no price and asks nothing", async () => {
  mockParams = { scanId: "scan-1" };
  (getOutfitScan as jest.Mock).mockResolvedValue(SCAN);
  const view = withCredits(<PickScreen />, { billing: true, prices: { garment: 2 }, credits: wallet(3) });
  await screen.findByText("Blazer");
  fireEvent.press(screen.getByRole("button", { name: "Generate" }));
  expect(generateOutfit).not.toHaveBeenCalled();
  expect(screen.getByText(/Deselect 1 garment to continue with what you have\./)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Adjust Selection" }));
  view.unmount();

  (generateOutfit as jest.Mock).mockResolvedValue({ items: [], failed: [] });
  withCredits(<PickScreen />);
  await screen.findByText("Blazer");
  expect(screen.queryByText(/credit/)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Generate" }));
  await waitFor(() => expect(generateOutfit).toHaveBeenCalledWith("scan-1", ["c1", "c3"], null));
});

test("a changed price re-opens the cost sheet instead of charging", async () => {
  mockParams = { scanId: "scan-1" };
  (getOutfitScan as jest.Mock).mockResolvedValue(SCAN);
  (generateOutfit as jest.Mock).mockRejectedValue(new Error("The price changed — check it and confirm again."));
  const value = withCredits(<PickScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(5) });
  await screen.findByText("Blazer");
  fireEvent.press(screen.getByRole("button", { name: "Generate" }));
  fireEvent.press(screen.getByRole("button", { name: "Generate · 2 credits" }));
  expect(await screen.findByText("The price changed. Check it and confirm again.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Generate · 2 credits" })).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
  void value;
});

test("review shows photo and generated image side by side; Save keeps the kept and discards the rest", async () => {
  mockParams = { failed: "trousers" };
  (getPendingItems as jest.Mock).mockResolvedValue([item("i1", "blazer"), item("i2", "shirt")]);
  (keepItem as jest.Mock).mockResolvedValue({});
  (deleteItem as jest.Mock).mockResolvedValue(undefined);
  withCredits(<ReviewScreen />);
  expect(await screen.findByText("Review 1 of 2")).toBeTruthy();
  expect(screen.getByText(/Couldn't make: trousers/)).toBeTruthy();
  expect(screen.getByText("Your photo")).toBeTruthy();
  expect(screen.getByText("2 kept")).toBeTruthy();
  expect(screen.queryByText(/Regenerate/)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Review 2 of 2")).toBeTruthy();
  fireEvent(screen.getByLabelText("Keep Black shirt"), "valueChange", false);
  expect(screen.getByText("1 kept")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Save 1 to Closet" }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/capture/saved"));
  expect(keepItem).toHaveBeenCalledWith(expect.objectContaining({ item_id: "i1" }));
  expect(deleteItem).toHaveBeenCalledWith(expect.objectContaining({ item_id: "i2" }));
});

test("detecting shows the photo, says detection is free, then opens the pick screen", async () => {
  jest.useFakeTimers();
  mockParams = { uri: "file:///outfit.jpg" };
  (scanOutfit as jest.Mock).mockResolvedValue(SCAN);
  withCredits(<DetectScreen />);
  expect(screen.getByText("Finding garments…")).toBeTruthy();
  expect(screen.getByText("Detection is free")).toBeTruthy();
  expect(await screen.findByText("3 garments found")).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(1500); });
  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/pick", params: { scanId: "scan-1", uri: "file:///outfit.jpg" } });
  jest.useRealTimers();
});

test("a failed scan offers another photo", async () => {
  mockParams = { uri: "file:///outfit.jpg" };
  (scanOutfit as jest.Mock).mockRejectedValue(new Error("Can't reach your wardrobe server."));
  withCredits(<DetectScreen />);
  expect(await screen.findByText("Can't reach your wardrobe server.")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Try Another Photo" }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/capture/camera", params: { mode: "outfit" } });
});
