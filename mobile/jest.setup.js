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
// jest-expo's native image-size mock expects a callback RN no longer passes; answer like the real one.
require("react-native").Image.getSize = jest.fn((uri, success) => { if (success) success(300, 400); return Promise.resolve({ width: 300, height: 400 }); });
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[test]" })),
  // Local scheduling (the morning reminder): nothing pending unless a test schedules it.
  scheduleNotificationAsync: jest.fn(async () => "local-1"),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  DEFAULT_ACTION_IDENTIFIER: "expo.modules.notifications.actions.DEFAULT",
  SchedulableTriggerInputTypes: { DATE: "date", TIME_INTERVAL: "timeInterval", CALENDAR: "calendar", DAILY: "daily" },
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
}));
// expo-image has no native view under Jest: draw a plain Image with the same source and error callback.
jest.mock("expo-image", () => {
  const React = require("react");
  const { Image } = require("react-native");
  const ExpoImage = ({ source, onError, contentFit, cachePolicy, recyclingKey, transition, ...rest }) =>
    React.createElement(Image, { ...rest, source, onError, resizeMode: contentFit });
  ExpoImage.prefetch = jest.fn(async () => true);
  return { Image: ExpoImage };
});
