import { File } from "expo-file-system";
import { API_BASE_URL, UNREACHABLE, parseJsonOrThrow } from "./http";
import type { RunResponse, ItemsResponse, ClosetItem, ItemPatch, Turn } from "./types";
import * as v1 from "./v1";

export { API_BASE_URL };

// Signed in (AuthProvider calls configureApi): every call goes to the account API (/v1) with the
// user's token. Otherwise (local mode) the same calls use the single-owner endpoints, as before.
let account: v1.Account | null = null;

export function configureApi(config: v1.Account | null): void {
  account = config;
}

const current = () => account;

export async function postRun(photoUri: string): Promise<RunResponse> {
  if (account) return v1.postRun(account, current, photoUri);
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
