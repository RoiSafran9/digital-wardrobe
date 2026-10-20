import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { pollJob, scanGarments, startGarmentGenerate } from "../api/client";
import { NO_CREDITS, SIGNED_OUT } from "../api/v1";
import { useCredits } from "../credits/CreditsProvider";
import {
  allPieces, defaultSelection, jobKey, jobsFor, photoStateFor, summarize, toggle as toggleRule,
  type JobPlan, type RoundJob, type RoundPhoto, type RoundPiece, type RoundSummary,
} from "./round";

// First 3 Pieces, Path A: the photos being collected, their free scans, the picks, and the round of
// generate jobs. The photos and picks live only in memory (owner decision: no onboarding drafts). Once
// the user confirms a round, the jobs it sends are written down first (per account, on this device), so
// leaving or closing the app never loses, repeats or double-charges them: a restart polls the same jobs,
// or sends an unsent one again under the same key (the server answers with the job it already has).

export const inflightKey = (userId: string) => `firstPieces.inflight.${userId}`;
const SCANS_AT_ONCE = 2;
const SCAN_LIMITED = /too many photo scans/i;
const PRICE_CHANGED = /price changed/i;

export type RoundStop = "credits" | "price" | "error" | null;  // why unsent jobs weren't sent

export type Round = {
  id: string;
  jobs: (RoundJob & { photoUri: string; unitPrice: number | null })[];
  startedAt: number;
  stopped: RoundStop;
  stopMessage?: string;
};

type Stored = Pick<Round, "id" | "startedAt"> & {
  jobs: { plan: JobPlan; key: string; jobId?: string; photoUri: string; unitPrice: number | null }[];
};

type Value = {
  photos: RoundPhoto[];
  pieces: RoundPiece[];        // found and not used in an earlier round
  selected: string[];
  round: Round | null;
  summary: RoundSummary | null;
  addPhotos: (uris: string[]) => void;
  removePhoto: (id: string) => void;
  scanAll: () => Promise<void>;
  togglePiece: (key: string) => boolean;  // false when blocked by the round cap
  submitRound: (unitPrice: number | null) => Promise<void>;
  sendUnsent: (unitPrice?: number | null) => Promise<void>;  // after more credits, or at a re-confirmed price
  retryFailed: () => Promise<void>;
  finishRound: () => void;                // forget a settled round (keeps unused photos for Add More)
  reset: () => void;                      // forget everything (leaving the flow)
};

const FirstPiecesContext = createContext<Value | undefined>(undefined);

export function useFirstPieces(): Value {
  const value = useContext(FirstPiecesContext);
  if (!value) throw new Error("useFirstPieces must be used within a FirstPiecesProvider");
  return value;
}

export function FirstPiecesProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const { refresh } = useCredits();
  const [photos, setPhotos] = useState<RoundPhoto[]>([]);
  const [selection, setSelection] = useState<string[] | null>(null);  // null = the default picks
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [round, setRound] = useState<Round | null>(null);
  const roundRef = useRef<Round | null>(null);
  const nextPhoto = useRef(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const pieces = useMemo(() => allPieces(photos).filter((p) => !used.has(p.key)), [photos, used]);
  const selected = useMemo(
    () => (selection ?? defaultSelection(pieces)).filter((k) => pieces.some((p) => p.key === k)),
    [selection, pieces],
  );

  const commit = useCallback((next: Round | null) => {
    roundRef.current = next;
    if (alive.current) setRound(next);
    if (!userId) return Promise.resolve();
    const unfinished = next?.jobs.some((j) => j.status === "running" || j.status === "unsent");
    if (!next || !unfinished) return AsyncStorage.removeItem(inflightKey(userId)).catch(() => {});
    const stored: Stored = { id: next.id, startedAt: next.startedAt,
      jobs: next.jobs.map(({ plan, key, jobId, photoUri, unitPrice }) => ({ plan, key, jobId, photoUri, unitPrice })) };
    return AsyncStorage.setItem(inflightKey(userId), JSON.stringify(stored)).catch(() => {});
  }, [userId]);

  const updateJob = useCallback((key: string, change: Partial<RoundJob>) => {
    const r = roundRef.current;
    if (!r) return Promise.resolve();
    return commit({ ...r, jobs: r.jobs.map((j) => (j.key === key ? { ...j, ...change } : j)) });
  }, [commit]);

  const follow = useCallback(async (key: string, jobId: string) => {
    try {
      const job = await pollJob(jobId, (progress) => { void updateJob(key, { progress }); });
      await updateJob(key, { status: "succeeded", itemIds: job.item_ids, error: undefined });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong — try again";
      if (message === SIGNED_OUT) return;  // another account now; the record stays with its owner
      // Still running after the poll limit: keep it "running"; the record lets a later resume pick it up.
      if (/still working/i.test(message)) return void updateJob(key, { error: message });
      await updateJob(key, { status: "failed", error: message });
    } finally {
      void refresh();
    }
  }, [updateJob, refresh]);

  // Sends the round's unsent jobs one by one, in order, each under its own kept key.
  const send = useCallback(async () => {
    for (const job of roundRef.current?.jobs ?? []) {
      if (job.status !== "unsent") continue;
      try {
        const started = await startGarmentGenerate(job.plan.scanId, job.plan.indexes, job.unitPrice, job.key);
        await updateJob(job.key, { jobId: started.id, status: "running", error: undefined });
        void follow(job.key, started.id);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Something went wrong — try again";
        const stopped: RoundStop = message === NO_CREDITS ? "credits" : PRICE_CHANGED.test(message) ? "price" : "error";
        const r = roundRef.current;
        if (r) await commit({ ...r, stopped, stopMessage: message });
        void refresh();
        return;
      }
    }
    const r = roundRef.current;
    if (r?.stopped) await commit({ ...r, stopped: null, stopMessage: undefined });
  }, [commit, follow, updateJob, refresh]);

  // A round confirmed before the app was closed: follow its jobs again, and send the ones not sent yet.
  useEffect(() => {
    if (!userId) return;
    let live = true;
    AsyncStorage.getItem(inflightKey(userId)).then((raw) => {
      if (!live || !raw || roundRef.current) return;
      let stored: Stored;
      try { stored = JSON.parse(raw); } catch { return; }
      const restored: Round = { id: stored.id, startedAt: stored.startedAt, stopped: null,
        jobs: stored.jobs.map((j) => ({ ...j, status: j.jobId ? "running" : "unsent" })) };
      roundRef.current = restored;
      setRound(restored);
      for (const j of restored.jobs) if (j.jobId) void follow(j.key, j.jobId);
      void send();
    }).catch(() => {});
    return () => { live = false; };
  }, [userId]);  // eslint-disable-line react-hooks/exhaustive-deps

  const addPhotos = useCallback((uris: string[]) => {
    setPhotos((list) => [...list, ...uris.map((uri) => ({ id: `ph${++nextPhoto.current}`, uri, state: "waiting" as const }))]);
  }, []);
  const removePhoto = useCallback((id: string) => setPhotos((list) => list.filter((p) => p.id !== id)), []);

  const setPhoto = (id: string, change: Partial<RoundPhoto>) =>
    alive.current && setPhotos((list) => list.map((p) => (p.id === id ? { ...p, ...change } : p)));

  const scanAll = useCallback(async () => {
    const queue = photos.filter((p) => p.state === "waiting" || p.state === "failed" || p.state === "limited");
    let limited = false;
    const worker = async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        if (limited) { setPhoto(p.id, { state: "limited" }); continue; }
        setPhoto(p.id, { state: "scanning" });
        try {
          const scan = await scanGarments(p.uri);
          if (scan) setPhoto(p.id, { state: photoStateFor(scan), scan });
          else setPhoto(p.id, { state: "failed" });
        } catch (e) {
          if (e instanceof Error && SCAN_LIMITED.test(e.message)) {
            limited = true;
            setPhoto(p.id, { state: "limited" });
          } else setPhoto(p.id, { state: "failed" });
        }
      }
    };
    await Promise.all(Array.from({ length: SCANS_AT_ONCE }, worker));
  }, [photos]);

  const togglePiece = useCallback((key: string) => {
    const result = toggleRule(selected, key);
    if (!result.blocked) setSelection(result.selection);
    return !result.blocked;
  }, [selected]);

  const submitRound = useCallback(async (unitPrice: number | null) => {
    if (roundRef.current) return;  // one round at a time
    const plans = jobsFor(selected, pieces);
    if (!plans.length) return;
    const id = randomUUID();
    const uriOf = (photoId: string) => photos.find((p) => p.id === photoId)?.uri ?? "";
    await commit({ id, startedAt: Date.now(), stopped: null,
      jobs: plans.map((plan) => ({ plan, key: jobKey(id, plan.scanId), status: "unsent", photoUri: uriOf(plan.photoId), unitPrice })) });
    setUsed((u) => new Set([...u, ...selected]));
    setSelection(null);
    await send();
  }, [selected, pieces, photos, commit, send]);

  const retryFailed = useCallback(async () => {
    const r = roundRef.current;
    if (!r) return;
    // A failed job is finished (its hold was returned); trying again is a new job under a new key.
    await commit({ ...r, stopped: null, jobs: r.jobs.map((j) => (j.status === "failed"
      ? { ...j, key: `${j.key}:${randomUUID().slice(0, 8)}`, jobId: undefined, status: "unsent", error: undefined, itemIds: undefined, progress: undefined }
      : j)) });
    await send();
  }, [commit, send]);

  const sendUnsent = useCallback(async (unitPrice?: number | null) => {
    const r = roundRef.current;
    if (r && unitPrice !== undefined) {
      await commit({ ...r, jobs: r.jobs.map((j) => (j.status === "unsent" ? { ...j, unitPrice } : j)) });
    }
    await send();
  }, [commit, send]);

  const finishRound = useCallback(() => { void commit(null); }, [commit]);
  const reset = useCallback(() => {
    if (!roundRef.current?.jobs.some((j) => j.status === "running")) void commit(null);
    setPhotos([]);
    setSelection(null);
    setUsed(new Set());
  }, [commit]);

  const summary = useMemo(() => (round ? summarize(round.jobs) : null), [round]);
  return (
    <FirstPiecesContext.Provider value={{ photos, pieces, selected, round, summary, addPhotos, removePhoto, scanAll,
      togglePiece, submitRound, sendUnsent, retryFailed, finishRound, reset }}>
      {children}
    </FirstPiecesContext.Provider>
  );
}
