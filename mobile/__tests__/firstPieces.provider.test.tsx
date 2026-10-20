import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render } from "@testing-library/react-native";
import { pollJob, scanGarments, startGarmentGenerate } from "../src/api/client";
import { NO_CREDITS, SIGNED_OUT } from "../src/api/v1";
import type { GarmentScan } from "../src/api/types";
import { FirstPiecesProvider, inflightKey, useFirstPieces } from "../src/firstPieces/FirstPiecesProvider";

jest.mock("../src/api/client", () => ({ scanGarments: jest.fn(), startGarmentGenerate: jest.fn(), pollJob: jest.fn() }));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `r${++mockUuid}` }));
const scanMock = scanGarments as jest.Mock;
const startMock = startGarmentGenerate as jest.Mock;
const pollMock = pollJob as jest.Mock;

const scan = (id: string, sizes: number[]): GarmentScan => ({
  id, status: "succeeded", error: null, quality: { status: "ok", reason: null }, reason: null, image: null, expires_at: null,
  pieces: sizes.map((s, index) => ({ index, category: "shirt", colors: ["blue"], box: { x: 0, y: 0, width: s, height: s } })),
});
const job = (id: string, status = "queued", item_ids: string[] = []) =>
  ({ id, status, error: null, item_ids, quality: null, failed: [] });

let fp: ReturnType<typeof useFirstPieces>;
function Probe() {
  fp = useFirstPieces();
  return null;
}
const mount = (userId: string | null = "u1") => render(<FirstPiecesProvider userId={userId}><Probe /></FirstPiecesProvider>);
const stored = async () => JSON.parse((await AsyncStorage.getItem(inflightKey("u1"))) ?? "null");
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(async () => {
  jest.clearAllMocks();
  mockUuid = 0;
  await AsyncStorage.clear();
});

async function scannedRound(sizesByPhoto: number[][]) {
  mount();
  await flush();
  sizesByPhoto.forEach((sizes, i) => scanMock.mockResolvedValueOnce(scan(`s${i}`, sizes)));
  act(() => fp.addPhotos(sizesByPhoto.map((_, i) => `file:///p${i}.jpg`)));
  await act(() => fp.scanAll());
}

test("photos are scanned for free and their pieces listed, at most five picked by default", async () => {
  await scannedRound([[10, 20, 30], [40, 50, 60]]);
  expect(scanMock).toHaveBeenCalledTimes(2);
  expect(fp.photos.map((p) => p.state)).toEqual(["found", "found"]);
  expect(fp.pieces).toHaveLength(6);
  expect(fp.selected).toEqual(["ph1:1", "ph1:2", "ph2:0", "ph2:1", "ph2:2"]);
  let allowed = true;
  act(() => { allowed = fp.togglePiece("ph1:0"); });
  expect(allowed).toBe(false);
});

test("a scan refused for the hourly limit marks that photo and the rest as not checked yet", async () => {
  mount();
  await flush();
  scanMock.mockRejectedValue(new Error("Too many photo scans in the last hour — try again in a little while"));
  act(() => fp.addPhotos(["file:///a.jpg", "file:///b.jpg", "file:///c.jpg"]));
  await act(() => fp.scanAll());
  expect(fp.photos.every((p) => p.state === "limited")).toBe(true);
  expect(scanMock.mock.calls.length).toBeLessThanOrEqual(2);
});

test("a confirmed round is written down before each job is sent, one job per photo under a kept key", async () => {
  await scannedRound([[10, 20], [30]]);
  const order: string[] = [];
  startMock.mockImplementation(async (scanId: string, _i: number[], _p: number, key: string) => {
    order.push(`start ${key} saved=${JSON.stringify(await stored()).includes(key)}`);
    return job(`job-${scanId}`);
  });
  pollMock.mockReturnValue(new Promise(() => {}));
  await act(() => fp.submitRound(1));
  expect(order).toEqual(["start fp:r1:s0 saved=true", "start fp:r1:s1 saved=true"]);
  expect(startMock).toHaveBeenCalledWith("s0", [0, 1], 1, "fp:r1:s0");
  expect((await stored()).jobs.map((j: { jobId: string }) => j.jobId)).toEqual(["job-s0", "job-s1"]);
  expect(fp.summary).toMatchObject({ requested: 3, running: 2, settled: false });
  expect(fp.pieces).toHaveLength(0);  // used pieces don't come back for the next round
});

test("when every job finishes the round is settled and the record removed", async () => {
  await scannedRound([[10, 20]]);
  startMock.mockResolvedValue(job("job-1"));
  pollMock.mockImplementation(async (_id: string, onProgress: (p: object) => void) => {
    onProgress({ done: 1, total: 2 });
    return job("job-1", "succeeded", ["i1"]);
  });
  await act(() => fp.submitRound(null));
  await flush();
  expect(fp.summary).toEqual({ requested: 2, made: 1, notMade: 1, running: 0, unsent: 0, settled: true });
  expect(await stored()).toBeNull();
});

test("not enough credits on the second job: the first keeps going, the rest wait unsent", async () => {
  await scannedRound([[10], [20], [30]]);
  startMock.mockResolvedValueOnce(job("job-1")).mockRejectedValueOnce(new Error(NO_CREDITS));
  pollMock.mockReturnValue(new Promise(() => {}));
  await act(() => fp.submitRound(1));
  expect(startMock).toHaveBeenCalledTimes(2);
  expect(fp.round?.stopped).toBe("credits");
  expect(fp.round?.jobs.map((j) => j.status)).toEqual(["running", "unsent", "unsent"]);
  startMock.mockResolvedValueOnce(job("job-2")).mockResolvedValueOnce(job("job-3"));
  await act(() => fp.sendUnsent());
  expect(startMock.mock.calls.slice(2).map((c) => c[3])).toEqual(["fp:r1:s1", "fp:r1:s2"]);  // the same keys
  expect(fp.round?.stopped).toBeNull();
});

test("a changed price stops sending until the user confirms the new one", async () => {
  await scannedRound([[10], [20]]);
  startMock.mockRejectedValueOnce(new Error("The price changed — check it and confirm again"));
  await act(() => fp.submitRound(1));
  expect(fp.round?.stopped).toBe("price");
  startMock.mockResolvedValue(job("job-x"));
  pollMock.mockReturnValue(new Promise(() => {}));
  await act(() => fp.sendUnsent(2));
  expect(startMock.mock.calls.slice(1).map((c) => c[2])).toEqual([2, 2]);
});

test("after a restart, sent jobs are followed again and unsent ones sent under the same key", async () => {
  await AsyncStorage.setItem(inflightKey("u1"), JSON.stringify({ id: "r9", startedAt: 1, jobs: [
    { plan: { photoId: "ph1", scanId: "s0", indexes: [0] }, key: "fp:r9:s0", jobId: "job-a", photoUri: "file:///a.jpg", unitPrice: 1 },
    { plan: { photoId: "ph2", scanId: "s1", indexes: [0, 1] }, key: "fp:r9:s1", photoUri: "file:///b.jpg", unitPrice: 1 },
  ] }));
  pollMock.mockReturnValue(new Promise(() => {}));
  startMock.mockResolvedValue(job("job-b"));
  mount();
  await flush();
  expect(pollMock).toHaveBeenCalledWith("job-a", expect.any(Function));
  expect(startMock).toHaveBeenCalledTimes(1);
  expect(startMock).toHaveBeenCalledWith("s1", [0, 1], 1, "fp:r9:s1");
  expect(fp.round?.jobs.map((j) => j.status)).toEqual(["running", "running"]);
});

test("another account never sees this account's round", async () => {
  await AsyncStorage.setItem(inflightKey("u1"), JSON.stringify({ id: "r9", startedAt: 1, jobs: [] }));
  render(<FirstPiecesProvider userId="u2"><Probe /></FirstPiecesProvider>);
  await flush();
  expect(fp.round).toBeNull();
});

test("a failed job is tried again as a new job under a new key; signing out leaves jobs alone", async () => {
  await scannedRound([[10], [20]]);
  startMock.mockResolvedValueOnce(job("job-1")).mockResolvedValueOnce(job("job-2"));
  pollMock.mockRejectedValueOnce(new Error("Something went wrong — try again")).mockRejectedValueOnce(new Error(SIGNED_OUT));
  await act(() => fp.submitRound(1));
  await flush();
  expect(fp.round?.jobs.map((j) => j.status)).toEqual(["failed", "running"]);
  startMock.mockResolvedValueOnce(job("job-3"));
  pollMock.mockReturnValue(new Promise(() => {}));
  await act(() => fp.retryFailed());
  const retryKey = startMock.mock.calls[2][3];
  expect(retryKey).toMatch(/^fp:r1:s0:/);
  expect(retryKey).not.toBe("fp:r1:s0");
});
