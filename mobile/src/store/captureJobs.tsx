import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { postRun } from "../api/client";
import { NO_CREDITS } from "../api/v1";
import type { ClosetItem, RunResponse } from "../api/types";
import { useCredits } from "../credits/CreditsProvider";

export type CaptureJob = {
  id: number;
  photoUri: string;
  maxFronts?: number;
  status: "running" | "done" | "failed";
  startedAt: number;
  result?: RunResponse;
  error?: string;
  insufficient?: boolean;
};

// What the Saved screen shows after either flow: the pieces that joined the closet and what they cost.
export type SavedSummary = { items: ClosetItem[]; creditsUsed: number | null };

type Value = {
  current: CaptureJob | null;
  start: (photoUri: string, maxFronts?: number) => void;
  retry: () => void;
  clear: () => void;
  saved: SavedSummary | null;
  setSaved: (saved: SavedSummary | null) => void;
};

const CaptureJobsContext = createContext<Value | undefined>(undefined);

export function useCaptureJobs(): Value {
  const value = useContext(CaptureJobsContext);
  if (!value) throw new Error("useCaptureJobs must be used within a CaptureJobsProvider");
  return value;
}

// The garment photo being turned into catalog images. It lives above the screens, so leaving the
// processing screen never cancels the work (the server job keeps going either way); Home shows it.
// Keyed by user in AppShell, so one account never sees another's capture.
export function CaptureJobsProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<CaptureJob | null>(null);
  const [saved, setSaved] = useState<SavedSummary | null>(null);
  const { refresh } = useCredits();
  const latest = useRef(0);

  const run = useCallback((photoUri: string, maxFronts?: number) => {
    const id = ++latest.current;
    setCurrent({ id, photoUri, maxFronts, status: "running", startedAt: Date.now() });
    postRun(photoUri, maxFronts)
      .then((result) => { if (latest.current === id) setCurrent((c) => (c?.id === id ? { ...c, status: "done", result } : c)); })
      .catch((e) => {
        if (latest.current !== id) return;
        const error = e instanceof Error ? e.message : "Upload failed. Try again.";
        setCurrent((c) => (c?.id === id ? { ...c, status: "failed", error, insufficient: error === NO_CREDITS } : c));
      })
      .finally(() => { void refresh(); });
  }, [refresh]);

  const retry = useCallback(() => {
    if (current) run(current.photoUri, current.maxFronts);
  }, [current, run]);

  const clear = useCallback(() => {
    latest.current += 1;
    setCurrent(null);
  }, []);

  return (
    <CaptureJobsContext.Provider value={{ current, start: run, retry, clear, saved, setSaved }}>
      {children}
    </CaptureJobsContext.Provider>
  );
}
