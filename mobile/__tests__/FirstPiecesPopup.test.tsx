import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import ClosetScreen from "../app/(tabs)/closet";
import { getItems } from "../src/api/client";
import { AuthContext, type AuthContextValue } from "../src/auth/AuthProvider";
import { POPUP_BODY, POPUP_TITLE } from "../src/components/firstPieces/FirstPiecesPopup";
import { celebratedKey } from "../src/firstPieces/celebrate";

jest.mock("../src/api/client");
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => { const { useEffect } = require("react"); useEffect(() => cb(), [cb]); },
}));

const f = (v: string | string[]) => ({ value: v, confidence: 1, basis: "observed" as const });
const item = (id: string, cat: string) => ({
  run_id: "r", photo_name: "", item_id: id, tier: "high",
  facts: { category: f(cat), colors: f(["blue"]), pattern: f("solid"), visible_text: f(""), trims: f(""), visible_parts: f([]), occluded_parts: f([]) },
  crop_url: "/c.png", generated_url: "/g.png", cutout_url: null, back: null,
});
const auth: AuthContextValue = { status: "signedIn", email: "a@b.c", userId: "u1", sendCode: jest.fn(), verifyCode: jest.fn(),
                                 signInWithPassword: jest.fn(), signOut: jest.fn() } as unknown as AuthContextValue;
const renderCloset = () => render(<AuthContext.Provider value={auth}><ClosetScreen /></AuthContext.Provider>);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (getItems as jest.Mock).mockResolvedValue({ items: [item("old", "coat"), item("n1", "jeans"), item("n2", "sweater")] });
});

test("after a First 3 Pieces round the popup shows the new pieces over the closet, once", async () => {
  mockParams = { celebrate: "1", ids: "n1,n2" };
  renderCloset();
  expect(await screen.findByText(POPUP_TITLE)).toBeTruthy();
  expect(screen.getByText(POPUP_BODY)).toBeTruthy();
  expect(screen.getByTestId("popup-n1", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByTestId("popup-n2", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId("popup-old", { includeHiddenElements: true })).toBeNull();
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Explore My Closet" })));
  expect(await AsyncStorage.getItem(celebratedKey("u1"))).toBe("1");

  screen.unmount();
  renderCloset();
  await act(async () => {});
  expect(screen.queryByText(POPUP_TITLE)).toBeNull();
});

test("Add More goes back to the start of the flow", async () => {
  mockParams = { celebrate: "1", ids: "n1" };
  renderCloset();
  fireEvent.press(await screen.findByRole("button", { name: "Add More" }));
  await act(async () => {});
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/first-pieces", params: { entry: "home" } });
});

test("no popup for an ordinary visit", async () => {
  mockParams = {};
  renderCloset();
  await act(async () => {});
  expect(screen.queryByText(POPUP_TITLE)).toBeNull();
});
