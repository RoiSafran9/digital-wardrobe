import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import SignInScreen from "../app/sign-in";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";

function renderScreen(overrides: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    status: "signedOut", email: null, userId: null,
    sendCode: jest.fn(async () => {}), verifyCode: jest.fn(async () => {}), signOut: jest.fn(async () => {}),
    ...overrides,
  };
  render(<AuthContext.Provider value={value}><SignInScreen /></AuthContext.Provider>);
  return value;
}

const sendButton = () => screen.getByRole("button", { name: "Send code" });

async function reachCodeStep(value?: Partial<AuthContextValue>) {
  const auth = renderScreen(value);
  fireEvent.changeText(screen.getByLabelText("Email"), " Me@Example.com ");
  await act(async () => fireEvent.press(sendButton()));
  return auth;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("Send code waits for a plausible email", () => {
  renderScreen();
  expect(screen.getByText("Sign in")).toBeTruthy();
  expect(sendButton()).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("Email"), "me@example");
  expect(sendButton()).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("Email"), " Me@Example.com ");
  expect(sendButton()).toBeEnabled();
});

test("sending the code moves to the code step with the normalized email", async () => {
  const auth = await reachCodeStep();
  expect(auth.sendCode).toHaveBeenCalledWith(" Me@Example.com ");
  expect(screen.getByText("Check your email")).toBeTruthy();
  expect(screen.getByText("Enter the 6-digit code we sent to me@example.com.")).toBeTruthy();
});

test("a failed send shows the reason and stays on the email step", async () => {
  renderScreen({ sendCode: jest.fn(async () => { throw new Error("Too many codes requested. Wait a minute and try again."); }) });
  fireEvent.changeText(screen.getByLabelText("Email"), "me@example.com");
  await act(async () => fireEvent.press(sendButton()));
  expect(screen.getByText("Too many codes requested. Wait a minute and try again.")).toBeTruthy();
  expect(screen.getByLabelText("Email")).toBeTruthy();
});

test("a pasted code with a space is accepted and verified as digits", async () => {
  const auth = await reachCodeStep();
  const signIn = screen.getByRole("button", { name: "Sign in" });
  expect(signIn).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("6-digit code"), "123 456");
  expect(screen.getByLabelText("6-digit code").props.value).toBe("123456");
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Sign in" })));
  expect(auth.verifyCode).toHaveBeenCalledWith("me@example.com", "123456");
});

test("a wrong code shows the error and keeps the input", async () => {
  await reachCodeStep({ verifyCode: jest.fn(async () => { throw new Error("That code is wrong or has expired. Check the email or send a new code."); }) });
  fireEvent.changeText(screen.getByLabelText("6-digit code"), "000000");
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Sign in" })));
  expect(screen.getByText("That code is wrong or has expired. Check the email or send a new code.")).toBeTruthy();
  expect(screen.getByLabelText("6-digit code").props.value).toBe("000000");
});

test("resend unlocks after 60 seconds and restarts the countdown", async () => {
  const auth = await reachCodeStep();
  expect(screen.getByRole("button", { name: "Resend code in 60s" })).toBeDisabled();
  act(() => jest.advanceTimersByTime(30_000));
  expect(screen.getByRole("button", { name: "Resend code in 30s" })).toBeDisabled();
  act(() => jest.advanceTimersByTime(30_000));
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Resend code" })));
  expect(auth.sendCode).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button", { name: "Resend code in 60s" })).toBeDisabled();
});

test("Use a different email goes back to the email step", async () => {
  await reachCodeStep();
  fireEvent.press(screen.getByRole("button", { name: "Use a different email" }));
  expect(screen.getByText("Sign in")).toBeTruthy();
  expect(screen.getByLabelText("Email").props.value).toBe(" Me@Example.com ");
});

test("buttons are disabled while a request is in flight", async () => {
  let finish: () => void = () => {};
  renderScreen({ sendCode: jest.fn(() => new Promise<void>((resolve) => { finish = resolve; })) });
  fireEvent.changeText(screen.getByLabelText("Email"), "me@example.com");
  fireEvent.press(sendButton());
  expect(sendButton()).toBeDisabled();
  await act(async () => finish());
  expect(screen.getByText("Check your email")).toBeTruthy();
});
