import React, { useState } from "react";
import { Pressable, Text } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { AppShell } from "../src/RootNavigator";
import { AuthContext, type AuthContextValue, type AuthStatus } from "../src/auth/AuthProvider";
import { useCaptureJobs } from "../src/store/captureJobs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import WelcomeScreen from "../app/welcome";
import { SEEN_KEY } from "../src/onboarding";

const auth = (status: AuthStatus, userId: string | null = null): AuthContextValue => ({
  status, email: userId ? `${userId}@x.com` : null, userId,
  sendCode: jest.fn(), verifyCode: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn(),
});

function TabsStub() {
  const { saved, setSaved } = useCaptureJobs();
  return (
    <>
      <Text>tabs home</Text>
      <Text>{saved ? `last run ${saved.items.length}` : "no last run"}</Text>
      <Pressable onPress={() => setSaved({ items: [], creditsUsed: null })}>
        <Text>capture</Text>
      </Pressable>
    </>
  );
}

let setAuth: (value: AuthContextValue) => void = () => {};
function routes(initial: AuthContextValue) {
  function Root() {
    const [value, set] = useState(initial);
    setAuth = set;
    return <AuthContext.Provider value={value}><AppShell /></AuthContext.Provider>;
  }
  return {
    _layout: { default: Root, unstable_settings: { anchor: "welcome" } },
    "(tabs)/_layout": () => { const { Slot } = require("expo-router"); return <Slot />; },
    "(tabs)/index": TabsStub,
    "sign-in": () => <Text>sign-in screen</Text>,
    welcome: WelcomeScreen,
    intro: () => <Text>intro screen</Text>,
    "sign-in-code": () => <Text>code screen</Text>,
    "welcome-credits": () => <Text>starter screen</Text>,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(SEEN_KEY, "1");  // most tests are past onboarding
});

test("signed out on first launch → Welcome, then Get Started opens the intro", async () => {
  await AsyncStorage.clear();
  renderRouter(routes(auth("signedOut")), { initialUrl: "/" });
  expect(await screen.findByText(/beautifully digital\./)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Get Started" }));
  expect(await screen.findByText("intro screen")).toBeTruthy();
});

test("Welcome's I already have an account goes to Sign In and remembers onboarding", async () => {
  await AsyncStorage.clear();
  renderRouter(routes(auth("signedOut")), { initialUrl: "/" });
  fireEvent.press(await screen.findByRole("button", { name: "I already have an account" }));
  expect(await screen.findByText("sign-in screen")).toBeTruthy();
  expect(await AsyncStorage.getItem(SEEN_KEY)).toBe("1");
});

test("local mode never shows onboarding", async () => {
  await AsyncStorage.clear();
  renderRouter(routes(auth("local")), { initialUrl: "/" });
  expect(await screen.findByText("tabs home")).toBeTruthy();
  expect(screen.queryByText(/beautifully digital/)).toBeNull();
});

test("signed out after onboarding → only Sign In", async () => {
  renderRouter(routes(auth("signedOut")), { initialUrl: "/" });
  expect(await screen.findByText("sign-in screen")).toBeTruthy();
  expect(screen.queryByText("tabs home")).toBeNull();
});

test("signed in → the tabs", async () => {
  renderRouter(routes(auth("signedIn", "a")), { initialUrl: "/" });
  expect(await screen.findByText("tabs home")).toBeTruthy();
});

test("local mode → the tabs, as today", async () => {
  renderRouter(routes(auth("local")), { initialUrl: "/" });
  expect(await screen.findByText("tabs home")).toBeTruthy();
});

test("a signed-out deep link to Sign In while signed in lands on the tabs", async () => {
  renderRouter(routes(auth("signedIn", "a")), { initialUrl: "/sign-in" });
  expect(await screen.findByText("tabs home")).toBeTruthy();
});

test("unconfigured → the setup message instead of the app", async () => {
  renderRouter(routes({ ...auth("unconfigured"), reason: "Supabase URL is missing." }), { initialUrl: "/" });
  expect(await screen.findByText("Sign-in isn't configured")).toBeTruthy();
  expect(screen.getByText("Supabase URL is missing.")).toBeTruthy();
});

test("signing out then in as someone else forgets the previous user's last capture", async () => {
  renderRouter(routes(auth("signedIn", "a")), { initialUrl: "/" });
  fireEvent.press(await screen.findByText("capture"));
  expect(screen.getByText("last run 0")).toBeTruthy();
  act(() => setAuth(auth("signedOut")));
  expect(await screen.findByText("sign-in screen")).toBeTruthy();
  act(() => setAuth(auth("signedIn", "b")));
  expect(await screen.findByText("no last run")).toBeTruthy();
});
