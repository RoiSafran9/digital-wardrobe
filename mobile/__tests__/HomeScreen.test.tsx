import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import HomeScreen from "../app/(tabs)/index";
import { LastRunProvider } from "../src/store/lastRun";
import { getItems, postRun, updateItem } from "../src/api/client";
import { pickPhoto } from "../src/photoPicker";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => void) => { const { useEffect } = require("react"); useEffect(() => cb(), [cb]); },
}));
jest.mock("../src/api/client", () => ({ ...jest.requireActual("../src/api/client"), getItems: jest.fn(), postRun: jest.fn(), updateItem: jest.fn() }));
jest.mock("../src/photoPicker", () => ({ pickPhoto: jest.fn() }));

beforeAll(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 16), doNotFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "nextTick", "setImmediate", "queueMicrotask"] });
});
afterAll(() => jest.useRealTimers());

const f = (v: string | string[]) => ({ value: v, confidence: 1, basis: "observed" as const });
const item = (id: string, cat: string, colors: string[]) => ({
  run_id: "20261016-1", photo_name: "p", item_id: id, tier: "high",
  facts: { category: f(cat), colors: f(colors), pattern: f("solid"), visible_text: f(""), trims: f(""),
           visible_parts: f([]), occluded_parts: f([]) },
  crop_url: "/c.png", generated_url: "/g.png", cutout_url: "/x.png", back: null,
});

function renderHome() {
  return render(<LastRunProvider><HomeScreen /></LastRunProvider>);
}

beforeEach(() => jest.clearAllMocks());

test("shows the closet at a glance: title, counts and category chips", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "t-shirt", ["gray"]), item("item_1", "shorts", ["navy"]), item("item_2", "T-shirt", ["navy"])] });
  renderHome();
  expect(screen.getByText("Wardrobe")).toBeTruthy();
  expect(await screen.findByText("3 pieces · 3 added this week")).toBeTruthy();
  expect(screen.getByLabelText("Pieces, 3")).toBeTruthy();  // VoiceOver hears the number, not just the label
  expect(screen.getByRole("button", { name: "T-shirt, 2" })).toBeTruthy();
});

test("a category chip opens the closet filtered to it", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shorts", ["navy"])] });
  renderHome();
  fireEvent.press(await screen.findByRole("button", { name: "Shorts, 1" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/closet", params: expect.objectContaining({ category: "Shorts", at: expect.any(String) }) });
});

test("an empty closet invites the first photo instead of empty rows", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  renderHome();
  expect(await screen.findByText("Start your closet")).toBeTruthy();
  expect(screen.getByText("Take photo")).toBeTruthy();
  expect(screen.queryByLabelText(/^Pieces/)).toBeNull();
});

test("when the server can't be reached it says so, offers a retry, and still lets you add", async () => {
  (getItems as jest.Mock).mockRejectedValueOnce(new Error("Can't reach your wardrobe server."))
    .mockResolvedValueOnce({ items: [item("item_0", "shorts", ["navy"])] });
  renderHome();
  expect(await screen.findByText(/Can't reach your wardrobe server/)).toBeTruthy();
  expect(screen.getByText("Take photo")).toBeTruthy();
  fireEvent.press(screen.getByText("Try again"));
  expect(await screen.findByText("1 piece · 1 added this week")).toBeTruthy();
});

test("quick add starts the capture right from Home", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  (pickPhoto as jest.Mock).mockResolvedValue(null);
  renderHome();
  fireEvent.press(await screen.findByText("Choose from library"));
  await waitFor(() => expect(pickPhoto).toHaveBeenCalledWith(false));
});

test("editing a garment opened from Home shows the new value in the open sheet", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shirt", ["gray"])] });
  (updateItem as jest.Mock).mockImplementation(async (it) => ({ ...it, facts: { ...it.facts, category: f("blouse") } }));
  renderHome();
  fireEvent.press((await screen.findAllByLabelText("Open shirt"))[0]);
  fireEvent.press(screen.getByLabelText("Edit"));
  fireEvent.changeText(screen.getByLabelText("Type"), "blouse");
  fireEvent.press(screen.getByText("Save"));
  expect(await screen.findByRole("header", { name: "Blouse" })).toBeTruthy();
});

test("the sheet from Home pages through the whole closet, not half of it", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shirt", []), item("item_1", "pants", []), item("item_2", "shorts", []), item("item_3", "dress", [])] });
  renderHome();
  fireEvent.press((await screen.findAllByLabelText("Open pants"))[0]);
  expect(screen.getByText("2 / 4")).toBeTruthy();
});

test("a capture started on Home refreshes Home's counts", async () => {
  (getItems as jest.Mock).mockResolvedValueOnce({ items: [item("item_0", "shirt", [])] })
    .mockResolvedValue({ items: [item("item_0", "shirt", []), item("item_1", "pants", [])] });
  (pickPhoto as jest.Mock).mockResolvedValue("file:///p.jpg");
  (postRun as jest.Mock).mockResolvedValue({ run_id: "r2", quality: { status: "ok", reason: null }, items: [], failed: [] });
  renderHome();
  expect(await screen.findByText("1 piece · 1 added this week")).toBeTruthy();
  fireEvent.press(screen.getByText("Take photo"));
  expect(await screen.findByText("2 pieces · 2 added this week")).toBeTruthy();
});
