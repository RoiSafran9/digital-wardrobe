import React from "react";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import FirstPiecesStart, { NEAR_QUESTION, START_TITLE } from "../app/first-pieces";
import { getItems, getPendingItems } from "../src/api/client";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import { offeredKey, useFirstPiecesOffer } from "../src/firstPieces/offer";
import { pickPhoto } from "../src/photoPicker";

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ entry: "auto" }),
}));
jest.mock("../src/photoPicker", () => ({ pickPhoto: jest.fn() }));
jest.mock("../src/api/client", () => ({ getItems: jest.fn(), getPendingItems: jest.fn() }));

function renderStart(value: Partial<CreditsValue> = {}) {
  const full: CreditsValue = { billing: true, prices: { garment: 1 }, credits: null, outfit: true, generation: true, refresh: jest.fn(async () => {}), ...value };
  return render(<CreditsContext.Provider value={full}><FirstPiecesStart /></CreditsContext.Provider>);
}

beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

test("asks whether you're near your wardrobe; near goes to the photo tray", () => {
  renderStart();
  expect(screen.getByRole("header", { name: START_TITLE })).toBeTruthy();
  expect(screen.getByText(NEAR_QUESTION)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Yes, I'm near it" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/first-pieces/photos", params: { entry: "auto" } });
});

test("not near: an outfit photo from the camera or the library, in onboarding mode", async () => {
  (pickPhoto as jest.Mock).mockResolvedValue("file:///outfit.jpg");
  renderStart();
  expect(screen.queryByRole("button", { name: "Take Outfit Photo" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Not right now" }));
  fireEvent.press(screen.getByRole("button", { name: "Take Outfit Photo" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/capture/camera", params: { mode: "outfit", onboarding: "1" } });
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose Outfit Photo" })));
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/outfit/detect", params: { uri: "file:///outfit.jpg", flow: "outfit", onboarding: "1" } });
});

test("without the outfit feature there is no question, only the garment path", () => {
  renderStart({ outfit: false });
  expect(screen.queryByText(NEAR_QUESTION)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Get Started" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/first-pieces/photos", params: { entry: "auto" } });
});

test("paused generation says so; close leaves", () => {
  renderStart({ generation: false });
  expect(screen.getByText("New images are paused")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(mockBack).toHaveBeenCalled();
});

type Input = Parameters<typeof useFirstPiecesOffer>[0];
function Gate(props: Input) {
  useFirstPiecesOffer(props);
  return <Text>gate</Text>;
}
const ready: Omit<Input, "open"> = { userId: "u1", signedIn: true, named: true, starterDecided: true, generation: true, loaded: true, inflight: false };

test("a new account with an empty closet is offered the flow once", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  (getPendingItems as jest.Mock).mockResolvedValue([]);
  const open = jest.fn();
  render(<Gate {...ready} open={open} />);
  await act(async () => {});
  expect(open).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem(offeredKey("u1"))).toBe("1");
  screen.unmount();
  const again = jest.fn();
  render(<Gate {...ready} open={again} />);
  await act(async () => {});
  expect(again).not.toHaveBeenCalled();
});

test("an account with pieces (any device) or waiting results is never offered it", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [{ item_id: "i1" }] });
  (getPendingItems as jest.Mock).mockResolvedValue([]);
  const open = jest.fn();
  render(<Gate {...ready} open={open} />);
  await act(async () => {});
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  (getPendingItems as jest.Mock).mockResolvedValue([{ item_id: "p1" }]);
  render(<Gate {...ready} userId="u2" open={open} />);
  await act(async () => {});
  expect(open).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(offeredKey("u1"))).toBeNull();
});

test("it waits for the name, the starter decision and the server's settings", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  (getPendingItems as jest.Mock).mockResolvedValue([]);
  const open = jest.fn();
  const { rerender } = render(<Gate {...ready} starterDecided={false} open={open} />);
  rerender(<Gate {...ready} named={false} open={open} />);
  rerender(<Gate {...ready} loaded={false} open={open} />);
  rerender(<Gate {...ready} signedIn={false} open={open} />);
  await act(async () => {});
  expect(getItems).not.toHaveBeenCalled();
  rerender(<Gate {...ready} open={open} />);
  await act(async () => {});
  expect(open).toHaveBeenCalledTimes(1);
});
