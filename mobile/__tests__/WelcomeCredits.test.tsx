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
jest.mock("../src/api/client", () => ({ getItems: jest.fn(async () => ({ items: [] })) }));
const mockGetItems = jest.requireMock("../src/api/client").getItems as jest.Mock;

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

test("a new closet continues into First 3 Pieces; Explore first opens Home", async () => {
  renderScreen({});
  await act(async () => {});
  fireEvent.press(screen.getByRole("button", { name: "Add Your First 3 Pieces" }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/first-pieces", params: { entry: "starter" } });
  fireEvent.press(screen.getByRole("button", { name: "Explore first" }));
  expect(mockReplace).toHaveBeenCalledWith("/");
});

test("an account that already has pieces (a new device) goes to Add instead", async () => {
  mockGetItems.mockResolvedValueOnce({ items: [{ item_id: "i1" }] });
  renderScreen({});
  fireEvent.press(await screen.findByRole("button", { name: "Add Clothes" }));
  expect(mockReplace).toHaveBeenCalledWith("/add");
  expect(screen.queryByRole("button", { name: "Add Your First 3 Pieces" })).toBeNull();
});

test("eligibility: billing on and something granted", () => {
  expect(starterEligible(true, credits(10, 10))).toBe(true);
  expect(starterEligible(false, credits(10, 10))).toBe(false);
  expect(starterEligible(true, credits(0, 0))).toBe(false);
  expect(starterEligible(true, null)).toBe(false);
  expect(priceChips({ garment: 1, back: 1, turn: 3 })).toEqual(["Front · 1", "Back · 1", "360° · 3"]);
});

function Harness({ billing, value, show, fresh = true }: { billing: boolean; value: Credits | null; show: () => void; fresh?: boolean }) {
  const { noteSignedIn } = useOnboarding();
  useEffect(() => { if (fresh) noteSignedIn(); }, [noteSignedIn, fresh]);
  const decided = useStarterCredits("u1", billing, value, show);
  return <Text>{decided ? "decided" : "deciding"}</Text>;
}

test("First 3 Pieces waits until the starter decision is made", async () => {
  const show = jest.fn();
  const { rerender } = render(<OnboardingProvider><Harness billing value={null} show={show} /></OnboardingProvider>);
  await act(async () => {});
  expect(screen.getByText("deciding")).toBeTruthy();  // a fresh sign-in, credits not in yet
  rerender(<OnboardingProvider><Harness billing={false} value={credits(37)} show={show} /></OnboardingProvider>);
  await waitFor(() => expect(screen.getByText("decided")).toBeTruthy());
  screen.unmount();
  render(<OnboardingProvider><Harness billing value={null} show={show} fresh={false} /></OnboardingProvider>);
  await act(async () => {});
  expect(screen.getByText("decided")).toBeTruthy();  // no fresh sign-in: nothing to decide
});

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
