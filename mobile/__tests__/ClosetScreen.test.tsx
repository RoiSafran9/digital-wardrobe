import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import ClosetScreenBase from "../app/(tabs)/closet";
import { CaptureJobsProvider } from "../src/store/captureJobs";

function ClosetScreen() {
  return (
    <CaptureJobsProvider>
      <ClosetScreenBase />
    </CaptureJobsProvider>
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

  fireEvent.press(screen.getByRole("button", { name: "Bottoms" }));
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
  mockedDeleteItem.mockResolvedValue(undefined);
  mockedGetItems.mockResolvedValue({ items: [fakeItem, fakeShorts] });
  render(<ClosetScreen />);
  fireEvent.press(await screen.findByTestId("thumb-r1-item_0"));
  fireEvent.press((await screen.findAllByRole("button", { name: "Remove from closet" }))[0]);  // one per swipe page; first is the opened item
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Remove" })));

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
  expect(screen.getByRole("button", { name: "Bottoms" }).props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
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
  expect(screen.getByRole("button", { name: "All" }).props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
});

test("when the server can't be reached the closet says so and can retry, without crashing", async () => {
  mockedGetItems.mockRejectedValueOnce(new Error("Can't reach your wardrobe server.")).mockResolvedValueOnce({ items: [fakeItem] });
  render(<ClosetScreen />);
  expect(await screen.findByText(/Can't reach your wardrobe server/)).toBeTruthy();
  fireEvent.press(screen.getByText("Try again"));
  expect(await screen.findByTestId("thumb-r1-item_0")).toBeTruthy();
});

test("tiles with a finished 360 carry a 360 badge", async () => {
  const withTurn = { ...fakeItem, item_id: "item_1", turn: { state: "done", error: null, views: [] } };
  mockedGetItems.mockResolvedValue({ items: [fakeItem, withTurn] });
  render(<ClosetScreen />);
  expect(await screen.findByTestId("badge-360-r1-item_1")).toBeTruthy();
  expect(screen.queryByTestId("badge-360-r1-item_0")).toBeNull();
});

test("search narrows the grid and Clear Filters brings everything back", async () => {
  mockedGetItems.mockResolvedValue({ items: [fakeItem, fakeShorts] });
  render(<ClosetScreen />);
  await screen.findByTestId("thumb-r1-item_1");
  fireEvent.changeText(screen.getByLabelText("Search your closet"), "shorts");
  await waitFor(() => expect(screen.queryByTestId("thumb-r1-item_0")).toBeNull());
  fireEvent.changeText(screen.getByLabelText("Search your closet"), "nothing like this");
  fireEvent.press(await screen.findByRole("button", { name: "Clear Filters" }));
  expect(await screen.findByTestId("thumb-r1-item_0")).toBeTruthy();
  expect(screen.getByTestId("thumb-r1-item_1")).toBeTruthy();
});

test("a color swatch filters, and tapping it again clears it", async () => {
  const red = { ...fakeShorts, facts: { ...fakeShorts.facts, colors: { value: ["red"], confidence: 1, basis: "observed" } } };
  mockedGetItems.mockResolvedValue({ items: [fakeItem, red] });
  render(<ClosetScreen />);
  await screen.findByTestId("thumb-r1-item_1");
  fireEvent.press(screen.getByRole("checkbox", { name: "Red" }));
  await waitFor(() => expect(screen.queryByTestId("thumb-r1-item_0")).toBeNull());
  expect(screen.getByRole("checkbox", { name: "Red" }).props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
  fireEvent.press(screen.getByRole("checkbox", { name: "Red" }));
  expect(await screen.findByTestId("thumb-r1-item_0")).toBeTruthy();
});

test("tiles show the garment's name and its group and color", async () => {
  render(<ClosetScreen />);
  expect(await screen.findByText("Blue shirt")).toBeTruthy();
  expect(screen.getByText("Tops · Blue")).toBeTruthy();
});
