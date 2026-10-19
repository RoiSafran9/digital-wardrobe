import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts, InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif";
import { AuthProvider } from "../src/auth/AuthProvider";
import { CreditsProvider } from "../src/credits/CreditsProvider";
import { AppShell } from "../src/RootNavigator";
import { colors } from "../src/theme";
import { ToastProvider } from "../src/ui";
import { AppearanceProvider } from "../src/appearance";

export default function RootLayout() {
  // Instrument Serif, for the editorial headlines only. If it fails to load, iOS falls back to the
  // system font, so a font error never blocks the app.
  const [fontsLoaded, fontError] = useFonts({ InstrumentSerif_400Regular });
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <AppearanceProvider>
      <AuthProvider>
        <CreditsProvider>
          <ToastProvider>
            <StatusBar style="auto" />
            <AppShell />
          </ToastProvider>
        </CreditsProvider>
      </AuthProvider>
    </AppearanceProvider>
  );
}
