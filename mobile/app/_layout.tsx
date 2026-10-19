import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth/AuthProvider";
import { CreditsProvider } from "../src/credits/CreditsProvider";
import { AppShell } from "../src/RootNavigator";
import { ToastProvider } from "../src/ui";

export default function RootLayout() {
  return (
    <AuthProvider>
      <CreditsProvider>
        <ToastProvider>
          <StatusBar style="auto" />
          <AppShell />
        </ToastProvider>
      </CreditsProvider>
    </AuthProvider>
  );
}
