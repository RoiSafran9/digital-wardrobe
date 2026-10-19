import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import HomeScreen from "../app/(tabs)/index";
import { LastRunProvider } from "../src/store/lastRun";
import { getItems, postRun, updateItem } from "../src/api/client";
import { pickPhoto } from "../src/photoPicker";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";

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

function renderHome(credits: Partial<CreditsValue> = {}) {
  const value: CreditsValue = { billing: false, prices: {}, credits: null, outfit: false, refresh: jest.fn(async () => {}), ...credits };
  return render(<CreditsContext.Provider value={value}><LastRunProvider><HomeScreen /></LastRunProvider></CreditsContext.Provider>);
}

beforeEach(() => jest.clearAllMocks());

test("shows the closet at a glance: greeting, stats and category groups", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "t-shirt", ["gray"]), item("item_1", "shorts", ["navy"]), item("item_2", "T-shirt", ["navy"])] });
  renderHome();
  expect(screen.getByText("FRIDAY, OCTOBER 16")).toBeTruthy();
  expect(screen.getByRole("header", { name: "Good evening" })).toBeTruthy();  // midnight
  expect(await screen.findByLabelText("Pieces, 3")).toBeTruthy();
  expect(screen.getByLabelText("Categories, 2")).toBeTruthy();  // Tops, Bottoms
  expect(screen.getByLabelText("New this week, 3")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tops, 2" })).toBeTruthy();
  expect(screen.getByText("Recently Added")).toBeTruthy();
  expect(screen.getAllByText("Gray t-shirt").length).toBeGreaterThan(0);
});

test("a category group opens the closet filtered to it", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shorts", ["navy"])] });
  renderHome();
  fireEvent.press(await screen.findByRole("button", { name: "Bottoms, 1" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/closet", params: expect.objectContaining({ group: "Bottoms", at: expect.any(String) }) });
});

test("See All opens the closet", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shorts", ["navy"])] });
  renderHome();
  fireEvent.press(await screen.findByRole("button", { name: "See All" }));
  expect(mockPush).toHaveBeenCalledWith("/closet");
});

test("an empty closet shows the frames, the add buttons and the tips", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  renderHome();
  expect(await screen.findByText("Your closet starts here")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Take Photo" })).toBeTruthy();
  expect(screen.getByText("Lay pieces flat on a bed or floor in daylight.")).toBeTruthy();
  expect(screen.queryByLabelText(/^Pieces/)).toBeNull();
});

test("the credit pill shows only while billing is on", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  renderHome();
  await screen.findByText("Your closet starts here");
  expect(screen.queryByRole("button", { name: /AI credits/ })).toBeNull();
  screen.unmount();
  renderHome({ billing: true, prices: { garment: 1 }, credits: { balance: 9, held: 0, available: 9, granted: 10, used: 1, entries: [], next_before: null } });
  fireEvent.press(await screen.findByRole("button", { name: "9 AI credits" }));
  expect(mockPush).toHaveBeenCalledWith("/account");
});

test("when the server can't be reached it says so, offers a retry, and still lets you add", async () => {
  (getItems as jest.Mock).mockRejectedValueOnce(new Error("Can't reach your wardrobe server."))
    .mockResolvedValueOnce({ items: [item("item_0", "shorts", ["navy"])] });
  renderHome();
  expect(await screen.findByText(/Can't reach your wardrobe server/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Take Photo" })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByLabelText("Pieces, 1")).toBeTruthy();
});

test("quick add starts the capture right from Home", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  (pickPhoto as jest.Mock).mockResolvedValue(null);
  renderHome();
  fireEvent.press(await screen.findByRole("button", { name: "From Library" }));
  await waitFor(() => expect(pickPhoto).toHaveBeenCalledWith(false));
});

test("editing a garment opened from Home shows the new value in the open sheet", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shirt", ["gray"])] });
  (updateItem as jest.Mock).mockImplementation(async (it) => ({ ...it, facts: { ...it.facts, category: f("blouse") } }));
  renderHome();
  fireEvent.press((await screen.findAllByLabelText("Open Gray shirt"))[0]);
  fireEvent.press(screen.getByLabelText("Edit"));
  fireEvent.changeText(screen.getByLabelText("Type"), "blouse");
  fireEvent.press(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("header", { name: "Gray blouse" })).toBeTruthy();
});

test("the sheet from Home pages through the whole closet", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shirt", []), item("item_1", "pants", []), item("item_2", "shorts", []), item("item_3", "dress", [])] });
  renderHome();
  fireEvent.press((await screen.findAllByLabelText("Open Pants"))[0]);
  expect(screen.getByText("2 / 4")).toBeTruthy();
});

test("a capture started on Home refreshes Home's counts", async () => {
  (getItems as jest.Mock).mockResolvedValueOnce({ items: [item("item_0", "shirt", [])] })
    .mockResolvedValue({ items: [item("item_0", "shirt", []), item("item_1", "pants", [])] });
  (pickPhoto as jest.Mock).mockResolvedValue("file:///p.jpg");
  (postRun as jest.Mock).mockResolvedValue({ run_id: "r2", quality: { status: "ok", reason: null }, items: [], failed: [] });
  renderHome();
  expect(await screen.findByLabelText("Pieces, 1")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Take Photo" }));
  expect(await screen.findByLabelText("Pieces, 2")).toBeTruthy();
});
