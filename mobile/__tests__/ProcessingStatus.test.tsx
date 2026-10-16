import React from "react";
import { render, screen, act } from "@testing-library/react-native";
import { ProcessingStatus } from "../src/components/ProcessingStatus";

const steps = [
  { label: "Finding your pieces", at: 0 },
  { label: "Smoothing them out", at: 6 },
  { label: "Cutting them out", at: 20 },
];

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("advances through the stages as time passes and asks to keep the app open", () => {
  render(<ProcessingStatus steps={steps} note="Keep the app open" />);
  expect(screen.getByText("Finding your pieces")).toBeTruthy();
  expect(screen.getByText("Keep the app open")).toBeTruthy();

  act(() => jest.advanceTimersByTime(7000));
  expect(screen.getByText("Smoothing them out")).toBeTruthy();

  act(() => jest.advanceTimersByTime(14000));
  expect(screen.getByText("Cutting them out")).toBeTruthy();
});

test("stays on the last stage instead of running out", () => {
  render(<ProcessingStatus steps={steps} note="" />);
  act(() => jest.advanceTimersByTime(120000));
  expect(screen.getByText("Cutting them out")).toBeTruthy();
  expect(screen.getByRole("progressbar")).toBeTruthy();
});
