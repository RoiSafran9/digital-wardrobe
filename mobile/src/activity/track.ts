// Activity events from the app (the server keeps the same list and checks it: api/activity.py). Only counts,
// booleans and fixed choices — never photos, text, garment details or anything about the device. Fire and
// forget: tracking never blocks or breaks a screen. Nothing is recorded in local mode or when signed out.
import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { randomUUID } from "expo-crypto";
import { createQueue, type EventProps, type Queue, type QueuedEvent } from "./queue";

export type Screen = "home" | "closet" | "add" | "account" | "camera" | "preview" | "processing" | "results"
  | "outfit_detect" | "outfit_pick" | "outfit_review" | "item" | "price_list" | "credits_activity" | "help"
  | "build_my_look" | "look_detail";
export type Action = "garment" | "back" | "turn" | "outfit" | "regenerate";
export type Path = "near" | "not_near";
export type OutfitSlot = "top" | "bottom" | "one_piece" | "outerwear" | "footwear";

export type Events = {
  // First 3 Pieces onboarding
  onboarding_started: { entry?: "auto" | "starter" | "home" };
  path_selected: { path: Path };
  photos_collected: { count: number; camera: number; library: number };
  detection_completed: { photos: number; found: number; unusable: number; limited: number };
  generation_started: { pieces: number; photos: number; round: number; path: Path };
  first_garment_saved: { path?: Path };
  first_3_saved: { path?: Path };
  popup_shown: { saved: number };
  popup_add_more: Record<string, never>;
  onboarding_abandoned: { step: "start" | "photos" | "pick" | "processing" | "outfit" };
  // App use
  app_opened: { cold: boolean };
  screen_viewed: { screen: Screen };
  cost_sheet: { action: Action; choice: "confirmed" | "cancelled"; pieces?: number };
  out_of_credits_shown: { action?: Action };
  permission: { kind: "camera" | "photos" | "notifications"; granted: boolean };
  capture_source: { flow: "garment" | "outfit"; from: "camera" | "library" };
  item_opened: { has_back: boolean; has_turn: boolean };
  client_error: { where: Screen | "global"; kind: "render" | "unhandled" | "network" | "http_5xx" };
  // Build My Look
  look_opened: { position: number };
  swap_applied: { slot: OutfitSlot };
};

export const FLUSH_EVERY_MS = 30_000;
export const NEW_SESSION_AFTER_MS = 30 * 60_000;

export type BatchSender = (body: { app_version: string; events: QueuedEvent[] }) => Promise<void>;

// "1.0.3" (+ " dev" in development), within the server's 20-character, letters-digits-dots rule.
export function appVersion(): string {
  const version = Constants.expoConfig?.version ?? "0";
  return `${version}${__DEV__ ? " dev" : ""}`.replace(/[^0-9A-Za-z.\-+ ()]/g, "").slice(0, 20) || "0";
}

let queue: Queue | null = null;
let sessionId: string | null = null;
let seenScreens = new Set<Screen>();
let backgroundAt: number | null = null;
let stopTimers: (() => void) | null = null;

function newSession(cold: boolean): void {
  sessionId = randomUUID();
  seenScreens = new Set();
  seenPermissions = new Set();
  track("app_opened", { cold });
}

// Called when an account signs in (AuthProvider). Events wait in this account's own queue.
export function startActivity(userId: string, send: BatchSender, now: () => number = Date.now): void {
  void stopActivity();
  const version = appVersion();
  queue = createQueue({
    storageKey: `activity.queue.${userId}`,
    storage: AsyncStorage,
    send: (events) => send({ app_version: version, events }),
  });
  const own = queue;
  const timer = setInterval(() => { void own.flush(); }, FLUSH_EVERY_MS);
  const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "background") {
      backgroundAt = now();
      void own.flush();
    } else if (state === "active") {
      if (backgroundAt !== null && now() - backgroundAt >= NEW_SESSION_AFTER_MS) newSession(false);
      backgroundAt = null;
    }
  });
  stopTimers = () => { clearInterval(timer); sub.remove(); };
  newSession(true);
}

// Called before signing out: one last send for this account, then nothing more from it.
export async function stopActivity(): Promise<void> {
  const q = queue;
  queue = null;
  stopTimers?.();
  stopTimers = null;
  sessionId = null;
  await q?.stop().catch(() => {});
}

export function track<E extends keyof Events>(event: E, props: Events[E]): void {
  try {
    if (!queue) return;
    const clean = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) as EventProps;
    queue.add({ event, props: clean, client_event_id: randomUUID(), client_at: new Date().toISOString(), session_id: sessionId });
  } catch {
    // Tracking must never break the app.
  }
}

// A key screen, once per app session.
export function trackScreen(screen: Screen): void {
  if (!queue || seenScreens.has(screen)) return;
  seenScreens.add(screen);
  track("screen_viewed", { screen });
}

export function useScreenViewed(screen: Screen): void {
  useEffect(() => { trackScreen(screen); }, [screen]);
}

// A permission answer, once per session per kind and answer (pickers ask again on every photo).
let seenPermissions = new Set<string>();
export function trackPermission(kind: Events["permission"]["kind"], granted: boolean): void {
  const key = `${kind}:${granted}`;
  if (!queue || seenPermissions.has(key)) return;
  seenPermissions.add(key);
  track("permission", { kind, granted });
}

export function flushActivity(): Promise<void> {
  return queue?.flush() ?? Promise.resolve();
}
