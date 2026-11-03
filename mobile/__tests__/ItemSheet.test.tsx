import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { ItemSheet } from "../src/components/ItemSheet";
import type { ClosetItem } from "../src/api/types";

const item: ClosetItem = {
  run_id: "20261015-214550-752",
  photo_name: "p",
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

test("shows the item's title, tier, date, and facts", async () => {
  await render(<ItemSheet items={[item]} index={0} onClose={() => {}} />);
  expect(screen.getByRole("header", { name: "Gray t-shirt" })).toBeTruthy();
  expect(screen.getByText("Great")).toBeTruthy();
  expect(screen.getByText("Tops · T-shirt · Added Oct 15")).toBeTruthy();
  expect(screen.getByText("Gray")).toBeTruthy();
  expect(screen.getByText("Black")).toBeTruthy();
  expect(screen.getByText("Solid")).toBeTruthy();
  expect(screen.getByText("Ribbed collar")).toBeTruthy();
});

test("hides the printed-text row when the item has no text", async () => {
  await render(<ItemSheet items={[item]} index={0} onClose={() => {}} />);
  expect(screen.queryByText("Text")).toBeNull();
});

test("the close button closes the sheet", async () => {
  const onClose = jest.fn();
  await render(<ItemSheet items={[item]} index={0} onClose={onClose} />);
  await fireEvent.press(screen.getByLabelText("Close"));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("renders nothing visible when there is no item", async () => {
  await render(<ItemSheet items={[item]} index={null} onClose={() => {}} />);
  expect(screen.queryByLabelText("Close")).toBeNull();
});

const shorts: ClosetItem = {
  ...item,
  item_id: "item_1",
  facts: { ...item.facts, category: { value: "shorts", confidence: 0.9, basis: "observed" } },
};
const jacket: ClosetItem = {
  ...item,
  item_id: "item_2",
  facts: { ...item.facts, category: { value: "jacket", confidence: 0.9, basis: "observed" } },
};

async function swipeTo(page: number) {
  const width = 400;
  await fireEvent(screen.getByTestId("item-pager"), "momentumScrollEnd", {
    nativeEvent: { contentOffset: { x: page * width, y: 0 }, layoutMeasurement: { width, height: 800 } },
  });
}

test("opens on the tapped item and shows its position", async () => {
  await render(<ItemSheet items={[item, shorts, jacket]} index={1} onClose={() => {}} />);
  expect(screen.getByText("2 / 3")).toBeTruthy();
});

test("swiping to another page updates the counter", async () => {
  await render(<ItemSheet items={[item, shorts, jacket]} index={0} onClose={() => {}} />);
  expect(screen.getByText("1 / 3")).toBeTruthy();
  await act(() => swipeTo(2));
  expect(screen.getByText("3 / 3")).toBeTruthy();
});

test("every item in the list is a swipeable page", async () => {
  await render(<ItemSheet items={[item, shorts, jacket]} index={0} onClose={() => {}} />);
  expect(screen.getByText("Gray t-shirt")).toBeTruthy();
  expect(screen.getByText("Gray shorts")).toBeTruthy();
  expect(screen.getByText("Gray jacket")).toBeTruthy();
});

test("hides the counter for a single item", async () => {
  await render(<ItemSheet items={[item]} index={0} onClose={() => {}} />);
  expect(screen.queryByText("1 / 1")).toBeNull();
});

test("facts sit in one grouped card with the title as a header", async () => {
  await render(<ItemSheet items={[item]} index={0} onClose={() => {}} />);
  expect(screen.getByRole("header", { name: "Gray t-shirt" })).toBeTruthy();
  expect(screen.getByTestId("facts-card")).toBeTruthy();
  expect(screen.queryByText("Material")).toBeNull();  // never guessed (spec D5)
});
