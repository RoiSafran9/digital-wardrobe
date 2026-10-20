import * as ImagePicker from "expo-image-picker";
import { pickPhotos } from "../src/photoPicker";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: "compatible" },
}));
const permission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const library = ImagePicker.launchImageLibraryAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

test("several library photos come back in the order picked, as JPEG-compatible files", async () => {
  permission.mockResolvedValue({ granted: true });
  library.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///a.jpg" }, { uri: "file:///b.jpg" }] });
  expect(await pickPhotos()).toEqual(["file:///a.jpg", "file:///b.jpg"]);
  expect(library).toHaveBeenCalledWith(expect.objectContaining({
    allowsMultipleSelection: true, selectionLimit: 0, preferredAssetRepresentationMode: "compatible",
  }));
});

test("cancelling picks nothing", async () => {
  permission.mockResolvedValue({ granted: true });
  library.mockResolvedValue({ canceled: true, assets: null });
  expect(await pickPhotos()).toEqual([]);
});

test("refused access says how to fix it", async () => {
  permission.mockResolvedValue({ granted: false });
  await expect(pickPhotos()).rejects.toThrow(/enable camera\/photos access in Settings/);
  expect(library).not.toHaveBeenCalled();
});
