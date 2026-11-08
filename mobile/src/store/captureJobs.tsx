import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import {
  generateFromGarmentScan, isAccountMode, pollJob, postRun, reconnectGarmentJob, runFromJob, startGarmentGenerate, startGarmentJob,
} from "../api/client";
import { ApiError, NO_CREDITS, followTiming, type Job, type JobProgress } from "../api/v1";
import type { ClosetItem, RunResponse } from "../api/types";
import { nap, useOnForeground } from "../api/wake";
import { useCredits } from "../credits/CreditsProvider";
import { noteItemsSaved } from "../morningReminder/closetSignal";
import { isInterruption, isRefusal, message, stateOf, type JobState } from "../jobs/jobState";

export type CaptureJob = {
  id: number;
  photoUri: string;
  maxFronts?: number;
  fromScan?: { scanId: string; indexes: number[]; unitPrice: number | null };  // pieces picked from a pre-scan
  status: "running" | "done" | "failed";
  startedAt: number;
  result?: RunResponse;
  progress?: JobProgress;  // account mode: pieces processed (and made), once they're known
  error?: string;
  insufficient?: boolean;
  // Account mode: the job on the server, written down per account before it is sent.
  key?: string;
  jobId?: string;
  phase?: JobState;        // the server's own status while running ("sending" until it confirms)
  offline?: boolean;       // the last check got no answer; it keeps trying
};

// What the Saved screen shows after either flow: the pieces that joined the closet and what they cost.
export type SavedSummary = { items: ClosetItem[]; creditsUsed: number | null };

type Value = {
  current: CaptureJob | null;
  jobs: CaptureJob[];      // every capture this session follows (current is the newest)
  start: (photoUri: string, maxFronts?: number) => void;
  startFromScan: (photoUri: string, scanId: string, indexes: number[], unitPrice: number | null) => void;
  retry: (id?: number) => void;   // the newest capture, or the one with this id
  clear: (id?: number) => void;
  dismiss: (id: number) => void;
  saved: SavedSummary | null;
  setSaved: (saved: SavedSummary | null) => void;
};

const CaptureJobsContext = createContext<Value | undefined>(undefined);

// For components that also render outside the provider (the jobs banner in tests): null there.
export const useCaptureJobsMaybe = (): Value | null => useContext(CaptureJobsContext) ?? null;

export function useCaptureJobs(): Value {
  const value = useContext(CaptureJobsContext);
  if (!value) throw new Error("useCaptureJobs must be used within a CaptureJobsProvider");
  return value;
}

export const captureJobsKey = (userId: string) => `captureJobs.v1.${userId}`;
type Stored = Pick<CaptureJob, "photoUri" | "maxFronts" | "fromScan" | "startedAt" | "key" | "jobId" | "phase">;
// Tries to send a photo the server says it never got, before saying it couldn't be sent.
const PHOTO_SENDS = 4;
const NOT_SENT = "Your photo couldn't be sent. Nothing was charged — try again.";

// The garment photos being turned into catalog images. They live above the screens, so leaving the processing
// screen never cancels the work (the server job keeps going either way); Home and the jobs banner show them.
// Signed in, each job is written down for this account (on this device) before it is sent, under the
// Idempotency-Key it is always sent with, and followed until the server says it is over: a lost connection or
// a slow job is never reported as a failure, and a restart reconnects to the same job instead of starting
// (and paying for) another. Keyed by user in AppShell, so one account never sees another's capture.
export function CaptureJobsProvider({ userId, children }: { userId?: string | null; children: React.ReactNode }) {
  const [jobs, setJobs] = useState<CaptureJob[]>([]);
  const jobsRef = useRef<CaptureJob[]>([]);
  const [saved, setSaved] = useState<SavedSummary | null>(null);
  const { refresh } = useCredits();
  const latest = useRef(0);
  const alive = useRef(true);
  const following = useRef(new Set<string>());
  useEffect(() => () => { alive.current = false; }, []);
  const persistent = () => !!userId && isAccountMode();

  const commit = useCallback((next: CaptureJob[]) => {
    if (!alive.current) return;
    jobsRef.current = next;
    setJobs(next);
    if (!userId || !isAccountMode()) return;
    const open: Stored[] = next.filter((j) => j.key && j.status === "running")
      .map(({ photoUri, maxFronts, fromScan, startedAt, key, jobId, phase }) => ({ photoUri, maxFronts, fromScan, startedAt, key, jobId, phase }));
    void (open.length ? AsyncStorage.setItem(captureJobsKey(userId), JSON.stringify(open))
      : AsyncStorage.removeItem(captureJobsKey(userId))).catch(() => {});
  }, [userId]);

  const update = useCallback((id: number, change: Partial<CaptureJob>) => {
    const list = jobsRef.current;
    const at = list.findIndex((j) => j.id === id);
    if (at < 0) return;
    const next = { ...list[at], ...change };
    if (JSON.stringify(next) === JSON.stringify(list[at])) return;
    commit(list.map((j, i) => (i === at ? next : j)));
  }, [commit]);

  const fail = useCallback((id: number, e: unknown) => {
    const error = message(e, "Upload failed. Try again.");
    update(id, { status: "failed", error, insufficient: error === NO_CREDITS, offline: false });
  }, [update]);

  // A started job: follow it until the server says it is over, then list the pieces it made.
  const follow = useCallback(async (id: number, jobId: string) => {
    if (following.current.has(jobId)) return;
    following.current.add(jobId);
    try {
      await followOnce(id, jobId);
    } finally {
      following.current.delete(jobId);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const followOnce = async (id: number, jobId: string) => {
    let job: Job;
    try {
      job = await pollJob(jobId, {
        alive: () => alive.current,
        onJob: (j) => update(id, { phase: stateOf(j), offline: false, ...(j.progress ? { progress: j.progress } : {}) }),
        onOffline: (offline) => update(id, { offline }),
      });
    } catch (e) {
      if (!isInterruption(e)) fail(id, e);  // only the server's own answer fails a job
      if (alive.current) void refresh();
      return;
    }
    noteItemsSaved();  // the server saved this photo's pieces
    for (let wait = followTiming.pollMs; alive.current; wait = Math.min(wait * 2, followTiming.maxBackoffMs)) {
      try {
        const result = await runFromJob(job);
        update(id, { status: "done", result, phase: "succeeded", offline: false });
        break;
      } catch {
        update(id, { offline: true });  // the job is done; only the list of its pieces is still to come
        await nap(wait);
      }
    }
    if (alive.current) void refresh();
  };

  // Sends (or re-sends, under the same key) until the server has the job or refuses it. One loop per capture.
  const sending = useRef(new Set<number>());
  const send = useCallback(async (id: number, reconnect: boolean) => {
    if (sending.current.has(id)) return;
    sending.current.add(id);
    try {
      await sendLoop(id, reconnect);
    } finally {
      sending.current.delete(id);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const sendLoop = async (id: number, reconnect: boolean) => {
    let photoSends = 0;
    let refused = 0;
    for (let wait = followTiming.pollMs; alive.current; wait = Math.min(wait * 2, followTiming.maxBackoffMs)) {
      const job = jobsRef.current.find((j) => j.id === id);
      if (!job?.key || job.status !== "running" || job.jobId) return;
      try {
        let started: Job;
        if (job.fromScan) {
          started = await startGarmentGenerate(job.fromScan.scanId, job.fromScan.indexes, job.fromScan.unitPrice, job.key);
        } else if (reconnect) {
          // After a restart the photo may be gone: ask by key first; only a "never got it" sends the photo.
          try {
            started = await reconnectGarmentJob(job.key);
          } catch (e) {
            if (!(e instanceof ApiError && e.status === 400 && e.answered)) throw e;
            if (!alive.current) return;  // signed out meanwhile: never send this account's photo for another
            if (++photoSends > PHOTO_SENDS) return fail(id, new Error(NOT_SENT));
            started = await startGarmentJob(job.photoUri, job.maxFronts, job.key);
          }
        } else {
          started = await startGarmentJob(job.photoUri, job.maxFronts, job.key);
        }
        if (!alive.current) return;
        update(id, { jobId: started.id, phase: stateOf(started), offline: false, ...(started.progress ? { progress: started.progress } : {}) });
        void follow(id, started.id);
        return;
      } catch (e) {
        if (!alive.current) return;
        // After a lost answer a refusal can race that first send's own insert: ask once more before failing.
        if (isRefusal(e) && (!reconnect || ++refused >= 2)) {
          fail(id, e);
          void refresh();
          return;
        }
        if (!isRefusal(e)) update(id, { offline: true });
        reconnect = true;  // the answer was lost: from now on ask by key before sending the photo again
        await nap(wait);
      }
    }
  };

  const run = useCallback((photoUri: string, maxFronts?: number, fromScan?: CaptureJob["fromScan"]) => {
    const id = ++latest.current;
    const job: CaptureJob = { id, photoUri, maxFronts: fromScan ? fromScan.indexes.length : maxFronts, fromScan, status: "running", startedAt: Date.now() };
    if (persistent()) {
      commit([...jobsRef.current, { ...job, key: `cap:${randomUUID()}`, phase: "sending" }]);
      void send(id, false);
      return;
    }
    // Local mode: the single-owner server answers the photo in one request.
    commit([...jobsRef.current, job]);
    const onProgress = (progress: JobProgress) => update(id, { progress });
    (fromScan
      ? generateFromGarmentScan(fromScan.scanId, fromScan.indexes, fromScan.unitPrice, onProgress)
      : postRun(photoUri, maxFronts, onProgress))
      .then((result) => {
        noteItemsSaved();  // the server saved this photo's pieces
        update(id, { status: "done", result });
      })
      .catch((e) => fail(id, e))
      .finally(() => { void refresh(); });
  }, [commit, send, update, fail, refresh]);  // eslint-disable-line react-hooks/exhaustive-deps

  // This account's captures from before the app was closed: reconnect to each by its key or job id.
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(captureJobsKey(userId)).then((raw) => {
      if (!alive.current || !raw || !isAccountMode()) return;
      let stored: Stored[];
      try { stored = JSON.parse(raw); } catch { return; }
      if (!Array.isArray(stored)) return;
      const known = new Set(jobsRef.current.map((j) => j.key));
      const restored: CaptureJob[] = stored.filter((s) => s?.key && !known.has(s.key))
        .map((s) => ({ ...s, id: ++latest.current, status: "running" as const, phase: s.phase ?? "sending" }));
      if (!restored.length) return;
      commit([...restored, ...jobsRef.current]);
      for (const j of restored) {
        if (j.jobId) void follow(j.id, j.jobId);
        else void send(j.id, true);
      }
    }).catch(() => {});
  }, [userId]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Back in the app: follow again any job that stopped being followed (session refreshed, connection back).
  useOnForeground(() => {
    for (const j of jobsRef.current) if (j.jobId && j.status === "running" && !j.result) void follow(j.id, j.jobId);
  });

  const current = jobs.length ? jobs[jobs.length - 1] : null;
  // An id picks that capture; anything else (no argument, or a press event from onPress={retry}) the newest.
  const pick = (id?: unknown) => (typeof id === "number" ? jobsRef.current.find((j) => j.id === id) : jobsRef.current[jobsRef.current.length - 1]);
  const retry = useCallback((id?: number) => {
    const last = pick(id);
    if (!last || last.status !== "failed") return;
    // A failed job is over on the server (its hold was returned): trying again is a new job under a new key.
    commit(jobsRef.current.filter((j) => j.id !== last.id));
    run(last.photoUri, last.fromScan ? undefined : last.maxFronts, last.fromScan);
  }, [commit, run]);  // eslint-disable-line react-hooks/exhaustive-deps
  const startFromScan = useCallback((photoUri: string, scanId: string, indexes: number[], unitPrice: number | null) =>
    run(photoUri, undefined, { scanId, indexes, unitPrice }), [run]);
  const dismiss = useCallback((id: number) => commit(jobsRef.current.filter((j) => j.id !== id)), [commit]);
  // Forgets the newest capture on this screen. A job still running keeps being followed (and listed) if it
  // is on the server; one never confirmed is dropped.
  const clear = useCallback((id?: number) => {
    const last = pick(id);
    if (last) commit(jobsRef.current.filter((j) => j.id !== last.id || (j.status === "running" && !!j.jobId)));
  }, [commit]);

  return (
    <CaptureJobsContext.Provider value={{ current, jobs, start: run, startFromScan, retry, clear, dismiss, saved, setSaved }}>
      {children}
    </CaptureJobsContext.Provider>
  );
}
