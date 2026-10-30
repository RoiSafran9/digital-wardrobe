import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import BuildMyLookScreen from "../app/build-my-look/index";
import { getItems, getOutfitSuggestions, getSwapOptions } from "../src/api/client";
import type { ClosetItem } from "../src/api/types";

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

test("an empty closet shows the Add Clothes empty state instead of the form", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  render(<BuildMyLookScreen />);
  await screen.findByText("Your looks start in your closet.");
  fireEvent.press(screen.getByRole("button", { name: "Add Clothes" }));
  expect(mockPush).toHaveBeenCalledWith("/add");
  expect(getOutfitSuggestions).not.toHaveBeenCalled();
});

test("generating with the defaults shows one look and its real catalog pieces", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT, CHINOS] });
  (getOutfitSuggestions as jest.Mock).mockResolvedValue({ looks: [LOOK], applied_filters: {}, limitations: [], used_fallback: false });
  render(<BuildMyLookScreen />);
  await screen.findByText("Generate Looks");
  fireEvent.press(screen.getByRole("button", { name: "Generate Looks" }));
  await screen.findByText("Your Looks");
  expect(getOutfitSuggestions).toHaveBeenCalledWith({ occasion: "any", style: "any", vibe: "any", weather: "any", colors: "any" });
  expect(screen.getByText("Shirt & Chinos")).toBeTruthy();
  expect(screen.getByText("1 idea from your closet")).toBeTruthy();
});

test("choosing a filter chip sends it with the request", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT, CHINOS] });
  (getOutfitSuggestions as jest.Mock).mockResolvedValue({ looks: [LOOK], applied_filters: {}, limitations: [], used_fallback: false });
  render(<BuildMyLookScreen />);
  await screen.findByText("Generate Looks");
  fireEvent.press(screen.getByRole("button", { name: "Work" }));
  fireEvent.press(screen.getByRole("button", { name: "Generate Looks" }));
  await waitFor(() => expect(getOutfitSuggestions).toHaveBeenCalledWith(
    expect.objectContaining({ occasion: "work" })));
});

test("no valid look shows the server's own limitation and a way back to the form", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT] });
  (getOutfitSuggestions as jest.Mock).mockResolvedValue({
    looks: [], applied_filters: {}, limitations: ["Add a bottom or a one-piece to build your first look."], used_fallback: false,
  });
  render(<BuildMyLookScreen />);
  await screen.findByText("Generate Looks");
  fireEvent.press(screen.getByRole("button", { name: "Generate Looks" }));
  await screen.findByText("Add a bottom or a one-piece to build your first look.");
  fireEvent.press(screen.getByRole("button", { name: "Adjust Preferences" }));
  await screen.findByText("Generate Looks");
});

test("opening a look, swapping a piece, and seeing only that slot change", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [SHIRT, CHINOS, JEANS] });
  (getOutfitSuggestions as jest.Mock).mockResolvedValue({ looks: [LOOK], applied_filters: {}, limitations: [], used_fallback: false });
  (getSwapOptions as jest.Mock).mockResolvedValue({ target_slot: "bottom", alternatives: [{ item_id: "bottom2", reason: "A more casual alternative." }] });
  render(<BuildMyLookScreen />);
  await screen.findByText("Generate Looks");
  fireEvent.press(screen.getByRole("button", { name: "Generate Looks" }));
  await screen.findByText("Shirt & Chinos");
  fireEvent.press(screen.getByRole("button", { name: "Open Shirt & Chinos" }));
  await screen.findByText("Tap any piece to swap it");

  const swapButtons = screen.getAllByRole("button", { name: "Swap" });
  fireEvent.press(swapButtons[swapButtons.length - 1]);  // the bottom row's Swap button
  await screen.findByText("Swap This Piece");
  expect(getSwapOptions).toHaveBeenCalledWith(
    { slots: { top: "top1", bottom: "bottom1" }, item_ids: ["top1", "bottom1"] }, "bottom1",
    { occasion: "any", style: "any", vibe: "any", weather: "any", colors: "any" });

  fireEvent.press(screen.getByLabelText("Use Jeans"));
  // The bottom slot now shows the chosen alternative; the top is untouched.
  await waitFor(() => expect(screen.getAllByText("Jeans").length).toBeGreaterThan(0));
  expect(screen.getAllByText("Shirt").length).toBeGreaterThan(0);
});
