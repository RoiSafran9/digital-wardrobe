import React from "react";
import { render, screen } from "@testing-library/react-native";
import { TierBadge } from "../src/components/TierBadge";

test.each([
  ["high", "Great"],
  ["medium", "OK"],
  ["low", "Retake"],
] as const)("renders label %s -> %s", (tier, label) => {
  render(<TierBadge tier={tier} />);
  expect(screen.getByText(label)).toBeTruthy();
});
