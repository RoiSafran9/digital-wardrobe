import React from "react";
import { act, render, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { getItems } from "../src/api/client";
import { track } from "../src/activity/track";
import { offeredKey } from "../src/firstPieces/offer";
import { MorningReminderProvider } from "../src/morningReminder/MorningReminderProvider";
import { FLAGS_WAIT_MS, MorningReminderTaps, REMINDER_ROUTE, reminderTapId } from "../src/morningReminder/MorningReminderTaps";
import { recordKey, REMINDER_KIND, type ReminderRecord } from "../src/morningReminder/schedule";

let mockNav: { key?: string } | undefined = { key: "root" };
const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), navigate: (...a: unknown[]) => mockNavigate(...a) },
  useRootNavigationState: () => mockNav,
}));
jest.mock("../src/api/client", () => ({ getItems: jest.fn() }));
jest.mock("../src/activity/track", () => ({ track: jest.fn(), trackPermission: jest.fn() }));

const N = Notifications as jest.Mocked<typeof Notifications>;
const getItemsMock = getItems as jest.Mock;
const DEFAULT = "expo.modules.notifications.actions.DEFAULT";
const response = (identifier: string, data: object = { kind: REMINDER_KIND }, actionIdentifier = DEFAULT) =>
  ({ actionIdentifier, notification: { request: { identifier, content: { data } } } }) as unknown as Notifications.NotificationResponse;

const auth = (status: AuthContextValue["status"], userId: string | null): AuthContextValue =>
  ({ status, email: null, userId, sendCode: jest.fn(), verifyCode: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn() });
const LOADED = { balance: 1, held: 0, available: 1, granted: 1, used: 0, next_before: null, entries: [] };
const creditsValue = (over: Partial<CreditsValue> = {}): CreditsValue =>
  ({ billing: false, prices: {}, refresh: jest.fn(async () => {}), outfit: true, generation: true, credits: LOADED, ...over });

function tree(a: AuthContextValue, c: CreditsValue = creditsValue()) {
  return (
    <AuthContext.Provider value={a}>
      <CreditsContext.Provider value={c}>
        <MorningReminderProvider enabled><MorningReminderTaps /></MorningReminderProvider>
      </CreditsContext.Provider>
    </AuthContext.Provider>
  );
}

const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const seed = (r: Partial<ReminderRecord>, u = "u1") => AsyncStorage.setItem(recordKey(u), JSON.stringify({ at: 1, ...r }));
const stored = async (u = "u1") => JSON.parse((await AsyncStorage.getItem(recordKey(u))) ?? "null");
let tapListener: (r: Notifications.NotificationResponse) => void = () => {};

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
  await AsyncStorage.clear();
  mockNav = { key: "root" };
  N.addNotificationResponseReceivedListener.mockImplementation(((l: typeof tapListener) => { tapListener = l; return { remove: jest.fn() }; }) as never);
  N.getLastNotificationResponse.mockReturnValue(null);
  N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  N.getPermissionsAsync.mockResolvedValue({ granted: true, status: "granted", ios: { status: 2 } } as never);
  getItemsMock.mockResolvedValue({ items: [{ item_id: "a" }] });
  // u1's reminder fired (iOS no longer lists it) and is being tapped.
  await seed({ status: "scheduled", id: "local-1", fireAt: Date.now() - 1000, introSeen: true });
});

test("only a plain tap on our reminder counts; job pushes and dismissals don't", () => {
  expect(reminderTapId(response("local-1"))).toBe("local-1");
  expect(reminderTapId(response("job", { job_id: "j", kind: "garment" }))).toBeNull();
  expect(reminderTapId(response("local-1", { kind: REMINDER_KIND }, "com.apple.UNNotificationDismissActionIdentifier"))).toBeNull();
  expect(reminderTapId(null)).toBeNull();
});

test("N17: a tap while the app runs opens First 3 Pieces with Someone wearing them, once", async () => {
  await render(tree(auth("signedIn", "u1")));
  await settle();
  await act(async () => tapListener(response("local-1")));
  await settle();
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith(REMINDER_ROUTE);
  expect(REMINDER_ROUTE).toEqual({ pathname: "/first-pieces", params: { entry: "reminder", photoType: "worn" } });
  expect(await stored()).toMatchObject({ status: "opened" });
  expect(await AsyncStorage.getItem(offeredKey("u1"))).toBe("1");  // First 3 Pieces won't also open by itself
  expect(track).toHaveBeenCalledWith("onboarding_nudge_tapped", { entry: "notification" });
  await act(async () => tapListener(response("local-1")));  // the same response delivered again
  await settle();
  expect(mockPush).toHaveBeenCalledTimes(1);
});

test("N18: a tap that launched the app waits for sign-in and the navigator, is handled once and cleared", async () => {
  N.getLastNotificationResponse.mockReturnValue(response("local-1"));
  mockNav = undefined;
  await render(tree(auth("loading", null)));
  await settle();
  expect(mockPush).not.toHaveBeenCalled();
  expect(N.clearLastNotificationResponse).toHaveBeenCalled();
  await act(async () => screen.rerender(tree(auth("signedIn", "u1"))));
  await settle();
  expect(mockPush).not.toHaveBeenCalled();  // navigator not mounted yet
  mockNav = { key: "root" };
  await act(async () => screen.rerender(tree(auth("signedIn", "u1"))));
  await settle();
  expect(mockPush).toHaveBeenCalledTimes(1);
  await act(async () => screen.rerender(tree(auth("signedIn", "u1"))));
  await settle();
  expect(mockPush).toHaveBeenCalledTimes(1);
});

test("N18: a later ordinary launch with the old response doesn't take over", async () => {
  await seed({ status: "opened", id: "local-1", introSeen: true });
  N.getLastNotificationResponse.mockReturnValue(response("local-1"));
  await render(tree(auth("signedIn", "u1")));
  await settle();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("N19: three pieces already saved: Home, not an onboarding loop", async () => {
  getItemsMock.mockResolvedValue({ items: [1, 2, 3] });
  await render(tree(auth("signedIn", "u1")));
  await settle();
  await act(async () => tapListener(response("local-1")));
  await settle();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith("/");
});

test("N20: outfit photos off: Home", async () => {
  await render(tree(auth("signedIn", "u1"), creditsValue({ outfit: false })));
  await settle();
  await act(async () => tapListener(response("local-1")));
  await settle();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith("/");
});

test("N20: signed out: nothing happens until someone signs in, then it is checked for that account", async () => {
  await render(tree(auth("signedOut", null)));
  await settle();
  await act(async () => tapListener(response("local-1")));
  await settle();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => screen.rerender(tree(auth("signedIn", "u1"))));
  await settle();
  expect(mockPush).toHaveBeenCalledWith(REMINDER_ROUTE);
});

test("N14: account A's reminder tapped while B is signed in: B's Home, nothing of A's", async () => {
  await render(tree(auth("signedIn", "u2")));
  await settle();
  await act(async () => tapListener(response("local-1")));
  await settle();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith("/");
  expect(await stored("u1")).toMatchObject({ status: "scheduled" });  // A's record untouched by B
  expect(track).not.toHaveBeenCalledWith("onboarding_nudge_tapped", expect.anything());
});

test("N21: a job-result push tap is left to the existing behavior", async () => {
  await render(tree(auth("signedIn", "u1")));
  await settle();
  await act(async () => tapListener(response("job-1", { job_id: "j1", kind: "garment" })));
  await settle();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect((await stored()).status).not.toBe("opened");
});

test("Mac offline: the tap still opens First 3 Pieces after a short wait; its screens show any errors", async () => {
  getItemsMock.mockRejectedValue(new Error("offline"));
  await render(tree(auth("signedIn", "u1"), creditsValue({ credits: null, outfit: false })));
  await settle();
  jest.useFakeTimers();
  await act(async () => tapListener(response("local-1")));
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(FLAGS_WAIT_MS); });
  jest.useRealTimers();
  await settle();
  expect(mockPush).toHaveBeenCalledWith(REMINDER_ROUTE);
});

test("N23: a reminder arriving while the app is open doesn't navigate by itself", async () => {
  await render(tree(auth("signedIn", "u1")));
  await settle();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});
