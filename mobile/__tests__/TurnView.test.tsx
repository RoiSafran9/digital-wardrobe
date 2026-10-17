import React from "react";
import { Image } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { TurnView } from "../src/components/TurnView";
import { API_BASE_URL } from "../src/api/client";

const views = ["Front", "Right side", "Back", "Left side"].map((label, i) => ({
  label, path: `/turn/${i}.png`, cutoutPath: `/turn/${i}_cutout.png`,
}));

function turner() {
  return screen.getByLabelText("360 view");
}

test("starts on the first view and names it for VoiceOver", () => {
  render(<TurnView views={views} />);
  expect(turner().props.accessibilityValue).toEqual({ text: "Front" });
  expect(turner().props.accessibilityRole).toBe("adjustable");
});

test("tap steps to the next view and wraps around", () => {
  render(<TurnView views={views} />);
  for (let i = 0; i < 4; i++) fireEvent.press(turner());
  expect(turner().props.accessibilityValue).toEqual({ text: "Front" });
  fireEvent.press(turner());
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

test("shows dots and the label", () => {
  render(<TurnView views={views} label="360 · AI view" />);
  expect(screen.getByText("360 · AI view")).toBeTruthy();
  expect(screen.getAllByTestId(/^turn-dot-/)).toHaveLength(4);
});
