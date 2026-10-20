import React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { useAuth } from "./auth/AuthProvider";
import { NotConfigured } from "./components/NotConfigured";
import { CaptureJobsProvider } from "./store/captureJobs";
import { FirstPiecesProvider } from "./firstPieces/FirstPiecesProvider";
import { OnboardingProvider } from "./onboarding";
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
        <Stack.Screen name="capture/camera" options={{ presentation: "fullScreenModal", animation: "fade" }} />
        <Stack.Screen name="capture/preview" />
        <Stack.Screen name="capture/processing" options={{ gestureEnabled: false }} />
        <Stack.Screen name="capture/results" options={{ gestureEnabled: false }} />
        <Stack.Screen name="capture/saved" options={{ gestureEnabled: false }} />
        <Stack.Screen name="outfit/detect" />
        <Stack.Screen name="outfit/pick" />
        <Stack.Screen name="outfit/review" />
        <Stack.Screen name="help" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="your-name" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
        <Stack.Screen name="welcome-credits" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
      </Stack.Protected>
      {/* Signed out: Welcome comes first; it forwards to Sign In once onboarding was seen. */}
      <Stack.Protected guard={!inApp}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="intro" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-in-code" />
        <Stack.Screen name="sign-in-password" />
      </Stack.Protected>
    </Stack>
  );
}

// Per-user app state (the capture in progress, the First 3 Pieces round) starts fresh whenever the signed-in person changes.
export function AppShell() {
  const { userId } = useAuth();
  return (
    <OnboardingProvider>
      <CaptureJobsProvider key={userId ?? "local"}>
        <FirstPiecesProvider key={userId ?? "local"} userId={userId}>
          <RootNavigator />
        </FirstPiecesProvider>
      </CaptureJobsProvider>
    </OnboardingProvider>
  );
}
