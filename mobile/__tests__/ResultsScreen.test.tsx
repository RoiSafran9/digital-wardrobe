import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { addBack } from "../src/api/client";
import { pickPhoto } from "../src/photoPicker";
import ResultsScreen from "../app/results";
import { LastRunProvider, useLastRun } from "../src/store/lastRun";
import type { RunResponse } from "../src/api/types";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../src/api/client", () => ({ ...jest.requireActual("../src/api/client"), addBack: jest.fn() }));
jest.mock("../src/photoPicker", () => ({ pickPhoto: jest.fn() }));

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
    item_id: "item_0", photo_name: "p1", tier: "high", reason: "ok", retake_instruction: null,
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

test("each new item can get a back photo right away", async () => {
  const alertSpy = jest.spyOn(Alert, "alert");
  (pickPhoto as jest.Mock).mockResolvedValue("file:///back.jpg");
  (addBack as jest.Mock).mockImplementation(async (item) => ({
    ...item, back: { generated_url: "/b.png", cutout_url: null, visible_text: "" },
  }));
  render(
    <LastRunProvider>
      <Setter run={fakeRun} />
      <ResultsScreen />
    </LastRunProvider>
  );

  fireEvent.press(await screen.findByText("Add back photo"));
  await act(async () => {
    await alertSpy.mock.calls[0][2]!.find((b) => b.text === "Take photo")!.onPress!();
  });

  await waitFor(() => expect(addBack).toHaveBeenCalled());
  const [sentItem, uri] = (addBack as jest.Mock).mock.calls[0];
  expect(sentItem).toMatchObject({ run_id: "r1", photo_name: "p1", item_id: "item_0" });
  expect(uri).toBe("file:///back.jpg");
  expect(await screen.findByText("Back added")).toBeTruthy();
});
