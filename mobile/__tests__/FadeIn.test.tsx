import React from "react";
import { AccessibilityInfo, Text } from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";
import { FadeIn } from "../src/components/FadeIn";

test("renders its content", () => {
  render(<FadeIn><Text>Hello</Text></FadeIn>);
  expect(screen.getByText("Hello")).toBeTruthy();
});

test("drops movement when the system asks for reduced motion", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  render(<FadeIn offset={8} testID="fade"><Text>Hi</Text></FadeIn>);
  await waitFor(() =>
    expect(screen.getByTestId("fade").props.style).toEqual(
      expect.objectContaining({ transform: [{ translateY: 0 }] })
    )
  );
});
