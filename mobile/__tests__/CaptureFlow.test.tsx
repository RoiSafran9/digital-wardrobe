import React, { useEffect } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import CameraScreen from "../app/capture/camera";
import PreviewScreen from "../app/capture/preview";
import ProcessingScreen from "../app/capture/processing";
import ResultsScreen from "../app/capture/results";
import SavedScreen from "../app/capture/saved";
import { deleteItem, postRun } from "../src/api/client";
import type { RunResponse } from "../src/api/types";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { CaptureJobsProvider, useCaptureJobs } from "../src/store/captureJobs";
import { pickPhoto } from "../src/photoPicker";

jest.mock("../src/api/client", () => ({ ...jest.requireActual("../src/api/client"), postRun: jest.fn(), deleteItem: jest.fn() }));
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
  test("the close button sits below the status bar and closes the camera", () => {
    renderWith(<CameraScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Close camera" }));
    expect(mockBack).toHaveBeenCalled();
    // Even when the modal reports no safe-area inset, the controls start below the status bar.
    const padded = screen.UNSAFE_root.findAll((n: { props: { style?: { paddingTop?: unknown } } }) => typeof n.props.style?.paddingTop === "number" && n.props.style.paddingTop >= 60);
    expect(padded.length).toBeGreaterThan(0);
  });

  test("the shutter takes the photo and opens its preview", async () => {
    renderWith(<CameraScreen />);
    expect(screen.getByText("Lay pieces flat · daylight works best")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Take garment photo" })));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/capture/preview", params: { uri: "file:///camera.jpg" } });
  });

  test("outfit mode sends the photo to the free scan; the switch shows only when outfits are on", async () => {
    renderWith(<CameraScreen />);
    expect(screen.queryByRole("tab", { name: "Outfit" })).toBeNull();
    screen.unmount();
    renderWith(<CameraScreen />, { outfit: true });
    fireEvent.press(screen.getByRole("tab", { name: "Outfit" }));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Take outfit photo" })));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/detect", params: { uri: "file:///camera.jpg" } });
  });

  test("with the camera refused it offers the photo library", async () => {
    (global as any).__cameraPermission = [{ granted: false, canAskAgain: false }, jest.fn()];
    (pickPhoto as jest.Mock).mockResolvedValue("file:///lib.jpg");
    renderWith(<CameraScreen />);
    expect(screen.getByText("Camera access is off")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose Garment Photo" })));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/capture/preview", params: { uri: "file:///lib.jpg" } });
  });
});

describe("preview", () => {
  test("billing off: no quote, and creating starts the job", () => {
    mockParams = { uri: "file:///photo.jpg" };
    (postRun as jest.Mock).mockReturnValue(new Promise(() => {}));
    renderWith(<PreviewScreen />);
    expect(screen.queryByText(/credit/)).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Create Catalog Images" }));
    expect(postRun).toHaveBeenCalledWith("file:///photo.jpg", undefined, expect.any(Function));
    expect(mockReplace).toHaveBeenCalledWith("/capture/processing");
  });

  test("billing on: the quote follows the pieces stepper, within what the user can afford", () => {
    mockParams = { uri: "file:///photo.jpg" };
    (postRun as jest.Mock).mockReturnValue(new Promise(() => {}));
    renderWith(<PreviewScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(2) });
    fireEvent.press(screen.getByRole("button", { name: "More pieces" }));
    expect(screen.getByText("Front catalog image × 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "More pieces" })).toBeDisabled();
    fireEvent.press(screen.getByRole("button", { name: "Generate up to 2 Items · 2 credits" }));
    expect(postRun).toHaveBeenCalledWith("file:///photo.jpg", 2, expect.any(Function));
  });

  test("without credits for even one piece it explains instead of starting", () => {
    mockParams = { uri: "file:///photo.jpg" };
    renderWith(<PreviewScreen />, { billing: true, prices: { garment: 1 }, credits: wallet(0) });
    fireEvent.press(screen.getByRole("button", { name: /Generate up to 1 Item/ }));
    expect(postRun).not.toHaveBeenCalled();
    expect(screen.getByText("Not enough credits")).toBeTruthy();
  });
});

describe("processing", () => {
  test("moves to the results when the job is done", async () => {
    renderWith(<Started result={RUN}><ProcessingScreen /></Started>);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/capture/results"));
  });

  test("a failed job pauses with Try Again, and says credits came back when billing is on", async () => {
    renderWith(<Started error={new Error("Can't reach your wardrobe server.")}><ProcessingScreen /></Started>, { billing: true, prices: { garment: 1 }, credits: wallet(3) });
    expect(await screen.findByText("Generation paused")).toBeTruthy();
    expect(screen.getByText(/Credits for unfinished items were returned/)).toBeTruthy();
    (postRun as jest.Mock).mockReturnValue(new Promise(() => {}));
    fireEvent.press(screen.getByRole("button", { name: "Try Again" }));
    expect(postRun).toHaveBeenLastCalledWith("file:///photo.jpg", 2, expect.any(Function));
  });

  test("a photo refused as worn offers the outfit flow with the same photo", async () => {
    renderWith(<Started error={new Error("No garment to add: worn on body")}><ProcessingScreen /></Started>, { outfit: true });
    fireEvent.press(await screen.findByRole("button", { name: "Try it as an outfit photo" }));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/detect", params: { uri: "file:///photo.jpg" } });
  });
});

describe("results and saved", () => {
  test("deselecting a piece removes it on Add, and Saved counts what stayed", async () => {
    (deleteItem as jest.Mock).mockResolvedValue(undefined);
    renderWith(<Started result={RUN}><ResultsScreen /><SavedScreen /></Started>, { billing: true, prices: { garment: 1 }, credits: wallet(5) });
    expect(await screen.findByText("2 pieces created")).toBeTruthy();
    fireEvent.press(screen.getByRole("checkbox", { name: "Navy jeans" }));
    expect(screen.getByText("Credits for removed pieces are not returned.")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Add 1 to Closet" })));
    expect(deleteItem).toHaveBeenCalledTimes(1);
    expect((deleteItem as jest.Mock).mock.calls[0][0].item_id).toBe("item_1");
    expect(mockReplace).toHaveBeenCalledWith("/capture/saved");
    expect(screen.getByText("1 new piece · 2 credits used")).toBeTruthy();
  });

  test("Add is off when nothing is selected", async () => {
    renderWith(<Started result={RUN}><ResultsScreen /></Started>);
    await screen.findByText("2 pieces created");
    fireEvent.press(screen.getByRole("checkbox", { name: "Navy shirt" }));
    fireEvent.press(screen.getByRole("checkbox", { name: "Navy jeans" }));
    expect(screen.getByRole("button", { name: "Add 0 to Closet" })).toBeDisabled();
  });

  test("a photo with nothing in it says so and offers another photo", async () => {
    renderWith(<Started result={{ ...RUN, items: [] }}><ResultsScreen /></Started>);
    expect(await screen.findByText("No pieces found")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Take Another Garment Photo" })).toBeTruthy();
  });

  test("billing off: Saved shows no credits", async () => {
    renderWith(<Started result={RUN}><ResultsScreen /><SavedScreen /></Started>);
    const add = await screen.findByRole("button", { name: "Add 2 to Closet" });
    await act(async () => fireEvent.press(add));
    expect(screen.getByText("2 new pieces")).toBeTruthy();
  });
});

test("the processing card shows the server's piece count when it has one", () => {
  const { ProcessingCard, GARMENT_STAGES } = require("../src/components/capture/ProcessingCard");
  render(<ProcessingCard photoUri="file:///p.jpg" stages={GARMENT_STAGES} startedAt={Date.now()} title="t" note="n" count={{ done: 1, total: 3 }} />);
  expect(screen.getByText("2 of 3")).toBeTruthy();
});
