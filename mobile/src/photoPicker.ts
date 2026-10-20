import * as ImagePicker from "expo-image-picker";

// Ask for access, open the camera or library, and return the photo's uri (null if cancelled).
// Throws a readable error when access is denied.
const DENIED = "permission denied — enable camera/photos access in Settings";

export async function pickPhoto(fromCamera: boolean): Promise<string | null> {
  const permission = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(DENIED);
  }

  const result = fromCamera
    ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
    : await ImagePicker.launchImageLibraryAsync({
        quality: 0.8,
        // iOS gallery photos are HEIC; the backend can only decode JPEG/PNG.
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  return result.assets[0].uri;
}

// Several photos from the library at once (no limit); [] if cancelled. Same access rules and JPEG
// conversion as pickPhoto.
export async function pickPhotos(): Promise<string[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error(DENIED);
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.8,
    allowsMultipleSelection: true,
    selectionLimit: 0,
    orderedSelection: true,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => a.uri);
}
