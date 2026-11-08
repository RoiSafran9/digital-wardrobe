// Every AI job this account has going (or just finished), from the three places that follow them: garment
// captures, the First 3 Pieces round, and outfit photos. One list for the banner and the jobs screen.
import type { Href } from "expo-router";
import { useCaptureJobsMaybe, type CaptureJob } from "../store/captureJobs";
import { useFirstPiecesMaybe } from "../firstPieces/FirstPiecesProvider";
import { idsParam } from "../firstPieces/celebrate";
import { useOutfitJobsMaybe, type OutfitJob } from "./OutfitJobsProvider";
import { countLines } from "./jobState";

export type ActiveJob = {
  id: string;
  state: "working" | "ready" | "failed";
  label: string;        // what the banner says when it is the only one
  detail?: string;      // the server's count, or why it waits
  route: Href;          // its job details
};

function captureEntry(job: CaptureJob, newest: boolean): ActiveJob | null {
  const id = `capture:${job.id}`;
  // The processing screen shows the newest capture; an older one is opened by its id.
  const details: Href = newest ? "/capture/processing" : { pathname: "/capture/processing", params: { id: String(job.id) } };
  if (job.status === "running") {
    const counts = countLines(job.progress);
    const detail = job.offline ? "Reconnecting…" : counts?.done ?? (job.phase === "queued" ? "Waiting for a free spot" : undefined);
    return { id, state: "working", label: "Creating your pieces…", detail, route: details };
  }
  if (job.status === "failed") return { id, state: "failed", label: "Generation paused — tap to see why", route: details };
  // Done: the newest opens its results; an older one's pieces are already in the closet.
  return newest
    ? { id, state: "ready", label: "Your pieces are ready — review them", route: "/capture/results" }
    : null;
}

function outfitEntry(job: OutfitJob): ActiveJob {
  const route: Href = { pathname: "/outfit/progress", params: { key: job.key } };
  const id = `outfit:${job.key}`;
  if (job.state === "succeeded") {
    const made = job.itemIds?.length ?? 0;
    return { id, state: "ready", label: "Your garments are ready for review", detail: `${made} to review`, route };
  }
  if (job.state === "failed") return { id, state: "failed", label: "Your garments couldn't be made — tap to see why", route };
  const counts = countLines(job.progress);
  const detail = job.offline ? "Reconnecting…" : counts?.done
    ?? (job.state === "queued" ? "Waiting for a free spot" : job.state === "sending" ? "Sending…" : undefined);
  return { id, state: "working", label: "Creating your garments…", detail, route };
}

export function useActiveJobs(): ActiveJob[] {
  const capture = useCaptureJobsMaybe();
  const firstPieces = useFirstPiecesMaybe();
  const outfit = useOutfitJobsMaybe();
  const list: ActiveJob[] = [];
  const captures = capture?.jobs ?? [];
  captures.forEach((job, i) => {
    const entry = captureEntry(job, i === captures.length - 1);
    if (entry) list.push(entry);
  });
  const round = firstPieces?.round;
  const summary = firstPieces?.summary;
  if (round && summary) {
    const running = !summary.settled;
    const ready = summary.settled && summary.made > 0;
    list.push({
      id: `round:${round.id}`,
      state: running ? "working" : ready ? "ready" : "failed",
      label: running ? "Creating your first pieces…" : ready ? "Your first pieces are ready — see them" : "Your pieces couldn't be made — tap to see why",
      detail: running ? `${summary.requested} ${summary.requested === 1 ? "piece" : "pieces"}` : undefined,
      route: ready && summary.notMade === 0
        ? { pathname: "/closet", params: { celebrate: "1", ids: idsParam(round.jobs.flatMap((j) => j.itemIds ?? [])), path: "near", at: String(Date.now()) } }
        : "/first-pieces/processing",
    });
  }
  for (const job of outfit?.jobs ?? []) list.push(outfitEntry(job));
  return list;
}

// The one line the banner shows for several jobs at once.
export function summaryLabel(jobs: ActiveJob[]): string {
  const working = jobs.filter((j) => j.state === "working").length;
  const ready = jobs.filter((j) => j.state === "ready").length;
  const failed = jobs.filter((j) => j.state === "failed").length;
  const parts = [
    working ? `${working} AI ${working === 1 ? "job" : "jobs"} in progress` : null,
    ready ? `${ready} ready` : null,
    failed ? `${failed} need${failed === 1 ? "s" : ""} attention` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
