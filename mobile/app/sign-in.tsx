import React, { useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { isValidEmail, normalizeEmail } from "../src/auth/messages";
import { ErrorNote } from "../src/components/ErrorNote";
import { colors, radius, type } from "../src/theme";
import { BackButton, Button } from "../src/ui";

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ height: 44, justifyContent: "center" }}>
            {router.canGoBack() ? <BackButton onPress={() => router.back()} /> : null}
          </View>
          <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label, marginTop: 12 }}>Sign in with email</Text>
          <Text style={{ ...type.body, color: colors.secondaryLabel, marginTop: 8, marginBottom: 28 }}>
            We'll send you a six-digit code. No password needed.
          </Text>
          <TextInput
            accessibilityLabel="Email"
            placeholder="you@example.com"
            placeholderTextColor={colors.tertiaryLabel}
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
            style={{
              ...type.body, color: colors.label, backgroundColor: colors.grouped, height: 56, borderRadius: radius.button,
              paddingHorizontal: 16, borderWidth: 1.5, borderColor: valid ? colors.tint : "transparent",
            }}
          />
          {error ? <View style={{ marginTop: 14 }}><ErrorNote message={error} /></View> : null}
          <View style={{ flex: 1, minHeight: 24 }} />
          <View style={{ gap: 14 }}>
            <Button title="Continue" onPress={send} disabled={!valid} loading={busy} />
            <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center", paddingHorizontal: 20 }}>
              By continuing you agree to the Terms and acknowledge the Privacy Policy.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
