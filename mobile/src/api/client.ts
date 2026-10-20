import { File } from "expo-file-system";
import { API_BASE_URL, UNREACHABLE, parseJsonOrThrow } from "./http";
import type { GarmentScan, RunResponse, ItemsResponse, ClosetItem, Credits, ItemPatch, OutfitResult, OutfitScan, Prices, Turn } from "./types";
import * as v1 from "./v1";

export { API_BASE_URL };

// Signed in (AuthProvider calls configureApi): every call goes to the account API (/v1) with the
// user's token. Otherwise (local mode) the same calls use the single-owner endpoints, as before.
let account: v1.Account | null = null;

export function configureApi(config: v1.Account | null): void {
  account = config;
}

const current = () => account;

export async function postRun(photoUri: string, maxFronts?: number, onProgress?: (p: v1.JobProgress) => void): Promise<RunResponse> {
  if (account) return v1.postRun(account, current, photoUri, maxFronts, onProgress);
  // Expo's global fetch rejects RN-style {uri, name, type} parts; File is a Blob it can read.
  const formData = new FormData();
  formData.append("photo", new File(photoUri));

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/runs`, { method: "POST", body: formData });
  } catch {
    throw new Error(UNREACHABLE);
  }
  return parseJsonOrThrow<RunResponse>(response);
}

// The free garment pre-scan needs the account API; local mode keeps the max-fronts capture.
export async function scanGarments(photoUri: string, key?: string): Promise<GarmentScan | null> {
  return account ? v1.scanGarments(account, current, photoUri, key) : null;
}

// For several photos at once (First 3 Pieces): start a generate job under a key the caller keeps, and
// wait for any job by id. Both need a signed-in account, like the pre-scan.
export const PICKING_NEEDS_ACCOUNT = "Picking pieces needs a signed-in account.";

export async function startGarmentGenerate(scanId: string, indexes: number[], unitPrice: number | null, key: string): Promise<v1.Job> {
  if (!account) throw new Error(PICKING_NEEDS_ACCOUNT);
  return v1.startGarmentGenerate(account, scanId, indexes, unitPrice, key);
}

export async function pollJob(jobId: string, onProgress?: (p: v1.JobProgress) => void): Promise<v1.Job> {
  if (!account) throw new Error(PICKING_NEEDS_ACCOUNT);
  return v1.pollJob(account, current, jobId, onProgress);
}

export async function generateFromGarmentScan(scanId: string, indexes: number[], unitPrice: number | null,
                                              onProgress?: (p: v1.JobProgress) => void): Promise<RunResponse> {
  if (!account) throw new Error(PICKING_NEEDS_ACCOUNT);
  return v1.generateFromGarmentScan(account, current, scanId, indexes, unitPrice, onProgress);
}

export async function getItems(): Promise<ItemsResponse> {
  if (account) return v1.getItems(account);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/items`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return parseJsonOrThrow<ItemsResponse>(response);
}

// The API returns image paths relative to itself; React Native needs a full URL.
export function imageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;  // signed storage URLs from the account API
  return API_BASE_URL + encodeURI(path);
}

function itemPath(item: ClosetItem): string {
  return `${API_BASE_URL}/items/${[item.run_id, item.photo_name, item.item_id].map(encodeURIComponent).join("/")}`;
}

export async function updateItem(item: ClosetItem, patch: ItemPatch): Promise<ClosetItem> {
  if (account) return v1.updateItem(account, item, patch);
  let response: Response;
  try {
    response = await fetch(itemPath(item), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  return parseJsonOrThrow<ClosetItem>(response);
}

export async function deleteItem(item: ClosetItem): Promise<void> {
  if (account) return v1.deleteItem(account, item);
  let response: Response;
  try {
    response = await fetch(itemPath(item), { method: "DELETE" });
  } catch {
    throw new Error(UNREACHABLE);
  }
  if (!response.ok) {
    await parseJsonOrThrow(response);
  }
}

export async function addBack(item: ClosetItem, photoUri: string): Promise<ClosetItem> {
  if (account) return v1.addBack(account, current, item, photoUri);
  const formData = new FormData();
  formData.append("photo", new File(photoUri));
  let response: Response;
  try {
    response = await fetch(`${itemPath(item)}/back`, { method: "POST", body: formData });
  } catch {
    throw new Error(UNREACHABLE);
  }
  return parseJsonOrThrow<ClosetItem>(response);
}

export async function startTurn(item: ClosetItem): Promise<Turn> {
  if (account) return v1.startTurn(account, item);
  let response: Response;
  try {
    response = await fetch(`${itemPath(item)}/turn`, { method: "POST" });
  } catch {
    throw new Error(UNREACHABLE);
  }
  return parseJsonOrThrow<Turn>(response);
}

export async function getTurn(item: ClosetItem): Promise<Turn> {
  if (account) return v1.getTurn(account, item);
  let response: Response;
  try {
    response = await fetch(`${itemPath(item)}/turn`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  return parseJsonOrThrow<Turn>(response);
}

// Activation steps exist only in account mode; local mode sends nothing.
export async function postEvent(event: string, props: Record<string, string | number> = {}): Promise<void> {
  if (account) return v1.postEvent(account, event, props);
}

export async function bootstrap(): Promise<number> {
  if (!account) return 0;
  return (await v1.bootstrap(account)).welcome_granted;
}

// AI Credits exist only in account mode; local mode has none (null).
export async function getCredits(before?: number): Promise<Credits | null> {
  return account ? v1.getCredits(account, before) : null;
}

export async function getPrices(): Promise<Prices | null> {
  return account ? v1.getPrices(account) : null;
}

// The profile (and its name) exists only in account mode.
export async function getProfile(): Promise<v1.Profile | null> {
  return account ? v1.getProfile(account) : null;
}

export async function setDisplayName(name: string): Promise<v1.Profile> {
  if (!account) throw new Error("Names need a signed-in account.");
  return v1.setDisplayName(account, name);
}

export async function registerPushToken(token: string): Promise<void> {
  if (!account) throw new Error("Notifications need a signed-in account.");
  return v1.registerPushToken(account, token);
}

export async function unregisterPushToken(token: string): Promise<void> {
  if (account) return v1.unregisterPushToken(account, token);
}

export const DELETE_NEEDS_ACCOUNT = "There's no account to delete in local mode.";

export async function deleteAccount(): Promise<void> {
  if (!account) throw new Error(DELETE_NEEDS_ACCOUNT);
  return v1.deleteAccount(account);
}

// Outfit Photo exists only in account mode (the scan, picks and review live on the server).
export const OUTFIT_NEEDS_ACCOUNT = "Outfit photos need a signed-in account.";

function signedIn(): v1.Account {
  if (!account) throw new Error(OUTFIT_NEEDS_ACCOUNT);
  return account;
}

export async function scanOutfit(photoUri: string): Promise<OutfitScan> {
  return v1.scanOutfit(signedIn(), current, photoUri);
}

export async function getOutfitScan(scanId: string): Promise<OutfitScan> {
  return v1.getOutfitScan(signedIn(), scanId);
}

export async function generateOutfit(scanId: string, candidateIds: string[], unitPrice: number | null,
                                     corrections: Record<string, string> = {}): Promise<OutfitResult> {
  return v1.generateOutfit(signedIn(), current, scanId, candidateIds, unitPrice, corrections);
}

export async function markRegion(scanId: string, box: { x: number; y: number; width: number; height: number }, category: string): Promise<OutfitScan> {
  return v1.markRegion(signedIn(), scanId, box, category);
}

export async function regenerateItem(item: ClosetItem, unitPrice: number | null): Promise<ClosetItem> {
  return v1.regenerateItem(signedIn(), current, item, unitPrice);
}

export async function getPendingItems(): Promise<ClosetItem[]> {
  return account ? v1.getPendingItems(account) : [];
}

export async function keepItem(item: ClosetItem): Promise<ClosetItem> {
  return v1.keepItem(signedIn(), item);
}
