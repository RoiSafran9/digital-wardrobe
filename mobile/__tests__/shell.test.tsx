import React from "react";
import { render, screen } from "@testing-library/react-native";
import CaptureScreen from "../app/index";
import ResultsScreen from "../app/results";
import ClosetScreen from "../app/closet";

test("capture screen renders placeholder", () => {
  render(<CaptureScreen />);
  expect(screen.getByText("Capture")).toBeTruthy();
});

test("results screen renders placeholder", () => {
  render(<ResultsScreen />);
  expect(screen.getByText("Results")).toBeTruthy();
});

test("closet screen renders placeholder", () => {
  render(<ClosetScreen />);
  expect(screen.getByText("Closet")).toBeTruthy();
});
