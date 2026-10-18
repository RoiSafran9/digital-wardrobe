import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth/AuthProvider";
import { CreditsProvider } from "../src/credits/CreditsProvider";
import { AppShell } from "../src/RootNavigator";

export default function RootLayout() {
  return (
    <AuthProvider>
      <CreditsProvider>
        <StatusBar style="auto" />
        <AppShell />
      </CreditsProvider>
    </AuthProvider>
  );
}
