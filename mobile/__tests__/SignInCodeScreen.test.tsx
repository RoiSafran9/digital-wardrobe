import React from "react";
import { Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import SignInCodeScreen from "../app/sign-in-code";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";
import { OnboardingProvider, useOnboarding } from "../src/onboarding";

const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

function SignedInFlag() {
  const { justSignedIn } = useOnboarding();
  return <Text>{justSignedIn ? "fresh sign-in" : "no sign-in"}</Text>;
}

function renderScreen(overrides: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    status: "signedOut", email: null, userId: null,
    sendCode: jest.fn(async () => {}), verifyCode: jest.fn(async () => {}), signInWithPassword: jest.fn(async () => {}), signOut: jest.fn(async () => {}),
    ...overrides,
  };
  render(
    <AuthContext.Provider value={value}>
      <OnboardingProvider><SignInCodeScreen /><SignedInFlag /></OnboardingProvider>
    </AuthContext.Provider>,
  );
  return value;
}

const typeCode = (code: string) => fireEvent.changeText(screen.getByLabelText("6-digit code"), code);

beforeEach(() => {
  jest.useFakeTimers();
  mockParams = { email: "me@example.com", sentAt: String(Date.now()) };
});
afterEach(() => { jest.useRealTimers(); mockBack.mockClear(); });

test("names the address and shows six boxes", () => {
  renderScreen();
  expect(screen.getByText("Check your inbox")).toBeTruthy();
  expect(screen.getByText("Enter the code we sent to me@example.com")).toBeTruthy();
  expect(screen.getAllByTestId(/code-box-/, { includeHiddenElements: true })).toHaveLength(6);
});

test("six digits verify on their own after 600ms and mark a fresh sign-in", async () => {
  const auth = renderScreen();
  typeCode("123 456");
  expect(screen.getByLabelText("6-digit code").props.value).toBe("123456");
  expect(auth.verifyCode).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(600); });
  expect(auth.verifyCode).toHaveBeenCalledWith("me@example.com", "123456");
  expect(screen.getByText("fresh sign-in")).toBeTruthy();
});

test("a wrong code shows the message, clears the boxes and forgets the sign-in", async () => {
  renderScreen({ verifyCode: jest.fn(async () => { throw new Error("That code is wrong or has expired. Check the email or send a new code."); }) });
  typeCode("000000");
  await act(async () => { jest.advanceTimersByTime(600); });
  expect(screen.getByText("That code is wrong or has expired. Check the email or send a new code.")).toBeTruthy();
  expect(screen.getByLabelText("6-digit code").props.value).toBe("");
  expect(screen.getByText("no sign-in")).toBeTruthy();
});

test("resend waits 60 seconds from when the code was sent", async () => {
  const auth = renderScreen();
  expect(screen.getByRole("button", { name: "Resend code in 60s" })).toBeDisabled();
  act(() => jest.advanceTimersByTime(60_000));
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Resend code" })));
  expect(auth.sendCode).toHaveBeenCalledWith("me@example.com");
  expect(screen.getByRole("button", { name: "Resend code in 60s" })).toBeDisabled();
});

test("Use a different email goes back", () => {
  renderScreen();
  fireEvent.press(screen.getByRole("button", { name: "Use a different email" }));
  expect(mockBack).toHaveBeenCalled();
});
