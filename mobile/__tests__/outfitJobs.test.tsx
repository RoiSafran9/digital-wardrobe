// Outfit photo generation as an app-level job (src/jobs/OutfitJobsProvider): written down per account before it
// is sent, followed until the server says it is over, resumed after a restart under the same key, and shown in
// the jobs banner while the user browses — finishing never moves them anywhere.
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { pollJob, startOutfitGenerate } from "../src/api/client";
import { ApiError, NO_CREDITS, SIGNED_OUT, followTiming, type Job, type JobWatch } from "../src/api/v1";
import { UNREACHABLE } from "../src/api/http";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { OutfitJobsProvider, outfitJobsKey, useOutfitJobs, type OutfitJob, type OutfitStart } from "../src/jobs/OutfitJobsProvider";
import { JobsBanner } from "../src/components/jobs/JobsBanner";
import OutfitProgressScreen from "../app/outfit/progress";

jest.mock("../src/api/client", () => ({ ...jest.requireActual("../src/api/client"), startOutfitGenerate: jest.fn(), pollJob: jest.fn() }));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `k${++mockUuid}` }));
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

const startMock = startOutfitGenerate as jest.Mock;
const pollMock = pollJob as jest.Mock;
const job = (id: string, status: Job["status"] = "queued", extra: Partial<Job> = {}): Job =>
  ({ id, status, error: null, item_ids: [], quality: null, failed: [], ...extra });
const INPUT: OutfitStart = { scanId: "scan-1", candidateIds: ["c1", "c2"], unitPrice: 1, corrections: {},
                             names: { c1: "Black blazer", c2: "Grey trousers" }, photoUri: "file:///o.jpg" };

// A pollJob the test drives: each followed job id gets its watch and a way to finish it.
type Followed = { watch: JobWatch; resolve: (j: Job) => void; reject: (e: Error) => void };
let followed: Record<string, Followed>;
function drivePolls() {
  pollMock.mockImplementation((jobId: string, watch: JobWatch) => new Promise<Job>((resolve, reject) => {
    followed[jobId] = { watch, resolve, reject };
  }));
}

let api: ReturnType<typeof useOutfitJobs>;
function Probe() {
  api = useOutfitJobs();
  return null;
}
const credits: CreditsValue = { billing: true, prices: { garment: 1 }, credits: null, outfit: true, refresh: jest.fn(async () => {}) };
const mount = (userId = "u1", extra: React.ReactNode = null) => render(
  <CreditsContext.Provider value={credits}>
    <OutfitJobsProvider userId={userId}><Probe />{extra}</OutfitJobsProvider>
  </CreditsContext.Provider>);
const stored = async (userId = "u1"): Promise<OutfitJob[] | null> => JSON.parse((await AsyncStorage.getItem(outfitJobsKey(userId))) ?? "null");
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const pace = { ...followTiming };

beforeEach(async () => {
  jest.clearAllMocks();
  mockUuid = 0;
  mockParams = {};
  followed = {};
  drivePolls();
  await AsyncStorage.clear();
  Object.assign(followTiming, pace, { pollMs: 1, maxBackoffMs: 2 });
});
afterAll(() => Object.assign(followTiming, pace));

test("the request is written down under its key before it is sent, then the server's job is followed", async () => {
  await mount();
  let savedFirst = false;
  startMock.mockImplementation(async (...args: unknown[]) => {
    savedFirst = (await stored())?.[0]?.key === args[4];
    return job("job-1");
  });
  let started: OutfitJob | null = null;
  await act(async () => { started = await api.start(INPUT); });
  expect(savedFirst).toBe(true);
  expect(startMock).toHaveBeenCalledWith("scan-1", ["c1", "c2"], 1, {}, "og:k1");
  expect(started).toMatchObject({ key: "og:k1", jobId: "job-1", state: "queued" });
  expect(pollMock).toHaveBeenCalledWith("job-1", expect.objectContaining({ alive: expect.any(Function) }));
  expect((await stored())?.[0]).toMatchObject({ key: "og:k1", jobId: "job-1" });
});

test("browsing elsewhere: the banner follows the server's count, turns to Ready for review, and never navigates", async () => {
  startMock.mockResolvedValue(job("job-1"));
  await mount("u1", <JobsBanner />);
  await act(async () => { await api.start(INPUT); });
  expect(screen.getByRole("button", { name: "Creating your garments…" })).toBeTruthy();
  expect(screen.getByText("Waiting for a free spot")).toBeTruthy();
  await act(async () => followed["job-1"].watch.onJob!(job("job-1", "running", { progress: { done: 1, total: 2, made: 1 } })));
  expect(screen.getByText("1 of 2 done")).toBeTruthy();
  await act(async () => followed["job-1"].resolve(job("job-1", "succeeded", { item_ids: ["i1"], failed: ["c2"], progress: { done: 2, total: 2, made: 1 } })));
  expect(screen.getByRole("button", { name: "Your garments are ready for review" })).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Your garments are ready for review" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/outfit/progress", params: { key: "og:k1" } });
  expect(startMock).toHaveBeenCalledTimes(1);
});

test("the progress screen says Ready for review and waits; Review Now carries what failed and the onboarding mode", async () => {
  startMock.mockResolvedValue(job("job-1"));
  mockParams = { key: "og:k1" };
  await mount("u1", <OutfitProgressScreen />);
  await act(async () => { await api.start({ ...INPUT, onboarding: true }); });
  expect(screen.getByText("Waiting for a free spot…")).toBeTruthy();
  expect(screen.queryByRole("progressbar")).toBeNull();  // no count yet: a spinner, not a made-up percentage
  await act(async () => followed["job-1"].watch.onJob!(job("job-1", "running", { progress: { done: 1, total: 2, made: 0 } })));
  expect(screen.getByRole("progressbar").props.accessibilityValue.now).toBe(50);
  expect(screen.getByText("0 images made · 1 couldn't be made")).toBeTruthy();
  await act(async () => followed["job-1"].resolve(job("job-1", "succeeded", { item_ids: ["i1"], failed: ["c2"] })));
  expect(screen.getByText("Ready for review")).toBeTruthy();
  expect(screen.queryByText(/Saved to (your )?closet/i)).toBeNull();
  expect(mockReplace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Review Now" }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/outfit/review", params: { failed: "grey trousers", onboarding: "1" } });
});

test("after a restart: a started job is followed by its id and an unconfirmed one is sent again under the same key", async () => {
  await AsyncStorage.setItem(outfitJobsKey("u1"), JSON.stringify([
    { ...INPUT, key: "og:a", jobId: "job-a", state: "running", startedAt: 1 },
    { ...INPUT, key: "og:b", state: "sending", startedAt: 2 },
  ]));
  startMock.mockResolvedValue(job("job-b"));
  await mount();
  await flush();
  expect(pollMock).toHaveBeenCalledWith("job-a", expect.any(Object));
  expect(startMock).toHaveBeenCalledTimes(1);
  expect(startMock).toHaveBeenCalledWith("scan-1", ["c1", "c2"], 1, {}, "og:b");  // the same key: no second job or hold
  expect(pollMock).toHaveBeenCalledWith("job-b", expect.any(Object));
  expect(api.jobs.map((j) => [j.key, j.jobId])).toEqual([["og:a", "job-a"], ["og:b", "job-b"]]);
});

test("a lost answer keeps the request and its key, and sends that same key again", async () => {
  await mount();
  startMock.mockRejectedValueOnce(new ApiError(UNREACHABLE, "r1", "POST /v1/outfit-scans/{id}/generate", 0))
    .mockResolvedValueOnce(job("job-1"));
  let started: OutfitJob | null = null;
  await act(async () => { started = await api.start(INPUT); });
  expect(started).toMatchObject({ state: "sending", offline: true });  // not a failure: the server may have it
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  expect(startMock.mock.calls.map((c) => c[4])).toEqual(["og:k1", "og:k1"]);
  expect(api.jobs[0]).toMatchObject({ key: "og:k1", jobId: "job-1", state: "queued", offline: false });
});

test("a refusal (not enough credits, a changed price) is thrown to the screen and forgotten: nothing was made", async () => {
  await mount();
  startMock.mockRejectedValue(new ApiError(NO_CREDITS, "r1", "POST /v1/outfit-scans/{id}/generate", 402, true));
  let thrown: unknown = null;
  await act(async () => { await api.start(INPUT).catch((e) => { thrown = e; }); });
  expect((thrown as Error).message).toBe(NO_CREDITS);
  expect(api.jobs).toEqual([]);
  expect(await stored()).toBeNull();
  expect(pollMock).not.toHaveBeenCalled();
});

test("a job the server failed is shown as failed and never started again; dismissing forgets it", async () => {
  startMock.mockResolvedValue(job("job-1"));
  await mount("u1", <JobsBanner />);
  await act(async () => { await api.start(INPUT); });
  await act(async () => followed["job-1"].reject(new Error("Couldn't make an image of the selected garments — try again or photograph them laid flat.")));
  expect(api.jobs[0]).toMatchObject({ state: "failed", error: expect.stringMatching(/^Couldn't make an image/) });
  expect(screen.getByRole("button", { name: "Your garments couldn't be made — tap to see why" })).toBeTruthy();
  expect(startMock).toHaveBeenCalledTimes(1);
  await act(async () => api.dismiss("og:k1"));
  expect(api.jobs).toEqual([]);
  expect(screen.queryByRole("button")).toBeNull();
});

test("two jobs at once keep their own keys, follow their own job ids and finish independently", async () => {
  startMock.mockResolvedValueOnce(job("job-1")).mockResolvedValueOnce(job("job-2"));
  await mount("u1", <JobsBanner />);
  await act(async () => { await api.start(INPUT); });
  await act(async () => { await api.start({ ...INPUT, scanId: "scan-2", candidateIds: ["c1"] }); });
  expect(startMock.mock.calls.map((c) => [c[0], c[4]])).toEqual([["scan-1", "og:k1"], ["scan-2", "og:k2"]]);
  expect(screen.getByRole("button", { name: "2 AI jobs in progress" })).toBeTruthy();
  await act(async () => followed["job-2"].resolve(job("job-2", "succeeded", { item_ids: ["i9"] })));
  expect(api.jobs.map((j) => [j.key, j.state, j.itemIds ?? null])).toEqual([["og:k1", "queued", null], ["og:k2", "succeeded", ["i9"]]]);
  expect(screen.getByRole("button", { name: "1 AI job in progress · 1 ready" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "1 AI job in progress · 1 ready" }));
  expect(mockPush).toHaveBeenCalledWith("/jobs");
  // Opening review takes only the finished one off the list.
  await act(async () => api.reviewed());
  expect(api.jobs.map((j) => j.key)).toEqual(["og:k1"]);
  expect((await stored())?.map((j) => j.key)).toEqual(["og:k1"]);
});

test("another account never sees, follows or resends this account's jobs", async () => {
  await AsyncStorage.setItem(outfitJobsKey("u1"), JSON.stringify([
    { ...INPUT, key: "og:a", jobId: "job-a", state: "running", startedAt: 1 },
    { ...INPUT, key: "og:b", state: "sending", startedAt: 2 },
  ]));
  await mount("u2", <JobsBanner />);
  await flush();
  expect(api.jobs).toEqual([]);
  expect(pollMock).not.toHaveBeenCalled();
  expect(startMock).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).toBeNull();
  expect((await stored("u1"))?.length).toBe(2);  // kept for its own account
});

test("signing out mid-follow leaves the job as it was for its account", async () => {
  startMock.mockResolvedValue(job("job-1"));
  await mount();
  await act(async () => { await api.start(INPUT); });
  await act(async () => followed["job-1"].reject(new Error(SIGNED_OUT)));
  expect(api.jobs[0]).toMatchObject({ state: "queued", jobId: "job-1" });
  expect((await stored())?.[0]).toMatchObject({ state: "queued", jobId: "job-1" });
});

test("an expired session while following is not a failure; back in the app the same job is followed again", async () => {
  const { AppState } = require("react-native");
  const handlers: ((s: string) => void)[] = [];
  const original = AppState.addEventListener;
  AppState.addEventListener = (_type: unknown, handler: unknown) => {
    handlers.push(handler as (s: string) => void);
    return { remove: () => {} };
  };
  startMock.mockResolvedValue(job("job-1"));
  await mount();
  await act(async () => { await api.start(INPUT); });
  const { SESSION_EXPIRED } = require("../src/api/v1");
  await act(async () => followed["job-1"].reject(new ApiError(SESSION_EXPIRED, "r", "GET /v1/jobs/{id}", 401)));
  expect(api.jobs[0]).toMatchObject({ state: "queued", jobId: "job-1" });  // not failed: no Try Again, no second job
  expect(pollMock).toHaveBeenCalledTimes(1);
  await act(async () => handlers.forEach((h) => h("active")));
  expect(pollMock).toHaveBeenCalledTimes(2);
  expect(pollMock).toHaveBeenLastCalledWith("job-1", expect.any(Object));
  await act(async () => handlers.forEach((h) => h("active")));
  expect(pollMock).toHaveBeenCalledTimes(2);  // already being followed: never twice at once
  expect(startMock).toHaveBeenCalledTimes(1);
  AppState.addEventListener = original;
});


test("paused AI work or a used-up budget (the server's own 503) is shown, not silently retried for hours", async () => {
  await mount();
  startMock.mockRejectedValue(new ApiError("AI generation is paused for now — your closet still works. Try again later.", "r", "POST", 503, true));
  let thrown: unknown = null;
  await act(async () => { await api.start(INPUT).catch((e) => { thrown = e; }); });
  expect((thrown as Error).message).toMatch(/paused/);
  expect(api.jobs).toEqual([]);
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  expect(startMock).toHaveBeenCalledTimes(1);
});

test("a Cloudflare 503/502 page on start is not a refusal: the key is kept and sent again", async () => {
  await mount();
  startMock.mockRejectedValueOnce(new ApiError("Something went wrong (error 502). Try again.", "r", "POST", 502, false))
    .mockResolvedValueOnce(job("job-1"));
  await act(async () => { await api.start(INPUT); });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  expect(startMock.mock.calls.map((c) => c[4])).toEqual(["og:k1", "og:k1"]);
  expect(api.jobs[0]).toMatchObject({ jobId: "job-1" });
});

test("after a lost answer one refusal is checked again before the job is called failed", async () => {
  await mount();
  const refused = new ApiError(NO_CREDITS, "r", "POST", 402, true);
  startMock.mockRejectedValueOnce(new ApiError(UNREACHABLE, "r", "POST", 0))
    .mockRejectedValueOnce(refused)          // raced the first send's own insert
    .mockResolvedValueOnce(job("job-1"));    // the same key now finds the job the first send made
  await act(async () => { await api.start(INPUT); });
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  expect(api.jobs[0]).toMatchObject({ key: "og:k1", jobId: "job-1", state: "queued" });
  expect(new Set(startMock.mock.calls.map((c) => c[4]))).toEqual(new Set(["og:k1"]));
});

test("a restart finds the job still running: 'Reconnecting' clears as soon as the server answers", async () => {
  await AsyncStorage.setItem(outfitJobsKey("u1"), JSON.stringify([{ ...INPUT, key: "og:a", jobId: "job-a", state: "running", offline: true, startedAt: 1 }]));
  await mount();
  await flush();
  await act(async () => followed["job-a"].watch.onJob!(job("job-a", "running")));
  expect(api.jobs[0].offline).toBe(false);
});
