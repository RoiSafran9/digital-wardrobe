import React, { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { isValidEmail, normalizeEmail } from "../src/auth/messages";
import { ErrorNote } from "../src/components/ErrorNote";
import { GlassField } from "../src/components/onboarding/GlassField";
import { colors, type } from "../src/theme";
import { BackButton, Button, GlassScreen } from "../src/ui";

// Step 1 of sign-in: the email. Step 2 (the code) is app/sign-in-code.tsx.
export default function SignInScreen() {
  const router = useRouter();
  const { sendCode } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = isValidEmail(email);

  async function send() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendCode(email);
      router.push({ pathname: "/sign-in-code", params: { email: normalizeEmail(email), sentAt: String(Date.now()) } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ height: 44, justifyContent: "center" }}>
              {router.canGoBack() ? <BackButton onPress={() => router.back()} /> : null}
            </View>
            {/* Holding the title opens password sign-in, for the App Review demo account (see docs/DEPLOY.md). */}
            <Pressable accessible={false} onLongPress={() => router.push("/sign-in-password")} delayLongPress={1000}>
              <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label, marginTop: 14 }}>Sign in with email</Text>
            </Pressable>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 6, marginBottom: 22 }}>
              We'll send you a six-digit code. No password needed.
            </Text>
            <GlassField
              accessibilityLabel="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              autoFocus
              onSubmitEditing={send}
            />
            {error ? <View style={{ marginTop: 14 }}><ErrorNote message={error} /></View> : null}
            <View style={{ marginTop: 18, gap: 14 }}>
              <Button title="Continue" onPress={send} disabled={!valid} loading={busy} />
              <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center", paddingHorizontal: 20 }}>
                By continuing you agree to the Terms and acknowledge the Privacy Policy.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GlassScreen>
  );
}
