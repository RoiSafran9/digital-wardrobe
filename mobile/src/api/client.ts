import type { RunResponse, ItemsResponse, ApiError } from "./types";

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
  const formData = new FormData();
  formData.append("photo", {
    uri: photoUri,
    name: "photo.jpg",
    type: "image/jpeg",
  } as any);

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
