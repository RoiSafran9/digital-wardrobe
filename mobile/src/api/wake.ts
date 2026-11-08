// Sleeps that end early when the app comes back to the foreground, so every job follower checks the server
// at once instead of finishing a long back-off first. iOS pauses timers in the background anyway.
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

const sleepers = new Set<() => void>();

export function nap(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      sleepers.delete(done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    sleepers.add(done);
  });
}

export function wakeFollowers(): void {
  for (const done of [...sleepers]) done();
}

// Mounted once (AppShell): returning to the app wakes the followers.
export function useWakeOnForeground(): void {
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") wakeFollowers();
    });
    return () => sub.remove();
  }, []);
}

// Runs the latest callback each time the app comes back to the foreground (a job provider resumes following
// any job it stopped following, e.g. after the session was refreshed).
export function useOnForeground(callback: () => void): void {
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") latest.current();
    });
    return () => sub.remove();
  }, []);
}
