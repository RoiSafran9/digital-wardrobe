import { Alert, type AlertButton } from "react-native";

// Taps a button on the most recent (spied) Alert.alert.
export function pressAlertButton(label: string) {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const buttons: AlertButton[] = calls[calls.length - 1][2] ?? [];
  const button = buttons.find((b) => b.text === label);
  if (!button) throw new Error(`No alert button "${label}"`);
  button.onPress?.();
}
