import React, { useEffect } from "react";
import { Text } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import WelcomeCreditsScreen from "../app/welcome-credits";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import type { Credits } from "../src/api/types";
import { OnboardingProvider, priceChips, starterEligible, starterKey, useOnboarding, useStarterCredits } from "../src/onboarding";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));

const credits = (available: number, granted = 200) =>
  ({ balance: available, held: 0, available, granted, used: granted - available, entries: [], next_before: null }) as Credits;

function renderScreen(value: Partial<CreditsValue>) {
  const full: CreditsValue = { billing: true, prices: { garment: 1, back: 1, turn: 3 }, credits: credits(37), refresh: jest.fn(async () => {}), ...value };
  return render(<CreditsContext.Provider value={full}><WelcomeCreditsScreen /></CreditsContext.Provider>);
}

beforeEach(async () => { await AsyncStorage.clear(); mockReplace.mockClear(); });

test("shows the server's available balance, never a fixed number", () => {
  renderScreen({ credits: credits(37) });
  expect(screen.getByText("37")).toBeTruthy();
  expect(screen.queryByText("25")).toBeNull();
  expect(screen.getByText("A welcome gift")).toBeTruthy();
  expect(screen.getByText(/covers about 37 garments/)).toBeTruthy();
});

test("price chips come from the server prices", () => {
  renderScreen({ prices: { garment: 2, turn: 5 } });
  expect(screen.getByText("Front · 2")).toBeTruthy();
  expect(screen.getByText("360° · 5")).toBeTruthy();
  expect(screen.queryByText(/Back ·/)).toBeNull();
});

test("Digitize Your First Piece opens Add with the first-piece hint; Explore first opens Home", () => {
  renderScreen({});
  fireEvent.press(screen.getByRole("button", { name: "Digitize Your First Piece" }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/add", params: { firstPiece: "1" } });
  fireEvent.press(screen.getByRole("button", { name: "Explore first" }));
  expect(mockReplace).toHaveBeenCalledWith("/");
});

test("eligibility: billing on and something granted", () => {
  expect(starterEligible(true, credits(10, 10))).toBe(true);
  expect(starterEligible(false, credits(10, 10))).toBe(false);
  expect(starterEligible(true, credits(0, 0))).toBe(false);
  expect(starterEligible(true, null)).toBe(false);
  expect(priceChips({ garment: 1, back: 1, turn: 3 })).toEqual(["Front · 1", "Back · 1", "360° · 3"]);
});

function Harness({ billing, value, show }: { billing: boolean; value: Credits | null; show: () => void }) {
  const { noteSignedIn } = useOnboarding();
  useEffect(() => { noteSignedIn(); }, [noteSignedIn]);
  useStarterCredits("u1", billing, value, show);
  return <Text>harness</Text>;
}

test("after a fresh sign-in the starter screen is shown once per account", async () => {
  const show = jest.fn();
  const { rerender } = render(<OnboardingProvider><Harness billing value={null} show={show} /></OnboardingProvider>);
  expect(show).not.toHaveBeenCalled();  // waits for credits
  rerender(<OnboardingProvider><Harness billing value={credits(37)} show={show} /></OnboardingProvider>);
  await waitFor(() => expect(show).toHaveBeenCalledTimes(1));
  expect(await AsyncStorage.getItem(starterKey("u1"))).toBe("1");

  screen.unmount();
  const again = jest.fn();
  render(<OnboardingProvider><Harness billing value={credits(37)} show={again} /></OnboardingProvider>);
  await act(async () => {});
  expect(again).not.toHaveBeenCalled();
});

test("billing off: no starter screen", async () => {
  const show = jest.fn();
  render(<OnboardingProvider><Harness billing={false} value={credits(37)} show={show} /></OnboardingProvider>);
  await act(async () => {});
  expect(show).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(starterKey("u1"))).toBeNull();
});
