import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import CaptureScreen from "../app/(tabs)/add";
import { LastRunProvider } from "../src/store/lastRun";
import * as ImagePicker from "expo-image-picker";
import { postRun } from "../src/api/client";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";

jest.mock("expo-image-picker");
jest.mock("../src/api/client");
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }), useLocalSearchParams: () => ({}) }));

const mockedPicker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const mockedPostRun = postRun as jest.Mock;

function renderScreen(credits?: Partial<CreditsValue>) {
  const value: CreditsValue = { billing: false, prices: {}, credits: null, refresh: jest.fn(async () => {}), ...credits };
  render(
    <CreditsContext.Provider value={value}>
      <LastRunProvider>
        <CaptureScreen />
      </LastRunProvider>
    </CreditsContext.Provider>
  );
  return value;
}

const BILLING = { billing: true, prices: { garment: 1, back: 1, turn: 3 } };
const wallet = (available: number) => ({ balance: available, held: 0, available, granted: 10, used: 0, entries: [], next_before: null });

function pickFromLibrary() {
  mockedPicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as any);
  mockedPicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///fake.jpg" }] } as any);
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

test("billing off: no piece picker, and the photo goes up without a front limit", async () => {
  pickFromLibrary();
  mockedPostRun.mockResolvedValue({ run_id: "r", quality: { status: "ok", reason: null }, items: [], failed: [] });
  renderScreen();
  expect(screen.queryByText("Pieces in this photo")).toBeNull();
  fireEvent.press(screen.getByText("Choose from library"));
  await waitFor(() => expect(mockedPostRun).toHaveBeenCalledWith("file:///fake.jpg", undefined));
});

test("billing on: the user picks how many fronts to pay for, and that goes to the server", async () => {
  pickFromLibrary();
  mockedPostRun.mockResolvedValue({ run_id: "r", quality: { status: "ok", reason: null }, items: [], failed: [] });
  const credits = renderScreen({ ...BILLING, credits: wallet(3) });
  expect(screen.getByText(/Up to 1 front image · 1 credit · 3 available/)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "More pieces" }));
  fireEvent.press(screen.getByRole("button", { name: "More pieces" }));
  expect(screen.getByText(/Up to 3 front images · 3 credits/)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "More pieces" }));  // can't afford a 4th
  expect(screen.getByLabelText("3 pieces")).toBeTruthy();
  fireEvent.press(screen.getByText("Choose from library"));
  await waitFor(() => expect(mockedPostRun).toHaveBeenCalledWith("file:///fake.jpg", 3));
  await waitFor(() => expect(credits.refresh).toHaveBeenCalled());
});

test("billing on with no credits: capture is off and says how to get more", () => {
  renderScreen({ ...BILLING, credits: wallet(0) });
  expect(screen.getByText(/Not enough AI credits for a photo/)).toBeTruthy();
  expect(screen.getByText(/Ask the app owner for more credits/)).toBeTruthy();
  fireEvent.press(screen.getByText("Take photo"));
  expect(mockedPostRun).not.toHaveBeenCalled();
});
