import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react-native";
import { JustAdded } from "../src/components/JustAdded";
import { LastRunProvider, useLastRun } from "../src/store/lastRun";
import { addBack } from "../src/api/client";
import { pickPhoto } from "../src/photoPicker";
import type { RunResponse } from "../src/api/types";

jest.mock("../src/api/client", () => ({ ...jest.requireActual("../src/api/client"), addBack: jest.fn() }));
jest.mock("../src/photoPicker", () => ({ pickPhoto: jest.fn() }));

const f = (value: string | string[]) => ({ value, confidence: 0.9, basis: "observed" as const });
const run: RunResponse = {
  run_id: "r1",
  quality: { status: "ok", reason: null },
  items: [{
    item_id: "item_0", photo_name: "p1", tier: "medium", reason: "ok",
    retake_instruction: "For a cleaner result, step back so the whole piece fits in the frame",
    facts: {
      category: f("t-shirt"), colors: f(["white"]), pattern: f("solid"), visible_text: f(""),
      trims: f(""), visible_parts: f(["front"]), occluded_parts: f(["back"]),
    },
    crop_url: "/c.png", generated_url: "/g.png",
  }],
  failed: [],
};

function Setter({ value }: { value: RunResponse }) {
  const { setLastRun } = useLastRun();
  React.useEffect(() => setLastRun(value), []);
  return null;
}

function renderWith(value: RunResponse | null, onChanged = jest.fn()) {
  return render(
    <LastRunProvider>
      {value ? <Setter value={value} /> : null}
      <JustAdded onClosetChanged={onChanged} />
    </LastRunProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

test("renders nothing before any capture", () => {
  renderWith(null);
  expect(screen.queryByText("Just added")).toBeNull();
});

test("lists the new pieces with their tip and an add-back action", async () => {
  renderWith(run);
  expect(await screen.findByText("Just added")).toBeTruthy();
  expect(screen.getByText("T-shirt")).toBeTruthy();
  expect(screen.getByText(/step back so the whole piece fits/)).toBeTruthy();
  expect(screen.getByLabelText("Add back photo")).toBeTruthy();
});

test("adding a back from the new pieces uploads to that item and refreshes the closet", async () => {
  const alertSpy = jest.spyOn(Alert, "alert");
  (pickPhoto as jest.Mock).mockResolvedValue("file:///back.jpg");
  (addBack as jest.Mock).mockImplementation(async (item) => ({
    ...item, back: { generated_url: "/b.png", cutout_url: null, visible_text: "" },
  }));
  const onChanged = jest.fn();
  renderWith(run, onChanged);

  fireEvent.press(await screen.findByLabelText("Add back photo"));
  await act(async () => {
    await alertSpy.mock.calls[0][2]!.find((b) => b.text === "Take photo")!.onPress!();
  });

  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect((addBack as jest.Mock).mock.calls[0][0]).toMatchObject({ run_id: "r1", photo_name: "p1", item_id: "item_0" });
  expect(await screen.findByText("Back added")).toBeTruthy();
});

test("a capture that found nothing explains how to retake", async () => {
  renderWith({ ...run, items: [] });
  expect(await screen.findByText(/No pieces found/)).toBeTruthy();
});

test("Done clears the section", async () => {
  renderWith(run);
  fireEvent.press(await screen.findByText("Done"));
  await waitFor(() => expect(screen.queryByText("Just added")).toBeNull());
});
