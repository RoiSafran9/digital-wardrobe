import React from "react";
import { Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { getCredits, getPrices } from "../src/api/client";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";
import { CreditsProvider, useCredits } from "../src/credits/CreditsProvider";

jest.mock("../src/api/client", () => ({ getCredits: jest.fn(), getPrices: jest.fn() }));
const mockedCredits = getCredits as jest.Mock;
const mockedPrices = getPrices as jest.Mock;

function Show() {
  const { credits, billing } = useCredits();
  return <Text>{credits ? `${credits.available} ${billing ? "billing" : "free"}` : "none"}</Text>;
}

const auth = (status: AuthContextValue["status"], userId: string | null): AuthContextValue =>
  ({ status, userId, email: null, sendCode: jest.fn(), verifyCode: jest.fn(), signOut: jest.fn() });

const tree = (value: AuthContextValue) => (
  <AuthContext.Provider value={value}><CreditsProvider><Show /></CreditsProvider></AuthContext.Provider>
);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockedCredits.mockResolvedValue({ available: 7 });
  mockedPrices.mockResolvedValue({ billing: true, prices: { garment: 1 } });
});
afterEach(() => jest.useRealTimers());

const settle = () => act(async () => { jest.runOnlyPendingTimers(); await Promise.resolve(); await Promise.resolve(); });

test("loads the signed-in account's credits and forgets them on sign-out", async () => {
  const { rerender } = render(tree(auth("signedIn", "u1")));
  await settle();
  expect(screen.getByText("7 billing")).toBeTruthy();
  rerender(tree(auth("signedOut", null)));
  await settle();
  expect(screen.getByText("none")).toBeTruthy();
});

test("local mode loads nothing", async () => {
  render(tree(auth("local", null)));
  await settle();
  expect(mockedCredits).not.toHaveBeenCalled();
  expect(screen.getByText("none")).toBeTruthy();
});

test("another account never sees the previous account's balance", async () => {
  const { rerender } = render(tree(auth("signedIn", "u1")));
  await settle();
  mockedCredits.mockResolvedValue({ available: 2 });
  rerender(tree(auth("signedIn", "u2")));
  expect(screen.getByText("none")).toBeTruthy();  // cleared at once, before u2's answer
  await settle();
  expect(screen.getByText("2 billing")).toBeTruthy();
});
