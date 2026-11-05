import React from "react";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import FirstPiecesStart, { START_TITLE, TYPE_QUESTION } from "../app/first-pieces";
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

const LAID_OUT = "Clothes by themselves. Laid out, hanging, or shoes together.";
const WORN = "Someone wearing them. A person wearing the clothes or shoes.";

test("asks what the photos show, in the Add tab's words; clothes by themselves go to the photo tray", async () => {
  await renderStart();
  expect(screen.getByRole("header", { name: START_TITLE })).toBeTruthy();
  expect(screen.getByRole("header", { name: TYPE_QUESTION })).toBeTruthy();
  expect(screen.queryByText(/near your wardrobe/)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: LAID_OUT }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/first-pieces/photos", params: { entry: "auto" } });
});

test("someone wearing them: Take Photo or Choose from Library, in onboarding mode, never the laid-out tray", async () => {
  (pickPhoto as jest.Mock).mockResolvedValue("file:///outfit.jpg");
  await renderStart();
  expect(screen.queryByRole("button", { name: "Take Photo" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: WORN }));
  await fireEvent.press(screen.getByRole("button", { name: "Take Photo" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/capture/camera", params: { mode: "outfit", onboarding: "1" } });
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose from Library" })));
  expect(pickPhoto).toHaveBeenCalledWith(false);
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/outfit/detect", params: { uri: "file:///outfit.jpg", onboarding: "1" } });
  expect(mockPush).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: "/first-pieces/photos" }));
});

test("a cancelled library stays put; refused access says why", async () => {
  (pickPhoto as jest.Mock).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("permission denied — enable camera/photos access in Settings"));
  await renderStart();
  await fireEvent.press(screen.getByRole("button", { name: WORN }));
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose from Library" })));
  expect(mockPush).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose from Library" })));
  expect(screen.getByText(/permission denied/)).toBeTruthy();
});

test("without the outfit feature only clothes by themselves is offered", async () => {
  await renderStart({ outfit: false });
  expect(screen.queryByText(TYPE_QUESTION)).toBeNull();
  expect(screen.queryByRole("button", { name: WORN })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: LAID_OUT }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/first-pieces/photos", params: { entry: "auto" } });
});

test("paused generation says so; close leaves", async () => {
  await renderStart({ generation: false });
  expect(screen.getByText("New images are paused")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
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
  await render(<Gate {...ready} open={open} />);
  await act(async () => {});
  expect(open).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem(offeredKey("u1"))).toBe("1");
  await screen.unmount();
  const again = jest.fn();
  await render(<Gate {...ready} open={again} />);
  await act(async () => {});
  expect(again).not.toHaveBeenCalled();
});

test("an account with pieces (any device) or waiting results is never offered it", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [{ item_id: "i1" }] });
  (getPendingItems as jest.Mock).mockResolvedValue([]);
  const open = jest.fn();
  await render(<Gate {...ready} open={open} />);
  await act(async () => {});
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  (getPendingItems as jest.Mock).mockResolvedValue([{ item_id: "p1" }]);
  await render(<Gate {...ready} userId="u2" open={open} />);
  await act(async () => {});
  expect(open).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(offeredKey("u1"))).toBeNull();
});

test("it waits for the name, the starter decision and the server's settings", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  (getPendingItems as jest.Mock).mockResolvedValue([]);
  const open = jest.fn();
  const { rerender } = await render(<Gate {...ready} starterDecided={false} open={open} />);
  await rerender(<Gate {...ready} named={false} open={open} />);
  await rerender(<Gate {...ready} loaded={false} open={open} />);
  await rerender(<Gate {...ready} signedIn={false} open={open} />);
  await act(async () => {});
  expect(getItems).not.toHaveBeenCalled();
  await rerender(<Gate {...ready} open={open} />);
  await act(async () => {});
  expect(open).toHaveBeenCalledTimes(1);
});
