import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import AccountScreen from "../app/(tabs)/account";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";
import { pressAlertButton } from "./helpers/alert";

function renderAccount(overrides: Partial<AuthContextValue>) {
  const value: AuthContextValue = {
    status: "signedIn", email: "me@example.com", userId: "u1",
    sendCode: jest.fn(), verifyCode: jest.fn(), signOut: jest.fn(async () => {}),
    ...overrides,
  };
  render(<AuthContext.Provider value={value}><AccountScreen /></AuthContext.Provider>);
  return value;
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
