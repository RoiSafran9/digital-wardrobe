import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FLUSH_EVERY_MS, NEW_SESSION_AFTER_MS, appVersion, flushActivity, startActivity, stopActivity, track, trackScreen } from "../src/activity/track";

let mockUuids = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++mockUuids}` }));

let appStateListener: ((s: string) => void) | null = null;
jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, fn: (s: string) => void) => {
  appStateListener = fn;
  return { remove: () => { appStateListener = null; } };
}) as never);

const sentEvents = (send: jest.Mock) => send.mock.calls.flatMap((c) => (c[0] as { events: { event: string; props: Record<string, unknown>; session_id: string; client_event_id: string }[] }).events);
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => { await stopActivity(); await AsyncStorage.clear(); jest.clearAllMocks(); });
afterAll(() => stopActivity());

test("nothing is recorded when signed out (or in local mode)", async () => {
  expect(() => track("app_opened", { cold: true })).not.toThrow();
  await flushActivity();
});

test("signing in opens a session; events carry it, the app version and their own ids", async () => {
  const send = jest.fn(async () => {});
  startActivity("A", send);
  track("permission", { kind: "camera", granted: false });
  await flushActivity();
  const [opened, permission] = sentEvents(send);
  expect(opened).toMatchObject({ event: "app_opened", props: { cold: true } });
  expect(permission).toMatchObject({ event: "permission", props: { kind: "camera", granted: false } });
  expect(permission.session_id).toBe(opened.session_id);
  expect(permission.client_event_id).not.toBe(opened.client_event_id);
  expect((send.mock.calls[0] as unknown as [{ app_version: string }])[0].app_version).toBe(appVersion());
});

test("a screen counts once per session", async () => {
  const send = jest.fn(async () => {});
  startActivity("A", send);
  trackScreen("closet");
  trackScreen("closet");
  trackScreen("home");
  await flushActivity();
  expect(sentEvents(send).filter((e) => e.event === "screen_viewed").map((e) => e.props.screen)).toEqual(["closet", "home"]);
});

test("going to the background sends; coming back after 30 minutes starts a new session", async () => {
  let now = 1_000_000;
  const send = jest.fn(async () => {});
  startActivity("A", send, () => now);
  appStateListener?.("background");
  await settle();
  expect(send).toHaveBeenCalledTimes(1);
  now += NEW_SESSION_AFTER_MS;
  appStateListener?.("active");
  trackScreen("closet");
  await flushActivity();
  const events = sentEvents(send);
  const opens = events.filter((e) => e.event === "app_opened");
  expect(opens.map((e) => e.props.cold)).toEqual([true, false]);
  expect(opens[0].session_id).not.toBe(opens[1].session_id);
});

test("a short trip to the background keeps the session", async () => {
  let now = 0;
  const send = jest.fn(async () => {});
  startActivity("A", send, () => now);
  appStateListener?.("background");
  now += 60_000;
  appStateListener?.("active");
  await flushActivity();
  expect(sentEvents(send).filter((e) => e.event === "app_opened")).toHaveLength(1);
});

test("sends every 30 seconds", async () => {
  jest.useFakeTimers();
  try {
    const send = jest.fn(async () => {});
    startActivity("A", send);
    expect(send).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(FLUSH_EVERY_MS);
    expect(send).toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test("signing out sends what is left, then nothing; the next account starts clean", async () => {
  const sendA = jest.fn(async () => {});
  startActivity("A", sendA);
  track("popup_add_more", {});
  await stopActivity();
  track("popup_add_more", {});
  expect(sentEvents(sendA).map((e) => e.event)).toEqual(["app_opened", "popup_add_more"]);
  const sendB = jest.fn(async () => {});
  startActivity("B", sendB);
  await flushActivity();
  expect(sentEvents(sendB).map((e) => e.event)).toEqual(["app_opened"]);
});

test("a send that throws never reaches the caller", async () => {
  startActivity("A", jest.fn(async () => { throw new Error("offline"); }));
  expect(() => track("app_opened", { cold: false })).not.toThrow();
  await expect(flushActivity()).resolves.toBeUndefined();
});
