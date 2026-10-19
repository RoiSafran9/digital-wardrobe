import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import SignInScreen from "../app/sign-in";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockCanGoBack = true;
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, canGoBack: () => mockCanGoBack }),
}));

function renderScreen(overrides: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    status: "signedOut", email: null, userId: null,
    sendCode: jest.fn(async () => {}), verifyCode: jest.fn(async () => {}), signInWithPassword: jest.fn(async () => {}), signOut: jest.fn(async () => {}),
    ...overrides,
  };
  render(<AuthContext.Provider value={value}><SignInScreen /></AuthContext.Provider>);
  return value;
}

const continueButton = () => screen.getByRole("button", { name: "Continue" });

afterEach(() => { mockPush.mockClear(); mockBack.mockClear(); mockCanGoBack = true; });

test("Continue waits for a plausible email", () => {
  renderScreen();
  expect(screen.getByText("Sign in with email")).toBeTruthy();
  expect(screen.getByText("We'll send you a six-digit code. No password needed.")).toBeTruthy();
  expect(continueButton()).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("Email"), "me@example");
  expect(continueButton()).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("Email"), " Me@Example.com ");
  expect(continueButton()).toBeEnabled();
});

test("Continue sends the code and opens the code screen with the normalized email", async () => {
  const auth = renderScreen();
  fireEvent.changeText(screen.getByLabelText("Email"), " Me@Example.com ");
  await act(async () => fireEvent.press(continueButton()));
  expect(auth.sendCode).toHaveBeenCalledWith(" Me@Example.com ");
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/sign-in-code", params: { email: "me@example.com", sentAt: expect.any(String) } });
});

test("a failed send shows the reason and stays put", async () => {
  renderScreen({ sendCode: jest.fn(async () => { throw new Error("Too many codes requested. Wait a minute and try again."); }) });
  fireEvent.changeText(screen.getByLabelText("Email"), "me@example.com");
  await act(async () => fireEvent.press(continueButton()));
  expect(screen.getByText("Too many codes requested. Wait a minute and try again.")).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
});

test("Continue is disabled while the code is being sent", async () => {
  let finish: () => void = () => {};
  renderScreen({ sendCode: jest.fn(() => new Promise<void>((resolve) => { finish = resolve; })) });
  fireEvent.changeText(screen.getByLabelText("Email"), "me@example.com");
  fireEvent.press(continueButton());
  expect(continueButton()).toBeDisabled();
  await act(async () => finish());
  expect(mockPush).toHaveBeenCalled();
});

test("Back appears only when there is somewhere to go back to", () => {
  renderScreen();
  fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(mockBack).toHaveBeenCalled();
  screen.unmount();
  mockCanGoBack = false;
  renderScreen();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
});

test("holding the title opens password sign-in (App Review demo account)", () => {
  renderScreen();
  fireEvent(screen.getByText("Sign in with email"), "longPress");
  expect(mockPush).toHaveBeenCalledWith("/sign-in-password");
});
