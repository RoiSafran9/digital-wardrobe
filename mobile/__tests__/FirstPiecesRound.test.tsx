import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import FirstPiecesPick, { CAP_TOAST } from "../app/first-pieces/pick";
import FirstPiecesProcessing, { ROUND_TITLE } from "../app/first-pieces/processing";
import { pollJob, scanGarments, startGarmentGenerate } from "../src/api/client";
import { NO_CREDITS } from "../src/api/v1";
import type { Credits, GarmentScan } from "../src/api/types";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { FirstPiecesProvider, useFirstPieces } from "../src/firstPieces/FirstPiecesProvider";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush, back: mockBack }) }));
jest.mock("../src/api/client", () => ({ scanGarments: jest.fn(), startGarmentGenerate: jest.fn(), pollJob: jest.fn() }));
const mockToast = jest.fn();
jest.mock("../src/ui/Toast", () => ({ ...jest.requireActual("../src/ui/Toast"), useToast: () => ({ show: mockToast }) }));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `r${++mockUuid}` }));

const scanMock = scanGarments as jest.Mock;
const startMock = startGarmentGenerate as jest.Mock;
const pollMock = pollJob as jest.Mock;

const scan = (id: string, cats: string[], extra: Partial<GarmentScan> = {}): GarmentScan => ({
  id, status: "succeeded", error: null, quality: { status: "ok", reason: null }, reason: null, image: { width: 1000, height: 1000 }, expires_at: null,
  pieces: cats.map((category, index) => ({ index, category, colors: ["blue"], box: { x: index * 10, y: 0, width: 100 - index, height: 100 - index } })),
  ...extra,
});
const job = (id: string, status = "queued", item_ids: string[] = []) => ({ id, status, error: null, item_ids, quality: null, failed: [] });
const credits = (available: number) => ({ balance: available, held: 0, available, granted: 40, used: 0, entries: [], next_before: null }) as Credits;

let fp: ReturnType<typeof useFirstPieces>;
function Probe() { fp = useFirstPieces(); return null; }

function renderFlow(screenEl: React.ReactElement, value: Partial<CreditsValue> = {}) {
  const full: CreditsValue = { billing: true, prices: { garment: 1 }, credits: credits(40), outfit: true, generation: true, refresh: jest.fn(async () => {}), ...value };
  return render(
    <CreditsContext.Provider value={full}>
      <FirstPiecesProvider userId="u1"><Probe />{screenEl}</FirstPiecesProvider>
    </CreditsContext.Provider>,
  );
}

async function pickWith(scans: GarmentScan[], value: Partial<CreditsValue> = {}) {
  const view = renderFlow(<Probe />, value);
  await act(async () => {});
  act(() => fp.addPhotos(scans.map((_, i) => `file:///p${i}.jpg`)));
  scans.forEach((s) => scanMock.mockResolvedValueOnce(s));
  view.rerender(
    <CreditsContext.Provider value={{ billing: true, prices: { garment: 1 }, credits: credits(40), outfit: true, generation: true, refresh: jest.fn(async () => {}), ...value }}>
      <FirstPiecesProvider userId="u1"><Probe /><FirstPiecesPick /></FirstPiecesProvider>
    </CreditsContext.Provider>,
  );
  await act(async () => {});
  return view;
}

beforeEach(async () => { jest.clearAllMocks(); mockUuid = 0; await AsyncStorage.clear(); });

test("pieces from every photo are listed; a sixth pick is refused with a hint", async () => {
  await pickWith([scan("s0", ["shirt", "jeans", "jacket"]), scan("s1", ["sweater", "skirt", "coat"])]);
  expect(scanMock).toHaveBeenCalledTimes(2);
  expect(screen.getByText("We found 6 pieces")).toBeTruthy();
  expect(screen.getByText("Pick up to 5 for this round. You can add the rest next.")).toBeTruthy();
  expect(screen.getByText("5 of 5 selected")).toBeTruthy();
  const off = screen.getAllByRole("checkbox").find((c) => !c.props.accessibilityState.checked)!;
  fireEvent.press(off);
  expect(mockToast).toHaveBeenCalledWith(CAP_TOAST);
  expect(screen.getByRole("button", { name: "Create 5 Pieces · 5 credits" })).toBeTruthy();
});

test("confirming the cost starts one job per photo at the server price and opens the round's progress", async () => {
  await pickWith([scan("s0", ["shirt", "jeans"]), scan("s1", ["sweater"])]);
  expect(screen.getByText("Tap a piece to leave it out.")).toBeTruthy();
  startMock.mockImplementation(async (scanId: string) => job(`job-${scanId}`));
  pollMock.mockReturnValue(new Promise(() => {}));
  fireEvent.press(screen.getByRole("button", { name: "Create 3 Pieces · 3 credits" }));
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Create · 3 credits" })));
  expect(startMock.mock.calls.map((c) => [c[0], c[1], c[2]])).toEqual([["s0", [0, 1], 1], ["s1", [0], 1]]);
  expect(mockReplace).toHaveBeenCalledWith("/first-pieces/processing");
});

test("short of credits it says how many pieces to leave out, and starts nothing", async () => {
  await pickWith([scan("s0", ["shirt", "jeans", "coat"])], { credits: credits(2) });
  fireEvent.press(screen.getByRole("button", { name: "Create 3 Pieces · 3 credits" }));
  expect(screen.getByText(/Leave out 1 piece to continue with what you have\./)).toBeTruthy();
  expect(startMock).not.toHaveBeenCalled();
});

test("unusable, empty and worn photos say why; fewer than three suggests another photo", async () => {
  await pickWith([
    scan("s0", ["shirt"]),
    scan("s1", [], { quality: { status: "retake", reason: "too dark" } }),
    scan("s2", [], { reason: "No garment to add: worn on body" }),
  ]);
  expect(screen.getByText("We found 1 piece")).toBeTruthy();
  expect(screen.getByText("Tap a piece to leave it out. Add another photo to reach 3.")).toBeTruthy();
  expect(screen.getByText(/This photo can't be used: too dark/)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Try it as an outfit photo" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/outfit/detect", params: { uri: "file:///p2.jpg", flow: "outfit", onboarding: "1" } });
});

test("nothing found anywhere offers more photos; billing off shows no amounts", async () => {
  await pickWith([scan("s0", [], { reason: "No garment found" })], { billing: false });
  expect(screen.getByText("We couldn't find clothes in these photos")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Add Photos" }));
  expect(mockBack).toHaveBeenCalled();
});

test("paused generation keeps Create off", async () => {
  await pickWith([scan("s0", ["shirt"])], { generation: false });
  expect(screen.getByRole("button", { name: "Create 1 Piece · 1 credit" })).toBeDisabled();
});

async function submitted(jobs: { scanId: string; result: Promise<unknown> | "credits" }[]) {
  const view = renderFlow(<Probe />);
  await act(async () => {});
  act(() => fp.addPhotos(jobs.map((_, i) => `file:///p${i}.jpg`)));
  jobs.forEach((j) => scanMock.mockResolvedValueOnce(scan(j.scanId, ["shirt", "jeans"])));
  await act(() => fp.scanAll());
  for (const j of jobs) {
    if (j.result === "credits") startMock.mockRejectedValueOnce(new Error(NO_CREDITS));
    else { startMock.mockResolvedValueOnce(job(`job-${j.scanId}`)); pollMock.mockReturnValueOnce(j.result); }
  }
  await act(() => fp.submitRound(1));
  view.rerender(
    <CreditsContext.Provider value={{ billing: true, prices: { garment: 1 }, credits: credits(40), refresh: jest.fn(async () => {}) }}>
      <FirstPiecesProvider userId="u1"><Probe /><FirstPiecesProcessing /></FirstPiecesProvider>
    </CreditsContext.Provider>,
  );
  await act(async () => {});
}

test("while running it shows the round's progress; a clean finish opens the closet with the popup", async () => {
  let finish: (v: unknown) => void = () => {};
  const view = renderFlow(<Probe />);
  await act(async () => {});
  act(() => fp.addPhotos(["file:///p0.jpg"]));
  scanMock.mockResolvedValueOnce(scan("s0", ["shirt", "jeans"]));
  await act(() => fp.scanAll());
  startMock.mockResolvedValueOnce(job("job-1"));
  pollMock.mockReturnValueOnce(new Promise((r) => { finish = r; }));
  await act(() => fp.submitRound(1));
  view.rerender(
    <CreditsContext.Provider value={{ billing: true, prices: { garment: 1 }, credits: credits(40), refresh: jest.fn(async () => {}) }}>
      <FirstPiecesProvider userId="u1"><Probe /><FirstPiecesProcessing /></FirstPiecesProvider>
    </CreditsContext.Provider>,
  );
  expect(screen.getByText(ROUND_TITLE)).toBeTruthy();
  await act(async () => finish(job("job-1", "succeeded", ["i1", "i2"])));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/closet", params: expect.objectContaining({ celebrate: "1", ids: "i1,i2" }) });
});

test("partial success says what wasn't made and that its credits came back", async () => {
  await submitted([
    { scanId: "s0", result: Promise.resolve(job("job-s0", "succeeded", ["i1"])) },
    { scanId: "s1", result: Promise.reject(new Error("Something went wrong — try again")) },
  ]);
  expect(screen.getByText("1 piece created")).toBeTruthy();
  expect(screen.getByText(/3 couldn't be made\. Something went wrong — try again Credits for pieces that weren't made were returned\./)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "See My Closet" }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/closet", params: expect.objectContaining({ ids: "i1" }) });
});

test("nothing made: try again or choose other photos", async () => {
  await submitted([{ scanId: "s0", result: Promise.reject(new Error("This photo's scan has expired — take the photo again")) }]);
  expect(screen.getByText("We couldn't make your pieces")).toBeTruthy();
  startMock.mockResolvedValueOnce(job("job-retry"));
  pollMock.mockReturnValueOnce(new Promise(() => {}));
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Try Again" })));
  expect(startMock).toHaveBeenLastCalledWith("s0", [0, 1], 1, expect.stringMatching(/^fp:r\d+:s0:/));
});

test("out of credits mid-round: what started keeps going, the rest is explained", async () => {
  await submitted([
    { scanId: "s0", result: new Promise(() => {}) },
    { scanId: "s1", result: "credits" },
  ]);
  expect(screen.getByText("2 pieces weren't started")).toBeTruthy();
  expect(screen.getByText("Not enough AI credits for them. Ask the app owner for more.")).toBeTruthy();
});

test("Home's banner shows a round resumed after a restart and opens its progress", async () => {
  const { CaptureBanner } = require("../src/components/home/CaptureBanner");
  const { CaptureJobsProvider } = require("../src/store/captureJobs");
  const { inflightKey } = require("../src/firstPieces/FirstPiecesProvider");
  await AsyncStorage.setItem(inflightKey("u1"), JSON.stringify({ id: "r9", startedAt: 1, jobs: [
    { plan: { photoId: "ph1", scanId: "s0", indexes: [0] }, key: "fp:r9:s0", jobId: "job-a", photoUri: "file:///a.jpg", unitPrice: 1 },
  ] }));
  pollMock.mockReturnValue(new Promise(() => {}));
  renderFlow(<CaptureJobsProvider><CaptureBanner /></CaptureJobsProvider>);
  await act(async () => {});
  fireEvent.press(screen.getByRole("button", { name: "Creating your first pieces…" }));
  expect(mockPush).toHaveBeenCalledWith("/first-pieces/processing");
});
