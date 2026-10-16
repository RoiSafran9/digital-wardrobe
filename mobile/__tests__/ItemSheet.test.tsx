import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ItemSheet } from "../src/components/ItemSheet";
import type { ClosetItem } from "../src/api/types";

const item: ClosetItem = {
  run_id: "20261015-214550-752",
  item_id: "item_0",
  tier: "high",
  facts: {
    category: { value: "t-shirt", confidence: 0.9, basis: "observed" },
    colors: { value: ["gray", "black"], confidence: 0.9, basis: "observed" },
    pattern: { value: "solid", confidence: 0.9, basis: "observed" },
    visible_text: { value: "", confidence: 0.9, basis: "observed" },
    trims: { value: "ribbed collar", confidence: 0.9, basis: "observed" },
    visible_parts: { value: ["front"], confidence: 0.9, basis: "observed" },
    occluded_parts: { value: [], confidence: 0.9, basis: "observed" },
  },
  crop_url: "/images/r/p/item_0/crop.png",
  generated_url: "/images/r/p/item_0/generated.png",
};

test("shows the item's title, tier, date, and facts", () => {
  render(<ItemSheet item={item} onClose={() => {}} />);
  expect(screen.getByText("T-shirt")).toBeTruthy();
  expect(screen.getByText("Great")).toBeTruthy();
  expect(screen.getByText("Added Oct 15")).toBeTruthy();
  expect(screen.getByText("Gray")).toBeTruthy();
  expect(screen.getByText("Black")).toBeTruthy();
  expect(screen.getByText("Solid")).toBeTruthy();
  expect(screen.getByText("Ribbed collar")).toBeTruthy();
});

test("hides the printed-text row when the item has no text", () => {
  render(<ItemSheet item={item} onClose={() => {}} />);
  expect(screen.queryByText("Text")).toBeNull();
});

test("the close button closes the sheet", () => {
  const onClose = jest.fn();
  render(<ItemSheet item={item} onClose={onClose} />);
  fireEvent.press(screen.getByLabelText("Close"));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("renders nothing visible when there is no item", () => {
  render(<ItemSheet item={null} onClose={() => {}} />);
  expect(screen.queryByLabelText("Close")).toBeNull();
});
