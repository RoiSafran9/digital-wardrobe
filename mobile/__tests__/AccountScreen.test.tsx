import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import AccountScreen from "../app/(tabs)/account";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";
import { pressAlertButton } from "./helpers/alert";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import type { Credits } from "../src/api/types";

jest.mock("expo-router", () => ({ useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]) }));

const CREDITS: Credits = {
  balance: 197, held: 1, available: 196, granted: 200, used: 3, next_before: null,
  entries: [
    { id: 4, kind: "hold", amount: 1, action: "garment", job_id: "j2", note: null, created_at: "2026-10-18T10:00:00Z" },
    { id: 3, kind: "release", amount: 1, action: "turn", job_id: "j1", note: null, created_at: "2026-10-18T09:00:00Z" },
    { id: 2, kind: "charge", amount: 3, action: "turn", job_id: "j1", note: null, created_at: "2026-10-18T09:00:00Z" },
    { id: 1, kind: "grant", amount: 200, action: null, job_id: null, note: "F&F pilot", created_at: "2026-10-18T08:00:00Z" },
  ],
};

function renderAccount(overrides: Partial<AuthContextValue>, credits: Partial<CreditsValue> = {}) {
  const value: AuthContextValue = {
    status: "signedIn", email: "me@example.com", userId: "u1",
    sendCode: jest.fn(), verifyCode: jest.fn(), signOut: jest.fn(async () => {}),
    ...overrides,
  };
  const creditsValue: CreditsValue = { billing: false, prices: {}, credits: null, refresh: jest.fn(async () => {}), ...credits };
  render(
    <AuthContext.Provider value={value}>
      <CreditsContext.Provider value={creditsValue}><AccountScreen /></CreditsContext.Provider>
    </AuthContext.Provider>,
  );
  return { ...value, refreshCredits: creditsValue.refresh };
}

beforeEach(() => jest.spyOn(Alert, "alert").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test("signed in: shows the email and signs out after confirming", () => {
  const auth = renderAccount({});
  expect(screen.getByText("Account")).toBeTruthy();
  expect(screen.getByText("me@example.com")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
  expect(Alert.alert).toHaveBeenCalledWith("Sign out?", "You'll need a new email code to sign back in.", expect.any(Array));
  expect(auth.signOut).not.toHaveBeenCalled();
  pressAlertButton("Sign out");
  expect(auth.signOut).toHaveBeenCalled();
});

test("cancelling keeps you signed in", () => {
  const auth = renderAccount({});
  fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
  pressAlertButton("Cancel");
  expect(auth.signOut).not.toHaveBeenCalled();
});

test("local mode: explains it and offers no sign out", () => {
  renderAccount({ status: "local", email: null, userId: null });
  expect(screen.getByText("Local mode")).toBeTruthy();
  expect(screen.getByText("Not signed in. Your items live on your computer's wardrobe server.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
});

test("shows available credits, what's held and an honest used-of-granted line", () => {
  const { refreshCredits } = renderAccount({}, { credits: CREDITS, billing: true, prices: { garment: 1, back: 1, turn: 3 } });
  expect(refreshCredits).toHaveBeenCalled();  // refreshed when Account comes into view
  expect(screen.getByText("196 available")).toBeTruthy();
  expect(screen.getByText("1 held for work in progress")).toBeTruthy();
  expect(screen.getByText("Used 3 of 200 credits granted")).toBeTruthy();
  expect(screen.queryByText(/Billing is off/)).toBeNull();
});

test("billing off: the balance shows, with no price list and a plain note", () => {
  renderAccount({}, { credits: { ...CREDITS, held: 0 }, billing: false });
  expect(screen.getByText("196 available")).toBeTruthy();
  expect(screen.getByText("Billing is off — AI actions don't use credits yet.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "AI Price List" })).toBeNull();
});

test("the price list comes from the server", () => {
  renderAccount({}, { credits: CREDITS, billing: true, prices: { garment: 1, back: 2, turn: 5 } });
  fireEvent.press(screen.getByRole("button", { name: "AI Price List" }));
  expect(screen.getByText("Front image")).toBeTruthy();
  expect(screen.getByText("2 credits")).toBeTruthy();
  expect(screen.getByText("5 credits")).toBeTruthy();
});

test("activity lists grants and charges, not internal holds and releases", () => {
  renderAccount({}, { credits: CREDITS });
  fireEvent.press(screen.getByRole("button", { name: "Credit activity" }));
  expect(screen.getByText("F&F pilot")).toBeTruthy();
  expect(screen.getByText("+200")).toBeTruthy();
  expect(screen.getByText("360 view")).toBeTruthy();
  expect(screen.getByText("−3")).toBeTruthy();
  expect(screen.queryByText("−1")).toBeNull();
});

test("no credits card before credits load or in local mode", () => {
  renderAccount({});
  expect(screen.queryByText("AI Credits")).toBeNull();
});
