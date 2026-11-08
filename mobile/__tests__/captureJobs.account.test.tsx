// Garment captures in account mode: written down per account before they are sent, followed until the server says
// they are over (a lost connection or a slow job is never a failure), and reconnected after a restart by job id
// or by key — never a second job or a second credit hold.
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
  isAccountMode, pollJob, reconnectGarmentJob, runFromJob, startGarmentGenerate, startGarmentJob,
} from "../src/api/client";
import { ApiError, followTiming, type Job, type JobWatch } from "../src/api/v1";
import type { RunResponse } from "../src/api/types";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { CaptureJobsProvider, captureJobsKey, useCaptureJobs } from "../src/store/captureJobs";
import { JobsBanner } from "../src/components/jobs/JobsBanner";
import ProcessingScreen from "../app/capture/processing";

jest.mock("../src/api/client", () => ({
  ...jest.requireActual("../src/api/client"),
  isAccountMode: jest.fn(() => true), pollJob: jest.fn(), reconnectGarmentJob: jest.fn(), runFromJob: jest.fn(),
  startGarmentGenerate: jest.fn(), startGarmentJob: jest.fn(), postRun: jest.fn(), generateFromGarmentScan: jest.fn(),
}));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `k${++mockUuid}` }));
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

const job = (id: string, status: Job["status"] = "queued", extra: Partial<Job> = {}): Job =>
  ({ id, status, error: null, item_ids: [], quality: null, failed: [], ...extra });
const RUN: RunResponse = { run_id: "r", quality: { status: "ok", reason: null }, items: [], failed: [] };
type Followed = { watch: JobWatch; resolve: (j: Job) => void; reject: (e: Error) => void };
let followed: Record<string, Followed>;

let api: ReturnType<typeof useCaptureJobs>;
function Probe() {
  api = useCaptureJobs();
  return null;
}
const credits: CreditsValue = { billing: false, prices: {}, credits: null, outfit: true, refresh: jest.fn(async () => {}) };
const mount = (userId = "u1", extra: React.ReactNode = null) => render(
  <CreditsContext.Provider value={credits}><CaptureJobsProvider userId={userId}><Probe />{extra}</CaptureJobsProvider></CreditsContext.Provider>);
const stored = async (userId = "u1") => JSON.parse((await AsyncStorage.getItem(captureJobsKey(userId))) ?? "null");
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 5)); });
const pace = { ...followTiming };

beforeEach(async () => {
  jest.clearAllMocks();
  mockUuid = 0;
  followed = {};
  (isAccountMode as jest.Mock).mockReturnValue(true);
  (pollJob as jest.Mock).mockImplementation((jobId: string, watch: JobWatch) => new Promise<Job>((resolve, reject) => {
    followed[jobId] = { watch, resolve, reject };
  }));
  (runFromJob as jest.Mock).mockResolvedValue(RUN);
  await AsyncStorage.clear();
  Object.assign(followTiming, pace, { pollMs: 1, maxBackoffMs: 2 });
});
afterAll(() => Object.assign(followTiming, pace));

test("picked pieces become a job written down under its key first, followed with the server's count, then listed", async () => {
  let savedFirst = false;
  (startGarmentGenerate as jest.Mock).mockImplementation(async (_s: string, _i: number[], _p: number, key: string) => {
    savedFirst = (await stored())?.[0]?.key === key;
    return job("job-1");
  });
  await mount("u1", <ProcessingScreen />);
  await act(async () => api.startFromScan("file:///p.jpg", "gs-1", [0, 1], 1));
  await flush();
  expect(savedFirst).toBe(true);
  expect(startGarmentGenerate).toHaveBeenCalledWith("gs-1", [0, 1], 1, "cap:k1");
  expect(screen.getByText("Waiting for a free spot…")).toBeTruthy();
  await act(async () => followed["job-1"].watch.onJob!(job("job-1", "running", { progress: { done: 1, total: 2, made: 1 } })));
  expect(api.current).toMatchObject({ status: "running", phase: "running", progress: { done: 1, total: 2, made: 1 } });
  expect(screen.getAllByText("1 of 2 done").length).toBeGreaterThan(0);
  await act(async () => followed["job-1"].resolve(job("job-1", "succeeded", { item_ids: ["i1", "i2"] })));
  await flush();
  expect(runFromJob).toHaveBeenCalledWith(expect.objectContaining({ id: "job-1" }));
  expect(api.current).toMatchObject({ status: "done", result: RUN });
  expect(mockReplace).toHaveBeenCalledWith("/capture/results");  // watching the processing screen: on to the results
  expect(await stored()).toBeNull();
});

test("a lost connection while following keeps the job running — no failure, no Try Again, nothing started again", async () => {
  (startGarmentGenerate as jest.Mock).mockResolvedValue(job("job-1"));
  await mount("u1", <ProcessingScreen />);
  await act(async () => api.startFromScan("file:///p.jpg", "gs-1", [0], 1));
  await flush();
  await act(async () => followed["job-1"].watch.onOffline!(true));
  expect(api.current).toMatchObject({ status: "running", offline: true });
  expect(screen.getByText("Reconnecting to KIPS…")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Try Again" })).toBeNull();
  expect(startGarmentGenerate).toHaveBeenCalledTimes(1);
  expect((await stored())?.[0]).toMatchObject({ key: "cap:k1", jobId: "job-1" });
});

test("leaving the processing screen keeps the job: the banner on another screen shows it and opens its details", async () => {
  (startGarmentGenerate as jest.Mock).mockResolvedValue(job("job-1"));
  const view = await mount("u1", <ProcessingScreen />);
  await act(async () => api.startFromScan("file:///p.jpg", "gs-1", [0, 1], 1));
  await flush();
  await view.unmount();
  // Back on Home / Closet: a new tree with the same provider state isn't possible in a unit test, so render the
  // banner under a provider that resumes this account's job (as after leaving and coming back).
  await mount("u1", <JobsBanner />);
  await flush();
  await act(async () => followed["job-1"].watch.onJob!(job("job-1", "running", { progress: { done: 1, total: 2, made: 1 } })));
  expect(screen.getByRole("button", { name: "Creating your pieces…" })).toBeTruthy();
  expect(screen.getByText("1 of 2 done")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Creating your pieces…" }));
  expect(mockPush).toHaveBeenCalledWith("/capture/processing");
  expect(startGarmentGenerate).toHaveBeenCalledTimes(1);  // resumed by id, not sent again
});

test("after a restart: by job id, or by key without the photo — the photo is sent only if the server never got it", async () => {
  await AsyncStorage.setItem(captureJobsKey("u1"), JSON.stringify([
    { photoUri: "file:///a.jpg", startedAt: 1, key: "cap:a", jobId: "job-a", phase: "running" },
    { photoUri: "file:///b.jpg", maxFronts: 2, startedAt: 2, key: "cap:b", phase: "sending" },
    { photoUri: "file:///c.jpg", maxFronts: 1, startedAt: 3, key: "cap:c", phase: "sending" },
  ]));
  (reconnectGarmentJob as jest.Mock).mockImplementation(async (key: string) => {
    if (key === "cap:b") return job("job-b", "running");
    throw new ApiError("No photo provided.", "r", "POST /v1/jobs", 400, true);
  });
  (startGarmentJob as jest.Mock).mockResolvedValue(job("job-c"));
  await mount();
  await flush();
  expect(pollJob).toHaveBeenCalledWith("job-a", expect.any(Object));
  expect(reconnectGarmentJob).toHaveBeenCalledWith("cap:b");
  expect(pollJob).toHaveBeenCalledWith("job-b", expect.any(Object));
  expect(startGarmentJob).toHaveBeenCalledTimes(1);
  expect(startGarmentJob).toHaveBeenCalledWith("file:///c.jpg", 1, "cap:c");  // never arrived: same key, sent once
  expect(api.jobs.map((j) => j.jobId)).toEqual(["job-a", "job-b", "job-c"]);
});

test("a send with no answer is sent again under the same key until the server answers", async () => {
  (startGarmentJob as jest.Mock).mockRejectedValueOnce(new ApiError("Can't reach", "r", "POST /v1/jobs", 0));
  (reconnectGarmentJob as jest.Mock).mockResolvedValue(job("job-1"));
  await mount();
  await act(async () => api.start("file:///p.jpg", 2));
  await flush();
  expect(startGarmentJob).toHaveBeenCalledWith("file:///p.jpg", 2, "cap:k1");
  expect(reconnectGarmentJob).toHaveBeenCalledWith("cap:k1");  // asks by key before sending the photo again
  expect(startGarmentJob).toHaveBeenCalledTimes(1);
  expect(api.current).toMatchObject({ status: "running", jobId: "job-1" });
});

test("a job the server failed can be tried again, as a new job under a new key", async () => {
  (startGarmentGenerate as jest.Mock).mockResolvedValue(job("job-1"));
  await mount();
  await act(async () => api.startFromScan("file:///p.jpg", "gs-1", [0], 1));
  await flush();
  await act(async () => followed["job-1"].reject(new Error("Couldn't make the image — try again.")));
  expect(api.current).toMatchObject({ status: "failed", error: "Couldn't make the image — try again." });
  await act(async () => api.retry());
  await flush();
  expect((startGarmentGenerate as jest.Mock).mock.calls.map((c) => c[3])).toEqual(["cap:k1", "cap:k2"]);
});

test("a refusal (not enough credits) fails at once and keeps nothing stored", async () => {
  (startGarmentGenerate as jest.Mock).mockRejectedValue(new ApiError("Not enough AI credits. Ask the app owner for more.", "r", "POST", 402, true));
  await mount();
  await act(async () => api.startFromScan("file:///p.jpg", "gs-1", [0], 1));
  await flush();
  expect(api.current).toMatchObject({ status: "failed", insufficient: true });
  expect(await stored()).toBeNull();
  expect(pollJob).not.toHaveBeenCalled();
});

test("another account never sees or reconnects this account's captures", async () => {
  await AsyncStorage.setItem(captureJobsKey("u1"), JSON.stringify([{ photoUri: "file:///a.jpg", startedAt: 1, key: "cap:a", jobId: "job-a" }]));
  await mount("u2", <JobsBanner />);
  await flush();
  expect(api.jobs).toEqual([]);
  expect(pollJob).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).toBeNull();
});

test("an expired session while following leaves the capture running, never failed", async () => {
  const { SESSION_EXPIRED } = require("../src/api/v1");
  (startGarmentGenerate as jest.Mock).mockResolvedValue(job("job-1"));
  await mount();
  await act(async () => api.startFromScan("file:///p.jpg", "gs-1", [0], 1));
  await flush();
  await act(async () => followed["job-1"].reject(new ApiError(SESSION_EXPIRED, "r", "GET /v1/jobs/{id}", 401)));
  expect(api.current).toMatchObject({ status: "running", jobId: "job-1" });
  expect((await stored())?.[0]).toMatchObject({ key: "cap:k1", jobId: "job-1" });
});
