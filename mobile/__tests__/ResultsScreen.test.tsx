import React from "react";
import { render, screen } from "@testing-library/react-native";
import ResultsScreen from "../app/results";
import { LastRunProvider, useLastRun } from "../src/store/lastRun";
import type { RunResponse } from "../src/api/types";

function Setter({ run }: { run: RunResponse }) {
  const { setLastRun } = useLastRun();
  React.useEffect(() => {
    setLastRun(run);
  }, []);
  return null;
}

const fakeRun: RunResponse = {
  run_id: "r1",
  quality: { status: "ok", reason: null },
  items: [{
    item_id: "item_0", tier: "high", reason: "ok", retake_instruction: null,
    facts: {
      category: { value: "shirt", confidence: 0.9, basis: "observed" },
      colors: { value: "blue", confidence: 0.9, basis: "observed" },
      pattern: { value: "solid", confidence: 0.9, basis: "observed" },
      visible_text: { value: "", confidence: 0.9, basis: "observed" },
      trims: { value: "", confidence: 0.9, basis: "observed" },
      visible_parts: { value: ["front"], confidence: 0.9, basis: "observed" },
      occluded_parts: { value: [], confidence: 0.9, basis: "observed" },
    },
    crop_url: "/images/r1/p1/item_0/crop.png",
    generated_url: "/images/r1/p1/item_0/generated.png",
  }],
  failed: ["item_1"],
};

test("shows the empty state when there's no run yet", () => {
  render(
    <LastRunProvider>
      <ResultsScreen />
    </LastRunProvider>
  );
  expect(screen.getByText(/no run yet/i)).toBeTruthy();
});

test("renders an ItemCard per item and a failed-items footer", async () => {
  render(
    <LastRunProvider>
      <Setter run={fakeRun} />
      <ResultsScreen />
    </LastRunProvider>
  );
  expect(await screen.findByText("Great")).toBeTruthy();
  expect(await screen.findByText(/1 item\(s\) failed to process/)).toBeTruthy();
});
