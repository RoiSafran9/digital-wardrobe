import React, { useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { isValidEmail } from "../src/auth/messages";
import { ErrorNote } from "../src/components/ErrorNote";
import { GlassField } from "../src/components/onboarding/GlassField";
import { haptics } from "../src/haptics";
import { useOnboarding } from "../src/onboarding";
import { colors, type } from "../src/theme";
import { BackButton, Button, GlassScreen } from "../src/ui";

// Password sign-in for the App Review demo account, reached by holding the Sign In title.
// Everyone else signs in with an email code; their accounts have no password.
export default function SignInPasswordScreen() {
  const router = useRouter();
  const { signInWithPassword } = useAuth();
  const { noteSignedIn, clearSignedIn } = useOnboarding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = isValidEmail(email) && password.length > 0;

  async function signIn() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    noteSignedIn();  // before signing in: success swaps the whole navigator to the app
    try {
      await signInWithPassword(email, password);
      haptics.success();
    } catch (e) {
      clearSignedIn();
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  return (
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ height: 44, justifyContent: "center" }}>
              <BackButton onPress={() => router.back()} />
            </View>
            <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label, marginTop: 14 }}>Sign in with password</Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 6, marginBottom: 22 }}>
              For demo accounts only. Everyone else signs in with an email code.
            </Text>
            <View style={{ gap: 12 }}>
              <GlassField
                accessibilityLabel="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={(t) => { setError(null); setEmail(t); }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                autoFocus
              />
              <GlassField
                accessibilityLabel="Password"
                placeholder="Password"
                value={password}
                onChangeText={(t) => { setError(null); setPassword(t); }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={signIn}
              />
            </View>
            {error ? <View style={{ marginTop: 14 }}><ErrorNote message={error} /></View> : null}
            <View style={{ marginTop: 18 }}>
              <Button title="Sign In" onPress={signIn} disabled={!ready} loading={busy} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GlassScreen>
  );
}
