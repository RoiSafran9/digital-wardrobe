import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import ClosetScreenBase from "../app/closet";
import { LastRunProvider } from "../src/store/lastRun";

function ClosetScreen() {
  return (
    <LastRunProvider>
      <ClosetScreenBase />
    </LastRunProvider>
  );
}
import { getItems, deleteItem } from "../src/api/client";
import { Alert } from "react-native";

jest.mock("../src/api/client");

// Tabs stay mounted, so the closet must reload whenever its tab regains focus.
let focusCallback: (() => void) | null = null;
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require("react");
    focusCallback = cb;
    useEffect(() => cb(), [cb]);
  },
}));
const mockedGetItems = getItems as jest.Mock;
const mockedDeleteItem = deleteItem as jest.Mock;

const fakeItem = {
  run_id: "r1", photo_name: "p1", item_id: "item_0", tier: "high",
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
};

const fakeShorts = {
  ...fakeItem,
  item_id: "item_1",
  facts: { ...fakeItem.facts, category: { value: "shorts", confidence: 0.9, basis: "observed" } },
};

beforeEach(() => {
  mockParams = {};
  jest.clearAllMocks();
  mockedGetItems.mockResolvedValue({ items: [fakeItem] });
});

test("fetches and displays items as thumbnails on mount", async () => {
  render(<ClosetScreen />);
  await waitFor(() => expect(mockedGetItems).toHaveBeenCalledTimes(1));
  expect(await screen.findByTestId("thumb-r1-item_0")).toBeTruthy();
});

test("tapping a thumbnail opens the detail view", async () => {
  render(<ClosetScreen />);
  const thumb = await screen.findByTestId("thumb-r1-item_0");
  fireEvent.press(thumb);
  expect(await screen.findByText("Great")).toBeTruthy();
});

test("the detail sheet's close button returns to the grid", async () => {
  render(<ClosetScreen />);
  fireEvent.press(await screen.findByTestId("thumb-r1-item_0"));
  fireEvent.press(await screen.findByLabelText("Close"));
  await waitFor(() => expect(screen.queryByLabelText("Close")).toBeNull());
});

test("category pills filter the grid", async () => {
  mockedGetItems.mockResolvedValue({ items: [fakeItem, fakeShorts] });
  render(<ClosetScreen />);
  expect(await screen.findByTestId("thumb-r1-item_1")).toBeTruthy();
  expect(screen.getByText("2 pieces")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "Shorts" }));
  await waitFor(() => expect(screen.queryByTestId("thumb-r1-item_0")).toBeNull());
  expect(screen.getByTestId("thumb-r1-item_1")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "All" }));
  expect(await screen.findByTestId("thumb-r1-item_0")).toBeTruthy();
});

test("shows an inviting empty state when the closet is empty", async () => {
  mockedGetItems.mockResolvedValue({ items: [] });
  render(<ClosetScreen />);
  expect(await screen.findByText("Your closet is empty")).toBeTruthy();
});

test("reloads items every time the closet tab regains focus", async () => {
  render(<ClosetScreen />);
  await waitFor(() => expect(mockedGetItems).toHaveBeenCalledTimes(1));
  await act(async () => focusCallback!());
  expect(mockedGetItems).toHaveBeenCalledTimes(2);
});

test("removing an item takes it off the grid and closes the sheet", async () => {
  const alertSpy = jest.spyOn(Alert, "alert");
  mockedDeleteItem.mockResolvedValue(undefined);
  mockedGetItems.mockResolvedValue({ items: [fakeItem, fakeShorts] });
  render(<ClosetScreen />);
  fireEvent.press(await screen.findByTestId("thumb-r1-item_0"));
  fireEvent.press((await screen.findAllByText("Remove from closet"))[0]);  // one per swipe page; first is the opened item
  await act(async () => {
    await alertSpy.mock.calls[0][2]!.find((b) => b.style === "destructive")!.onPress!();
  });

  await waitFor(() => expect(screen.queryByTestId("thumb-r1-item_0")).toBeNull());
  expect(screen.getByTestId("thumb-r1-item_1")).toBeTruthy();
  expect(screen.queryByLabelText("Close")).toBeNull();
});

test("opens filtered when Home sends a category", async () => {
  mockParams = { category: "shorts " };
  mockedGetItems.mockResolvedValue({ items: [fakeItem, fakeShorts] });
  render(<ClosetScreen />);
  expect(await screen.findByTestId("thumb-r1-item_1")).toBeTruthy();
  expect(screen.queryByTestId("thumb-r1-item_0")).toBeNull();
  expect(screen.getByRole("button", { name: "Shorts" }).props.accessibilityState).toEqual({ selected: true });
});

test("uses the iOS large title", async () => {
  render(<ClosetScreen />);
  expect(await screen.findByRole("header", { name: "Closet" })).toBeTruthy();
});

test("tapping the same Home chip again re-applies the filter after the user changed it", async () => {
  mockParams = { category: "Shorts", at: "1" };
  mockedGetItems.mockResolvedValue({ items: [fakeItem, fakeShorts] });
  const { rerender } = render(<ClosetScreen />);
  await screen.findByTestId("thumb-r1-item_1");
  fireEvent.press(screen.getByRole("button", { name: "All" }));
  expect(await screen.findByTestId("thumb-r1-item_0")).toBeTruthy();
  mockParams = { category: "Shorts", at: "2" };
  rerender(<ClosetScreen />);
  await waitFor(() => expect(screen.queryByTestId("thumb-r1-item_0")).toBeNull());
});

test("a category that no longer exists falls back to everything instead of a blank closet", async () => {
  mockParams = { category: "Jackets", at: "1" };
  mockedGetItems.mockResolvedValue({ items: [fakeItem, fakeShorts] });
  render(<ClosetScreen />);
  expect(await screen.findByTestId("thumb-r1-item_0")).toBeTruthy();
  expect(screen.getByRole("button", { name: "All" }).props.accessibilityState).toEqual({ selected: true });
});
