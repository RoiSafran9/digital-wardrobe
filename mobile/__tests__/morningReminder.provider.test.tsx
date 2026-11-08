import React from "react";
import { AppState, Pressable, Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { getItems } from "../src/api/client";
import { track } from "../src/activity/track";
import { NotifyProvider } from "../src/notifications";
import { offeredKey } from "../src/firstPieces/offer";
import { noteItemsSaved, reportSavedCount } from "../src/morningReminder/closetSignal";
import { CANT_CHECK, MorningReminderProvider, SAVE_FAILED, useMorningReminder } from "../src/morningReminder/MorningReminderProvider";
import { MorningReminderCard, OFFER_TITLE, DENIED_TITLE } from "../src/morningReminder/MorningReminderCard";
import { recordKey, REMINDER_BODY, REMINDER_KIND, REMINDER_TITLE, type ReminderRecord } from "../src/morningReminder/schedule";

jest.mock("../src/api/client", () => ({ getItems: jest.fn(), registerPushToken: jest.fn(), unregisterPushToken: jest.fn() }));
jest.mock("../src/activity/track", () => ({ track: jest.fn(), trackPermission: jest.fn() }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: "p" } } } } }));

const N = Notifications as jest.Mocked<typeof Notifications>;
const getItemsMock = getItems as jest.Mock;
const trackMock = track as jest.Mock;
const ours = (identifier: string) => ({ identifier, content: { data: { kind: REMINDER_KIND } }, trigger: null });
const GRANTED = { granted: true, status: "granted", ios: { status: 2 } };
const DENIED_PERM = { granted: false, status: "denied", canAskAgain: false, ios: { status: 1 } };

const auth = (status: AuthContextValue["status"], userId: string | null): AuthContextValue =>
  ({ status, email: null, userId, sendCode: jest.fn(), verifyCode: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn() });
const creditsValue = (over: Partial<CreditsValue> = {}): CreditsValue => ({
  billing: false, prices: {}, refresh: jest.fn(async () => {}), outfit: true, generation: true,
  credits: { balance: 40, held: 0, available: 40, granted: 40, used: 0, next_before: null, entries: [] }, ...over,
});

let value: ReturnType<typeof useMorningReminder>;
function Probe() {
  value = useMorningReminder();
  return (
    <>
      <Text testID="status">{value.record?.status ?? "none"}</Text>
      <Text testID="offer">{value.offerVisible ? "offer" : "no offer"}</Text>
      {value.error ? <Text>{value.error}</Text> : null}
      <Pressable onPress={() => void value.turnOff()}><Text>turn off</Text></Pressable>
      <MorningReminderCard />
    </>
  );
}

function tree(a: AuthContextValue, c: CreditsValue = creditsValue(), enabled = true) {
  return (
    <AuthContext.Provider value={a}>
      <CreditsContext.Provider value={c}>
        <MorningReminderProvider enabled={enabled}><Probe /></MorningReminderProvider>
      </CreditsContext.Provider>
    </AuthContext.Provider>
  );
}

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const stored = async (u = "u1"): Promise<ReminderRecord | null> => {
  const raw = await AsyncStorage.getItem(recordKey(u));
  return raw ? JSON.parse(raw) : null;
};
const seed = (r: Partial<ReminderRecord>, u = "u1") => AsyncStorage.setItem(recordKey(u), JSON.stringify({ at: 1, ...r }));
const remindMe = () => screen.getByRole("button", { name: "Remind Me" });

// A signed-in account that has seen First 3 Pieces, with `count` saved pieces reported by the closet.
async function newAccount(count = 0, c?: CreditsValue) {
  await AsyncStorage.setItem(offeredKey("u1"), "1");
  getItemsMock.mockResolvedValue({ items: Array.from({ length: count }, (_, i) => ({ item_id: `i${i}` })) });
  const view = await render(tree(auth("signedIn", "u1"), c));
  await settle();
  await act(async () => reportSavedCount(count));
  await settle();
  return view;
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useRealTimers();
  await AsyncStorage.clear();
  N.getPermissionsAsync.mockResolvedValue({ granted: false, status: "undetermined", canAskAgain: true, ios: { status: 0 } } as never);
  N.requestPermissionsAsync.mockResolvedValue(GRANTED as never);
  N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  N.scheduleNotificationAsync.mockResolvedValue("local-1");
});

let restoreSetItem: (() => void) | null = null;
afterEach(() => { restoreSetItem?.(); restoreSetItem = null; jest.restoreAllMocks(); });

test("N01: signing in never asks iOS or schedules anything by itself", async () => {
  await newAccount(0);
  expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(screen.getByText(OFFER_TITLE)).toBeTruthy();  // only the card, no prompt
});

test("N02/N03: the card shows for 0–2 saved pieces after First 3 Pieces, not for 3 or before First 3 Pieces", async () => {
  await newAccount(2);
  expect(screen.getByTestId("offer").props.children).toBe("offer");
  await act(async () => reportSavedCount(3));
  await settle();
  expect(screen.getByTestId("offer").props.children).toBe("no offer");
  await screen.unmount();
  await AsyncStorage.clear();
  getItemsMock.mockResolvedValue({ items: [] });
  await render(tree(auth("signedIn", "u1")));
  await settle();
  await act(async () => reportSavedCount(0));
  await settle();
  expect(screen.getByTestId("offer").props.children).toBe("no offer");  // First 3 Pieces not seen yet
  await act(async () => value.noteIntroSeen());
  await settle();
  expect(screen.getByTestId("offer").props.children).toBe("offer");
});

test("N04: flag off, outfit photos off, local mode and signed out never offer or schedule", async () => {
  await AsyncStorage.setItem(offeredKey("u1"), "1");
  for (const [a, c, enabled] of [
    [auth("signedIn", "u1"), creditsValue(), false],
    [auth("signedIn", "u1"), creditsValue({ outfit: false }), true],
    [auth("local", null), creditsValue(), true],
    [auth("signedOut", null), creditsValue(), true],
  ] as const) {
    await render(tree(a, c, enabled));
    await settle();
    await act(async () => reportSavedCount(0));
    await settle();
    expect(screen.queryByText(OFFER_TITLE)).toBeNull();
    await act(async () => { await value.accept(); });
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    await screen.unmount();
  }
});

test("N05: Remind Me at Monday 17:00 asks iOS once and schedules one 08:45 Tuesday date notification", async () => {
  jest.useFakeTimers({ now: new Date(2026, 10, 9, 17, 0), advanceTimers: true });
  await newAccount(1);
  await act(async () => fireEvent.press(remindMe()));
  await settle();
  expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  const [{ content, trigger }] = N.scheduleNotificationAsync.mock.calls[0] as [Notifications.NotificationRequestInput];
  expect(content).toEqual({ title: REMINDER_TITLE, body: REMINDER_BODY, data: { kind: REMINDER_KIND } });
  expect(trigger).toEqual({ type: "date", date: new Date(2026, 10, 10, 8, 45) });
  expect(await stored()).toMatchObject({ status: "scheduled", id: "local-1", fireAt: new Date(2026, 10, 10, 8, 45).getTime() });
  expect(screen.getByText("Reminder set for tomorrow at 8:45 AM")).toBeTruthy();
  expect(N.getExpoPushTokenAsync).not.toHaveBeenCalled();  // N08/N09: no push token, no Notify when ready
  expect(trackMock.mock.calls).toEqual([
    ["onboarding_nudge_choice", { choice: "accepted" }],
    ["onboarding_nudge_scheduled", { slot: "morning" }],
  ]);
});

test("N06: Remind Me at Monday 23:30 is for Wednesday 08:45", async () => {
  jest.useFakeTimers({ now: new Date(2026, 10, 9, 23, 30), advanceTimers: true });
  await newAccount(0);
  await act(async () => fireEvent.press(remindMe()));
  await settle();
  expect((N.scheduleNotificationAsync.mock.calls[0][0] as { trigger: { date: Date } }).trigger.date).toEqual(new Date(2026, 10, 11, 8, 45));
  expect(screen.getByText("Reminder set for Wednesday at 8:45 AM")).toBeTruthy();
});

test("N07: Not Now is remembered and never asks again, also after a restart", async () => {
  await newAccount(0);
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Not Now" })));
  await settle();
  expect(screen.queryByText(OFFER_TITLE)).toBeNull();
  expect(await stored()).toMatchObject({ status: "declined" });
  expect(trackMock).toHaveBeenCalledWith("onboarding_nudge_choice", { choice: "declined" });
  await screen.unmount();
  await newAccount(0);
  expect(screen.queryByText(OFFER_TITLE)).toBeNull();
  expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
});

test("N08: iOS permission refused: not scheduled, explained once, no token", async () => {
  N.requestPermissionsAsync.mockResolvedValue(DENIED_PERM as never);
  await newAccount(0);
  await act(async () => fireEvent.press(remindMe()));
  await settle();
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(N.getExpoPushTokenAsync).not.toHaveBeenCalled();
  expect(await stored()).toMatchObject({ status: "denied" });
  expect(screen.getByText(DENIED_TITLE)).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Done" })));
  expect(screen.queryByText(DENIED_TITLE)).toBeNull();
  expect(screen.queryByText(OFFER_TITLE)).toBeNull();  // no repeated prompt
});

test("provisional (quiet) permission isn't enough: it asks for full permission", async () => {
  N.getPermissionsAsync.mockResolvedValue({ granted: true, status: "granted", ios: { status: 3 } } as never);
  await newAccount(0);
  await act(async () => fireEvent.press(remindMe()));
  await settle();
  expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
});

test("N09: Notify when ready being on is not consent to the reminder", async () => {
  await AsyncStorage.setItem("notify.token.u1", "ExponentPushToken[x]");
  await AsyncStorage.setItem(offeredKey("u1"), "1");
  getItemsMock.mockResolvedValue({ items: [] });
  await render(
    <AuthContext.Provider value={auth("signedIn", "u1")}>
      <CreditsContext.Provider value={creditsValue()}>
        <NotifyProvider><MorningReminderProvider enabled><Probe /></MorningReminderProvider></NotifyProvider>
      </CreditsContext.Provider>
    </AuthContext.Provider>,
  );
  await settle();
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(await stored()).toBeNull();
});

test("the closet is checked on the server before scheduling; if it can't be, nothing is scheduled", async () => {
  await newAccount(0);
  getItemsMock.mockRejectedValueOnce(new Error("offline"));
  await act(async () => fireEvent.press(remindMe()));
  await settle();
  expect(screen.getAllByText(CANT_CHECK).length).toBeGreaterThan(0);
  expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
});

async function scheduledAccount(count = 2) {
  await newAccount(count);
  await act(async () => fireEvent.press(remindMe()));
  await settle();
  N.getAllScheduledNotificationsAsync.mockResolvedValue([ours("local-1")] as never);
  N.getPermissionsAsync.mockResolvedValue(GRANTED as never);
  expect(await stored()).toMatchObject({ status: "scheduled", id: "local-1" });
  trackMock.mockClear();
}

test("N10/N25: the third saved piece cancels only this reminder, by its id", async () => {
  await scheduledAccount(2);
  await act(async () => reportSavedCount(3));
  await settle();
  expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("local-1");
  expect(N.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  expect(await stored()).toMatchObject({ status: "cancelled", reason: "three_saved" });
  expect(trackMock).toHaveBeenCalledWith("onboarding_nudge_cancelled", { reason: "three_saved" });
});

test("N25: a save in any flow re-checks the closet while a reminder is pending", async () => {
  await scheduledAccount(2);
  getItemsMock.mockImplementation(async () => { reportSavedCount(3); return { items: [1, 2, 3] }; });
  await act(async () => noteItemsSaved());
  await settle();
  expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("local-1");
  expect(await stored()).toMatchObject({ status: "cancelled", reason: "three_saved" });
});

test("N11: scans, picks or pending pieces aren't saves — two saved pieces keep the reminder", async () => {
  await scheduledAccount(2);
  getItemsMock.mockImplementation(async () => { reportSavedCount(2); return { items: [1, 2] }; });
  await act(async () => noteItemsSaved());
  await settle();
  expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(await stored()).toMatchObject({ status: "scheduled" });
});

test("N12: rapid double taps schedule exactly one", async () => {
  await newAccount(0);
  let finish: (id: string) => void = () => {};
  N.scheduleNotificationAsync.mockImplementationOnce(() => new Promise((r) => { finish = r; }));
  await act(async () => { void value.accept(); void value.accept(); });
  await act(async () => fireEvent.press(remindMe()));
  await settle();
  await act(async () => finish("local-1"));
  await settle();
  await act(async () => { await value.accept(); });
  expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});

test("N12: a restart with a pending reminder keeps it and schedules nothing new", async () => {
  await seed({ status: "scheduled", id: "local-1", fireAt: Date.now() + 3600_000, introSeen: true });
  N.getAllScheduledNotificationsAsync.mockResolvedValue([ours("local-1")] as never);
  N.getPermissionsAsync.mockResolvedValue(GRANTED as never);
  await newAccount(1);
  expect(screen.getByTestId("status").props.children).toBe("scheduled");
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
});

test("N13: if its id can't be written down, the scheduled notification is taken back", async () => {
  await newAccount(0);
  const setItem = AsyncStorage.setItem as jest.Mock;
  const impl = setItem.getMockImplementation()!;
  let writes = 0;
  setItem.mockImplementation(async (k: string, v: string) => {
    if (k === recordKey("u1") && ++writes === 2) throw new Error("disk full");  // 1: intent, 2: the id
    return impl(k, v);
  });
  restoreSetItem = () => setItem.mockImplementation(impl);
  await act(async () => fireEvent.press(remindMe()));
  await settle();
  expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("local-1");
  expect(screen.getAllByText(SAVE_FAILED).length).toBeGreaterThan(0);
  expect((await stored())?.status).not.toBe("scheduled");
});

test("N13: closed between scheduling and writing its id: the next start adopts it and drops duplicates", async () => {
  await seed({ status: "scheduling", fireAt: Date.now() + 3600_000, introSeen: true });
  N.getAllScheduledNotificationsAsync.mockResolvedValue([ours("n-a"), ours("n-b")] as never);
  N.getPermissionsAsync.mockResolvedValue(GRANTED as never);
  await newAccount(0);
  expect(await stored()).toMatchObject({ status: "scheduled", id: "n-a" });
  expect(N.cancelScheduledNotificationAsync.mock.calls).toEqual([["n-b"]]);
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
});

test("N14: signing out or switching account cancels the previous account's reminder; B sees nothing of A's", async () => {
  await scheduledAccount(1);
  await act(async () => screen.rerender(tree(auth("signedIn", "u2"))));
  await settle();
  expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("local-1");
  expect(await stored("u1")).toMatchObject({ status: "cancelled", reason: "sign_out" });
  expect(await stored("u2")).toBeNull();
  expect(screen.getByTestId("status").props.children).toBe("unseen");  // u2's own (empty) record
  N.cancelScheduledNotificationAsync.mockClear();
  await act(async () => screen.rerender(tree(auth("signedOut", null))));
  await settle();
  expect(screen.getByTestId("status").props.children).toBe("none");
});

test("signed out at launch: any reminder of ours left on the phone is cancelled; job notifications are not", async () => {
  N.getAllScheduledNotificationsAsync.mockResolvedValue([ours("old"), { identifier: "job-push", content: { data: { job_id: "j", kind: "garment" } } }] as never);
  await render(tree(auth("signedOut", null)));
  await settle();
  expect(N.cancelScheduledNotificationAsync.mock.calls).toEqual([["old"]]);
});

test("N15: deleting the account cancels its reminder and forgets the record", async () => {
  await scheduledAccount(0);
  await act(async () => { await value.forgetAccount(); });
  expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("local-1");
  expect(await stored()).toBeNull();
});

test("N16: once its time has passed it is expired: no new schedule, no tap counted", async () => {
  await seed({ status: "scheduled", id: "local-1", fireAt: Date.now() - 60_000, introSeen: true });
  await newAccount(1);
  expect(await stored()).toMatchObject({ status: "expired", id: "local-1" });
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(trackMock).not.toHaveBeenCalledWith("onboarding_nudge_tapped", expect.anything());
  expect(screen.queryByText(OFFER_TITLE)).toBeNull();
});

test("N26: notifications turned off in Settings cancel it when the app is next active", async () => {
  const handlers: ((s: string) => void)[] = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, h: (s: string) => void) => {
    handlers.push(h);
    return { remove: jest.fn() };
  }) as never);
  await scheduledAccount(1);
  N.getPermissionsAsync.mockResolvedValue(DENIED_PERM as never);
  await act(async () => handlers.forEach((h) => h("active")));
  await settle();
  expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("local-1");
  expect(await stored()).toMatchObject({ status: "cancelled", reason: "permission_off" });
  expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);  // only the original Remind Me
});

test("outfit photos turned off on the server cancel it", async () => {
  await scheduledAccount(1);
  await act(async () => screen.rerender(tree(auth("signedIn", "u1"), creditsValue({ outfit: false }))));
  await settle();
  expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("local-1");
  expect(await stored()).toMatchObject({ status: "cancelled", reason: "outfit_off" });
});

test("turning it off cancels it; a deliberate Remind Me later is still exactly one", async () => {
  await scheduledAccount(1);
  await act(async () => fireEvent.press(screen.getByText("turn off")));
  await settle();
  expect(await stored()).toMatchObject({ status: "cancelled", reason: "opt_out" });
  expect(trackMock).toHaveBeenCalledWith("onboarding_nudge_cancelled", { reason: "opt_out" });
  expect(value.armable).toBe(true);
  N.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  N.scheduleNotificationAsync.mockResolvedValue("local-2");
  await act(async () => { await value.accept(); });
  await settle();
  expect(await stored()).toMatchObject({ status: "scheduled", id: "local-2" });
  expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
});

test("N21: job-result notifications are never cancelled as orphans", async () => {
  N.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: "job-1", content: { data: { job_id: "j1", kind: "garment" } } }] as never);
  await newAccount(0);
  await act(async () => fireEvent.press(remindMe()));
  await settle();
  expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith("job-1");
});

test("N22: event props are fixed choices only", async () => {
  await scheduledAccount(0);
  await act(async () => reportSavedCount(5));
  await settle();
  for (const [, props] of trackMock.mock.calls) {
    for (const v of Object.values(props as object)) expect(["morning", "three_saved", "accepted", "declined", "notification", "opt_out"]).toContain(v);
  }
});
