import React from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import CameraScreen from "../app/capture/camera";
import FirstPiecesPhotos from "../app/first-pieces/photos";
import { FirstPiecesProvider, useFirstPieces } from "../src/firstPieces/FirstPiecesProvider";
import { pickPhotos } from "../src/photoPicker";
import { pressAlertButton } from "./helpers/alert";

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock("../src/photoPicker", () => ({ pickPhoto: jest.fn(), pickPhotos: jest.fn() }));
jest.mock("../src/api/client", () => ({}));

let fp: ReturnType<typeof useFirstPieces>;
function Probe() { fp = useFirstPieces(); return null; }
const inFlow = (ui: React.ReactElement) => render(<FirstPiecesProvider userId="u1">{ui}<Probe /></FirstPiecesProvider>);

beforeEach(async () => { jest.clearAllMocks(); mockParams = {}; await AsyncStorage.clear(); jest.spyOn(Alert, "alert"); });

test("an empty tray can't look for pieces yet; library photos join it", async () => {
  (pickPhotos as jest.Mock).mockResolvedValue(["file:///a.jpg", "file:///b.jpg"]);
  inFlow(<FirstPiecesPhotos />);
  expect(screen.getByText("No photos yet")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Find My Pieces" })).toBeDisabled();
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose Garment Photos" })));
  expect(screen.getByLabelText("Photo 2")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Find My Pieces" }));
  expect(mockPush).toHaveBeenCalledWith("/first-pieces/pick");
});

test("a photo can be removed; leaving with photos asks first and forgets them", async () => {
  (pickPhotos as jest.Mock).mockResolvedValue(["file:///a.jpg", "file:///b.jpg"]);
  inFlow(<FirstPiecesPhotos />);
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose Garment Photos" })));
  fireEvent.press(screen.getByRole("button", { name: "Remove photo 1" }));
  expect(fp.photos.map((p) => p.uri)).toEqual(["file:///b.jpg"]);
  fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(Alert.alert).toHaveBeenCalledWith("Leave?", "Your photos won't be kept.", expect.any(Array));
  act(() => pressAlertButton("Leave"));
  expect(fp.photos).toEqual([]);
  expect(mockBack).toHaveBeenCalled();
});

test("refused photo access says how to fix it", async () => {
  (pickPhotos as jest.Mock).mockRejectedValue(new Error("permission denied — enable camera/photos access in Settings"));
  inFlow(<FirstPiecesPhotos />);
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose Garment Photos" })));
  expect(screen.getByText(/enable camera\/photos access/)).toBeTruthy();
});

test("the camera in collect mode adds each shot to the tray and stays open until Done", async () => {
  mockParams = { mode: "garments", collect: "1" };
  inFlow(<CameraScreen />);
  expect(screen.getByText("Take as many photos as you like")).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Take garment photo" })));
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Take garment photo" })));
  expect(fp.photos).toHaveLength(2);
  expect(screen.getByText("2 photos added · keep going or tap Done")).toBeTruthy();
  expect(mockBack).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole("button", { name: "Done, 2 photos" }));
  expect(mockBack).toHaveBeenCalled();
});

test("with the camera refused, collect mode still adds library photos", async () => {
  mockParams = { mode: "garments", collect: "1" };
  (global as Record<string, unknown>).__cameraPermission = [{ granted: false, canAskAgain: false }, async () => ({ granted: false })];
  (pickPhotos as jest.Mock).mockResolvedValue(["file:///a.jpg"]);
  try {
    inFlow(<CameraScreen />);
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Choose Garment Photos" })));
    expect(fp.photos).toHaveLength(1);
    expect(mockBack).toHaveBeenCalled();
  } finally {
    delete (global as Record<string, unknown>).__cameraPermission;
  }
});
