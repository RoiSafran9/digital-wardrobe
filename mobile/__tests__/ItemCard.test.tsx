import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ItemCard } from "../src/components/ItemCard";
import type { RunItem } from "../src/api/types";

const baseItem: RunItem = {
  item_id: "item_0",
  tier: "high",
  reason: "ok",
  retake_instruction: null,
  facts: {
    category: { value: "shirt", confidence: 0.9, basis: "observed" },
    colors: { value: "blue", confidence: 0.9, basis: "observed" },
    pattern: { value: "solid", confidence: 0.9, basis: "observed" },
    visible_text: { value: "", confidence: 0.9, basis: "observed" },
    trims: { value: "", confidence: 0.9, basis: "observed" },
    visible_parts: { value: ["front"], confidence: 0.9, basis: "observed" },
    occluded_parts: { value: [], confidence: 0.9, basis: "observed" },
  },
  crop_url: "/images/r1/p1/item_0/crop.png",
  generated_url: "/images/r1/p1/item_0/generated.png",
};

test("shows tier badge and facts", () => {
  render(<ItemCard item={baseItem} />);
  expect(screen.getByText("Great")).toBeTruthy();
  expect(screen.getByText(/shirt/)).toBeTruthy();
  expect(screen.getByText(/blue/)).toBeTruthy();
});

test("shows retake instruction when present", () => {
  render(<ItemCard item={{ ...baseItem, tier: "low", retake_instruction: "Shoot it alone in better light" }} />);
  expect(screen.getByText(/Shoot it alone in better light/)).toBeTruthy();
});

test("omits retake instruction when absent", () => {
  render(<ItemCard item={baseItem} />);
  expect(screen.queryByText(/Shoot it alone/)).toBeNull();
});
