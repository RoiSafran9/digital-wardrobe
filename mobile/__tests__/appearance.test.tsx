import React from "react";
import { Appearance, Pressable, Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { APPEARANCE_KEY, AppearanceProvider, useAppearance } from "../src/appearance";

function Probe() {
  const { mode, setMode } = useAppearance();
  return (
    <>
      <Text>{`mode ${mode}`}</Text>
      <Pressable onPress={() => setMode("dark")}><Text>dark</Text></Pressable>
      <Pressable onPress={() => setMode("system")}><Text>system</Text></Pressable>
    </>
  );
}

beforeEach(async () => { await AsyncStorage.clear(); jest.restoreAllMocks(); });

test("defaults to the system appearance", async () => {
  const spy = jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {});
  render(<AppearanceProvider><Probe /></AppearanceProvider>);
  await act(async () => {});
  expect(screen.getByText("mode system")).toBeTruthy();
  expect(spy).not.toHaveBeenCalledWith("dark");
});

test("a chosen appearance applies at once, persists, and System hands back to iOS", async () => {
  const spy = jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {});
  render(<AppearanceProvider><Probe /></AppearanceProvider>);
  await act(async () => fireEvent.press(screen.getByText("dark")));
  expect(spy).toHaveBeenLastCalledWith("dark");
  expect(await AsyncStorage.getItem(APPEARANCE_KEY)).toBe("dark");
  await act(async () => fireEvent.press(screen.getByText("system")));
  expect(spy).toHaveBeenLastCalledWith("unspecified");
});

test("a saved choice is restored at launch", async () => {
  await AsyncStorage.setItem(APPEARANCE_KEY, "light");
  const spy = jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {});
  render(<AppearanceProvider><Probe /></AppearanceProvider>);
  expect(await screen.findByText("mode light")).toBeTruthy();
  expect(spy).toHaveBeenCalledWith("light");
});
