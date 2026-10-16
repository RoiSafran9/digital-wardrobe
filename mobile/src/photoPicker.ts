import * as ImagePicker from "expo-image-picker";

// Ask for access, open the camera or library, and return the photo's uri (null if cancelled).
// Throws a readable error when access is denied.
export async function pickPhoto(fromCamera: boolean): Promise<string | null> {
  const permission = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("permission denied — enable camera/photos access in Settings");
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
