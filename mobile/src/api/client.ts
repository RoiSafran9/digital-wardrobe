import { File } from "expo-file-system";
import type { RunResponse, ItemsResponse, ApiError, ClosetItem, ItemPatch } from "./types";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.238:8000";

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    const message = (body as ApiError).error ?? `request failed with status ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

export async function postRun(photoUri: string): Promise<RunResponse> {
  // Expo's global fetch rejects RN-style {uri, name, type} parts; File is a Blob it can read.
  const formData = new FormData();
  formData.append("photo", new File(photoUri));

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/runs`, { method: "POST", body: formData });
  } catch {
    throw new Error("can't reach server — check WiFi/IP");
  }
  return parseJsonOrThrow<RunResponse>(response);
}

export async function getItems(): Promise<ItemsResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/items`);
  } catch {
    throw new Error("can't reach server — check WiFi/IP");
  }
  return parseJsonOrThrow<ItemsResponse>(response);
}

// The API returns image paths relative to itself; React Native needs a full URL.
export function imageUrl(path: string): string {
  return API_BASE_URL + encodeURI(path);
}

function itemPath(item: ClosetItem): string {
  return `${API_BASE_URL}/items/${[item.run_id, item.photo_name, item.item_id].map(encodeURIComponent).join("/")}`;
}

export async function updateItem(item: ClosetItem, patch: ItemPatch): Promise<ClosetItem> {
  let response: Response;
  try {
    response = await fetch(itemPath(item), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  } catch {
    throw new Error("can't reach server — check WiFi/IP");
  }
  return parseJsonOrThrow<ClosetItem>(response);
}

export async function deleteItem(item: ClosetItem): Promise<void> {
  let response: Response;
  try {
    response = await fetch(itemPath(item), { method: "DELETE" });
  } catch {
    throw new Error("can't reach server — check WiFi/IP");
  }
  if (!response.ok) {
    await parseJsonOrThrow(response);
  }
}
