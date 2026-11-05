import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  useFonts, BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
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

export default function RootLayout() {
  // Bricolage Grotesque, the app's one family. If it fails to load, iOS falls back to the system font,
  // so a font error never blocks the app.
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
  });
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
