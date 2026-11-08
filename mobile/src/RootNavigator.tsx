import React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { useAuth } from "./auth/AuthProvider";
import { NotConfigured } from "./components/NotConfigured";
import { CaptureJobsProvider } from "./store/captureJobs";
import { FirstPiecesProvider } from "./firstPieces/FirstPiecesProvider";
import { OutfitJobsProvider } from "./jobs/OutfitJobsProvider";
import { useWakeOnForeground } from "./api/wake";
import { OnboardingProvider } from "./onboarding";
import { MorningReminderProvider } from "./morningReminder/MorningReminderProvider";
import { MorningReminderTaps } from "./morningReminder/MorningReminderTaps";
import { colors } from "./theme";

// Signed-in (or local-mode) people see the tabs; everyone else only Sign In.
export function RootNavigator() {
  const { status, reason } = useAuth();
  if (status === "loading") return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (status === "unconfigured") return <NotConfigured reason={reason ?? ""} />;
  const inApp = status === "signedIn" || status === "local";
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* A blocked route goes to Welcome (signed out) or the tabs (signed in); expo-router 58 would otherwise
          pick the first accessible route, which is no longer the first declared one. */}
      <Stack.Protected guard={inApp} redirectTo="/welcome">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="capture/camera" options={{ presentation: "fullScreenModal", animation: "fade" }} />
        <Stack.Screen name="capture/preview" />
        <Stack.Screen name="capture/processing" options={{ gestureEnabled: false }} />
        <Stack.Screen name="capture/results" options={{ gestureEnabled: false }} />
        <Stack.Screen name="capture/saved" options={{ gestureEnabled: false }} />
        <Stack.Screen name="first-pieces/index" />
        <Stack.Screen name="first-pieces/photos" />
        <Stack.Screen name="first-pieces/pick" />
        <Stack.Screen name="first-pieces/processing" options={{ gestureEnabled: false }} />
        <Stack.Screen name="outfit/detect" />
        <Stack.Screen name="outfit/pick" />
        <Stack.Screen name="outfit/progress" options={{ gestureEnabled: false }} />
        <Stack.Screen name="outfit/review" />
        <Stack.Screen name="jobs" />
        <Stack.Screen name="help" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="your-name" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
        <Stack.Screen name="welcome-credits" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
      </Stack.Protected>
      {/* Signed out: Welcome comes first; it forwards to Sign In once onboarding was seen. */}
      <Stack.Protected guard={!inApp} redirectTo="/">
        <Stack.Screen name="welcome" />
        <Stack.Screen name="intro" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-in-code" />
        <Stack.Screen name="sign-in-password" />
      </Stack.Protected>
    </Stack>
  );
}

// Per-user app state (captures, the First 3 Pieces round, outfit photo jobs) starts fresh whenever the signed-in
// person changes: each provider is keyed by user and reads only that account's stored jobs, so signing out or
// switching accounts clears the previous account's jobs from view (they stay stored for that account only).
// The morning reminder is not keyed: it has to see the account change to cancel the previous one's reminder.
export function AppShell() {
  const { userId } = useAuth();
  useWakeOnForeground();  // back in the app: every job follower checks the server at once
  return (
    <OnboardingProvider>
      <MorningReminderProvider>
        <MorningReminderTaps />
        <CaptureJobsProvider key={userId ?? "local"} userId={userId}>
          <FirstPiecesProvider key={userId ?? "local"} userId={userId}>
            <OutfitJobsProvider key={userId ?? "local"} userId={userId}>
              <RootNavigator />
            </OutfitJobsProvider>
          </FirstPiecesProvider>
        </CaptureJobsProvider>
      </MorningReminderProvider>
    </OnboardingProvider>
  );
}
