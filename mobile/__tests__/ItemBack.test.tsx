import React from "react";
import { Alert, Image } from "react-native";
import { mockActionSheet } from "./helpers/actionSheet";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { ItemSheet } from "../src/components/ItemSheet";
import { addBack, API_BASE_URL } from "../src/api/client";
import { pickPhoto } from "../src/photoPicker";
import type { ClosetItem } from "../src/api/types";
import { ToastProvider } from "../src/ui";

jest.mock("../src/api/client", () => ({ ...jest.requireActual("../src/api/client"), addBack: jest.fn() }));
jest.mock("../src/photoPicker", () => ({ pickPhoto: jest.fn() }));
const mockedAddBack = addBack as jest.Mock;
const mockedPick = pickPhoto as jest.Mock;

const f = (value: string | string[]) => ({ value, confidence: 0.9, basis: "observed" as const });
const front: ClosetItem = {
  run_id: "20261016-104633-249", photo_name: "p", item_id: "item_0", tier: "high",
  facts: {
    category: f("hoodie"), colors: f(["gray"]), pattern: f("solid"), visible_text: f(""),
    trims: f(""), visible_parts: f(["front"]), occluded_parts: f(["back"]),
  },
  crop_url: "/front/crop.png", generated_url: "/front/generated.png", cutout_url: "/front/cutout.png", back: null,
};
const withBack: ClosetItem = {
  ...front, back: { generated_url: "/back/generated.png", cutout_url: "/back/cutout.png", visible_text: "TEAM 9" },
};

function shownImage() {
  return screen.UNSAFE_getAllByType(Image)[0].props.source.uri;
}

beforeEach(() => jest.clearAllMocks());

test("offers to add a back only for closet items without one", () => {
  const { rerender } = render(<ItemSheet items={[front]} index={0} onClose={() => {}} />);
  expect(screen.queryByRole("button", { name: "Add Back Image" })).toBeNull();  // read-only results view
  expect(screen.queryByRole("tab", { name: "Back" })).toBeNull();
  rerender(<ItemSheet items={[front]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  expect(screen.getByRole("button", { name: "Add Back Image" })).toBeTruthy();
  fireEvent.press(screen.getByRole("tab", { name: "Back" }));
  expect(screen.getByText("No back image yet")).toBeTruthy();
  rerender(<ItemSheet items={[withBack]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  expect(screen.queryByRole("button", { name: "Add Back Image" })).toBeNull();
});

test("front/back tabs switch the image and show the back's text", () => {
  render(<ItemSheet items={[withBack]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  expect(shownImage()).toBe(`${API_BASE_URL}/front/cutout.png`);
  fireEvent.press(screen.getByRole("tab", { name: "Back" }));
  expect(shownImage()).toBe(`${API_BASE_URL}/back/cutout.png`);
  expect(screen.getByText("“TEAM 9”")).toBeTruthy();
  fireEvent.press(screen.getByRole("tab", { name: "Front" }));
  expect(shownImage()).toBe(`${API_BASE_URL}/front/cutout.png`);
});

test("adding a back picks a photo, uploads it, reports the updated item and says it's ready", async () => {
  const sheet = mockActionSheet();
  mockedPick.mockResolvedValue("file:///back.jpg");
  mockedAddBack.mockResolvedValue(withBack);
  const onUpdated = jest.fn();
  render(<ToastProvider><ItemSheet items={[front]} index={0} onClose={() => {}} onUpdated={onUpdated} onDeleted={() => {}} /></ToastProvider>);

  fireEvent.press(screen.getByRole("button", { name: "Add Back Image" }));
  await act(async () => { await sheet.choose("Take photo"); });

  expect(mockedPick).toHaveBeenCalledWith(true);
  await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(withBack));
  expect(mockedAddBack).toHaveBeenCalledWith(front, "file:///back.jpg");
  expect(screen.getByText("✓ Back image ready")).toBeTruthy();
});

test("a rejected back photo shows the server's instruction", async () => {
  const sheet = mockActionSheet();
  mockedPick.mockResolvedValue("file:///back.jpg");
  mockedAddBack.mockRejectedValue(new Error("Part of this piece is outside the photo — step back"));
  render(<ItemSheet items={[front]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);

  fireEvent.press(screen.getByRole("button", { name: "Add Back Image" }));
  await act(async () => { await sheet.choose("Choose from library"); });

  expect(await screen.findByText(/step back/)).toBeTruthy();
});

test("cancelling the picker uploads nothing", async () => {
  const sheet = mockActionSheet();
  mockedPick.mockResolvedValue(null);
  render(<ItemSheet items={[front]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  fireEvent.press(screen.getByRole("button", { name: "Add Back Image" }));
  await act(async () => { await sheet.choose("Take photo"); });
  expect(mockedAddBack).not.toHaveBeenCalled();
});

describe("with billing on", () => {
  const { CreditsContext } = require("../src/credits/CreditsProvider");
  const wallet = (available: number) => ({ balance: available, held: 0, available, granted: 10, used: 0, entries: [], next_before: null });
  const billed = (available: number) => render(
    <CreditsContext.Provider value={{ billing: true, prices: { back: 1 }, credits: wallet(available), refresh: jest.fn(async () => {}) }}>
      <ItemSheet items={[front]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />
    </CreditsContext.Provider>,
  );
  afterEach(() => jest.restoreAllMocks());

  test("the back's price is confirmed before choosing a photo", () => {
    const sheet = mockActionSheet();
    billed(4);
    expect(screen.getByText("1 credit")).toBeTruthy();  // price in the actions list
    fireEvent.press(screen.getByRole("button", { name: "Add Back Image" }));
    expect(sheet.spy).not.toHaveBeenCalled();
    expect(screen.getByText("Balance 4 → 3")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Continue · 1 credit" }));
    expect(sheet.spy.mock.calls[0][0].message).toBe("Lay the item flat, back side up. Uses 1 credit · 4 available.");
  });

  test("without credits the back explains instead of opening the camera", () => {
    const sheet = mockActionSheet();
    billed(0);
    fireEvent.press(screen.getByRole("button", { name: "Add Back Image" }));
    expect(sheet.spy).not.toHaveBeenCalled();
    expect(screen.getByText("Not enough credits")).toBeTruthy();
    expect(screen.getByText(/Ask the app owner for more credits\./)).toBeTruthy();
  });

  test("a server 'not enough credits' answer opens the same explanation", async () => {
    const sheet = mockActionSheet();
    const { NO_CREDITS } = require("../src/api/v1");
    mockedPick.mockResolvedValue("file:///back.jpg");
    mockedAddBack.mockRejectedValue(new Error(NO_CREDITS));
    billed(4);
    fireEvent.press(screen.getByRole("button", { name: "Add Back Image" }));
    fireEvent.press(screen.getByRole("button", { name: "Continue · 1 credit" }));
    await act(async () => { await sheet.choose("Take photo"); });
    expect(await screen.findByText("Not enough credits")).toBeTruthy();
  });
});
