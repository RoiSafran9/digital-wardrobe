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

// Touches the way the responder system delivers them (PanResponder reads touchHistory). Slow and
// deliberate: no flick.
let clock = 1;
function touchAt(x: number, startX: number) {
  const t = (clock += 1000);
  return {
    nativeEvent: { touches: [], changedTouches: [], pageX: x, pageY: 0, timestamp: t },
    touchHistory: {
      numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: t,
      touchBank: [{
        touchActive: true, startPageX: startX, startPageY: 0, startTimeStamp: 0,
        currentPageX: x, currentPageY: 0, currentTimeStamp: t,
        previousPageX: startX, previousPageY: 0, previousTimeStamp: t - 1,
      }],
    },
  };
}

// Drags sideways across the image (negative = toward the next item). The swipe claims a touch only once
// it has moved (it never answers "start"), so the responder events go straight to its handlers, as
// they do on a phone once the move has been captured.
async function swipe(dx: number) {
  const from = 200;
  const pager = () => screen.getByTestId("item-pager").props;
  await act(async () => { pager().onResponderGrant(touchAt(from, from)); });
  await act(async () => { pager().onResponderMove(touchAt(from + dx, from)); });
  await act(async () => { pager().onResponderRelease(touchAt(from + dx, from)); });
}

test("opens on the tapped item and shows its position", async () => {
  await render(<ItemSheet items={[item, shorts, jacket]} index={1} onClose={() => {}} />);
  expect(screen.getByText("2 / 3")).toBeTruthy();
  expect(screen.getByRole("header", { name: "Gray shorts" })).toBeTruthy();
});

test("swiping the image moves through the list and updates the counter", async () => {
  await render(<ItemSheet items={[item, shorts, jacket]} index={0} onClose={() => {}} />);
  expect(screen.getByText("1 / 3")).toBeTruthy();
  await swipe(-100);
  expect(screen.getByText("2 / 3")).toBeTruthy();
  await swipe(-100);
  expect(screen.getByText("3 / 3")).toBeTruthy();
  await swipe(100);
  expect(screen.getByText("2 / 3")).toBeTruthy();
});

test("every item in the list can be reached by swiping", async () => {
  await render(<ItemSheet items={[item, shorts, jacket]} index={0} onClose={() => {}} />);
  expect(screen.getByRole("header", { name: "Gray t-shirt" })).toBeTruthy();
  await swipe(-100);
  expect(screen.getByRole("header", { name: "Gray shorts" })).toBeTruthy();
  await swipe(-100);
  expect(screen.getByRole("header", { name: "Gray jacket" })).toBeTruthy();
});

test("a short drag stays on the item, and the ends don't wrap around", async () => {
  await render(<ItemSheet items={[item, shorts]} index={0} onClose={() => {}} />);
  await swipe(-40);  // under the 60pt threshold
  expect(screen.getByText("1 / 2")).toBeTruthy();
  await swipe(100);  // nothing before the first item
  expect(screen.getByText("1 / 2")).toBeTruthy();
  await swipe(-100);
  await swipe(-100);  // nothing after the last
  expect(screen.getByText("2 / 2")).toBeTruthy();
});

test("the swipe only takes over sideways moves past 8pt, so taps and scrolls stay with the screen", async () => {
  await render(<ItemSheet items={[item, shorts]} index={0} onClose={() => {}} />);
  const wants = (dx: number, dy: number) => {
    const t = (clock += 1000);
    return screen.getByTestId("item-pager").props.onMoveShouldSetResponderCapture({
      nativeEvent: { touches: [], changedTouches: [] },
      touchHistory: { numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: t, touchBank: [{ touchActive: true, startPageX: 0, startPageY: 0, startTimeStamp: 0, currentPageX: dx, currentPageY: dy, currentTimeStamp: t, previousPageX: 0, previousPageY: 0, previousTimeStamp: t - 1 }] },
    });
  };
  // Each check starts a fresh gesture, as a new touch would.
  const fresh = () => screen.getByTestId("item-pager").props.onStartShouldSetResponderCapture({ nativeEvent: { touches: [{}], changedTouches: [] }, touchHistory: { numberActiveTouches: 1 } });
  fresh();
  expect(wants(5, 0)).toBe(false);
  fresh();
  expect(wants(12, 40)).toBe(false);
  fresh();
  expect(wants(12, 2)).toBe(true);
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
