import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import CameraScreen from "../app/capture/camera";
import PreviewScreen from "../app/capture/preview";
import ProcessingScreen from "../app/capture/processing";
import ResultsScreen from "../app/capture/results";
import SavedScreen from "../app/capture/saved";
import { deleteItem, generateFromGarmentScan, postRun, scanGarments } from "../src/api/client";
import type { RunResponse } from "../src/api/types";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { CaptureJobsProvider, useCaptureJobs } from "../src/store/captureJobs";
import { pickPhoto } from "../src/photoPicker";

jest.mock("../src/api/client", () => ({ ...jest.requireActual("../src/api/client"), postRun: jest.fn(), deleteItem: jest.fn(),
  scanGarments: jest.fn(async () => null), generateFromGarmentScan: jest.fn() }));
jest.mock("../src/photoPicker", () => ({ pickPhoto: jest.fn() }));
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

const wallet = (available: number) => ({ balance: available, held: 0, available, granted: 10, used: 0, entries: [], next_before: null });
const f = (v: string | string[]) => ({ value: v, confidence: 1, basis: "observed" as const });
const made = (id: string, cat: string, extra = {}) => ({
  item_id: id, photo_name: "p", tier: "high" as const, reason: "ok", retake_instruction: null,
  facts: { category: f(cat), colors: f(["navy"]), pattern: f("solid"), visible_text: f(""), trims: f(""), visible_parts: f([]), occluded_parts: f([]) },
  crop_url: "/c.png", generated_url: "/g.png", cutout_url: null, ...extra,
});
const RUN: RunResponse = { run_id: "20261019-120000", quality: { status: "ok", reason: null }, items: [made("item_0", "shirt"), made("item_1", "jeans")], failed: [] };

// Starts a job before the screen under test renders, like coming from the preview.
function Started({ result, error, children }: { result?: RunResponse; error?: Error; children: React.ReactNode }) {
  const { start } = useCaptureJobs();
  const [started, setStarted] = React.useState(false);
  useEffect(() => {
    (postRun as jest.Mock).mockImplementation(() => (error ? Promise.reject(error) : Promise.resolve(result)));
    start("file:///photo.jpg", 2);
    setStarted(true);
  }, []);
  return started ? <>{children}</> : null;
}

function renderWith(ui: React.ReactElement, credits: Partial<CreditsValue> = {}) {
  const value: CreditsValue = { billing: false, prices: {}, credits: null, outfit: false, refresh: jest.fn(async () => {}), ...credits };
  return render(<CreditsContext.Provider value={value}><CaptureJobsProvider>{ui}</CaptureJobsProvider></CreditsContext.Provider>);
}

beforeEach(() => { jest.clearAllMocks(); mockParams = {}; (global as any).__cameraPermission = undefined; });

describe("camera", () => {
  test("the close button sits below the status bar and closes the camera", async () => {
    await renderWith(<CameraScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Close camera" }));
    expect(mockBack).toHaveBeenCalled();
    // Even when the modal reports no safe-area inset, the controls start below the status bar.
    const padded = screen.container.queryAll((n) => { const top = StyleSheet.flatten(n.props.style)?.paddingTop; return typeof top === "number" && top >= 60; });
    expect(padded.length).toBeGreaterThan(0);
  });

  test("the shutter takes the photo and opens its preview", async () => {
    await renderWith(<CameraScreen />);
    expect(screen.getByText("Clothes by themselves")).toBeTruthy();
    expect(screen.getByText("Lay clothes out or hang them. Shoes: low side angle.")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Take garment photo" })));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/capture/preview", params: { uri: "file:///camera.jpg" } });
  });

  test("the photo type comes from the entry: no Garments / Outfit switch in the camera", async () => {
    mockParams = { mode: "outfit" };
    await renderWith(<CameraScreen />, { outfit: true });
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByText("Someone wearing them")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Take outfit photo" })));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/detect", params: { uri: "file:///camera.jpg" } });
  });

  test("opened without a type (the tab bar's camera), it offers Garments / Outfit with icons", async () => {
    await renderWith(<CameraScreen />, { outfit: true });
    expect(screen.getAllByRole("tab").map((t) => t.props.accessibilityLabel)).toEqual(["Garments", "Outfit"]);
    await fireEvent.press(screen.getByRole("tab", { name: "Outfit" }));
    expect(screen.getByText("Someone wearing them")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Take outfit photo" })));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/detect", params: { uri: "file:///camera.jpg" } });
  });

  test("without outfits on the server, no switch even without a type", async () => {
    await renderWith(<CameraScreen />);
    expect(screen.queryByRole("tab")).toBeNull();
  });

  test("outfit mode falls back to clothes by themselves when the server has outfits off", async () => {
    mockParams = { mode: "outfit" };
    await renderWith(<CameraScreen />);
    expect(screen.getByText("Clothes by themselves")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Take garment photo" })).toBeTruthy();
  });

  test("the library button keeps the chosen type", async () => {
    mockParams = { mode: "outfit" };
    (pickPhoto as jest.Mock).mockResolvedValue("file:///lib.jpg");
    await renderWith(<CameraScreen />, { outfit: true });
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose from Library" })));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/detect", params: { uri: "file:///lib.jpg" } });
  });

  test("with the camera refused it offers the photo library", async () => {
    (global as any).__cameraPermission = [{ granted: false, canAskAgain: false }, jest.fn()];
    (pickPhoto as jest.Mock).mockResolvedValue("file:///lib.jpg");
    await renderWith(<CameraScreen />);
    expect(screen.getByText("Camera access is off")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose from Library" })));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/capture/preview", params: { uri: "file:///lib.jpg" } });
  });
});

describe("preview", () => {
  test("billing off: no quote, and creating starts the job", async () => {
    mockParams = { uri: "file:///photo.jpg" };
    (postRun as jest.Mock).mockReturnValue(new Promise(() => {}));
    await renderWith(<PreviewScreen />);
    await screen.findByText("Ready to create");
    expect(screen.queryByText(/credit/)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Create Catalog Images" }));
    expect(postRun).toHaveBeenCalledWith("file:///photo.jpg", undefined, expect.any(Function));
    expect(mockReplace).toHaveBeenCalledWith("/capture/processing");
  });

  test("billing on: the quote follows the pieces stepper, within what the user can afford", async () => {
    mockParams = { uri: "file:///photo.jpg" };
    (postRun as jest.Mock).mockReturnValue(new Promise(() => {}));
    await renderWith(<PreviewScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(2) });
    await screen.findByText("Ready to create");
    await fireEvent.press(screen.getByRole("button", { name: "More pieces" }));
    expect(screen.getByText("Front catalog image × 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "More pieces" })).toBeDisabled();
    await fireEvent.press(screen.getByRole("button", { name: "Generate up to 2 Items · 2 credits" }));
    expect(postRun).toHaveBeenCalledWith("file:///photo.jpg", 2, expect.any(Function));
  });

  test("without credits for even one piece it explains instead of starting", async () => {
    mockParams = { uri: "file:///photo.jpg" };
    await renderWith(<PreviewScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(0) });
    await screen.findByText("Ready to create");
    await fireEvent.press(screen.getByRole("button", { name: /Generate up to 1 Item/ }));
    expect(postRun).not.toHaveBeenCalled();
    expect(screen.getByText("Not enough credits")).toBeTruthy();
  });
});

describe("processing", () => {
  test("moves to the results when the job is done", async () => {
    await renderWith(<Started result={RUN}><ProcessingScreen /></Started>);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/capture/results"));
  });

  test("a failed job pauses with Try Again, and says credits came back when billing is on", async () => {
    await renderWith(<Started error={new Error("Can't reach your wardrobe server.")}><ProcessingScreen /></Started>, { billing: true, prices: { garment: 1 }, credits: wallet(3) });
    expect(await screen.findByText("Generation paused")).toBeTruthy();
    expect(screen.getByText(/Credits for unfinished items were returned/)).toBeTruthy();
    (postRun as jest.Mock).mockReturnValue(new Promise(() => {}));
    await fireEvent.press(screen.getByRole("button", { name: "Try Again" }));
    expect(postRun).toHaveBeenLastCalledWith("file:///photo.jpg", 2, expect.any(Function));
  });

  test("a photo refused as worn offers the outfit flow with the same photo", async () => {
    await renderWith(<Started error={new Error("No garment to add: worn on body")}><ProcessingScreen /></Started>, { outfit: true });
    await fireEvent.press(await screen.findByRole("button", { name: "Try it as an outfit photo" }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/detect", params: { uri: "file:///photo.jpg" } });
  });
});

describe("results and saved", () => {
  test("deselecting a piece removes it on Add, and Saved counts what stayed", async () => {
    (deleteItem as jest.Mock).mockResolvedValue(undefined);
    await renderWith(<Started result={RUN}><ResultsScreen /><SavedScreen /></Started>, { billing: true, prices: { garment: 1 }, credits: wallet(5) });
    expect(await screen.findByText("2 pieces created")).toBeTruthy();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Navy jeans" }));
    expect(screen.getByText("Credits for removed pieces are not returned.")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Add 1 to Closet" })));
    expect(deleteItem).toHaveBeenCalledTimes(1);
    expect((deleteItem as jest.Mock).mock.calls[0][0].item_id).toBe("item_1");
    expect(mockReplace).toHaveBeenCalledWith("/capture/saved");
    expect(screen.getByText("1 new piece · 2 credits used")).toBeTruthy();
  });

  test("Add is off when nothing is selected", async () => {
    await renderWith(<Started result={RUN}><ResultsScreen /></Started>);
    await screen.findByText("2 pieces created");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Navy shirt" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Navy jeans" }));
    expect(screen.getByRole("button", { name: "Add 0 to Closet" })).toBeDisabled();
  });

  test("a photo with nothing in it says so and offers another photo", async () => {
    await renderWith(<Started result={{ ...RUN, items: [] }}><ResultsScreen /></Started>);
    expect(await screen.findByText("No pieces found")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Take Another Garment Photo" })).toBeTruthy();
  });

  test("billing off: Saved shows no credits", async () => {
    await renderWith(<Started result={RUN}><ResultsScreen /><SavedScreen /></Started>);
    const add = await screen.findByRole("button", { name: "Add 2 to Closet" });
    await act(async () => fireEvent.press(add));
    expect(screen.getByText("2 new pieces")).toBeTruthy();
  });
});

test("the processing card shows the server's own count, processed apart from made, and no timed stages", async () => {
  const { ProcessingCard } = require("../src/components/capture/ProcessingCard");
  await render(<ProcessingCard photoUri="file:///p.jpg" title="t" note="n" view={{ state: "running", progress: { done: 2, total: 3, made: 1 } }} />);
  expect(screen.getAllByText("2 of 3 done").length).toBeGreaterThan(0);
  expect(screen.getByText("1 image made · 1 couldn't be made")).toBeTruthy();
  expect(screen.getByRole("progressbar").props.accessibilityValue).toEqual({ min: 0, max: 100, now: 67 });
  expect(screen.getByText("Making catalog images…")).toBeTruthy();
  expect(screen.queryByText(/Finding each garment|Separating the pieces|Laying them flat/)).toBeNull();
});

test("without a server count the processing card shows a spinner and the server's status, not a percentage", async () => {
  const { ProcessingCard } = require("../src/components/capture/ProcessingCard");
  await render(<ProcessingCard photoUri="file:///p.jpg" title="t" note="n" view={{ state: "queued" }} />);
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(screen.getByText("Waiting for a free spot…")).toBeTruthy();
  expect(screen.getByLabelText("Sending your request, done")).toBeTruthy();
  expect(screen.getByLabelText("Waiting for a free spot, in progress")).toBeTruthy();
});

test("a lost connection says so without calling the job failed", async () => {
  const { ProcessingCard } = require("../src/components/capture/ProcessingCard");
  await render(<ProcessingCard photoUri="file:///p.jpg" title="t" note="n" view={{ state: "running", offline: true, progress: { done: 1, total: 2 } }} />);
  expect(screen.getByText("Reconnecting to KIPS…")).toBeTruthy();
  expect(screen.getByText(/won't be sent or charged twice/)).toBeTruthy();
});

describe("preview with the free pre-scan", () => {
  const SCAN = {
    id: "gs-1", status: "succeeded", error: null, quality: { status: "ok", reason: null }, reason: null, expires_at: null,
    image: { width: 1000, height: 1000 },
    pieces: [
      { index: 0, category: "shirt", colors: ["white"], box: { x: 10, y: 10, width: 300, height: 400 } },
      { index: 1, category: "jeans", colors: ["blue"], box: { x: 500, y: 10, width: 300, height: 600 } },
    ],
  };

  test("shows what was found and creates only the picked pieces at the server price", async () => {
    mockParams = { uri: "file:///photo.jpg" };
    (scanGarments as jest.Mock).mockResolvedValueOnce(SCAN);
    (generateFromGarmentScan as jest.Mock).mockReturnValue(new Promise(() => {}));
    await renderWith(<PreviewScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(5) });
    expect(await screen.findByText("2 garments found")).toBeTruthy();
    expect(screen.getByText("Front catalog image × 2")).toBeTruthy();
    await fireEvent.press(screen.getByRole("checkbox", { name: "1, White shirt" }));
    expect(screen.getByText("Front catalog image × 1")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Generate 1 Item · 1 credit" }));
    expect(generateFromGarmentScan).toHaveBeenCalledWith("gs-1", [1], 1, expect.any(Function));
    expect(mockReplace).toHaveBeenCalledWith("/capture/processing");
  });

  test("short of credits it says how many to leave out", async () => {
    mockParams = { uri: "file:///photo.jpg" };
    (scanGarments as jest.Mock).mockResolvedValueOnce(SCAN);
    await renderWith(<PreviewScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(1) });
    await fireEvent.press(await screen.findByRole("button", { name: "Generate 2 Items · 2 credits" }));
    expect(screen.getByText(/Leave out 1 piece/)).toBeTruthy();
    expect(generateFromGarmentScan).not.toHaveBeenCalled();
  });

  test("a worn photo found nothing to add and offers the outfit flow", async () => {
    mockParams = { uri: "file:///photo.jpg" };
    (scanGarments as jest.Mock).mockResolvedValueOnce({ ...SCAN, pieces: [], reason: "No garment to add: worn on body." });
    await renderWith(<PreviewScreen />, { outfit: true });
    expect(await screen.findByText("No pieces found")).toBeTruthy();
    expect(screen.getByText("This looks like someone wearing the clothes. Try as a worn photo.")).toBeTruthy();
    expect(screen.getByText("We'll scan this photo again for free.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try as a worn photo" }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/detect", params: { uri: "file:///photo.jpg" } });
  });

  test("if the pre-scan fails it falls back to choosing how many to create", async () => {
    mockParams = { uri: "file:///photo.jpg" };
    (scanGarments as jest.Mock).mockRejectedValueOnce(new Error("not found"));
    await renderWith(<PreviewScreen />);
    expect(await screen.findByText(/choose how many to create instead/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Catalog Images" })).toBeTruthy();
  });
});
