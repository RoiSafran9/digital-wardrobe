import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { pollJob, startOutfitGenerate } from "../api/client";
import { followTiming, type Job, type JobProgress } from "../api/v1";
import { nap, useOnForeground } from "../api/wake";
import { useCredits } from "../credits/CreditsProvider";
import { isFinished, isInterruption, isRefusal, message, stateOf, type JobState } from "./jobState";

// Outfit Photo generation as an app-level job (it used to live inside the pick screen, which had to stay open).
// Same pattern as First 3 Pieces: the request is written down per account, on this device, BEFORE it is sent,
// under the Idempotency-Key it will always be sent with. So leaving the screen, losing the connection or
// closing the app never loses, repeats or double-charges it: a restart follows the same job id, or sends the
// same key again (the server answers with the job it already has). Results still wait for review.

export const outfitJobsKey = (userId: string) => `outfitJobs.v1.${userId}`;
const KEEP = 10;  // finished jobs remembered for the banner until reviewed or dismissed

export type OutfitJob = {
  key: string;                          // the Idempotency-Key, fixed before the first send
  scanId: string;
  candidateIds: string[];
  unitPrice: number | null;
  corrections: Record<string, string>;
  names: Record<string, string>;        // candidate id → what the pick screen called it
  photoUri?: string;
  onboarding?: boolean;                 // started from First 3 Pieces
  startedAt: number;
  jobId?: string;
  state: JobState;
  progress?: JobProgress | null;
  itemIds?: string[];
  failed?: string[];                    // candidate ids the server couldn't make (not charged)
  error?: string;
  offline?: boolean;                    // the last check got no answer; it keeps trying
};

type Sent = { outcome: "sent" } | { outcome: "refused"; error: unknown } | { outcome: "unknown" };

export type OutfitStart = Pick<OutfitJob, "scanId" | "candidateIds" | "unitPrice" | "corrections" | "names" | "photoUri" | "onboarding">;

type Value = {
  jobs: OutfitJob[];
  // Writes the job down and sends it. Resolves once the server has it, or once its answer is unknown (it is
  // then sent again under the same key until the server answers). Throws only a refusal, after forgetting it.
  start: (input: OutfitStart) => Promise<OutfitJob>;
  dismiss: (key: string) => void;
  reviewed: () => void;                 // the review screen opened: finished results are now there
};

const OutfitJobsContext = createContext<Value | undefined>(undefined);

export const useOutfitJobsMaybe = (): Value | null => useContext(OutfitJobsContext) ?? null;

export function useOutfitJobs(): Value {
  const value = useContext(OutfitJobsContext);
  if (!value) throw new Error("useOutfitJobs must be used within an OutfitJobsProvider");
  return value;
}

// Keyed by user in AppShell: a new account starts with only its own stored jobs.
export function OutfitJobsProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const { refresh } = useCredits();
  const [jobs, setJobs] = useState<OutfitJob[]>([]);
  const jobsRef = useRef<OutfitJob[]>([]);
  const alive = useRef(true);
  const followed = useRef(new Set<string>());
  const resending = useRef(new Set<string>());
  useEffect(() => () => { alive.current = false; }, []);
  const isAlive = useCallback(() => alive.current, []);

  const commit = useCallback((next: OutfitJob[]) => {
    if (!alive.current) return Promise.resolve();
    jobsRef.current = next;
    setJobs(next);
    if (!userId) return Promise.resolve();
    const kept = [...next.filter((j) => !isFinished(j.state)), ...next.filter((j) => isFinished(j.state)).slice(-KEEP)];
    return (kept.length ? AsyncStorage.setItem(outfitJobsKey(userId), JSON.stringify(kept))
      : AsyncStorage.removeItem(outfitJobsKey(userId))).catch(() => {});
  }, [userId]);

  const update = useCallback((key: string, change: Partial<OutfitJob>) => {
    const list = jobsRef.current;
    const at = list.findIndex((j) => j.key === key);
    if (at < 0) return Promise.resolve();
    const next = { ...list[at], ...change };
    if (JSON.stringify(next) === JSON.stringify(list[at])) return Promise.resolve();
    return commit(list.map((j, i) => (i === at ? next : j)));
  }, [commit]);

  const follow = useCallback(async (key: string, jobId: string) => {
    if (followed.current.has(jobId)) return;
    followed.current.add(jobId);
    try {
      const job = await pollJob(jobId, {
        alive: isAlive,
        onJob: (j: Job) => { void update(key, { state: stateOf(j), progress: j.progress ?? null, offline: false }); },
        onOffline: (offline) => { void update(key, { offline }); },
      });
      await update(key, { state: "succeeded", itemIds: job.item_ids, failed: job.failed, progress: job.progress ?? null,
                          error: undefined, offline: false });
    } catch (e) {
      if (isInterruption(e)) return;  // signed out, session expired or this provider went away: not the job's fault
      await update(key, { state: "failed", error: message(e), offline: false });  // the server's own answer
    } finally {
      followed.current.delete(jobId);
      if (alive.current) void refresh();
    }
  }, [isAlive, update, refresh]);

  const send = useCallback(async (job: OutfitJob): Promise<Sent> => {
    try {
      const started = await startOutfitGenerate(job.scanId, job.candidateIds, job.unitPrice, job.corrections, job.key);
      await update(job.key, { jobId: started.id, state: stateOf(started), progress: started.progress ?? null, offline: false, error: undefined });
      void follow(job.key, started.id);
      return { outcome: "sent" };
    } catch (e) {
      if (isRefusal(e)) return { outcome: "refused", error: e };
      await update(job.key, { offline: true });
      return { outcome: "unknown" };
    }
  }, [update, follow]);

  // An answer that never came: keep sending the same key, slower each time, until the server answers.
  // now: send at once (after a restart); otherwise wait first (the send just made got no answer).
  const resend = useCallback(async (key: string, now: boolean) => {
    if (resending.current.has(key)) return;
    resending.current.add(key);
    try {
      await resendLoop(key, now);
    } finally {
      resending.current.delete(key);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const resendLoop = async (key: string, now: boolean) => {
    let refused = 0;
    for (let wait = followTiming.pollMs; alive.current; wait = Math.min(wait * 2, followTiming.maxBackoffMs)) {
      if (!now) await nap(wait);
      now = false;
      if (!alive.current) return;
      const job = jobsRef.current.find((j) => j.key === key);
      if (!job || job.state !== "sending") return;
      const sent = await send(job);
      if (sent.outcome === "sent") return;
      // A refusal right after a lost answer can race that first send's own insert: ask once more (the same key
      // then returns the job if it exists) before saying it never started.
      if (sent.outcome === "refused" && ++refused >= 2) {
        await update(key, { state: "failed", error: `${message(sent.error)} Nothing was charged.`, offline: false });
        return;
      }
    }
  };

  // Back in the app: follow again anything that stopped being followed (session refreshed, connection back).
  useOnForeground(() => {
    for (const j of jobsRef.current) {
      if (j.jobId && !isFinished(j.state)) void follow(j.key, j.jobId);
      else if (!j.jobId && j.state === "sending") void resend(j.key, true);
    }
  });

  // This account's jobs from before the app was closed: follow the started ones, resend the unconfirmed ones.
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(outfitJobsKey(userId)).then((raw) => {
      if (!alive.current || !raw) return;
      let stored: OutfitJob[];
      try { stored = JSON.parse(raw); } catch { return; }
      if (!Array.isArray(stored)) return;
      const known = new Set(jobsRef.current.map((j) => j.key));
      const restored = [...stored.filter((j) => j && j.key && !known.has(j.key)), ...jobsRef.current];
      jobsRef.current = restored;
      setJobs(restored);
      for (const j of restored) {
        if (j.jobId && !isFinished(j.state)) void follow(j.key, j.jobId);
        else if (!j.jobId && j.state === "sending") void resend(j.key, true);
      }
    }).catch(() => {});
  }, [userId]);  // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async (input: OutfitStart) => {
    const job: OutfitJob = { ...input, key: `og:${randomUUID()}`, startedAt: Date.now(), state: "sending" };
    await commit([...jobsRef.current, job]);
    resending.current.add(job.key);  // one send of a key at a time: the foreground resume waits for this one
    let sent: Sent;
    try {
      sent = await send(job);
    } finally {
      resending.current.delete(job.key);
    }
    void refresh();
    if (sent.outcome === "refused") {
      await commit(jobsRef.current.filter((j) => j.key !== job.key));  // nothing was created or held
      throw sent.error;
    }
    if (sent.outcome === "unknown") void resend(job.key, false);
    return jobsRef.current.find((j) => j.key === job.key) ?? job;
  }, [commit, send, resend, refresh]);

  const dismiss = useCallback((key: string) => { void commit(jobsRef.current.filter((j) => j.key !== key)); }, [commit]);
  const reviewed = useCallback(() => {
    void commit(jobsRef.current.filter((j) => j.state !== "succeeded"));
  }, [commit]);

  const value = useMemo(() => ({ jobs, start, dismiss, reviewed }), [jobs, start, dismiss, reviewed]);
  return <OutfitJobsContext.Provider value={value}>{children}</OutfitJobsContext.Provider>;
}
