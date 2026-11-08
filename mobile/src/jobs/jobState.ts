// Shared words for AI jobs the app follows (garment captures, First 3 Pieces, outfit photos). Everything here
// comes from the server's own answers; nothing is estimated from time on the phone.
import { ApiError, SESSION_EXPIRED, SIGNED_OUT, STOPPED, type Job, type JobProgress } from "../api/v1";
import { OUTFIT_NEEDS_ACCOUNT, PICKING_NEEDS_ACCOUNT } from "../api/client";

// sending: written down, the server hasn't confirmed it yet (or the answer was lost; it is sent again under
// the same key until it does). queued/running/succeeded/failed: the server's own status.
export type JobState = "sending" | "queued" | "running" | "succeeded" | "failed";

export type JobView = { state: JobState; progress?: JobProgress | null; offline?: boolean };

export const stateOf = (job: Job): JobState => (job.status === "canceled" ? "failed" : job.status);

export const isFinished = (state: JobState) => state === "succeeded" || state === "failed";

// A start the wardrobe server itself answered with a refusal: nothing was created and nothing is held, so the
// request can be forgotten and the screen can say why (credits, a changed price, an expired scan, AI work
// paused or today's budget used — 503 with the server's own message). The server answers a resend of a job
// that exists with that job before any of these checks. Anything else (no answer, a Cloudflare page, a crash,
// an expired session) may have reached the server: keep the key and send it again, which can only ever find
// or make that one job.
export function isRefusal(e: unknown): boolean {
  if (e instanceof ApiError) {
    if (!e.answered) return false;
    return (e.status >= 400 && e.status < 500 && ![401, 408, 429].includes(e.status)) || e.status === 503;
  }
  return e instanceof Error && (e.message === OUTFIT_NEEDS_ACCOUNT || e.message === PICKING_NEEDS_ACCOUNT);
}

// Following stopped for a reason that says nothing about the job (signed out, session expired, account changed,
// provider gone): never a failure — the job stays as it was and is followed again later.
export function isInterruption(e: unknown): boolean {
  const m = e instanceof Error ? e.message : "";
  return [SIGNED_OUT, STOPPED, SESSION_EXPIRED, PICKING_NEEDS_ACCOUNT, OUTFIT_NEEDS_ACCOUNT].includes(m);
}

export const message = (e: unknown, fallback = "Something went wrong — try again") =>
  (e instanceof Error && e.message ? e.message : fallback);

// "2 of 3 done" and, once some are done, how many got an image: processed is not the same as made.
export function countLines(progress: JobProgress | null | undefined): { done: string; made: string | null } | null {
  if (!progress || progress.total <= 0) return null;
  const done = `${Math.min(progress.done, progress.total)} of ${progress.total} done`;
  if (progress.made === null || progress.made === undefined || progress.done === 0) return { done, made: null };
  const failed = Math.max(0, progress.done - progress.made);
  const made = `${progress.made} ${progress.made === 1 ? "image" : "images"} made${failed ? ` · ${failed} couldn't be made` : ""}`;
  return { done, made };
}
