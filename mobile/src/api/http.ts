import Constants from "expo-constants";
import { resolveApiBaseUrl } from "./baseUrl";
import type { ApiError } from "./types";

export const API_BASE_URL = resolveApiBaseUrl({
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
});

export const UNREACHABLE = "Can't reach your wardrobe server. Check that your phone and computer are on the same Wi-Fi.";

// Server messages are lowercase fragments; show them as sentences.
export function sentence(message: string): string {
  return message ? message[0].toUpperCase() + message.slice(1) : message;
}

export async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    const message = (body as ApiError).error ?? `Something went wrong (error ${response.status}). Try again.`;
    throw new Error(sentence(message));
  }
  return body as T;
}
