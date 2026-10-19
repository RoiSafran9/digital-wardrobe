// Native modules that have no implementation under Jest.
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);
jest.mock("expo-camera", () => {
  const React = require("react");
  const { View } = require("react-native");
  const CameraView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ takePictureAsync: global.__takePicture ?? (async () => ({ uri: "file:///camera.jpg" })) }));
    return React.createElement(View, { testID: "camera-view", ...props });
  });
  return {
    CameraView,
    useCameraPermissions: () => global.__cameraPermission ?? [{ granted: true, canAskAgain: true }, async () => ({ granted: true })],
  };
});
