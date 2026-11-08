import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AccountScreen from "../app/(tabs)/account";
import { deleteAccount } from "../src/api/client";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import type { Credits } from "../src/api/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as N from "expo-notifications";
import { MorningReminderProvider } from "../src/morningReminder/MorningReminderProvider";
import { recordKey, REMINDER_KIND } from "../src/morningReminder/schedule";

jest.mock("../src/api/client", () => ({ ...jest.requireActual("../src/api/client"), deleteAccount: jest.fn() }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
  useRouter: () => ({ push: mockPush }),
}));

const CREDITS: Credits = {
  balance: 197, held: 1, available: 196, granted: 200, used: 3, next_before: null,
  entries: [
    { id: 4, kind: "hold", amount: 1, action: "garment", job_id: "j2", note: null, created_at: "2026-10-18T10:00:00Z" },
    { id: 3, kind: "release", amount: 1, action: "turn", job_id: "j1", note: null, created_at: "2026-10-18T09:00:00Z" },
    { id: 2, kind: "charge", amount: 3, action: "turn", job_id: "j1", note: null, created_at: "2026-10-18T09:00:00Z" },
    { id: 1, kind: "grant", amount: 200, action: null, job_id: null, note: "F&F pilot", created_at: "2026-10-18T08:00:00Z" },
  ],
};

async function renderAccount(overrides: Partial<AuthContextValue>, credits: Partial<CreditsValue> = {}) {
  const value: AuthContextValue = {
    status: "signedIn", email: "me@example.com", userId: "u1",
    sendCode: jest.fn(), verifyCode: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn(async () => {}),
    ...overrides,
  };
  const creditsValue: CreditsValue = { billing: false, prices: {}, credits: null, refresh: jest.fn(async () => {}), ...credits };
  await render(
    <AuthContext.Provider value={value}>
      <CreditsContext.Provider value={creditsValue}><AccountScreen /></CreditsContext.Provider>
    </AuthContext.Provider>,
  );
  return { ...value, refreshCredits: creditsValue.refresh };
}

beforeEach(() => jest.spyOn(Alert, "alert").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test("signed in: shows the email with initials and signs out after confirming", async () => {
  const auth = await renderAccount({});
  expect(screen.getByText("Me")).toBeTruthy();
  expect(screen.getByText("me@example.com")).toBeTruthy();
  expect(screen.getByText("M")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Sign Out" }));
  expect(screen.getByText("You'll need a new email code to sign back in.")).toBeTruthy();
  expect(auth.signOut).not.toHaveBeenCalled();
  const buttons = screen.getAllByRole("button", { name: "Sign Out" });
  await fireEvent.press(buttons[buttons.length - 1]);
  expect(auth.signOut).toHaveBeenCalled();
});

test("cancelling keeps you signed in", async () => {
  const auth = await renderAccount({});
  await fireEvent.press(screen.getByRole("button", { name: "Sign Out" }));
  await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(auth.signOut).not.toHaveBeenCalled();
});

test("local mode: explains it, offers appearance, no sign out and no credits", async () => {
  await renderAccount({ status: "local", email: null, userId: null }, { credits: CREDITS, billing: true });
  expect(screen.getByText("Local mode")).toBeTruthy();
  expect(screen.getByText("Not signed in. Your items live on your computer's wardrobe server.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Sign Out" })).toBeNull();
  expect(screen.queryByText("AI Credits")).toBeNull();
  expect(screen.getByRole("tab", { name: "System" })).toBeTruthy();
});

test("the balance is out of what the server granted, never a fixed number", async () => {
  const { refreshCredits } = await renderAccount({}, { credits: CREDITS, billing: true, prices: { garment: 1, back: 1, turn: 3 } });
  expect(refreshCredits).toHaveBeenCalled();  // refreshed when Account comes into view
  expect(screen.getByLabelText("196 AI credits available")).toBeTruthy();
  expect(screen.getByText("of 200 granted")).toBeTruthy();
  expect(screen.getByText("3 used so far · enough for about 196 more garments")).toBeTruthy();
  expect(screen.getByText("1 held for work in progress")).toBeTruthy();
  expect(screen.getByLabelText("Credits left").props.accessibilityValue).toEqual({ min: 0, max: 100, now: 98 });
});

test("three credits or fewer turns the meter amber and says so", async () => {
  await renderAccount({}, { credits: { ...CREDITS, available: 3, balance: 3, held: 0 }, billing: true, prices: { garment: 1 } });
  expect(screen.getByText("Running low. Ask the app owner for more credits.")).toBeTruthy();
});

test("billing off: the balance shows, with no price list and a plain note", async () => {
  await renderAccount({}, { credits: { ...CREDITS, held: 0 }, billing: false });
  expect(screen.getByLabelText("196 AI credits available")).toBeTruthy();
  expect(screen.getByText("Billing is off — AI actions don't use credits yet.")).toBeTruthy();
  expect(screen.queryByText("Price list")).toBeNull();
});

test("the price list comes from the server", async () => {
  await renderAccount({}, { credits: CREDITS, billing: true, prices: { garment: 1, back: 2, turn: 5 }, outfit: true });
  expect(screen.getByText("Price list")).toBeTruthy();
  expect(screen.getByLabelText("Garment detection, Free")).toBeTruthy();
  expect(screen.getByText("Free")).toBeTruthy();
  expect(screen.getByLabelText("Front image, 1 credit")).toBeTruthy();
  expect(screen.getByLabelText("Back image, 2 credits")).toBeTruthy();
  expect(screen.getByLabelText("360° view, 5 credits")).toBeTruthy();
  expect(screen.getByText("5")).toBeTruthy();
});

test("the price list leaves out actions the server has no price for", async () => {
  await renderAccount({}, { credits: CREDITS, billing: true, prices: { garment: 1 } });
  expect(screen.getByLabelText("Front image, 1 credit")).toBeTruthy();
  expect(screen.queryByLabelText(/Back image/)).toBeNull();
  expect(screen.queryByLabelText(/Garment detection/)).toBeNull();
});

test("activity lists grants and charges, not internal holds and releases", async () => {
  await renderAccount({}, { credits: CREDITS });
  expect(screen.getByText("F&F pilot")).toBeTruthy();
  expect(screen.getByText("+200")).toBeTruthy();
  expect(screen.getByText("360 view")).toBeTruthy();
  expect(screen.getByText("−3")).toBeTruthy();
  expect(screen.queryByText("−1")).toBeNull();
});

test("How it works explains the three rules", async () => {
  await renderAccount({}, { credits: CREDITS, billing: true, prices: { garment: 1 } });
  await fireEvent.press(screen.getByRole("button", { name: "How it works" }));
  expect(screen.getByText("Finding garments is free")).toBeTruthy();
  expect(screen.getByText("You always see the cost first")).toBeTruthy();
});

test("no credits card before credits load", async () => {
  await renderAccount({});
  expect(screen.queryByText("AI Credits")).toBeNull();
});

test("initials come from the email's name part", () => {
  const { initials } = require("../app/(tabs)/account");
  expect(initials("maya.chen@icloud.com")).toBe("MC");
  expect(initials("roi@x.com")).toBe("R");
  expect(initials("1234@x.com")).toBe("?");
});

test("Delete Account asks first, deletes, then signs out", async () => {
  (deleteAccount as jest.Mock).mockResolvedValue(undefined);
  const auth = await renderAccount({}, { credits: CREDITS });
  await fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
  expect(screen.getByText(/removed for good/)).toBeTruthy();
  expect(deleteAccount).not.toHaveBeenCalled();
  const buttons = screen.getAllByRole("button", { name: "Delete Account" });
  await act(async () => fireEvent.press(buttons[buttons.length - 1]));
  expect(deleteAccount).toHaveBeenCalled();
  expect(auth.signOut).toHaveBeenCalled();
});

test("a failed delete says so and keeps you signed in", async () => {
  (deleteAccount as jest.Mock).mockRejectedValue(new Error("Can't reach your wardrobe server."));
  const auth = await renderAccount({}, { credits: CREDITS });
  await fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
  const buttons = screen.getAllByRole("button", { name: "Delete Account" });
  await act(async () => fireEvent.press(buttons[buttons.length - 1]));
  expect(screen.getByText("Can't reach your wardrobe server.")).toBeTruthy();
  expect(auth.signOut).not.toHaveBeenCalled();
});

test("local mode offers no Delete Account", async () => {
  await renderAccount({ status: "local", email: null, userId: null });
  expect(screen.queryByRole("button", { name: "Delete Account" })).toBeNull();
});

test("initials prefer the chosen name", () => {
  const { initials } = require("../app/(tabs)/account");
  expect(initials("x@y.com", "Maya Chen")).toBe("MC");
  expect(initials("x@y.com", "רועי")).toBe("ר");
});

test("Help and Privacy open from Settings", async () => {
  await renderAccount({}, { credits: CREDITS });
  await fireEvent.press(screen.getByRole("button", { name: "Help & Support" }));
  expect(mockPush).toHaveBeenCalledWith("/help");
  await fireEvent.press(screen.getByRole("button", { name: "Privacy" }));
  expect(mockPush).toHaveBeenCalledWith("/privacy");
});

// The one-time morning reminder's row: its own switch, apart from Notify when ready.
describe("morning reminder", () => {
  const Notifications = N as unknown as Record<string, jest.Mock>;
  const LOADED: Credits = { ...CREDITS, entries: [] };

  async function renderWithReminder(record: object | null) {
    await AsyncStorage.clear();
    if (record) await AsyncStorage.setItem(recordKey("u1"), JSON.stringify({ at: 1, ...record }));
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: "local-1", content: { data: { kind: REMINDER_KIND } } }]);
    Notifications.getPermissionsAsync.mockResolvedValue({ granted: true, status: "granted", ios: { status: 2 } });
    const value: AuthContextValue = { status: "signedIn", email: "me@example.com", userId: "u1",
      sendCode: jest.fn(), verifyCode: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn(async () => {}) };
    const creditsValue: CreditsValue = { billing: false, prices: {}, credits: LOADED, outfit: true, refresh: jest.fn(async () => {}) };
    await render(
      <AuthContext.Provider value={value}>
        <CreditsContext.Provider value={creditsValue}>
          <MorningReminderProvider enabled><AccountScreen /></MorningReminderProvider>
        </CreditsContext.Provider>
      </AuthContext.Provider>,
    );
    for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    return value;
  }

  beforeEach(() => jest.clearAllMocks());

  test("a pending reminder shows when it's set and turns off by itself, leaving Notify when ready alone", async () => {
    await renderWithReminder({ status: "scheduled", id: "local-1", fireAt: Date.now() + 3600_000 });
    const sw = screen.getByLabelText("Morning reminder");
    expect(sw.props.value).toBe(true);
    expect(screen.getByLabelText("Notify when ready").props.value).toBe(false);
    expect(screen.getByText(/One reminder only\./)).toBeTruthy();
    await act(async () => fireEvent(sw, "valueChange", false));
    for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("local-1");
    expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Notify when ready").props.value).toBe(false);
  });

  test("never answered or already used: no row; declined: a deliberate way back", async () => {
    await renderWithReminder(null);
    expect(screen.queryByLabelText("Morning reminder")).toBeNull();
    await screen.unmount();
    await renderWithReminder({ status: "opened", id: "local-1" });
    expect(screen.queryByLabelText("Morning reminder")).toBeNull();
    await screen.unmount();
    await renderWithReminder({ status: "declined" });
    expect(screen.getByLabelText("Morning reminder").props.value).toBe(false);
  });

  test("deleting the account cancels its reminder and forgets it before signing out", async () => {
    (deleteAccount as jest.Mock).mockResolvedValue(undefined);
    const auth = await renderWithReminder({ status: "scheduled", id: "local-1", fireAt: Date.now() + 3600_000 });
    await fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
    const buttons = screen.getAllByRole("button", { name: "Delete Account" });
    await act(async () => fireEvent.press(buttons[buttons.length - 1]));
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("local-1");
    expect(await AsyncStorage.getItem(recordKey("u1"))).toBeNull();
    expect(auth.signOut).toHaveBeenCalled();
  });
});
