import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { Dimensions } from "react-native";
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

// The image is a native horizontal paging list: a swipe ends with the list resting on a page.
async function swipeTo(page: number) {
  const width = Dimensions.get("window").width;
  await fireEvent(screen.getByTestId("item-pager"), "momentumScrollEnd", { nativeEvent: { contentOffset: { x: page * width, y: 0 } } });
}

test("opens on the tapped item and shows its position", async () => {
  await render(<ItemSheet items={[item, shorts, jacket]} index={1} onClose={() => {}} />);
  expect(screen.getByText("2 / 3")).toBeTruthy();
  expect(screen.getByRole("header", { name: "Gray shorts" })).toBeTruthy();
});

test("swiping the image moves through the list and updates the counter", async () => {
  await render(<ItemSheet items={[item, shorts, jacket]} index={0} onClose={() => {}} />);
  expect(screen.getByText("1 / 3")).toBeTruthy();
  await swipeTo(1);
  expect(screen.getByText("2 / 3")).toBeTruthy();
  expect(screen.getByRole("header", { name: "Gray shorts" })).toBeTruthy();
  await swipeTo(2);
  expect(screen.getByText("3 / 3")).toBeTruthy();
  expect(screen.getByRole("header", { name: "Gray jacket" })).toBeTruthy();
  await swipeTo(1);
  expect(screen.getByText("2 / 3")).toBeTruthy();
});

test("the pager opens on the tapped item and pages one item per screen width", async () => {
  await render(<ItemSheet items={[item, shorts, jacket]} index={1} onClose={() => {}} />);
  const list = screen.getByTestId("item-pager").props;
  expect(list.horizontal).toBe(true);
  expect(list.pagingEnabled).toBe(true);
  expect(list.initialScrollIndex).toBe(1);
  expect(list.scrollEnabled).toBe(true);
  await swipeTo(1);  // came to rest on the same page: nothing changes
  expect(screen.getByText("2 / 3")).toBeTruthy();
});

test("VoiceOver moves between items from the counter", async () => {
  await render(<ItemSheet items={[item, shorts, jacket]} index={0} onClose={() => {}} />);
  const counter = () => screen.getByLabelText("Item");
  expect(counter().props.accessibilityValue).toEqual({ text: "1 of 3" });
  await fireEvent(counter(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
  expect(counter().props.accessibilityValue).toEqual({ text: "2 of 3" });
  expect(screen.getByRole("header", { name: "Gray shorts" })).toBeTruthy();
  await fireEvent(counter(), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
  expect(screen.getByRole("header", { name: "Gray t-shirt" })).toBeTruthy();
});

test("hides the counter for a single item", async () => {
  await render(<ItemSheet items={[item]} index={0} onClose={() => {}} />);
  expect(screen.queryByText("1 / 1")).toBeNull();
});

test("facts sit in one row of chips with the title as a header", async () => {
  await render(<ItemSheet items={[item]} index={0} onClose={() => {}} />);
  expect(screen.getByRole("header", { name: "Gray t-shirt" })).toBeTruthy();
  expect(screen.getByTestId("facts-card")).toBeTruthy();
  expect(screen.queryByText("Material")).toBeNull();  // never guessed (spec D5)
});
