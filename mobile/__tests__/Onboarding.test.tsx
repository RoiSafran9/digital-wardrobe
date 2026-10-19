import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import IntroScreen from "../app/intro";
import { OnboardingProvider, SEEN_KEY } from "../src/onboarding";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => true }) }));

beforeEach(async () => { await AsyncStorage.clear(); mockReplace.mockClear(); });

const renderIntro = () => render(<OnboardingProvider><IntroScreen /></OnboardingProvider>);

test("the intro has three pages with the handoff titles", () => {
  renderIntro();
  expect(screen.getByText("Snap any garment")).toBeTruthy();
  expect(screen.getByText("Or import an outfit")).toBeTruthy();
  expect(screen.getByText("Browse what you own")).toBeTruthy();
  expect(screen.getByLabelText("Page 1 of 3")).toBeTruthy();
});

test("Skip remembers onboarding and opens Sign In", async () => {
  renderIntro();
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Skip" })));
  expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  expect(await AsyncStorage.getItem(SEEN_KEY)).toBe("1");
});

test("Next walks the pages and the last one continues to Sign In", async () => {
  renderIntro();
  fireEvent.press(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByLabelText("Page 2 of 3")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByLabelText("Page 3 of 3")).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Continue" })));
  expect(mockReplace).toHaveBeenCalledWith("/sign-in");
});
