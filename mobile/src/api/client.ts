import { File } from "expo-file-system";
import type { RunResponse, ItemsResponse, ApiError, ClosetItem, ItemPatch } from "./types";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.238:8000";

const UNREACHABLE = "Can't reach your wardrobe server. Check that your phone and computer are on the same Wi-Fi.";

// Server messages are lowercase fragments; show them as sentences.
function sentence(message: string): string {
  return message ? message[0].toUpperCase() + message.slice(1) : message;
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    const message = (body as ApiError).error ?? `Something went wrong (error ${response.status}). Try again.`;
    throw new Error(sentence(message));
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
    throw new Error(UNREACHABLE);
  }
  return parseJsonOrThrow<RunResponse>(response);
}

export async function getItems(): Promise<ItemsResponse> {
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
    throw new Error(UNREACHABLE);
  }
  return parseJsonOrThrow<ClosetItem>(response);
}

export async function deleteItem(item: ClosetItem): Promise<void> {
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
