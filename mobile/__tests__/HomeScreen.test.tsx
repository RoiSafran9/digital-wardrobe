import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import HomeScreen from "../app/(tabs)/index";
import { CaptureJobsProvider } from "../src/store/captureJobs";
import { getItems, postRun } from "../src/api/client";
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
  return render(<CreditsContext.Provider value={value}><CaptureJobsProvider><HomeScreen /></CaptureJobsProvider></CreditsContext.Provider>);
}

beforeEach(() => jest.clearAllMocks());

test("shows the greeting, a search field, the two labelled add tiles and the closet by category", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "t-shirt", ["gray"]), item("item_1", "shorts", ["navy"]), item("item_2", "T-shirt", ["navy"])] });
  renderHome({ outfit: true });
  expect(screen.getByText("FRIDAY, OCTOBER 16")).toBeTruthy();
  expect(screen.getByRole("header", { name: "Good evening" })).toBeTruthy();  // midnight
  expect(await screen.findByText("Search 3 pieces")).toBeTruthy();
  expect(screen.getByText("FLAT LAY")).toBeTruthy();
  expect(screen.getByText("WORN")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add garments, flat lay photo, Camera" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add from outfit photo, Choose photo" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tops, 2" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Bottoms, 1" })).toBeTruthy();
  // The old dashboard pieces are gone.
  expect(screen.queryByText("Recently Added")).toBeNull();
  expect(screen.queryByLabelText(/^Pieces,/)).toBeNull();
});

test("a category row opens the closet filtered to it; search opens the closet ready to type", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shorts", ["navy"])] });
  renderHome();
  fireEvent.press(await screen.findByRole("button", { name: "Bottoms, 1" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/closet", params: expect.objectContaining({ group: "Bottoms", at: expect.any(String) }) });
  fireEvent.press(screen.getByRole("search", { name: "Search 1 pieces" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/closet", params: expect.objectContaining({ search: "1" }) });
});

test("garment buttons feed the garment flow; the outfit button feeds the outfit flow", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shirt", [])] });
  (pickPhoto as jest.Mock).mockResolvedValue("file:///p.jpg");
  renderHome({ outfit: true });
  fireEvent.press(await screen.findByRole("button", { name: "Add garments, flat lay photo, Camera" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/capture/camera", params: { mode: "garments" } });
  fireEvent.press(screen.getByRole("button", { name: "Add garments, flat lay photo, Library" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: "/capture/preview", params: { uri: "file:///p.jpg", flow: "garment" } }));
  fireEvent.press(screen.getByRole("button", { name: "Add from outfit photo, Choose photo" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: "/outfit/detect", params: { uri: "file:///p.jpg", flow: "outfit" } }));
});

test("without outfit import only the garment tile shows", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shirt", [])] });
  renderHome();
  await screen.findByText("FLAT LAY");
  expect(screen.queryByText("WORN")).toBeNull();
});

test("an empty closet shows the frames, two labelled rows and the tips", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  renderHome({ outfit: true });
  expect(await screen.findByText("Your closet starts here")).toBeTruthy();
  expect(screen.getByText("Laid flat or on a hanger")).toBeTruthy();
  expect(screen.getByText("You wearing it")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Garment photo, Camera" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Garment photo, Library" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Outfit photo, Choose photo" })).toBeTruthy();
  expect(screen.getByText("Lay pieces flat on a bed or floor in daylight.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Take Photo" })).toBeNull();
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

test("when the server can't be reached it says so and offers a retry", async () => {
  (getItems as jest.Mock).mockRejectedValueOnce(new Error("Can't reach your wardrobe server."))
    .mockResolvedValueOnce({ items: [item("item_0", "shorts", ["navy"])] });
  renderHome();
  expect(await screen.findByText(/Can't reach your wardrobe server/)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Search 1 piece")).toBeTruthy();
});

test("a capture in progress shows on Home and opens the processing screen", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  (postRun as jest.Mock).mockReturnValue(new Promise(() => {}));
  const { useCaptureJobs } = require("../src/store/captureJobs");
  const { Pressable, Text } = require("react-native");
  function Starter() {
    const { start } = useCaptureJobs();
    return <Pressable onPress={() => start("file:///p.jpg", 1)}><Text>start</Text></Pressable>;
  }
  const value: CreditsValue = { billing: false, prices: {}, credits: null, outfit: false, refresh: jest.fn(async () => {}) };
  render(<CreditsContext.Provider value={value}><CaptureJobsProvider><Starter /><HomeScreen /></CaptureJobsProvider></CreditsContext.Provider>);
  fireEvent.press(await screen.findByText("start"));
  fireEvent.press(await screen.findByRole("button", { name: "Creating your pieces…" }));
  expect(mockPush).toHaveBeenCalledWith("/capture/processing");
});

test("categoryRows keeps group order and uses each group's first piece", () => {
  const { categoryRows } = require("../app/(tabs)/index");
  const rows = categoryRows([item("a", "jeans", []), item("b", "shirt", []), item("c", "skirt", [])]);
  expect(rows.map((r: { name: string; count: number; first: { item_id: string } }) => [r.name, r.count, r.first.item_id])).toEqual([["Tops", 1, "b"], ["Bottoms", 2, "a"]]);
});
