import React from "react";
import { Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import YourNameScreen from "../app/your-name";
import { Greeting } from "../src/components/home/Greeting";
import { useNameStep } from "../src/onboarding";

const mockBack = jest.fn();
const mockSave = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn() }) }));
jest.mock("../src/profile", () => ({
  ...jest.requireActual("../src/profile"),
  useProfile: () => ({ profile: null, loaded: true, saveName: mockSave }),
}));

beforeEach(() => { mockBack.mockClear(); mockSave.mockReset(); });

test("Continue waits for a name, saves it trimmed, and moves on", async () => {
  mockSave.mockResolvedValue(undefined);
  render(<YourNameScreen />);
  expect(screen.getByText("What should we call you?")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("Your name"), "   ");
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("Your name"), " Maya ");
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Continue" })));
  expect(mockSave).toHaveBeenCalledWith(" Maya ");
  expect(mockBack).toHaveBeenCalled();
});

test("a failed save says so and stays", async () => {
  mockSave.mockRejectedValue(new Error("Can't reach your wardrobe server."));
  render(<YourNameScreen />);
  fireEvent.changeText(screen.getByLabelText("Your name"), "Maya");
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Continue" })));
  expect(screen.getByText("Can't reach your wardrobe server.")).toBeTruthy();
  expect(mockBack).not.toHaveBeenCalled();
});

test("the greeting uses the chosen name", () => {
  render(<Greeting now={new Date(2026, 9, 19, 9)} name="Maya" onCredits={() => {}} />);
  expect(screen.getByRole("header", { name: "Good morning,\nMaya" })).toBeTruthy();
});

function Step({ signedIn, loaded, name, ask }: { signedIn: boolean; loaded: boolean; name: string | null; ask: () => void }) {
  const ready = useNameStep(signedIn, loaded, name, ask);
  return <Text>{ready ? "ready" : "waiting"}</Text>;
}

test("the name step asks once when a signed-in account has no name, never in local mode", () => {
  const ask = jest.fn();
  const { rerender } = render(<Step signedIn loaded={false} name={null} ask={ask} />);
  expect(ask).not.toHaveBeenCalled();
  rerender(<Step signedIn loaded name={null} ask={ask} />);
  rerender(<Step signedIn loaded name={null} ask={ask} />);
  expect(ask).toHaveBeenCalledTimes(1);
  expect(screen.getByText("waiting")).toBeTruthy();
  rerender(<Step signedIn loaded name="Maya" ask={ask} />);
  expect(screen.getByText("ready")).toBeTruthy();
  const local = jest.fn();
  render(<Step signedIn={false} loaded={false} name={null} ask={local} />);
  expect(local).not.toHaveBeenCalled();
});
