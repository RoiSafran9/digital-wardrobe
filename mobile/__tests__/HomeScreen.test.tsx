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

test("shows the greeting, a search field, one Add Clothes entry and the closet by category", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "t-shirt", ["gray"]), item("item_1", "shorts", ["navy"]), item("item_2", "T-shirt", ["navy"])] });
  await renderHome({ outfit: true });
  expect(screen.getByText("FRIDAY, OCTOBER 16")).toBeTruthy();
  expect(screen.getByRole("header", { name: "Good evening" })).toBeTruthy();  // midnight
  expect(await screen.findByText("Search 3 pieces")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Add Clothes" })).toHaveLength(1);
  // No photo-type or source choice on Home itself: that is the Add tab's job.
  for (const old of ["FLAT LAY", "WORN", "Camera", "Library", "Choose Photo", "Clothes by themselves", "Someone wearing them"]) {
    expect(screen.queryByText(old)).toBeNull();
  }
  expect(screen.getByRole("button", { name: "Tops, 2" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Bottoms, 1" })).toBeTruthy();
  // The old dashboard pieces are gone.
  expect(screen.queryByText("Recently Added")).toBeNull();
  expect(screen.queryByLabelText(/^Pieces,/)).toBeNull();
});

test("a category row opens the closet filtered to it; search opens the closet ready to type", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shorts", ["navy"])] });
  await renderHome();
  await fireEvent.press(await screen.findByRole("button", { name: "Bottoms, 1" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/closet", params: expect.objectContaining({ group: "Bottoms", at: expect.any(String) }) });
  await fireEvent.press(screen.getByRole("search", { name: "Search 1 pieces" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/closet", params: expect.objectContaining({ search: "1" }) });
});

test("Add Clothes opens the Add tab, with or without outfit import; Home opens no camera or library itself", async () => {
  for (const outfit of [true, false]) {
    (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shirt", [])] });
    await renderHome({ outfit });
    await fireEvent.press(await screen.findByRole("button", { name: "Add Clothes" }));
    expect(mockPush).toHaveBeenLastCalledWith("/add");
    await screen.unmount();
  }
  expect(pickPhoto).not.toHaveBeenCalled();
});

test("local mode's empty closet: the frames, one Add Clothes entry and the tips", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  await renderHome({ outfit: true });
  expect(await screen.findByText("Your closet starts here")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Add Clothes" }));
  expect(mockPush).toHaveBeenCalledWith("/add");
  expect(screen.getByText("Lay clothes out on a bed or floor, or hang them up, in daylight.")).toBeTruthy();
  expect(screen.getByText("A full-body photo of someone wearing them works too.")).toBeTruthy();
  for (const old of ["Garment photo, Camera", "Garment photo, Library", "Outfit photo, Choose photo", "Take Photo"]) {
    expect(screen.queryByRole("button", { name: old })).toBeNull();
  }
});

test("the credit pill shows only while billing is on", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  await renderHome();
  await screen.findByText("Your closet starts here");
  expect(screen.queryByRole("button", { name: /AI credits/ })).toBeNull();
  await screen.unmount();
  await renderHome({ billing: true, prices: { garment: 1 }, credits: { balance: 9, held: 0, available: 9, granted: 10, used: 1, entries: [], next_before: null } });
  await fireEvent.press(await screen.findByRole("button", { name: "9 AI credits" }));
  expect(mockPush).toHaveBeenCalledWith("/account");
});

test("when the server can't be reached it says so and offers a retry", async () => {
  (getItems as jest.Mock).mockRejectedValueOnce(new Error("Can't reach your wardrobe server."))
    .mockResolvedValueOnce({ items: [item("item_0", "shorts", ["navy"])] });
  await renderHome();
  expect(await screen.findByText(/Can't reach your wardrobe server/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
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
  await render(<CreditsContext.Provider value={value}><CaptureJobsProvider><Starter /><HomeScreen /></CaptureJobsProvider></CreditsContext.Provider>);
  await fireEvent.press(await screen.findByText("start"));
  await fireEvent.press(await screen.findByRole("button", { name: "Creating your pieces…" }));
  expect(mockPush).toHaveBeenCalledWith("/capture/processing");
});

test("categoryRows keeps group order and uses each group's first piece", () => {
  const { categoryRows } = require("../app/(tabs)/index");
  const rows = categoryRows([item("a", "jeans", []), item("b", "shirt", []), item("c", "skirt", [])]);
  expect(rows.map((r: { name: string; count: number; first: { item_id: string } }) => [r.name, r.count, r.first.item_id])).toEqual([["Tops", 1, "b"], ["Bottoms", 2, "a"]]);
});

test("signed in with an empty closet: the guided First 3 Pieces card is the one way in", async () => {
  const { AuthContext } = require("../src/auth/AuthProvider");
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  const value: CreditsValue = { billing: false, prices: {}, credits: null, outfit: false, refresh: jest.fn(async () => {}) };
  await render(
    <AuthContext.Provider value={{ status: "signedIn", email: "a@b.c", userId: "u1", sendCode: jest.fn(), verifyCode: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn() }}>
      <CreditsContext.Provider value={value}><CaptureJobsProvider><HomeScreen /></CaptureJobsProvider></CreditsContext.Provider>
    </AuthContext.Provider>,
  );
  await fireEvent.press(await screen.findByRole("button", { name: "Add your first 3 pieces" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/first-pieces", params: { entry: "home" } });
  // No second set of add buttons competing with it (the Add tab stays in the tab bar).
  expect(screen.queryByRole("button", { name: "Add Clothes" })).toBeNull();
  expect(screen.queryByText(/Camera|Library|Choose Photo/)).toBeNull();
});

test("local mode's empty closet has no guided card", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  await renderHome();
  expect(await screen.findByText("Your closet starts here")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add your first 3 pieces" })).toBeNull();
});

test("signed in with the outfit builder on: Build My Look is a prominent entry, not a new tab", async () => {
  const { AuthContext } = require("../src/auth/AuthProvider");
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  const value: CreditsValue = { billing: false, prices: {}, credits: null, outfit: false, outfitBuilder: true, refresh: jest.fn(async () => {}) };
  await render(
    <AuthContext.Provider value={{ status: "signedIn", email: "a@b.c", userId: "u1", sendCode: jest.fn(), verifyCode: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn() }}>
      <CreditsContext.Provider value={value}><CaptureJobsProvider><HomeScreen /></CaptureJobsProvider></CreditsContext.Provider>
    </AuthContext.Provider>,
  );
  await fireEvent.press(await screen.findByRole("button", { name: "Build My Look. Outfit ideas made from your own closet." }));
  expect(mockPush).toHaveBeenCalledWith("/build-my-look");
});

test("the Build My Look entry is hidden when the server has it off, or in local mode", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  await renderHome({ outfitBuilder: false });
  await screen.findByText("Your closet starts here");
  expect(screen.queryByText("Build My Look")).toBeNull();
});
