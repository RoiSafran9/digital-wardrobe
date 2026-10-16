import { ActionSheetIOS } from "react-native";

// Stand-in for the iOS action sheet: records the options and lets a test tap one.
export function mockActionSheet() {
  const spy = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation(() => {});
  return {
    spy,
    async choose(label: string) {
      const [config, callback] = spy.mock.calls[spy.mock.calls.length - 1];
      await callback(config.options.indexOf(label));
    },
  };
}
