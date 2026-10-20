// The account API (/v1): the same operations as the local API, adapted to the shapes the screens use.
// Captures, back photos and 360s are jobs on the server; we poll them so work survives a dropped request.
import { randomUUID } from "expo-crypto";
import { File } from "expo-file-system";
import { API_BASE_URL, UNREACHABLE, sentence } from "./http";
import type { BackView, ClosetItem, Credits, GarmentScan, ItemFacts, ItemPatch, ItemsResponse, OutfitResult, OutfitScan, Prices, RunItem, RunResponse, Tier, Turn } from "./types";

export type Account = {
  getToken: () => Promise<string | null>;
  onUnauthorized: () => void;
};

export const POLL_MS = 2000;
export const POLL_LIMIT_MS = 5 * 60_000;
export const SESSION_EXPIRED = "Your session expired. Sign in again.";
export const NOT_ACCOUNT_MODE = "Your wardrobe server isn't in account mode. Restart it with WARDROBE_AUTH=on.";
export const SIGNED_OUT = "You signed out.";
export const STILL_WORKING = "Still working on it — check your closet in a minute.";
export const NO_CREDITS = "Not enough AI credits. Ask the app owner for more.";

type V1Item = {
  id: string;
  created_at: string;
  tier: Tier;
  facts: ItemFacts;
  crop_url: string;
  generated_url: string;
  cutout_url?: string | null;
  back?: BackView | null;
  turn?: Turn | null;
  origin?: "garment_photo" | "outfit_photo";
  review_state?: "pending" | "kept" | null;
};

export type Job = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  error: string | null;
  item_ids: string[];
  quality: RunResponse["quality"] | null;
  failed: string[];
  retakes?: unknown[];
  over_limit?: number;
  progress?: JobProgress | null;
};

export type JobProgress = { done: number; total: number };

const pad = (n: number) => String(n).padStart(2, "0");

// The screens date items by a local "YYYYMMDD-HHMMSS" stamp (today's run ids); give /v1 items one too.
function stamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function toClosetItem(item: V1Item): ClosetItem {
  const { created_at, ...rest } = item;
  return { ...rest, item_id: item.id, photo_name: "", run_id: stamp(new Date(created_at)) };
}

async function send(account: Account, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await account.getToken();
  if (!token) {
    account.onUnauthorized();
    throw new Error(SESSION_EXPIRED);
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  if (response.status === 401) {
    account.onUnauthorized();
    throw new Error(SESSION_EXPIRED);
  }
  return response;
}

async function read<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  if (response.status === 402) throw new Error(NO_CREDITS);
  const body = await response.json();
  if (!response.ok) {
    const error = (body as { error?: string } | null)?.error;
    if (error) throw new Error(sentence(error));
    if (response.status === 404) throw new Error(NOT_ACCOUNT_MODE);  // FastAPI's own 404: no /v1 routes
    throw new Error(`Something went wrong (error ${response.status}). Try again.`);
  }
  return body as T;
}

const call = async <T>(account: Account, path: string, init?: RequestInit) => read<T>(await send(account, path, init));

// Starts a job. A request that never got an answer is sent once more with the same key, so the
// server returns the job it may already have made instead of starting a second one. A caller that keeps
// the key (to send it again after an app restart) passes its own.
async function startJob(account: Account, path: string, photoUri?: string, fields: Record<string, string> = {},
                        key: string = randomUUID()): Promise<Job> {
  const attempt = () => {
    let body: FormData | undefined;
    if (photoUri) {
      body = new FormData();
      body.append("photo", new File(photoUri) as unknown as Blob);
      for (const [name, value] of Object.entries(fields)) body.append(name, value);
    }
    return call<Job>(account, path, { method: "POST", body, headers: { "Idempotency-Key": key } });
  };
  try {
    return await attempt();
  } catch (e) {
    if (e instanceof Error && e.message === UNREACHABLE) return attempt();
    throw e;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(account: Account, current: () => Account | null, job: Job, onProgress?: (p: JobProgress) => void): Promise<Job> {
  for (let waited = 0; ; waited += POLL_MS) {
    if (job.progress && onProgress) onProgress(job.progress);
    if (job.status === "succeeded") return job;
    if (job.status === "failed" || job.status === "canceled") throw new Error(sentence(job.error ?? "Something went wrong — try again"));
    if (waited >= POLL_LIMIT_MS) throw new Error(STILL_WORKING);
    await sleep(POLL_MS);
    if (current() !== account) throw new Error(SIGNED_OUT);
    job = await call<Job>(account, `/v1/jobs/${encodeURIComponent(job.id)}`);
  }
}

export async function getItems(account: Account): Promise<ItemsResponse> {
  const { items } = await call<{ items: V1Item[] }>(account, "/v1/items");
  return { items: items.map(toClosetItem) };
}

// maxFronts: the front images the user approved paying for (sent only while billing is on).
export async function postRun(account: Account, current: () => Account | null, photoUri: string, maxFronts?: number,
                              onProgress?: (p: JobProgress) => void): Promise<RunResponse> {
  const fields: Record<string, string> = maxFronts ? { max_fronts: String(maxFronts) } : {};
  const job = await waitFor(account, current, await startJob(account, "/v1/jobs", photoUri, fields), onProgress);
  return runFromJob(account, job);
}

// A finished garment job as the run the Results screen shows: its new pieces, what failed, what was left out.
async function runFromJob(account: Account, job: Job): Promise<RunResponse> {
  const { items } = await getItems(account);
  const byId = new Map(items.map((i) => [i.item_id, i]));
  const pieces: RunItem[] = job.item_ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [{ ...item, reason: "", retake_instruction: null }] : [];
  });
  return {
    run_id: stamp(new Date()),
    quality: job.quality ?? { status: "ok", reason: null },
    items: pieces,
    // Pieces the pipeline couldn't render have no picture to show; report them as not processed.
    failed: [...job.failed, ...(job.retakes ?? []).map((_, i) => `retake_${i}`)],
    over_limit: job.over_limit ?? 0,
  };
}

const garmentScanPath = (id: string) => `/v1/garment-scans/${encodeURIComponent(id)}`;

// Free pre-scan of a garment photo: finds the pieces (with boxes) before anything is made or charged.
export async function scanGarments(account: Account, current: () => Account | null, photoUri: string,
                                   key?: string): Promise<GarmentScan> {
  let scan = (await startJob(account, "/v1/garment-scans", photoUri, {}, key)) as unknown as GarmentScan;
  for (let waited = 0; ; waited += POLL_MS) {
    if (scan.status === "succeeded") return scan;
    if (scan.status === "failed" || scan.status === "canceled") throw new Error(sentence(scan.error ?? "Something went wrong — try again"));
    if (waited >= POLL_LIMIT_MS) throw new Error(STILL_WORKING);
    await sleep(POLL_MS);
    if (current() !== account) throw new Error(SIGNED_OUT);
    scan = await call<GarmentScan>(account, garmentScanPath(scan.id));
  }
}

// Starts front images for the picked pieces of a pre-scan, at the per-front price the user saw. The key
// makes it safe to send again (same key → the same job, never a second charge).
export async function startGarmentGenerate(account: Account, scanId: string, indexes: number[], unitPrice: number | null,
                                           key: string): Promise<Job> {
  const attempt = () => call<Job>(account, `${garmentScanPath(scanId)}/generate`, {
    method: "POST", headers: { "Idempotency-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ piece_indexes: indexes, expected_unit_price: unitPrice }),
  });
  try {
    return await attempt();
  } catch (e) {
    if (!(e instanceof Error && e.message === UNREACHABLE)) throw e;
    return attempt();
  }
}

// Waits for a job started earlier (also one from before an app restart) until it succeeds; throws its sentence if not.
export async function pollJob(account: Account, current: () => Account | null, jobId: string,
                              onProgress?: (p: JobProgress) => void): Promise<Job> {
  return waitFor(account, current, await call<Job>(account, `/v1/jobs/${encodeURIComponent(jobId)}`), onProgress);
}

// Front images for the picked pieces of a pre-scan, at the per-front price the user saw.
export async function generateFromGarmentScan(account: Account, current: () => Account | null, scanId: string,
                                              indexes: number[], unitPrice: number | null,
                                              onProgress?: (p: JobProgress) => void): Promise<RunResponse> {
  const started = await startGarmentGenerate(account, scanId, indexes, unitPrice, randomUUID());
  return runFromJob(account, await waitFor(account, current, started, onProgress));
}

// First 3 Pieces activation steps (server allow-list in api/events.py). No answer needed.
export async function postEvent(account: Account, event: string, props: Record<string, string | number>): Promise<void> {
  await call<void>(account, "/v1/events", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, props }),
  });
}

export type Profile = { email: string | null; display_name: string | null };

export async function getProfile(account: Account): Promise<Profile> {
  return call<Profile>(account, "/v1/profile");
}

export async function setDisplayName(account: Account, name: string): Promise<Profile> {
  return call<Profile>(account, "/v1/profile", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: name }),
  });
}

// 'Notify when ready': this phone's Expo push token, on or off.
export async function registerPushToken(account: Account, token: string): Promise<void> {
  await call<void>(account, "/v1/push-token", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
  });
}

export async function unregisterPushToken(account: Account, token: string): Promise<void> {
  await call<void>(account, "/v1/push-token", {
    method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
  });
}

// Deletes the signed-in account and everything in it (the server takes the user from the token).
export async function deleteAccount(account: Account): Promise<void> {
  await call<void>(account, "/v1/account", {
    method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }),
  });
}

// After each sign-in: the server grants the one-time welcome credits if this account is invited (no-op otherwise).
export async function bootstrap(account: Account): Promise<{ welcome_granted: number }> {
  return call<{ welcome_granted: number }>(account, "/v1/bootstrap", { method: "POST" });
}

export async function getCredits(account: Account, before?: number): Promise<Credits> {
  return call<Credits>(account, `/v1/credits${before ? `?before=${before}` : ""}`);
}

export async function getPrices(account: Account): Promise<Prices> {
  return call<Prices>(account, "/v1/prices");
}

const itemPath = (item: ClosetItem) => `/v1/items/${encodeURIComponent(item.id ?? item.item_id)}`;

export async function getItem(account: Account, item: ClosetItem): Promise<ClosetItem> {
  return toClosetItem(await call<V1Item>(account, itemPath(item)));
}

export async function updateItem(account: Account, item: ClosetItem, patch: ItemPatch): Promise<ClosetItem> {
  return toClosetItem(await call<V1Item>(account, itemPath(item), {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
  }));
}

export async function deleteItem(account: Account, item: ClosetItem): Promise<void> {
  await call<void>(account, itemPath(item), { method: "DELETE" });
}

export async function addBack(account: Account, current: () => Account | null, item: ClosetItem, photoUri: string): Promise<ClosetItem> {
  await waitFor(account, current, await startJob(account, `${itemPath(item)}/back`, photoUri));
  return getItem(account, item);
}

export async function startTurn(account: Account, item: ClosetItem): Promise<Turn> {
  await startJob(account, `${itemPath(item)}/turn`);
  return { state: "running", error: null, views: [] };
}

export async function getTurn(account: Account, item: ClosetItem): Promise<Turn> {
  const { turn } = await getItem(account, item);
  if (!turn) throw new Error("No 360 view yet");
  return turn;
}

// --- Outfit Photo -------------------------------------------------------------------------------
export const SCAN_EXPIRED = "This scan has expired — scan the photo again.";

const scanPath = (id: string) => `/v1/outfit-scans/${encodeURIComponent(id)}`;

export async function getOutfitScan(account: Account, scanId: string): Promise<OutfitScan> {
  const response = await send(account, scanPath(scanId));
  if (response.status === 410) throw new Error(SCAN_EXPIRED);
  return read<OutfitScan>(response);
}

// Stage 1 (free): upload the photo and wait until the garments on the person are found.
export async function scanOutfit(account: Account, current: () => Account | null, photoUri: string): Promise<OutfitScan> {
  let scan = (await startJob(account, "/v1/outfit-scans", photoUri)) as unknown as OutfitScan;
  for (let waited = 0; ; waited += POLL_MS) {
    if (scan.status === "succeeded") return scan;
    if (scan.status === "failed" || scan.status === "canceled") throw new Error(sentence(scan.error ?? "Something went wrong — try again"));
    if (waited >= POLL_LIMIT_MS) throw new Error(STILL_WORKING);
    await sleep(POLL_MS);
    if (current() !== account) throw new Error(SIGNED_OUT);
    scan = await getOutfitScan(account, scan.id);
  }
}

// Stage 2: make images for the picked garments only. unitPrice is the per-image price the user saw
// (null while billing is off); the server refuses with 409 if it changed. Results wait for review.
export async function generateOutfit(account: Account, current: () => Account | null, scanId: string,
                                     candidateIds: string[], unitPrice: number | null,
                                     corrections: Record<string, string> = {}): Promise<OutfitResult> {
  const key = randomUUID();
  const attempt = () => call<Job>(account, `${scanPath(scanId)}/generate`, {
    method: "POST", headers: { "Idempotency-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ candidate_ids: candidateIds, expected_unit_price: unitPrice,
                           ...(Object.keys(corrections).length ? { corrections } : {}) }),
  });
  let started: Job;
  try {
    started = await attempt();
  } catch (e) {
    if (!(e instanceof Error && e.message === UNREACHABLE)) throw e;
    started = await attempt();
  }
  const job = await waitFor(account, current, started);
  const items = await Promise.all(job.item_ids.map((id) => call<V1Item>(account, `/v1/items/${encodeURIComponent(id)}`)));
  return { items: items.map(toClosetItem), failed: job.failed };
}

// A garment the scan missed: the area the user marked (photo pixels) and its type. Free; returns the scan.
export async function markRegion(account: Account, scanId: string,
                                 box: { x: number; y: number; width: number; height: number }, category: string): Promise<OutfitScan> {
  return call<OutfitScan>(account, `${scanPath(scanId)}/regions`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ box, category }),
  });
}

// A new image for an outfit result still in review, at the front price the user saw; waits for it.
export async function regenerateItem(account: Account, current: () => Account | null, item: ClosetItem,
                                     unitPrice: number | null): Promise<ClosetItem> {
  const key = randomUUID();
  const started = await call<Job>(account, `${itemPath(item)}/regenerate`, {
    method: "POST", headers: { "Idempotency-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ expected_unit_price: unitPrice }),
  });
  await waitFor(account, current, started);
  return toClosetItem(await call<V1Item>(account, itemPath(item)));
}

export async function getPendingItems(account: Account): Promise<ClosetItem[]> {
  const { items } = await call<{ items: V1Item[] }>(account, "/v1/items?review=pending");
  return items.map(toClosetItem);
}

export async function keepItem(account: Account, item: ClosetItem): Promise<ClosetItem> {
  return toClosetItem(await call<V1Item>(account, `${itemPath(item)}/keep`, { method: "POST" }));
}
