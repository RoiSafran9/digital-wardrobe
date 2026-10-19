import React from "react";
import { Image } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { TurnView } from "../src/components/TurnView";
import { API_BASE_URL } from "../src/api/client";
import { haptics } from "../src/haptics";

jest.mock("../src/haptics", () => ({ haptics: { success: jest.fn(), light: jest.fn() } }));

const views = ["Front", "Right side", "Back", "Left side"].map((label, i) => ({
  label, path: `/turn/${i}.png`, cutoutPath: `/turn/${i}_cutout.png`,
}));

function turner() {
  return screen.getByLabelText("360 view");
}

// Touches the way the responder system delivers them (PanResponder reads touchHistory).
let clock = 1;
function touchAt(x: number, startX: number) {
  const t = (clock += 1000);   // slow, deliberate drags: no fling
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

function drag(fromX: number, toX: number) {
  fireEvent(turner(), "responderGrant", touchAt(fromX, fromX));
  if (toX !== fromX) fireEvent(turner(), "responderMove", touchAt(toX, fromX));
  fireEvent(turner(), "responderRelease", touchAt(toX, fromX));
}

const tap = () => drag(100, 100);

test("starts on the first view and names it for VoiceOver", () => {
  render(<TurnView views={views} />);
  expect(turner().props.accessibilityValue).toEqual({ text: "Front" });
  expect(turner().props.accessibilityRole).toBe("adjustable");
});

test("tap steps to the next view and wraps around", () => {
  render(<TurnView views={views} />);
  for (let i = 0; i < 4; i++) tap();
  expect(turner().props.accessibilityValue).toEqual({ text: "Front" });
  tap();
  expect(turner().props.accessibilityValue).toEqual({ text: "Right side" });
});

test("VoiceOver increment and decrement turn the garment", () => {
  render(<TurnView views={views} />);
  fireEvent(turner(), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
  expect(turner().props.accessibilityValue).toEqual({ text: "Left side" });
  fireEvent(turner(), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
  expect(turner().props.accessibilityValue).toEqual({ text: "Front" });
});

test("all views are loaded up front so turning never waits on the network", () => {
  render(<TurnView views={views} />);
  const uris = screen.UNSAFE_getAllByType(Image).map((img) => img.props.source.uri);
  expect(uris).toEqual(views.map((v) => `${API_BASE_URL}${v.cutoutPath}`));
});

test("shows the angle pill, the drag hint and the AI label", () => {
  render(<TurnView views={views} label="360 · AI view" />);
  expect(screen.getByText("Drag to rotate · 360 · AI view")).toBeTruthy();
  expect(screen.getByTestId("turn-angle")).toBeTruthy();
});

test("the arrow buttons turn the garment both ways", () => {
  render(<TurnView views={views} />);
  fireEvent.press(screen.getByRole("button", { name: "Turn right" }));
  expect(turner().props.accessibilityValue).toEqual({ text: views[1].label });
  fireEvent.press(screen.getByRole("button", { name: "Turn left" }));
  fireEvent.press(screen.getByRole("button", { name: "Turn left" }));
  expect(turner().props.accessibilityValue).toEqual({ text: views[3].label });
});

test("the view claims touches so its own handlers run, not a press handler", () => {
  render(<TurnView views={views} />);
  expect(turner().props.onStartShouldSetResponder()).toBe(true);
  expect(turner().props.onPress).toBeUndefined();
});

test("dragging left one step turns to the next view; a short drag snaps back", () => {
  render(<TurnView views={views} />);
  drag(200, 110);                               // 90pt left = one view
  expect(turner().props.accessibilityValue).toEqual({ text: "Right side" });
  drag(200, 180);                               // 20pt: not enough, stays
  expect(turner().props.accessibilityValue).toEqual({ text: "Right side" });
  drag(100, 190);                               // 90pt right = back one view
  expect(turner().props.accessibilityValue).toEqual({ text: "Front" });
});

test("tells its parent while a drag is active, so the pager can stop scrolling", () => {
  const onDragActive = jest.fn();
  render(<TurnView views={views} onDragActive={onDragActive} />);
  fireEvent(turner(), "responderGrant", touchAt(200, 200));
  expect(onDragActive).toHaveBeenLastCalledWith(true);
  fireEvent(turner(), "responderMove", touchAt(150, 200));
  fireEvent(turner(), "responderRelease", touchAt(150, 200));
  expect(onDragActive).toHaveBeenLastCalledWith(false);
});

test("a drag taken away by the system settles on a view", () => {
  render(<TurnView views={views} />);
  fireEvent(turner(), "responderGrant", touchAt(200, 200));
  fireEvent(turner(), "responderMove", touchAt(100, 200));
  fireEvent(turner(), "responderTerminate", touchAt(100, 200));
  expect(turner().props.accessibilityValue).toEqual({ text: "Right side" });
});

test("a quick flick keeps the garment spinning past the next side", () => {
  render(<TurnView views={views} />);
  const at = (x: number, t: number, prevX: number) => ({
    nativeEvent: { touches: [], changedTouches: [] },
    touchHistory: {
      numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: t,
      touchBank: [{ touchActive: true, startPageX: 300, startPageY: 0, startTimeStamp: 0,
        currentPageX: x, currentPageY: 0, currentTimeStamp: t, previousPageX: prevX, previousPageY: 0, previousTimeStamp: t - 10 }],
    },
  });
  const base = (clock += 1000);
  fireEvent(turner(), "responderGrant", at(300, base, 300));
  // PanResponder measures speed from the second move on, as with a real finger.
  fireEvent(turner(), "responderMove", at(296, base + 5, 300));
  fireEvent(turner(), "responderMove", at(290, base + 15, 296));   // only 10pt, but fast
  fireEvent(turner(), "responderRelease", at(290, base + 15, 296));
  // A slow 10pt drag would settle back on Front; the flick carries it two sides round.
  expect(turner().props.accessibilityValue).toEqual({ text: "Back" });
});

test("turning is silent: no vibration on drags, flicks or taps", () => {
  render(<TurnView views={views} />);
  drag(200, 110);
  drag(100, 190);
  tap();
  for (const fn of Object.values(haptics)) expect(fn).not.toHaveBeenCalled();
});
