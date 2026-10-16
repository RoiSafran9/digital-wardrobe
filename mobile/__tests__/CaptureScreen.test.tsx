import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import CaptureScreen from "../app/add";
import { LastRunProvider } from "../src/store/lastRun";
import * as ImagePicker from "expo-image-picker";
import { postRun } from "../src/api/client";

jest.mock("expo-image-picker");
jest.mock("../src/api/client");
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const mockedPicker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const mockedPostRun = postRun as jest.Mock;

function renderScreen() {
  return render(
    <LastRunProvider>
      <CaptureScreen />
    </LastRunProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("shows a permission-denied message and never uploads when permission is refused", async () => {
  mockedPicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as any);
  renderScreen();

  fireEvent.press(screen.getByText("Take photo"));

  await waitFor(() => screen.getByText(/permission denied/i));
  expect(mockedPostRun).not.toHaveBeenCalled();
});

test("does nothing when the user cancels the picker", async () => {
  mockedPicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as any);
  mockedPicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] } as any);
  renderScreen();

  fireEvent.press(screen.getByText("Choose from library"));

  await waitFor(() => expect(mockedPostRun).not.toHaveBeenCalled());
});

test("uploads the picked photo and shows an error message on failure", async () => {
  mockedPicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as any);
  mockedPicker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///fake.jpg" }],
  } as any);
  mockedPostRun.mockRejectedValue(new Error("can't reach server — check WiFi/IP"));

  renderScreen();
  fireEvent.press(screen.getByText("Choose from library"));

  await waitFor(() => screen.getByText("can't reach server — check WiFi/IP"));
});

test("asks the library picker for a JPEG-compatible file so HEIC photos upload", async () => {
  // The backend cannot decode HEIC, which is what iOS gallery photos are by default.
  mockedPicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as any);
  mockedPicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] } as any);
  renderScreen();

  fireEvent.press(screen.getByText("Choose from library"));

  await waitFor(() =>
    expect(mockedPicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ preferredAssetRepresentationMode: "compatible" })
    )
  );
});

test("explains how to shoot before the first photo", () => {
  renderScreen();
  expect(screen.getByText("Lay it flat")).toBeTruthy();
  expect(screen.getByText("Shoot from above")).toBeTruthy();
  expect(screen.getByText("A few at once works")).toBeTruthy();
});
