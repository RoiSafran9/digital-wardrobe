import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import ClosetScreen from "../app/closet";
import { getItems } from "../src/api/client";

jest.mock("../src/api/client");
const mockedGetItems = getItems as jest.Mock;

const fakeItem = {
  run_id: "r1", item_id: "item_0", tier: "high",
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

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetItems.mockResolvedValue({ items: [fakeItem] });
});

test("fetches and displays items as thumbnails on mount", async () => {
  render(<ClosetScreen />);
  await waitFor(() => expect(mockedGetItems).toHaveBeenCalledTimes(1));
  expect(await screen.findByTestId("thumb-r1-item_0")).toBeTruthy();
});

test("tapping a thumbnail opens the detail view", async () => {
  render(<ClosetScreen />);
  const thumb = await screen.findByTestId("thumb-r1-item_0");
  fireEvent.press(thumb);
  expect(await screen.findByText("Great")).toBeTruthy();
});
