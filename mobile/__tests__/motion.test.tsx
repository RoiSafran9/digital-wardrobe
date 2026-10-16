import React from "react";
import { AccessibilityInfo, Text } from "react-native";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { Rise } from "../src/motion/Rise";
import { PressScale } from "../src/motion/PressScale";

afterEach(() => jest.restoreAllMocks());

test("Rise renders its content", () => {
  render(<Rise><Text>Hello</Text></Rise>);
  expect(screen.getByText("Hello")).toBeTruthy();
});

test("Rise drops movement under Reduce Motion", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  render(<Rise testID="r"><Text>Hi</Text></Rise>);
  await waitFor(() =>
    expect(screen.getByTestId("r").props.style).toEqual(expect.objectContaining({ transform: [{ translateY: 0 }] }))
  );
});

test("PressScale calls onPress and exposes its role", () => {
  const onPress = jest.fn();
  render(<PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Open"><Text>x</Text></PressScale>);
  fireEvent.press(screen.getByRole("button", { name: "Open" }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
