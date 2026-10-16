import React from "react";
import { AccessibilityInfo } from "react-native";
import { render, screen, act, waitFor } from "@testing-library/react-native";
import { CountUp } from "../src/motion/CountUp";

afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test("lands on the final value", async () => {
  jest.useFakeTimers();
  render(<CountUp value={38} testID="c" />);
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByTestId("c")).toHaveTextContent("38");
});

test("shows the final value at once under Reduce Motion", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  render(<CountUp value={12} testID="c" />);
  await waitFor(() => expect(screen.getByTestId("c")).toHaveTextContent("12"));
});
