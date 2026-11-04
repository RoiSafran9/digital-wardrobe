import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import SignInScreen from "../app/sign-in";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockCanGoBack = true;
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, canGoBack: () => mockCanGoBack }),
}));

async function renderScreen(overrides: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    status: "signedOut", email: null, userId: null,
    sendCode: jest.fn(async () => {}), verifyCode: jest.fn(async () => {}), signInWithPassword: jest.fn(async () => {}), signOut: jest.fn(async () => {}),
    ...overrides,
  };
  await render(<AuthContext.Provider value={value}><SignInScreen /></AuthContext.Provider>);
  return value;
}

const continueButton = () => screen.getByRole("button", { name: "Continue" });

afterEach(() => { mockPush.mockClear(); mockBack.mockClear(); mockCanGoBack = true; });

test("Continue waits for a plausible email", async () => {
  await renderScreen();
  expect(screen.getByText("Sign in with email")).toBeTruthy();
  expect(screen.getByText("We'll send you a six-digit code. No password needed.")).toBeTruthy();
  expect(continueButton()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText("Email"), "me@example");
  expect(continueButton()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText("Email"), " Me@Example.com ");
  expect(continueButton()).toBeEnabled();
});

test("Continue sends the code and opens the code screen with the normalized email", async () => {
  const auth = await renderScreen();
  await fireEvent.changeText(screen.getByLabelText("Email"), " Me@Example.com ");
  await act(async () => fireEvent.press(continueButton()));
  expect(auth.sendCode).toHaveBeenCalledWith(" Me@Example.com ");
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/sign-in-code", params: { email: "me@example.com", sentAt: expect.any(String) } });
});

test("a failed send shows the reason and stays put", async () => {
  await renderScreen({ sendCode: jest.fn(async () => { throw new Error("Too many codes requested. Wait a minute and try again."); }) });
  await fireEvent.changeText(screen.getByLabelText("Email"), "me@example.com");
  await act(async () => fireEvent.press(continueButton()));
  expect(screen.getByText("Too many codes requested. Wait a minute and try again.")).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
});

test("Continue is disabled while the code is being sent", async () => {
  let finish: () => void = () => {};
  await renderScreen({ sendCode: jest.fn(() => new Promise<void>((resolve) => { finish = resolve; })) });
  await fireEvent.changeText(screen.getByLabelText("Email"), "me@example.com");
  // The press settles only once the send does, so it is awaited after the send is let through.
  const pressing = fireEvent.press(continueButton());
  await waitFor(() => expect(continueButton()).toBeDisabled());
  finish();
  await pressing;
  expect(mockPush).toHaveBeenCalled();
});

test("Back appears only when there is somewhere to go back to", async () => {
  await renderScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(mockBack).toHaveBeenCalled();
  await screen.unmount();
  mockCanGoBack = false;
  await renderScreen();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
});

test("holding the title opens password sign-in (App Review demo account)", async () => {
  await renderScreen();
  await fireEvent(screen.getByText("Sign in with email"), "longPress");
  expect(mockPush).toHaveBeenCalledWith("/sign-in-password");
});
