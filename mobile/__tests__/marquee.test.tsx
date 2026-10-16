import React from "react";
import { AccessibilityInfo, Text } from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Marquee } from "../src/motion/Marquee";

afterEach(() => jest.restoreAllMocks());

test("repeats a short list so the row never shows a gap", () => {
  render(<Marquee items={["a"]} itemWidth={100} renderItem={(x, i) => <Text key={i}>{x}</Text>} />);
  // 1 item at 100pt + gap must still cover two widths of a 390pt screen.
  expect(screen.getAllByText("a").length).toBeGreaterThanOrEqual(8);
});

test("renders nothing for an empty list", () => {
  render(<Marquee items={[]} itemWidth={100} renderItem={(x: string) => <Text>{x}</Text>} testID="m" />);
  expect(screen.queryByTestId("m")).toBeNull();
});

test("stays still under Reduce Motion", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  render(<Marquee items={["a", "b"]} itemWidth={100} renderItem={(x, i) => <Text key={i}>{x}</Text>} testID="m" />);
  await waitFor(() =>
    expect(screen.getByTestId("m-track").props.style).toEqual(expect.objectContaining({ transform: [{ translateX: 0 }] }))
  );
});
