// Change Photo Type (docs/features/unified-add-clothes 01 §3.5): before paid generation the same photo
// switches between clothes by themselves (garment preview) and someone wearing them (outfit scan).
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import PreviewScreen from "../app/capture/preview";
import DetectScreen from "../app/outfit/detect";
import PickScreen from "../app/outfit/pick";
import { generateFromGarmentScan, generateOutfit, getOutfitScan, scanGarments, scanOutfit } from "../src/api/client";
import type { GarmentScan, OutfitCandidate, OutfitScan } from "../src/api/types";
import { track } from "../src/activity/track";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { CaptureJobsProvider } from "../src/store/captureJobs";

jest.mock("../src/api/client", () => ({ ...jest.requireActual("../src/api/client"),
  scanGarments: jest.fn(), generateFromGarmentScan: jest.fn(), postRun: jest.fn(),
  scanOutfit: jest.fn(), getOutfitScan: jest.fn(), generateOutfit: jest.fn() }));
jest.mock("../src/activity/track", () => ({ ...jest.requireActual("../src/activity/track"), track: jest.fn() }));
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

const PHOTO = "file:///photo.jpg";
const GARMENTS: GarmentScan = {
  id: "gs-1", status: "succeeded", error: null, quality: { status: "ok", reason: null }, reason: null, expires_at: null,
  image: { width: 1000, height: 1000 },
  pieces: [{ index: 0, category: "shirt", colors: ["white"], box: { x: 10, y: 10, width: 300, height: 400 } }],
} as GarmentScan;
const cand = (id: string, category: string): OutfitCandidate => ({
  id, category, visibility: "full", layer: "single", colors: ["black"], pattern: "solid", visible_text: "", description: `a ${category}`,
  hidden_parts: [], uncertainty: "", box: { x: 10, y: 10, width: 100, height: 120 }, preview_url: `https://sb.test/${id}.jpg`,
});
const WORN: OutfitScan = { id: "scan-1", status: "succeeded", error: null, scene_kind: "worn", person_count: 1, expires_at: null,
  candidates: [cand("c1", "blazer"), cand("c2", "trousers")] };
const FLAT: OutfitScan = { ...WORN, id: "scan-2", scene_kind: "flat" };

function renderWith(ui: React.ReactElement, credits: Partial<CreditsValue> = {}) {
  const value: CreditsValue = { billing: false, prices: {}, credits: null, outfit: true, refresh: jest.fn(async () => {}), ...credits };
  return render(<CreditsContext.Provider value={value}><CaptureJobsProvider>{ui}</CaptureJobsProvider></CreditsContext.Provider>);
}
const wallet = (available: number) => ({ balance: available, held: 0, available, granted: 10, used: 0, entries: [], next_before: null });
const CHANGE = { name: "Change Photo Type" };

beforeEach(() => { jest.clearAllMocks(); mockParams = {}; });

// The correction event carries only the two types and the step, never the photo.
function expectCorrection(from: string, to: string, stage: string) {
  expect(track).toHaveBeenCalledWith("add_photo_type_corrected", { from, to, stage });
  expect(JSON.stringify((track as jest.Mock).mock.calls)).not.toContain("file://");
}

describe("garment preview → someone wearing them", () => {
  test("switches the same photo to the free outfit scan, without generating", async () => {
    mockParams = { uri: PHOTO };
    (scanGarments as jest.Mock).mockResolvedValueOnce(GARMENTS);
    await renderWith(<PreviewScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(5) });
    await screen.findByText("1 garment found");
    expect(screen.getByText("Switches to someone wearing them. We'll scan this photo again for free.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", CHANGE));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/detect", params: { uri: PHOTO } });
    expect(generateFromGarmentScan).not.toHaveBeenCalled();
    expectCorrection("laid_out", "worn", "garment_preview");
    expect(screen.queryByRole("button", CHANGE)).toBeNull();  // one switch only
  });

  test("keeps First 3 Pieces' onboarding mode", async () => {
    mockParams = { uri: PHOTO, onboarding: "1" };
    (scanGarments as jest.Mock).mockResolvedValueOnce(GARMENTS);
    await renderWith(<PreviewScreen />);
    await fireEvent.press(await screen.findByRole("button", CHANGE));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/detect", params: { uri: PHOTO, onboarding: "1" } });
  });

  test("the max-pieces fallback offers it too", async () => {
    mockParams = { uri: PHOTO };
    (scanGarments as jest.Mock).mockResolvedValueOnce(null);
    await renderWith(<PreviewScreen />);
    await fireEvent.press(await screen.findByRole("button", CHANGE));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/detect", params: { uri: PHOTO } });
  });

  test("not offered when the server has no outfit photos, even for a worn photo", async () => {
    mockParams = { uri: PHOTO };
    (scanGarments as jest.Mock).mockResolvedValueOnce(GARMENTS);
    const view = await renderWith(<PreviewScreen />, { outfit: false });
    await screen.findByText("1 garment found");
    expect(screen.queryByRole("button", CHANGE)).toBeNull();
    await view.unmount();

    (scanGarments as jest.Mock).mockResolvedValueOnce({ ...GARMENTS, pieces: [], reason: "No garment to add: worn on body." });
    await renderWith(<PreviewScreen />, { outfit: false });
    await screen.findByText("No pieces found");
    expect(screen.queryByRole("button", { name: "Try as a worn photo" })).toBeNull();
    expect(screen.queryByRole("button", CHANGE)).toBeNull();
  });

  test("gone once generation starts", async () => {
    mockParams = { uri: PHOTO };
    (scanGarments as jest.Mock).mockResolvedValueOnce(GARMENTS);
    (generateFromGarmentScan as jest.Mock).mockReturnValue(new Promise(() => {}));
    await renderWith(<PreviewScreen />);
    await screen.findByRole("button", CHANGE);
    await fireEvent.press(screen.getByRole("button", { name: "Create 1 Item" }));
    expect(mockReplace).toHaveBeenCalledWith("/capture/processing");
    expect(screen.queryByRole("button", CHANGE)).toBeNull();
    expect(track).not.toHaveBeenCalledWith("add_photo_type_corrected", expect.anything());
  });
});

describe("outfit scan → clothes by themselves", () => {
  test("a laid-out scene stays on the scan screen (no timed move) and offers the same photo as clothes", async () => {
    jest.useFakeTimers();
    try {
      mockParams = { uri: PHOTO };
      (scanOutfit as jest.Mock).mockResolvedValue(FLAT);
      await renderWith(<DetectScreen />);
      expect(await screen.findByText("These clothes look laid out. Try as clothes by themselves.")).toBeTruthy();
      await act(async () => { jest.advanceTimersByTime(5000); });
      expect(mockReplace).not.toHaveBeenCalled();
      expect(screen.getByText("We'll scan this photo again for free.")).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Try as clothes by themselves" }));
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith({ pathname: "/capture/preview", params: { uri: PHOTO } });
      expectCorrection("worn", "laid_out", "outfit_detect");
      expect(scanOutfit).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test("a laid-out scene can still continue as a worn photo", async () => {
    mockParams = { uri: PHOTO, onboarding: "1" };
    (scanOutfit as jest.Mock).mockResolvedValue(FLAT);
    await renderWith(<DetectScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Continue as Worn Photo" }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/pick", params: { scanId: "scan-2", uri: PHOTO, onboarding: "1" } });
  });

  test("a failed scan offers Change Photo Type with the same photo, keeping onboarding", async () => {
    mockParams = { uri: PHOTO, onboarding: "1" };
    (scanOutfit as jest.Mock).mockRejectedValue(new Error("Can't reach your wardrobe server."));
    await renderWith(<DetectScreen />);
    await screen.findByText("Couldn't check this photo");
    await fireEvent.press(screen.getByRole("button", CHANGE));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/capture/preview", params: { uri: PHOTO, onboarding: "1" } });
  });

  test("a worn scene still moves on to the pick screen and shows no switch while it waits", async () => {
    jest.useFakeTimers();
    try {
      mockParams = { uri: PHOTO };
      (scanOutfit as jest.Mock).mockResolvedValue(WORN);
      const view = await renderWith(<DetectScreen />);
      await screen.findByText("2 garments found");
      expect(screen.queryByRole("button", CHANGE)).toBeNull();
      await view.unmount();  // leaving early clears the timer
      await act(async () => { jest.advanceTimersByTime(5000); });
      expect(mockReplace).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test("the pick screen switches the same photo to the garment preview, with no old scan or picks", async () => {
    mockParams = { scanId: "scan-1", uri: PHOTO };
    (getOutfitScan as jest.Mock).mockResolvedValue(WORN);
    await renderWith(<PickScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(5) });
    await screen.findByText("Blazer");
    expect(screen.getByText("Switches to clothes by themselves. We'll scan this photo again for free.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", CHANGE));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/capture/preview", params: { uri: PHOTO } });
    expect(generateOutfit).not.toHaveBeenCalled();
    expectCorrection("worn", "laid_out", "outfit_pick");
  });

  test("the pick screen makes it prominent for a laid-out scene, in onboarding mode too", async () => {
    mockParams = { scanId: "scan-2", uri: PHOTO, onboarding: "1" };
    (getOutfitScan as jest.Mock).mockResolvedValue(FLAT);
    await renderWith(<PickScreen />);
    await screen.findByText("Blazer");
    await fireEvent.press(screen.getByRole("button", { name: "Try as clothes by themselves" }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/capture/preview", params: { uri: PHOTO, onboarding: "1" } });
  });

  test("without the photo it offers another photo instead of a broken route", async () => {
    mockParams = { scanId: "scan-1" };
    (getOutfitScan as jest.Mock).mockResolvedValue(WORN);
    await renderWith(<PickScreen />);
    await screen.findByText("Blazer");
    await fireEvent.press(screen.getByRole("button", { name: "Choose Another Photo" }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/capture/camera", params: { mode: "garments" } });
  });

  test("gone once the cost is being confirmed or images are being made", async () => {
    mockParams = { scanId: "scan-1", uri: PHOTO };
    (getOutfitScan as jest.Mock).mockResolvedValue(WORN);
    (generateOutfit as jest.Mock).mockReturnValue(new Promise(() => {}));
    const view = await renderWith(<PickScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(5) });
    await screen.findByText("Blazer");
    await fireEvent.press(screen.getByRole("button", { name: "Generate" }));
    expect(screen.queryByRole("button", CHANGE)).toBeNull();
    await view.unmount();

    await renderWith(<PickScreen />);  // billing off: Generate starts right away
    await screen.findByText("Blazer");
    await fireEvent.press(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(generateOutfit).toHaveBeenCalled());
    expect(screen.queryByRole("button", CHANGE)).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe("First 3 Pieces", () => {
  test("a worn photo corrected to clothes by themselves joins the round's photo tray", async () => {
    const fp = require("../src/firstPieces/FirstPiecesProvider");
    const addPhotos = jest.fn();
    const spy = jest.spyOn(fp, "useFirstPiecesMaybe").mockReturnValue({ addPhotos });
    const { ChangePhotoType } = require("../src/components/capture/ChangePhotoType");
    try {
      await render(<ChangePhotoType from="worn" stage="outfit_pick" uri={PHOTO} onboarding />);
      await fireEvent.press(screen.getByRole("button", CHANGE));
      expect(addPhotos).toHaveBeenCalledWith([PHOTO]);
      expect(mockReplace).toHaveBeenCalledWith("/first-pieces/photos");
      expectCorrection("worn", "laid_out", "outfit_pick");
    } finally {
      spy.mockRestore();
    }
  });
});
