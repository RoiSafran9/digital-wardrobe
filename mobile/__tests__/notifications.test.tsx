import React from "react";
import { Pressable, Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";
import { DENIED, NOT_SET_UP, NotifyProvider, useNotify } from "../src/notifications";
import { registerPushToken, unregisterPushToken } from "../src/api/client";

let mockProjectId: string | undefined = "proj-1";
jest.mock("expo-constants", () => ({ __esModule: true, default: { get expoConfig() { return { extra: mockProjectId ? { eas: { projectId: mockProjectId } } : {} }; } } }));
jest.mock("../src/api/client", () => ({ registerPushToken: jest.fn(async () => {}), unregisterPushToken: jest.fn(async () => {}) }));

function Probe() {
  const { enabled, error, setEnabled } = useNotify();
  return (
    <>
      <Text>{enabled ? "on" : "off"}</Text>
      {error ? <Text>{error}</Text> : null}
      <Pressable onPress={() => setEnabled(true)}><Text>enable</Text></Pressable>
      <Pressable onPress={() => setEnabled(false)}><Text>disable</Text></Pressable>
    </>
  );
}

const auth: AuthContextValue = { status: "signedIn", email: "a@x.com", userId: "u1", sendCode: jest.fn(), verifyCode: jest.fn(), signOut: jest.fn() };
const renderProbe = () => render(<AuthContext.Provider value={auth}><NotifyProvider><Probe /></NotifyProvider></AuthContext.Provider>);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockProjectId = "proj-1";
});

test("turning it on asks permission, registers this phone's token and remembers it", async () => {
  renderProbe();
  await act(async () => fireEvent.press(screen.getByText("enable")));
  expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "proj-1" });
  expect(registerPushToken).toHaveBeenCalledWith("ExponentPushToken[test]");
  expect(screen.getByText("on")).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText("disable")));
  expect(unregisterPushToken).toHaveBeenCalledWith("ExponentPushToken[test]");
  expect(screen.getByText("off")).toBeTruthy();
});

test("refused permission explains how to turn it on and registers nothing", async () => {
  (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
  renderProbe();
  await act(async () => fireEvent.press(screen.getByText("enable")));
  expect(screen.getByText(DENIED)).toBeTruthy();
  expect(registerPushToken).not.toHaveBeenCalled();
});

test("without an Expo project id it says notifications aren't set up", async () => {
  mockProjectId = undefined;
  renderProbe();
  await act(async () => fireEvent.press(screen.getByText("enable")));
  expect(screen.getByText(NOT_SET_UP)).toBeTruthy();
});
