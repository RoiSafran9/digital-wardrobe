import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import type { Credits } from "../src/api/types";
import { CreditPill } from "../src/ui/CreditPill";
import { CostSheet } from "../src/ui/CostSheet";
import { InsufficientCreditsSheet } from "../src/ui/InsufficientCreditsSheet";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const credits = (available: number) => ({ balance: available, held: 0, available, granted: 200, used: 0, entries: [], next_before: null }) as Credits;

function withCredits(ui: React.ReactElement, value: Partial<CreditsValue>) {
  const full: CreditsValue = { billing: false, prices: {}, credits: null, refresh: jest.fn(async () => {}), ...value };
  return render(<CreditsContext.Provider value={full}>{ui}</CreditsContext.Provider>);
}

afterEach(() => mockPush.mockClear());

test("the credit pill shows the server balance and opens Account", () => {
  const onPress = jest.fn();
  withCredits(<CreditPill onPress={onPress} />, { billing: true, prices: { garment: 1 }, credits: credits(37) });
  fireEvent.press(screen.getByRole("button", { name: "37 AI credits" }));
  expect(onPress).toHaveBeenCalled();
});

test("the credit pill is hidden while billing is off or before credits load", () => {
  withCredits(<CreditPill onPress={() => {}} />, { billing: false, credits: credits(37) });
  expect(screen.queryByText("37")).toBeNull();
  screen.unmount();
  withCredits(<CreditPill onPress={() => {}} />, { billing: true, credits: null });
  expect(screen.queryByRole("button")).toBeNull();
});

test("the cost sheet shows each line, the total and the balance after", () => {
  const onConfirm = jest.fn();
  withCredits(
    <CostSheet
      visible title="Generate 4 garments" subtitle="High-quality front catalog images for the pieces you selected."
      lines={[{ label: "Front image", action: "garment", count: 4 }]} note="Detection was free"
      confirmLabel="Generate · 4 credits" onConfirm={onConfirm} onClose={() => {}}
    />,
    { billing: true, prices: { garment: 1 }, credits: credits(18) },
  );
  expect(screen.getByText("Front image × 4")).toBeTruthy();
  expect(screen.getByText("Total")).toBeTruthy();
  expect(screen.getByText("Balance 18 → 14")).toBeTruthy();
  expect(screen.getByText("Detection was free")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Generate · 4 credits" }));
  expect(onConfirm).toHaveBeenCalled();
});

test("the insufficient sheet shows balance against need and never offers to buy", () => {
  const onAdjust = jest.fn();
  withCredits(
    <InsufficientCreditsSheet visible needed={4} onAdjust={onAdjust} onClose={() => {}} body="Deselect 2 garments to continue with what you have." />,
    { billing: true, prices: { garment: 1 }, credits: credits(2) },
  );
  expect(screen.getByText("2")).toBeTruthy();
  expect(screen.getByText("/ 4 credits needed")).toBeTruthy();
  expect(screen.getByText("Not enough credits")).toBeTruthy();
  expect(screen.getByText(/Deselect 2 garments/)).toBeTruthy();
  expect(screen.getByText(/Ask the app owner for more credits\./)).toBeTruthy();
  expect(screen.queryByText(/buy|purchase/i)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Adjust Selection" }));
  expect(onAdjust).toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "View Price List" }));
  expect(mockPush).toHaveBeenCalledWith("/account");
});

test("without an adjust action the insufficient sheet just says OK", () => {
  const onClose = jest.fn();
  withCredits(<InsufficientCreditsSheet visible needed={3} onClose={onClose} />, { billing: true, prices: { turn: 3 }, credits: credits(1) });
  fireEvent.press(screen.getByRole("button", { name: "OK" }));
  expect(onClose).toHaveBeenCalled();
});
