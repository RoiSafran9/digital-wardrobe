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

test("shows the greeting, the piece count, the Add clothes card and a tile per category", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "t-shirt", ["gray"]), item("item_1", "shorts", ["navy"]), item("item_2", "T-shirt", ["navy"])] });
  await renderHome({ outfit: true });
  expect(screen.getByRole("header", { name: "Good evening" })).toBeTruthy();  // midnight
  expect(await screen.findByLabelText("3 pieces")).toBeTruthy();
  expect(screen.getByText("Add clothes")).toBeTruthy();
  expect(screen.getByText("Finding pieces is free")).toBeTruthy();  // billing off: no price
  expect(screen.getByRole("button", { name: "Add clothes laid flat, opens the camera" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add clothes from an outfit you're wearing, opens the camera" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tops, 2" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Bottoms, 1" })).toBeTruthy();
  // Search lives in Closet now; the old rows are gone.
  expect(screen.queryByRole("search")).toBeNull();
  expect(screen.queryByText("Your closet")).toBeNull();
});

test("a category tile opens the closet filtered to it", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shorts", ["navy"])] });
  await renderHome();
  await fireEvent.press(await screen.findByRole("button", { name: "Bottoms, 1" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/closet", params: expect.objectContaining({ group: "Bottoms", at: expect.any(String) }) });
});

test("Laid flat opens the camera for garments; Worn opens it for an outfit", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shirt", [])] });
  await renderHome({ outfit: true });
  await fireEvent.press(await screen.findByRole("button", { name: "Add clothes laid flat, opens the camera" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/capture/camera", params: { mode: "garments" } });
  await fireEvent.press(screen.getByRole("button", { name: "Add clothes from an outfit you're wearing, opens the camera" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/capture/camera", params: { mode: "outfit" } });
});

test("without outfit import only Laid flat shows", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shirt", [])] });
  await renderHome();
  await screen.findByRole("button", { name: "Add clothes laid flat, opens the camera" });
  expect(screen.queryByText("Worn")).toBeNull();
});

test("the Add card names the server's price per piece while billing is on", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shirt", [])] });
  await renderHome({ billing: true, prices: { garment: 2 }, credits: { balance: 9, held: 0, available: 9, granted: 10, used: 1, entries: [], next_before: null } });
  expect(await screen.findByText("Finding pieces is free · 2 credits per piece")).toBeTruthy();
});

test("New this week shows only pieces added in the last 7 days", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [{ ...item("old", "shirt", []), run_id: "20260901-1" }] });
  await renderHome();
  await screen.findByLabelText("1 piece");
  expect(screen.queryByText("New this week")).toBeNull();
  await screen.unmount();
  (getItems as jest.Mock).mockResolvedValue({ items: [item("new", "shirt", []), { ...item("old", "shirt", []), run_id: "20260901-1" }] });
  await renderHome();
  expect(await screen.findByText("New this week")).toBeTruthy();
});

test("newThisWeek keeps the last 7 days, newest first", () => {
  const { newThisWeek } = require("../app/(tabs)/index");
  const items = [{ ...item("a", "shirt", []), run_id: "20261010-1" }, { ...item("b", "shirt", []), run_id: "20261015-1" }, { ...item("c", "shirt", []), run_id: "20261001-1" }];
  expect(newThisWeek(items, new Date(2026, 9, 16)).map((i: { item_id: string }) => i.item_id)).toEqual(["b", "a"]);
});

test("an empty closet shows the frames, two labelled rows and the tips", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  await renderHome({ outfit: true });
  expect(await screen.findByText("Your closet starts here")).toBeTruthy();
  expect(screen.getByText("Clothes laid flat or hung, and shoes")).toBeTruthy();
  expect(screen.getByText("You wearing it")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Garment photo, Camera" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Garment photo, Library" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Outfit photo, Choose photo" })).toBeTruthy();
  expect(screen.getByText("Lay pieces flat on a bed or floor in daylight.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Take Photo" })).toBeNull();
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
  expect(await screen.findByLabelText("1 piece")).toBeTruthy();
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

test("signed in with an empty closet: the guided First 3 Pieces card leads the add options", async () => {
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
});

test("local mode's empty closet has no guided card", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  await renderHome();
  expect(await screen.findByText("Your closet starts here")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add your first 3 pieces" })).toBeNull();
});

test("signed in with the outfit builder on: Build My Look is a card on Home", async () => {
  const { AuthContext } = require("../src/auth/AuthProvider");
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shirt", [])] });
  const value: CreditsValue = { billing: false, prices: {}, credits: null, outfit: false, outfitBuilder: true, refresh: jest.fn(async () => {}) };
  await render(
    <AuthContext.Provider value={{ status: "signedIn", email: "a@b.c", userId: "u1", sendCode: jest.fn(), verifyCode: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn() }}>
      <CreditsContext.Provider value={value}><CaptureJobsProvider><HomeScreen /></CaptureJobsProvider></CreditsContext.Provider>
    </AuthContext.Provider>,
  );
  await fireEvent.press(await screen.findByRole("button", { name: "Build My Look. Outfits from your 1 piece." }));
  expect(mockPush).toHaveBeenCalledWith("/build-my-look");
});

test("the Build My Look entry is hidden when the server has it off, or in local mode", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  await renderHome({ outfitBuilder: false });
  await screen.findByText("Your closet starts here");
  expect(screen.queryByText("Build My Look")).toBeNull();
});

test("the one-time morning reminder card sits under Add clothes for a signed-in account with fewer than 3 pieces", async () => {
  const AsyncStorage = jest.requireMock("@react-native-async-storage/async-storage");
  const { act } = require("@testing-library/react-native");
  const { AuthContext } = require("../src/auth/AuthProvider");
  const { MorningReminderProvider } = require("../src/morningReminder/MorningReminderProvider");
  const { OFFER_TITLE } = require("../src/morningReminder/MorningReminderCard");
  const { reportSavedCount } = require("../src/morningReminder/closetSignal");
  const { offeredKey } = require("../src/firstPieces/offer");
  await AsyncStorage.clear();
  await AsyncStorage.setItem(offeredKey("u1"), "1");
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shirt", [])] });
  const auth = { status: "signedIn", email: null, userId: "u1", sendCode: jest.fn(), verifyCode: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn() };
  const credits: CreditsValue = { billing: false, prices: {}, outfit: true, refresh: jest.fn(async () => {}),
    credits: { balance: 1, held: 0, available: 1, granted: 1, used: 0, next_before: null, entries: [] } };
  await render(
    <AuthContext.Provider value={auth}>
      <CreditsContext.Provider value={credits}>
        <MorningReminderProvider enabled><CaptureJobsProvider><HomeScreen /></CaptureJobsProvider></MorningReminderProvider>
      </CreditsContext.Provider>
    </AuthContext.Provider>,
  );
  expect(await screen.findByText("Add clothes")).toBeTruthy();
  await act(async () => { reportSavedCount(1); await new Promise((r) => setTimeout(r, 0)); });
  expect(await screen.findByText(OFFER_TITLE)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Remind Me" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Not Now" })).toBeTruthy();
});
