import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import SignInPasswordScreen from "../app/sign-in-password";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), back: mockBack, canGoBack: () => true }) }));

function renderScreen(overrides: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    status: "signedOut", email: null, userId: null,
    sendCode: jest.fn(async () => {}), verifyCode: jest.fn(async () => {}),
    signInWithPassword: jest.fn(async () => {}), signOut: jest.fn(async () => {}),
    ...overrides,
  };
  render(<AuthContext.Provider value={value}><SignInPasswordScreen /></AuthContext.Provider>);
  return value;
}

const signInButton = () => screen.getByRole("button", { name: "Sign In" });

afterEach(() => mockBack.mockClear());

test("Sign In waits for an email and a password", () => {
  renderScreen();
  expect(signInButton()).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("Email"), "review@example.com");
  expect(signInButton()).toBeDisabled();
  fireEvent.changeText(screen.getByLabelText("Password"), "secret");
  expect(signInButton()).toBeEnabled();
});

test("Sign In passes the email and password to Supabase sign-in", async () => {
  const auth = renderScreen();
  fireEvent.changeText(screen.getByLabelText("Email"), "review@example.com");
  fireEvent.changeText(screen.getByLabelText("Password"), "secret");
  await act(async () => fireEvent.press(signInButton()));
  expect(auth.signInWithPassword).toHaveBeenCalledWith("review@example.com", "secret");
});

test("a wrong password shows the reason and stays put", async () => {
  renderScreen({ signInWithPassword: jest.fn(async () => { throw new Error("That email and password don't match."); }) });
  fireEvent.changeText(screen.getByLabelText("Email"), "review@example.com");
  fireEvent.changeText(screen.getByLabelText("Password"), "wrong");
  await act(async () => fireEvent.press(signInButton()));
  expect(screen.getByText("That email and password don't match.")).toBeTruthy();
  expect(signInButton()).toBeEnabled();
});

test("Back returns to the email sign-in", () => {
  renderScreen();
  fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(mockBack).toHaveBeenCalled();
});
