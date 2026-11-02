import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts, InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif";
import { AuthProvider } from "../src/auth/AuthProvider";
import { CreditsProvider } from "../src/credits/CreditsProvider";
import { AppShell } from "../src/RootNavigator";
import { colors } from "../src/theme";
import { ToastProvider } from "../src/ui";
import { AppearanceProvider } from "../src/appearance";
import { ProfileProvider } from "../src/profile";
import { NotifyProvider } from "../src/notifications";
import { ErrorBoundary, reportUncaughtErrors } from "../src/ui/ErrorBoundary";

reportUncaughtErrors();

// Expo Router 58's Stack.Protected guards fall back to the shortest unguarded route name when a URL
// doesn't match (see https://docs.expo.dev/router/advanced/protected/). Anchoring on "welcome" keeps
// signed-out landings there instead of skipping ahead to "intro".
export const unstable_settings = { anchor: "welcome" };

export default function RootLayout() {
  // Instrument Serif, for the editorial headlines only. If it fails to load, iOS falls back to the
  // system font, so a font error never blocks the app.
  const [fontsLoaded, fontError] = useFonts({ InstrumentSerif_400Regular });
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <AppearanceProvider>
      <AuthProvider>
        <CreditsProvider>
          <ProfileProvider>
            <NotifyProvider>
              <ToastProvider>
                <StatusBar style="auto" />
                <ErrorBoundary>
                  <AppShell />
                </ErrorBoundary>
              </ToastProvider>
            </NotifyProvider>
          </ProfileProvider>
        </CreditsProvider>
      </AuthProvider>
    </AppearanceProvider>
  );
}
