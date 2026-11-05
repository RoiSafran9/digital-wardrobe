import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AddScreen from "../app/(tabs)/add";
import PreviewScreen from "../app/capture/preview";
import PickScreen from "../app/outfit/pick";
import { track } from "../src/activity/track";
import { availableTypes, cameraRoute, otherType, photoRoute, typeOfMode } from "../src/addPhoto";
import { getOutfitScan, getPendingItems, scanGarments } from "../src/api/client";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { pickPhoto } from "../src/photoPicker";
import { CaptureJobsProvider } from "../src/store/captureJobs";

jest.mock("../src/activity/track", () => ({ track: jest.fn(), useScreenViewed: jest.fn(), trackPermission: jest.fn() }));
jest.mock("../src/api/client");
jest.mock("../src/photoPicker", () => ({ pickPhoto: jest.fn() }));
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => { const { useEffect } = require("react"); useEffect(() => cb(), [cb]); },
}));

function withCredits(ui: React.ReactElement) {
  const value: CreditsValue = { billing: false, prices: {}, credits: null, outfit: true, refresh: jest.fn(async () => {}) };
  return render(<CreditsContext.Provider value={value}><CaptureJobsProvider>{ui}</CaptureJobsProvider></CreditsContext.Provider>);
}
const events = () => (track as jest.Mock).mock.calls;

beforeEach(() => { jest.clearAllMocks(); mockParams = {}; (getPendingItems as jest.Mock).mockResolvedValue([]); });

test("a route's mode becomes a type; unknown modes and a disabled worn flow are laid out", () => {
  expect(typeOfMode("outfit", true)).toBe("worn");
  expect(typeOfMode("outfit", false)).toBe("laid_out");
  expect(typeOfMode("garments", true)).toBe("laid_out");
  expect(typeOfMode(undefined, true)).toBe("laid_out");
  expect(typeOfMode("../../evil", true)).toBe("laid_out");
  expect(availableTypes(false)).toEqual(["laid_out"]);
  expect(otherType("worn")).toBe("laid_out");
});

test("both sources of a type lead to the same scan", () => {
  expect(cameraRoute("laid_out")).toEqual({ pathname: "/capture/camera", params: { mode: "garments" } });
  expect(cameraRoute("worn", true)).toEqual({ pathname: "/capture/camera", params: { mode: "outfit", onboarding: "1" } });
  expect(photoRoute("laid_out", "file:///a.jpg", true)).toEqual({ pathname: "/capture/preview", params: { uri: "file:///a.jpg" } });
  expect(photoRoute("worn", "file:///a.jpg")).toEqual({ pathname: "/outfit/detect", params: { uri: "file:///a.jpg" } });
});

test("the Add hub records the chosen type and, once a library photo is in, its source — never the photo", async () => {
  (pickPhoto as jest.Mock).mockResolvedValue("file:///private/IMG_0001.jpg");
  await withCredits(<AddScreen />);
  await fireEvent.press(screen.getByRole("button", { name: /^Someone wearing them/ }));
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose from Library" })));
  expect(events()).toEqual([
    ["add_photo_type_selected", { type: "worn", entry: "add" }],
    ["capture_source", { flow: "outfit", from: "library" }],
  ]);
  expect(JSON.stringify(events())).not.toContain("IMG_0001");
});

test("Take Photo records nothing yet: the camera records capture_source once the shot is taken", async () => {
  await withCredits(<AddScreen />);
  await fireEvent.press(screen.getByRole("button", { name: /^Clothes by themselves/ }));
  await fireEvent.press(screen.getByRole("button", { name: "Take Photo" }));
  expect(events()).toEqual([["add_photo_type_selected", { type: "laid_out", entry: "add" }]]);
});

test("a type change is recorded with its stage, in both directions", async () => {
  mockParams = { uri: "file:///p.jpg" };
  (scanGarments as jest.Mock).mockResolvedValue({ id: "gs-1", status: "succeeded", error: null, quality: { status: "ok", reason: null },
    reason: null, expires_at: null, image: { width: 10, height: 10 }, pieces: [{ index: 0, category: "shirt", colors: [], box: { x: 0, y: 0, width: 5, height: 5 } }] });
  await withCredits(<PreviewScreen />);
  await fireEvent.press(await screen.findByRole("button", { name: "Change Photo Type" }));
  await screen.unmount();
  mockParams = { scanId: "scan-x", uri: "file:///p.jpg" };
  (getOutfitScan as jest.Mock).mockResolvedValue({ id: "scan-x", status: "succeeded", error: null, scene_kind: "worn", person_count: 1, expires_at: null, candidates: [] });
  await withCredits(<PickScreen />);
  await fireEvent.press(await screen.findByRole("button", { name: "Change Photo Type" }));
  expect(events()).toEqual([
    ["add_photo_type_corrected", { from: "laid_out", to: "worn", stage: "garment_preview" }],
    ["add_photo_type_corrected", { from: "worn", to: "laid_out", stage: "outfit_pick" }],
  ]);
});
