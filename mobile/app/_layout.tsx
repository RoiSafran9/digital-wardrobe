import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth/AuthProvider";
import { AppShell } from "../src/RootNavigator";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <AppShell />
    </AuthProvider>
  );
}
