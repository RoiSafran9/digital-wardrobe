import React from "react";
import { Text, View } from "react-native";
import { track } from "../activity/track";
import { colors, type } from "../theme";
import { Button } from "./Button";

// A screen that crashes while drawing shows this instead of a blank app, and the error's kind is
// recorded (client_error) — never its message or stack, which can hold the user's text.
type State = { failed: boolean };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(): void {
    track("client_error", { where: "global", kind: "render" });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 24, gap: 14 }}>
        <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>Something went wrong</Text>
        <Text style={{ ...type.body, color: colors.secondaryLabel }}>Your closet is safe. Try again.</Text>
        <Button title="Try Again" onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler(): GlobalHandler; setGlobalHandler(handler: GlobalHandler): void };

// Uncaught JavaScript errors outside rendering: recorded, then handed to React Native's own handler.
export function reportUncaughtErrors(utils: ErrorUtilsLike | undefined = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils): void {
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    track("client_error", { where: "global", kind: "unhandled" });
    previous(error, isFatal);
  });
}
