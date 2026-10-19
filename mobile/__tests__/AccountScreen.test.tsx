import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AccountScreen from "../app/(tabs)/account";
import { deleteAccount } from "../src/api/client";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import type { Credits } from "../src/api/types";

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

function renderAccount(overrides: Partial<AuthContextValue>, credits: Partial<CreditsValue> = {}) {
  const value: AuthContextValue = {
    status: "signedIn", email: "me@example.com", userId: "u1",
    sendCode: jest.fn(), verifyCode: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn(async () => {}),
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

test("signed in: shows the email with initials and signs out after confirming", () => {
  const auth = renderAccount({});
  expect(screen.getByText("Account")).toBeTruthy();
  expect(screen.getByText("me@example.com")).toBeTruthy();
  expect(screen.getByText("M")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Sign Out" }));
  expect(screen.getByText("You'll need a new email code to sign back in.")).toBeTruthy();
  expect(auth.signOut).not.toHaveBeenCalled();
  const buttons = screen.getAllByRole("button", { name: "Sign Out" });
  fireEvent.press(buttons[buttons.length - 1]);
  expect(auth.signOut).toHaveBeenCalled();
});

test("cancelling keeps you signed in", () => {
  const auth = renderAccount({});
  fireEvent.press(screen.getByRole("button", { name: "Sign Out" }));
  fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(auth.signOut).not.toHaveBeenCalled();
});

test("local mode: explains it, offers appearance, no sign out and no credits", () => {
  renderAccount({ status: "local", email: null, userId: null }, { credits: CREDITS, billing: true });
  expect(screen.getByText("Local mode")).toBeTruthy();
  expect(screen.getByText("Not signed in. Your items live on your computer's wardrobe server.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Sign Out" })).toBeNull();
  expect(screen.queryByText("AI Credits")).toBeNull();
  expect(screen.getByRole("tab", { name: "System" })).toBeTruthy();
});

test("the balance is out of what the server granted, never a fixed number", () => {
  const { refreshCredits } = renderAccount({}, { credits: CREDITS, billing: true, prices: { garment: 1, back: 1, turn: 3 } });
  expect(refreshCredits).toHaveBeenCalled();  // refreshed when Account comes into view
  expect(screen.getByLabelText("196 AI credits available")).toBeTruthy();
  expect(screen.getByText("of 200 granted")).toBeTruthy();
  expect(screen.getByText("3 used so far · enough for about 196 more garments")).toBeTruthy();
  expect(screen.getByText("1 held for work in progress")).toBeTruthy();
  expect(screen.getByLabelText("Credits left").props.accessibilityValue).toEqual({ min: 0, max: 100, now: 98 });
});

test("three credits or fewer turns the meter amber and says so", () => {
  renderAccount({}, { credits: { ...CREDITS, available: 3, balance: 3, held: 0 }, billing: true, prices: { garment: 1 } });
  expect(screen.getByText("Running low. Ask the app owner for more credits.")).toBeTruthy();
});

test("billing off: the balance shows, with no price list and a plain note", () => {
  renderAccount({}, { credits: { ...CREDITS, held: 0 }, billing: false });
  expect(screen.getByLabelText("196 AI credits available")).toBeTruthy();
  expect(screen.getByText("Billing is off — AI actions don't use credits yet.")).toBeTruthy();
  expect(screen.queryByText("Price list")).toBeNull();
});

test("the price list comes from the server", () => {
  renderAccount({}, { credits: CREDITS, billing: true, prices: { garment: 1, back: 2, turn: 5 }, outfit: true });
  expect(screen.getByText("Garment detection")).toBeTruthy();
  expect(screen.getByText("Free")).toBeTruthy();
  expect(screen.getByText("Front image")).toBeTruthy();
  expect(screen.getByText("2 credits")).toBeTruthy();
  expect(screen.getByText("5 credits")).toBeTruthy();
});

test("activity lists grants and charges, not internal holds and releases", () => {
  renderAccount({}, { credits: CREDITS });
  expect(screen.getByText("F&F pilot")).toBeTruthy();
  expect(screen.getByText("+200")).toBeTruthy();
  expect(screen.getByText("360 view")).toBeTruthy();
  expect(screen.getByText("−3")).toBeTruthy();
  expect(screen.queryByText("−1")).toBeNull();
});

test("How it works explains the three rules", () => {
  renderAccount({}, { credits: CREDITS, billing: true, prices: { garment: 1 } });
  fireEvent.press(screen.getByRole("button", { name: "How it works" }));
  expect(screen.getByText("Finding garments is free")).toBeTruthy();
  expect(screen.getByText("You always see the cost first")).toBeTruthy();
});

test("no credits card before credits load", () => {
  renderAccount({});
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
  const auth = renderAccount({}, { credits: CREDITS });
  fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
  expect(screen.getByText(/removed for good/)).toBeTruthy();
  expect(deleteAccount).not.toHaveBeenCalled();
  const buttons = screen.getAllByRole("button", { name: "Delete Account" });
  await act(async () => fireEvent.press(buttons[buttons.length - 1]));
  expect(deleteAccount).toHaveBeenCalled();
  expect(auth.signOut).toHaveBeenCalled();
});

test("a failed delete says so and keeps you signed in", async () => {
  (deleteAccount as jest.Mock).mockRejectedValue(new Error("Can't reach your wardrobe server."));
  const auth = renderAccount({}, { credits: CREDITS });
  fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
  const buttons = screen.getAllByRole("button", { name: "Delete Account" });
  await act(async () => fireEvent.press(buttons[buttons.length - 1]));
  expect(screen.getByText("Can't reach your wardrobe server.")).toBeTruthy();
  expect(auth.signOut).not.toHaveBeenCalled();
});

test("local mode offers no Delete Account", () => {
  renderAccount({ status: "local", email: null, userId: null });
  expect(screen.queryByRole("button", { name: "Delete Account" })).toBeNull();
});

test("initials prefer the chosen name", () => {
  const { initials } = require("../app/(tabs)/account");
  expect(initials("x@y.com", "Maya Chen")).toBe("MC");
  expect(initials("x@y.com", "רועי")).toBe("ר");
});

test("Help and Privacy open from Settings", () => {
  renderAccount({}, { credits: CREDITS });
  fireEvent.press(screen.getByRole("button", { name: "Help & Support" }));
  expect(mockPush).toHaveBeenCalledWith("/help");
  fireEvent.press(screen.getByRole("button", { name: "Privacy" }));
  expect(mockPush).toHaveBeenCalledWith("/privacy");
});
