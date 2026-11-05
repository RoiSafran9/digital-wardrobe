import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import BuildMyLookScreen from "../app/build-my-look/index";
import { getItems, getOutfitSuggestions, getSwapOptions } from "../src/api/client";
import type { ClosetItem } from "../src/api/types";
import {
  COLOR_PREF_OPTIONS, OCCASION_OPTIONS, STYLE_OPTIONS, VIBE_OPTIONS, WEATHER_OPTIONS,
} from "../src/outfitBuilder/filters";

jest.mock("../src/api/client");
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }));

const f = (v: string | string[]) => ({ value: v, confidence: 1, basis: "observed" as const });
const item = (id: string, category: string): ClosetItem => ({
  id, item_id: id, run_id: "20261029-100000", photo_name: "", tier: "high",
  facts: { category: f(category), colors: f([]), pattern: f("solid"), visible_text: f(""), trims: f(""),
          visible_parts: f([]), occluded_parts: f([]) },
  crop_url: "https://sb.test/c.jpg", generated_url: "https://sb.test/g.png", cutout_url: null,
});

const SHIRT = item("top1", "shirt");
const CHINOS = item("bottom1", "chinos");
const JEANS = item("bottom2", "jeans");

const LOOK = { look_id: "look_1", title: "Shirt & Chinos", reason: "A look built from pieces you already own.",
               item_ids: ["top1", "bottom1"], slots: { top: "top1", bottom: "bottom1" }, completeness: "core_outfit" as const };

beforeEach(() => {
  jest.clearAllMocks();
});

// The questions come one at a time, each already answered Any: tap Next until `name` is on screen.
async function nextUntil(name: string) {
  await screen.findByText("Made with clothes you already own.");
  while (!screen.queryByRole("button", { name })) await fireEvent.press(screen.getByRole("button", { name: "Next" }));
}

async function buildLooks() {
  await nextUntil("Build Looks");
  await fireEvent.press(screen.getByRole("button", { name: "Build Looks" }));
}

test("an empty closet shows the Add Clothes empty state instead of the form", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  await render(<BuildMyLookScreen />);
  await screen.findByText("Your looks start in your closet.");
  await fireEvent.press(screen.getByRole("button", { name: "Add Clothes" }));
  expect(mockPush).toHaveBeenCalledWith("/add");
  expect(getOutfitSuggestions).not.toHaveBeenCalled();
});

test("generating with the defaults shows one look and its real catalog pieces", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT, CHINOS] });
  (getOutfitSuggestions as jest.Mock).mockResolvedValue({ looks: [LOOK], applied_filters: {}, limitations: [], used_fallback: false });
  await render(<BuildMyLookScreen />);
  await buildLooks();
  await screen.findByText("1 look for you");
  expect(getOutfitSuggestions).toHaveBeenCalledWith({ occasion: "any", style: "any", vibe: "any", weather: "any", colors: "any" });
  expect(screen.getByText("Shirt & Chinos")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open Shirt & Chinos" })).toBeTruthy();
  expect(screen.getByText("2 pieces")).toBeTruthy();
  // One look: nothing to swipe to.
  expect(screen.queryByRole("button", { name: "Next Look" })).toBeNull();
});

test("the questions come one at a time, with Back to the one before", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT, CHINOS] });
  await render(<BuildMyLookScreen />);
  await screen.findByText("What are you dressing for?");
  expect(screen.getByText("Build My Look · 1 of 5")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Build My Look · 2 of 5")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText("What are you dressing for?")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(mockBack).toHaveBeenCalled();
  expect(getOutfitSuggestions).not.toHaveBeenCalled();
});

test("choosing a filter chip sends it with the request", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT, CHINOS] });
  (getOutfitSuggestions as jest.Mock).mockResolvedValue({ looks: [LOOK], applied_filters: {}, limitations: [], used_fallback: false });
  await render(<BuildMyLookScreen />);
  await fireEvent.press(await screen.findByRole("button", { name: "Work" }));
  await buildLooks();
  await waitFor(() => expect(getOutfitSuggestions).toHaveBeenCalledWith(
    expect.objectContaining({ occasion: "work" })));
  await screen.findByText("Work");  // the answers' chip over the looks
});

test("every answer is a tile with an icon or swatches, and tapping one selects it", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT, CHINOS] });
  await render(<BuildMyLookScreen />);
  await nextUntil("Cold");
  for (const option of [...OCCASION_OPTIONS, ...STYLE_OPTIONS, ...VIBE_OPTIONS, ...WEATHER_OPTIONS, ...COLOR_PREF_OPTIONS]) {
    expect("icon" in option || option.swatches.length > 0).toBe(true);
  }
  const cold = screen.getByRole("button", { name: "Cold" });
  expect(cold.props.accessibilityState).toEqual({ selected: false });
  await fireEvent.press(cold);
  expect(screen.getByRole("button", { name: "Cold" }).props.accessibilityState).toEqual({ selected: true });
  // The answer stays when you step back and forward again.
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("button", { name: "Cold" }).props.accessibilityState).toEqual({ selected: true });
});

test("no valid look shows the server's own limitation and a way back to the form", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT] });
  (getOutfitSuggestions as jest.Mock).mockResolvedValue({
    looks: [], applied_filters: {}, limitations: ["Add a bottom or a one-piece to build your first look."], used_fallback: false,
  });
  await render(<BuildMyLookScreen />);
  await buildLooks();
  await screen.findByText("Add a bottom or a one-piece to build your first look.");
  await fireEvent.press(screen.getByRole("button", { name: "Adjust Preferences" }));
  await screen.findByText("What are you dressing for?");
});

test("opening a look, swapping a piece, and seeing only that slot change", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT, CHINOS, JEANS] });
  (getOutfitSuggestions as jest.Mock).mockResolvedValue({ looks: [LOOK], applied_filters: {}, limitations: [], used_fallback: false });
  (getSwapOptions as jest.Mock).mockResolvedValue({ target_slot: "bottom", alternatives: [{ item_id: "bottom2", reason: "A more casual alternative." }] });
  await render(<BuildMyLookScreen />);
  await buildLooks();
  await screen.findByText("Shirt & Chinos");
  await fireEvent.press(screen.getByRole("button", { name: "Open Shirt & Chinos" }));
  await screen.findByText("Tap any piece to swap it");

  const swapButtons = screen.getAllByRole("button", { name: "Swap" });
  await fireEvent.press(swapButtons[swapButtons.length - 1]);  // the bottom row's Swap button
  await screen.findByText("Swap bottom");
  expect(getSwapOptions).toHaveBeenCalledWith(
    { slots: { top: "top1", bottom: "bottom1" }, item_ids: ["top1", "bottom1"] }, "bottom1",
    { occasion: "any", style: "any", vibe: "any", weather: "any", colors: "any" });

  await fireEvent.press(screen.getByLabelText("Use Jeans"));
  // The bottom slot now shows the chosen alternative; the top is untouched.
  await waitFor(() => expect(screen.getAllByText("Jeans").length).toBeGreaterThan(0));
  expect(screen.getAllByText("Shirt").length).toBeGreaterThan(0);
});

const LOOK2 = { ...LOOK, look_id: "look_1", title: "Shirt & Jeans", item_ids: ["top1", "bottom2"],
                slots: { top: "top1", bottom: "bottom2" } };

test("Generate Again sends the looks already shown and shows the new ones", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT, CHINOS, JEANS] });
  (getOutfitSuggestions as jest.Mock)
    .mockResolvedValueOnce({ looks: [LOOK], applied_filters: {}, limitations: [], used_fallback: false })
    .mockResolvedValueOnce({ looks: [LOOK2], applied_filters: {}, limitations: [], used_fallback: false })
    .mockResolvedValueOnce({ looks: [LOOK], applied_filters: {}, used_fallback: false,
                             limitations: ["No other combinations match these choices yet — these are your best looks."] });
  await render(<BuildMyLookScreen />);
  await buildLooks();
  await fireEvent.press(await screen.findByRole("button", { name: "Generate Again" }));
  await screen.findByText("Shirt & Jeans");
  expect((getOutfitSuggestions as jest.Mock).mock.calls[1][1]).toEqual([["top1", "bottom1"]]);
  await fireEvent.press(screen.getByRole("button", { name: "Generate Again" }));
  await screen.findByText(/No other combinations match/);
  expect((getOutfitSuggestions as jest.Mock).mock.calls[2][1]).toEqual([["top1", "bottom1"], ["top1", "bottom2"]]);
  // Nothing new was left: the next press starts over from what is on screen now.
  await fireEvent.press(screen.getByRole("button", { name: "Generate Again" }));
  await waitFor(() => expect((getOutfitSuggestions as jest.Mock).mock.calls[3][1]).toEqual([["top1", "bottom1"]]));
});

test("changing a choice forgets the looks shown before", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT, CHINOS] });
  (getOutfitSuggestions as jest.Mock).mockResolvedValue({ looks: [LOOK], applied_filters: {}, limitations: [], used_fallback: false });
  await render(<BuildMyLookScreen />);
  await buildLooks();
  await screen.findByText("1 look for you");
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await screen.findByRole("button", { name: "Build Looks" });
  while (!screen.queryByRole("button", { name: "Work" })) await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(screen.getByRole("button", { name: "Work" }));
  await buildLooks();
  await waitFor(() => expect(getOutfitSuggestions).toHaveBeenCalledTimes(2));
  expect((getOutfitSuggestions as jest.Mock).mock.calls[1]).toEqual([expect.objectContaining({ occasion: "work" })]);
});

test("Generate Again never sends more than 30 shown looks", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT, CHINOS, JEANS] });
  let n = 0;
  (getOutfitSuggestions as jest.Mock).mockImplementation(async () => {
    n += 1;
    const looks = [0, 1, 2].map((k) => ({ ...LOOK, look_id: `look_${k}`, title: `Look ${n}-${k}`, item_ids: [`t${n}-${k}`, "b"] }));
    return { looks, applied_filters: {}, limitations: [], used_fallback: false };
  });
  await render(<BuildMyLookScreen />);
  await buildLooks();
  for (let press = 2; press <= 12; press++) {
    await fireEvent.press(await screen.findByRole("button", { name: "Generate Again" }));
    await screen.findByText(`Look ${press}-0`);
  }
  const last = (getOutfitSuggestions as jest.Mock).mock.calls.at(-1)[1] as string[][];
  expect(last).toHaveLength(30);
  expect(last.at(-1)).toEqual(["t11-2", "b"]);  // the latest are kept
});

test("the deck's piece row swaps a piece of the look on top", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT, CHINOS, JEANS] });
  (getOutfitSuggestions as jest.Mock).mockResolvedValue({ looks: [LOOK], applied_filters: {}, limitations: [], used_fallback: false });
  (getSwapOptions as jest.Mock).mockResolvedValue({ target_slot: "bottom", alternatives: [{ item_id: "bottom2", reason: "A more casual alternative." }] });
  await render(<BuildMyLookScreen />);
  await buildLooks();
  await fireEvent.press(await screen.findByRole("button", { name: "Swap Chinos" }));
  await screen.findByText("1 other option from your closet");
  expect(getSwapOptions).toHaveBeenCalledWith(
    { slots: { top: "top1", bottom: "bottom1" }, item_ids: ["top1", "bottom1"] }, "bottom1", expect.anything());
  expect(screen.getByLabelText("Chinos, currently in this look")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Use Jeans"));
  await screen.findByRole("button", { name: "Swap Jeans" });
  expect(screen.getByRole("button", { name: "Swap Shirt" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Swap Chinos" })).toBeNull();
});

test("Next Look moves the deck on, and round again after the last", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT, CHINOS, JEANS] });
  (getOutfitSuggestions as jest.Mock).mockResolvedValue({
    looks: [LOOK, { ...LOOK2, look_id: "look_2" }], applied_filters: {}, limitations: [], used_fallback: false,
  });
  await render(<BuildMyLookScreen />);
  await buildLooks();
  await screen.findByText("2 looks for you");
  expect(screen.getByText("1 of 2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open Shirt & Chinos" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Next Look" }));
  await screen.findByText("2 of 2");
  expect(screen.getByRole("button", { name: "Open Shirt & Jeans" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Open Shirt & Jeans" }));
  await screen.findByText("Tap any piece to swap it");
  expect(screen.getByText("Shirt & Jeans")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(await screen.findByRole("button", { name: "Next Look" }));
  await screen.findByText("1 of 2");
});
