import React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { useAuth } from "./auth/AuthProvider";
import { NotConfigured } from "./components/NotConfigured";
import { LastRunProvider } from "./store/lastRun";
import { colors } from "./theme";

// Signed-in (or local-mode) people see the tabs; everyone else only Sign In.
export function RootNavigator() {
  const { status, reason } = useAuth();
  if (status === "loading") return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (status === "unconfigured") return <NotConfigured reason={reason ?? ""} />;
  const inApp = status === "signedIn" || status === "local";
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={inApp}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!inApp}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

// Per-user app state starts fresh whenever the signed-in person changes.
export function AppShell() {
  const { userId } = useAuth();
  return (
    <LastRunProvider key={userId ?? "local"}>
      <RootNavigator />
    </LastRunProvider>
  );
}
