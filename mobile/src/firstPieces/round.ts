// First 3 Pieces: the rules of a generation round, kept apart from the screens so they can be tested.
// A round turns the pieces picked across several garment photos into one generate job per photo.
// Prices always come from the server (GET /v1/prices); nothing here is a price.
import type { GarmentScan } from "../api/types";

// Most pieces one round makes, across all its photos (owner decision; a UX limit, not a price).
export const ROUND_CAP = 5;
// The goal the flow is named after.
export const FIRST_GOAL = 3;

export type PhotoState =
  | "waiting"    // collected, not scanned yet
  | "scanning"
  | "found"      // the free pre-scan found pieces
  | "none"       // nothing to add in this photo (the scan's reason says why)
  | "unusable"   // the quality check asks for a retake
  | "limited"    // too many free scans this hour; can be checked later
  | "failed";    // the scan itself failed

export type RoundPhoto = { id: string; uri: string; state: PhotoState; scan?: GarmentScan | null };

// The state a finished pre-scan puts its photo in.
export function photoStateFor(scan: GarmentScan): PhotoState {
  if (scan.quality?.status === "retake") return "unusable";
  return scan.pieces.length ? "found" : "none";
}

export type RoundPiece = { key: string; photoId: string; scanId: string; index: number; area: number };

export const pieceKey = (photoId: string, index: number) => `${photoId}:${index}`;

// Every piece found, photo by photo in the order collected, each photo's pieces in scan order.
export function allPieces(photos: RoundPhoto[]): RoundPiece[] {
  return photos.flatMap((photo) =>
    photo.state === "found" && photo.scan
      ? photo.scan.pieces.map((p) => ({ key: pieceKey(photo.id, p.index), photoId: photo.id, scanId: photo.scan!.id,
                                         index: p.index, area: p.box.width * p.box.height }))
      : []);
}

// What starts selected: everything when it fits the round, else the largest pieces (like the server's
// own max_fronts rule), listed in display order.
export function defaultSelection(pieces: RoundPiece[], cap = ROUND_CAP): string[] {
  if (pieces.length <= cap) return pieces.map((p) => p.key);
  const largest = new Set([...pieces].sort((a, b) => b.area - a.area).slice(0, cap).map((p) => p.key));
  return pieces.filter((p) => largest.has(p.key)).map((p) => p.key);
}

// Tapping a piece. A tap that would pass the cap changes nothing and says it was blocked.
export function toggle(selection: string[], key: string, cap = ROUND_CAP): { selection: string[]; blocked: boolean } {
  if (selection.includes(key)) return { selection: selection.filter((k) => k !== key), blocked: false };
  if (selection.length >= cap) return { selection, blocked: true };
  return { selection: [...selection, key], blocked: false };
}

export type JobPlan = { photoId: string; scanId: string; indexes: number[] };

// One generate job per photo with picks, in photo order; indexes in scan order.
export function jobsFor(selection: string[], pieces: RoundPiece[]): JobPlan[] {
  const picked = new Set(selection);
  const plans: JobPlan[] = [];
  for (const piece of pieces) {
    if (!picked.has(piece.key)) continue;
    const last = plans[plans.length - 1];
    if (last?.photoId === piece.photoId) last.indexes.push(piece.index);
    else plans.push({ photoId: piece.photoId, scanId: piece.scanId, indexes: [piece.index] });
  }
  return plans;
}

// The key a round's job is sent under; kept with the round so a restart sends the same one again.
export const jobKey = (roundId: string, scanId: string) => `fp:${roundId}:${scanId}`;

export type RoundQuote = { count: number; total: number | null; affordable: boolean; leaveOut: number };

// What the picked pieces cost. unitPrice undefined = billing off: no amount, always affordable.
export function roundQuote(count: number, unitPrice: number | undefined, available: number): RoundQuote {
  if (unitPrice === undefined) return { count, total: null, affordable: true, leaveOut: 0 };
  const total = count * unitPrice;
  const leaveOut = unitPrice > 0 ? Math.max(0, count - Math.floor(available / unitPrice)) : 0;
  return { count, total, affordable: total <= available, leaveOut };
}

export type RoundJob = {
  plan: JobPlan;
  key: string;
  jobId?: string;
  status: "unsent" | "running" | "succeeded" | "failed";
  itemIds?: string[];
  error?: string;
  progress?: { done: number; total: number };
};

export type RoundSummary = {
  requested: number;   // pieces picked
  made: number;        // pieces now in the closet
  notMade: number;     // picked but not made (failed or unusable); never charged
  running: number;     // jobs still working
  unsent: number;      // jobs not started (e.g. not enough credits)
  settled: boolean;    // nothing running any more
};

export function summarize(jobs: RoundJob[]): RoundSummary {
  const s: RoundSummary = { requested: 0, made: 0, notMade: 0, running: 0, unsent: 0, settled: true };
  for (const job of jobs) {
    const asked = job.plan.indexes.length;
    s.requested += asked;
    if (job.status === "running") s.running += 1;
    else if (job.status === "unsent") s.unsent += 1;
    else if (job.status === "succeeded") {
      const made = Math.min(asked, job.itemIds?.length ?? 0);
      s.made += made;
      s.notMade += asked - made;
    } else s.notMade += asked;
  }
  s.settled = s.running === 0;
  return s;
}

export type OfferInput = {
  signedIn: boolean;         // account mode, signed in (local mode never gets the flow)
  named: boolean;            // the name step is done
  starterDecided: boolean;   // the starter-credits screen was shown or ruled out
  generation: boolean;       // the operator hasn't paused AI work
  closetCount: number | null;   // null until loaded
  pendingCount: number | null;  // outfit results waiting for review; null until loaded
  inflight: boolean;         // a submitted round is still being tracked
  offered: boolean;          // already offered to this account on this device
};

// Whether to open First 3 Pieces by itself: once, for a new account whose closet is still empty.
// Anyone with pieces (also on another device) never sees it.
export function shouldOffer(i: OfferInput): boolean {
  return i.signedIn && i.named && i.starterDecided && i.generation && !i.inflight && !i.offered
    && i.closetCount === 0 && i.pendingCount === 0;
}
